begin;
create extension if not exists pgtap with schema extensions;
select plan(33);
set constraints all deferred;

insert into auth.users(id) values('11111111-1111-4111-8111-111111111111') on conflict do nothing;
insert into private.admin_accounts(user_id)
select '11111111-1111-4111-8111-111111111111'
where not exists(select 1 from private.admin_accounts);
select set_config('request.jwt.claims',jsonb_build_object(
  'sub',(select user_id from private.admin_accounts limit 1),
  'role','authenticated','aal','aal2'
)::text,true);

create temporary table publication_context(
  competition_id bigint,
  future_competition_id bigint,
  matchup_id bigint,
  entry_one bigint,
  entry_two bigint,
  reg_one bigint,
  reg_two bigint,
  game_id bigint,
  publication_one bigint,
  publication_two bigint,
  publication_three bigint
);
grant select,update on publication_context to authenticated;
grant select on publication_context to anon;

with series as(
  insert into public.competition_series(name,slug)
  values('MVP04 publish','mvp04-publish') returning id
), category as(
  insert into public.categories(name,slug)
  values('MVP04 publish','mvp04-publish') returning id
)
insert into publication_context(competition_id,future_competition_id)
select
  public.admin_create_competition_from_preset(gen_random_uuid(),jsonb_build_object(
    'seriesId',series.id,'categoryId',category.id,'year',2025,
    'name','Versioned publication QA','gender','male','source','manual_scoresheet',
    'preset','single_group','entryCount',2,'reviewed',true,'expectedProfileId',null,
    'startsOn','2025-01-01','endsOn','2025-12-31'
  )),
  public.admin_create_competition_from_preset(gen_random_uuid(),jsonb_build_object(
    'seriesId',series.id,'categoryId',category.id,'year',2027,
    'name','Future publication QA','gender','female','source','manual_scoresheet',
    'preset','single_group','entryCount',2,'reviewed',true,'expectedProfileId',null,
    'startsOn','2027-01-01','endsOn','2027-12-31'
  ))
from series,category;

insert into public.teams(name,slug)
values('Publish team one','mvp04-publish-team-1'),('Publish team two','mvp04-publish-team-2');
insert into public.team_registrations(competition_id,team_id,status,confirmed_at)
select context.competition_id,team.id,'confirmed',now()
from publication_context context
join public.teams team on team.slug like 'mvp04-publish-team-%';
update publication_context context set
  matchup_id=(select id from public.matchups where competition_id=context.competition_id),
  entry_one=(select id from public.competition_entries where competition_id=context.competition_id and seed=1),
  entry_two=(select id from public.competition_entries where competition_id=context.competition_id and seed=2),
  reg_one=(select registration.id from public.team_registrations registration join public.teams team on team.id=registration.team_id where registration.competition_id=context.competition_id and team.slug='mvp04-publish-team-1'),
  reg_two=(select registration.id from public.team_registrations registration join public.teams team on team.id=registration.team_id where registration.competition_id=context.competition_id and team.slug='mvp04-publish-team-2');

set local role authenticated;
select lives_ok($$select public.admin_assign_competition_entry(entry_one,reg_one) from publication_context$$,
  'first explicit entry is assigned');
select lives_ok($$select public.admin_assign_competition_entry(entry_two,reg_two) from publication_context$$,
  'second explicit entry is assigned');
select ok((select (public.admin_get_publication_review(competition_id)->>'canPublish')::boolean from publication_context),
  'server review enables a complete historical edition');
select is((select public.admin_get_publication_review(competition_id)->>'currentVersion' from publication_context),'0',
  'initial review reports version zero');
select throws_ok($$select public.admin_publish_competition(competition_id,0,false) from publication_context$$,
  'BR043','BDB_PUBLICATION_CONFIRMATION_REQUIRED','publication requires explicit confirmation');
select lives_ok($$update publication_context set publication_one=public.admin_publish_competition(competition_id,0,true)$$,
  'confirmed AAL2 action creates publication version one');
select is((select status from public.competitions where id=(select competition_id from publication_context)),'published',
  'sporting edition becomes publicly addressable only after confirmation');
select is((select version from public.competition_publications where id=(select publication_one from publication_context)),1,
  'first publication is version one');
select is((select public.admin_publish_competition(competition_id,0,true) from publication_context),
  (select publication_one from publication_context),'exact retry is idempotent despite stale expected version');
select is((select count(*) from public.competition_publications where competition_id=(select competition_id from publication_context)),1::bigint,
  'idempotent retry creates no extra publication');
