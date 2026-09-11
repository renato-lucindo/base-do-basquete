begin;
create extension if not exists pgtap with schema extensions;
select plan(28);
set constraints all deferred;

insert into auth.users(id) values('11111111-1111-4111-8111-111111111111') on conflict do nothing;
insert into private.admin_accounts(user_id)
select '11111111-1111-4111-8111-111111111111'
where not exists(select 1 from private.admin_accounts);
select set_config('request.jwt.claims',jsonb_build_object(
  'sub',(select user_id from private.admin_accounts limit 1),
  'role','authenticated','aal','aal2'
)::text,true);

create temporary table progress_context(
  competition_id bigint,
  semi_one bigint,
  semi_two bigint,
  final_matchup bigint,
  reg_one bigint,
  reg_two bigint,
  reg_three bigint,
  reg_four bigint,
  game_one bigint,
  game_two bigint,
  final_game bigint,
  submission_one bigint,
  submission_two bigint
);

with series as(
  insert into public.competition_series(name,slug)
  values('MVP04 progress','mvp04-progress') returning id
), category as(
  insert into public.categories(name,slug)
  values('MVP04 progress','mvp04-progress') returning id
)
insert into progress_context(competition_id)
select public.admin_create_competition_from_preset(gen_random_uuid(),jsonb_build_object(
  'seriesId',series.id,'categoryId',category.id,'year',2026,
  'name','Private progress QA','gender','male','source','manual_scoresheet',
  'preset','single_elimination','entryCount',4,'reviewed',true,
  'expectedProfileId',null,'startsOn','2026-01-01','endsOn','2026-12-31'
)) from series,category;

insert into public.teams(name,slug)
select 'Progress team '||n,'mvp04-progress-team-'||n from generate_series(1,4)n;
insert into public.team_registrations(competition_id,team_id,status,confirmed_at)
select context.competition_id,team.id,'confirmed',now()
from progress_context context
join public.teams team on team.slug like 'mvp04-progress-team-%';

update progress_context context set
  semi_one=(select id from public.matchups where competition_id=context.competition_id and code='semifinal_match_1'),
  semi_two=(select id from public.matchups where competition_id=context.competition_id and code='semifinal_match_2'),
  final_matchup=(select id from public.matchups where competition_id=context.competition_id and code='final_match_1'),
  reg_one=(select registration.id from public.team_registrations registration join public.teams team on team.id=registration.team_id where registration.competition_id=context.competition_id and team.slug='mvp04-progress-team-1'),
  reg_two=(select registration.id from public.team_registrations registration join public.teams team on team.id=registration.team_id where registration.competition_id=context.competition_id and team.slug='mvp04-progress-team-2'),
  reg_three=(select registration.id from public.team_registrations registration join public.teams team on team.id=registration.team_id where registration.competition_id=context.competition_id and team.slug='mvp04-progress-team-3'),
  reg_four=(select registration.id from public.team_registrations registration join public.teams team on team.id=registration.team_id where registration.competition_id=context.competition_id and team.slug='mvp04-progress-team-4');

grant select,update on progress_context to authenticated;
set local role authenticated;
select lives_ok($$
  select public.admin_assign_competition_entry(entry.id,registration.id)
  from public.competition_entries entry
  join progress_context context on context.competition_id=entry.competition_id
  cross join lateral(values
    (1,context.reg_one),(2,context.reg_two),(3,context.reg_three),(4,context.reg_four)
  ) registration(seed,id)
  where entry.seed=registration.seed
$$,'four explicit entries can be assigned');
select lives_ok($$update progress_context set
  game_one=public.admin_prepare_matchup(semi_one,0,'2026-03-01T18:00:00-03:00','Court 1'),
  game_two=public.admin_prepare_matchup(semi_two,0,'2026-03-01T20:00:00-03:00','Court 1')$$,
  'both semifinals can be prepared');
reset role;

insert into public.game_periods(game_id,period_number)
select game_id,period from progress_context
cross join lateral(values(game_one),(game_two)) games(game_id)
cross join generate_series(1,4) period;
insert into public.game_period_scores(game_id,registration_id,period_number,points)
select context.game_one,registration,period,points
from progress_context context
cross join lateral(values(context.reg_one,1,20),(context.reg_one,2,20),(context.reg_one,3,20),(context.reg_one,4,20),
  (context.reg_four,1,15),(context.reg_four,2,15),(context.reg_four,3,15),(context.reg_four,4,15)) score(registration,period,points)
union all
select context.game_two,registration,period,points
from progress_context context
cross join lateral(values(context.reg_two,1,18),(context.reg_two,2,18),(context.reg_two,3,18),(context.reg_two,4,18),
  (context.reg_three,1,19),(context.reg_three,2,19),(context.reg_three,3,19),(context.reg_three,4,19)) score(registration,period,points);
update public.games set status='final',started_at=scheduled_at,ended_at=scheduled_at+interval '2 hours'
where id in((select game_one from progress_context),(select game_two from progress_context));

with inserted as(
  insert into public.game_data_submissions(
    game_id,submission_version,source_type,role,status,payload_hash,idempotency_key,
    submitted_by,validated_by,validated_at
  )
  select game_id,1,'manual_scoresheet','primary','active',repeat(hash_char,64),key,
    (select user_id from private.admin_accounts limit 1),
    (select user_id from private.admin_accounts limit 1),now()
  from progress_context
  cross join lateral(values(game_one,'a','mvp04-progress-1'),(game_two,'b','mvp04-progress-2'))
    input(game_id,hash_char,key)
  returning id,game_id,source_type
)
insert into public.game_data_domain_authority(
  game_id,domain,submission_id,source_type,activated_by
)
select inserted.game_id,'official_result',inserted.id,inserted.source_type,
  (select user_id from private.admin_accounts limit 1)