select is((select count(*) from public.admin_mutation_audit where action='competition_published'
  and entity_id=(select competition_id from publication_context)),1::bigint,
  'version one has exactly one audit event');
select throws_ok($$select public.admin_publish_competition(future_competition_id,0,true) from publication_context$$,
  'BR042','BDB_PUBLICATION_BLOCKED','future starts_on blocks manual publication');
select is((select status from public.competitions where id=(select future_competition_id from publication_context)),'draft',
  'arrival of a future date is never simulated as automatic publication');

reset role;
update public.competitions set status='published'
where id=(select future_competition_id from publication_context);
set local role anon;
select is((select count(*) from public.competitions where id=(select competition_id from publication_context)),1::bigint,
  'published competition is visible anonymously');
select is((select count(*) from public.competitions where id=(select future_competition_id from publication_context)),0::bigint,
  'legacy published status without a confirmed version remains private');
select is((select jsonb_array_length(public.public_get_competition_publication(competition_id)->'teams') from publication_context),2,
  'public snapshot contains the two confirmed teams');
select is((select jsonb_array_length(public.public_get_competition_publication(competition_id)->'games') from publication_context),0,
  'version one exposes no unconfirmed game');
select is((select count(*) from public.competition_publications where competition_id=(select competition_id from publication_context)),1::bigint,
  'anonymous readers can select only the current publication');
select is((select public.public_get_competition_publication(future_competition_id) from publication_context),null::jsonb,
  'public snapshot RPC returns null for a private URL');
reset role;

set local role authenticated;
select lives_ok($$update publication_context set game_id=public.admin_prepare_matchup(
  matchup_id,0,'2025-03-01T18:00:00-03:00','Publication court')$$,
  'published edition accepts a later private sporting operation');
select ok((select (public.admin_get_publication_review(competition_id)->>'changed')::boolean from publication_context),
  'review detects unpublished changes');
reset role;
set local role anon;
select is((select count(*) from public.games where id=(select game_id from publication_context)),0::bigint,
  'new game does not leak before republishing');
select is((select jsonb_array_length(public.public_get_competition_publication(competition_id)->'games') from publication_context),0,
  'public keeps reading version one while changes are pending');
reset role;

set local role authenticated;
select lives_ok($$update publication_context set publication_two=public.admin_publish_competition(competition_id,1,true)$$,
  'explicit republish creates version two');
select is((select version from public.competition_publications where id=(select publication_two from publication_context)),2,
  'republish increments the version');
reset role;
set local role anon;
select is((select count(*) from public.competition_publications where competition_id=(select competition_id from publication_context)),1::bigint,
  'old publication is no longer directly visible to anon');
select is((select count(*) from public.games where id=(select game_id from publication_context)),1::bigint,
  'confirmed scheduled game becomes visible');
select is((select public.public_get_competition_publication(competition_id)->'games'->0->>'homeScore' from publication_context),null::text,
  'scheduled game never appears as zero to zero');
reset role;

update public.games set status='final',started_at=scheduled_at,ended_at=scheduled_at+interval '2 hours'
where id=(select game_id from publication_context);
insert into public.game_periods(game_id,period_number)
select game_id,period from publication_context cross join generate_series(1,4) period;
insert into public.game_period_scores(game_id,registration_id,period_number,points)
select context.game_id,registration,period,points from publication_context context
cross join lateral(values(context.reg_one,1,20),(context.reg_one,2,20),(context.reg_one,3,20),(context.reg_one,4,20),
  (context.reg_two,1,15),(context.reg_two,2,15),(context.reg_two,3,15),(context.reg_two,4,15)) score(registration,period,points);
set local role anon;
select is((select count(*) from public.games where id=(select game_id from publication_context)),0::bigint,
  'changed final result is hidden until another confirmation');
select is((select public.public_get_competition_publication(competition_id)->'games'->0->>'status' from publication_context),'scheduled',
  'public snapshot remains at the last confirmed sporting state');
reset role;

select set_config('request.jwt.claims',jsonb_set(current_setting('request.jwt.claims')::jsonb,'{aal}','"aal1"')::text,true);
set local role authenticated;
select throws_ok($$select public.admin_get_publication_review(null)$$,
  'BD401','BDB_ADMIN_AAL2_REQUIRED','AAL1 cannot review publication');
select throws_ok($$select public.admin_publish_competition(null,null,null)$$,
  'BD401','BDB_ADMIN_AAL2_REQUIRED','AAL1 cannot publish');
reset role;
set local role anon;
select throws_ok($$select public.admin_publish_competition(null,null,null)$$,'42501',null,
  'anon cannot execute publication mutation');
reset role;

set constraints all immediate;
select * from finish();
rollback;