from inserted;
update progress_context context set
  submission_one=(select submission_id from public.game_data_domain_authority where game_id=context.game_one and domain='official_result'),
  submission_two=(select submission_id from public.game_data_domain_authority where game_id=context.game_two and domain='official_result');

set local role authenticated;
select throws_ok($$select public.admin_resolve_matchup(semi_one,submission_two) from progress_context$$,
  'BR031','BDB_OFFICIAL_RESULT_REQUIRED','stale or foreign authority cannot resolve a matchup');
select lives_ok($$select public.admin_resolve_matchup(semi_one,submission_one) from progress_context$$,
  'active primary official result resolves the first semifinal');
select is((select winner_registration_id from public.matchup_resolutions where matchup_id=(select semi_one from progress_context)),
  (select reg_one from progress_context),'higher official score determines winner server-side');
select is((select loser_registration_id from public.matchup_resolutions where matchup_id=(select semi_one from progress_context)),
  (select reg_four from progress_context),'loser is recorded without frontend input');
select is((select home_score from public.matchup_resolutions where matchup_id=(select semi_one from progress_context)),80,
  'home score is snapshotted from canonical period scores');
select is((select away_score from public.matchup_resolutions where matchup_id=(select semi_one from progress_context)),60,
  'away score is snapshotted from canonical period scores');
select ok((select home_registration_id=(select reg_one from progress_context) or away_registration_id=(select reg_one from progress_context)
  from public.matchups where id=(select final_matchup from progress_context)),
  'winner propagates to the dependent final slot');
select ok((select home_registration_id is null or away_registration_id is null
  from public.matchups where id=(select final_matchup from progress_context)),
  'final remains incomplete until the other semifinal resolves');
select is((select public.admin_resolve_matchup(semi_one,submission_one) from progress_context),
  (select semi_one from progress_context),'same resolution retry is idempotent');
select throws_ok($$update public.matchup_resolutions set home_score=1 where matchup_id=(select semi_one from progress_context)$$,
  '42501',null,'direct resolution mutation is denied');
select throws_ok($$select public.admin_resolve_matchup(semi_two,null) from progress_context$$,
  'BR031','BDB_OFFICIAL_RESULT_REQUIRED','draft or review without active authority never progresses');
select lives_ok($$select public.admin_resolve_matchup(semi_two,submission_two) from progress_context$$,
  'second active result resolves once');
select is((select winner_registration_id from public.matchup_resolutions where matchup_id=(select semi_two from progress_context)),
  (select reg_three from progress_context),'away winner is calculated correctly');
select ok((select home_registration_id is not null and away_registration_id is not null
  from public.matchups where id=(select final_matchup from progress_context)),
  'both winners make the final ready to schedule');
select is((select count(*) from public.games where matchup_id=(select final_matchup from progress_context)),0::bigint,
  'progression does not invent or publish a final game');
select lives_ok($$update progress_context set final_game=public.admin_prepare_matchup(
  final_matchup,0,'2026-03-08T18:00:00-03:00','Court 1')$$,
  'administrator explicitly materializes the ready final');
select is((select count(*) from public.game_participants where game_id=(select final_game from progress_context)),2::bigint,
  'final participants are derived from the two winners');
select is((select jsonb_array_length(public.admin_get_competition_schedule(competition_id)->'matchups') from progress_context),3,
  'administrative summary keeps all bracket matchups');
select ok((select (item->>'readyToResolve')::boolean=false and item->'resolution' is not null
  from progress_context context
  cross join lateral jsonb_array_elements(public.admin_get_competition_schedule(context.competition_id)->'matchups') item
  where (item->>'id')::bigint=context.semi_one),
  'resolved matchup summary is explicit and no longer actionable');
select is((select count(*) from public.admin_mutation_audit where action='matchup_resolved'
  and entity_id in((select semi_one from progress_context),(select semi_two from progress_context))),2::bigint,
  'one audit row exists per immutable resolution');
select set_config('request.jwt.claims',jsonb_set(current_setting('request.jwt.claims')::jsonb,'{aal}','"aal1"')::text,true);
select throws_ok($$select public.admin_resolve_matchup(null,null)$$,
  'BD401','BDB_ADMIN_AAL2_REQUIRED','AAL1 is rejected before result validation');
select is((select count(*) from public.matchup_resolutions),0::bigint,'AAL1 cannot read private resolutions');
reset role;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select throws_ok($$select public.admin_resolve_matchup(null,null)$$,
  'BD401','BDB_ADMIN_AAL2_REQUIRED','non-admin AAL2 cannot resolve');
reset role;
set local role anon;
select throws_ok($$select public.admin_resolve_matchup(null,null)$$,'42501',null,'anon cannot execute resolution RPC');
select throws_ok($$select * from public.matchup_resolutions$$,'42501',null,'anon cannot read resolutions');
reset role;

select is(private.preset_blueprint((select id from public.competition_ruleset_revisions
  where competition_id=(select competition_id from progress_context))),
  private.compile_competition_preset_v1('single_elimination',4),
  'progression preserves the immutable preset blueprint');

set constraints all immediate;
select * from finish();
rollback;
