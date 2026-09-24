begin;
create extension if not exists pgtap with schema extensions;
select plan(42);
set constraints all deferred;
insert into auth.users(id) values('11111111-1111-4111-8111-111111111111') on conflict do nothing;
insert into private.admin_accounts(user_id) select '11111111-1111-4111-8111-111111111111' where not exists(select 1 from private.admin_accounts);
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from private.admin_accounts limit 1),'role','authenticated','aal','aal2')::text,true);
create temporary table schedule_context(competition_id bigint,first_matchup bigint,final_matchup bigint,entry_one bigint,entry_two bigint,reg_one bigint,reg_two bigint,reg_three bigint,game_id bigint);
with s as(insert into public.competition_series(name,slug) values('MVP04 test','mvp04-test') returning id),
c as(insert into public.categories(name,slug) values('MVP04 test','mvp04-test') returning id)
insert into schedule_context(competition_id) select public.admin_create_competition_from_preset(gen_random_uuid(),jsonb_build_object(
  'seriesId',s.id,'categoryId',c.id,'year',2025,'name','Private schedule QA','gender','female','source','manual_scoresheet',
  'preset','single_elimination','entryCount',4,'reviewed',true,'expectedProfileId',null,'startsOn','2025-01-01','endsOn','2025-12-31')) from s,c;
with t as(insert into public.teams(name,slug) select 'Schedule team '||n,'mvp04-team-'||n from generate_series(1,3)n returning id),
r as(insert into public.team_registrations(competition_id,team_id,status,confirmed_at) select c.competition_id,t.id,'confirmed',now() from schedule_context c,t returning id)
update schedule_context set reg_one=(select min(id) from r),reg_two=(select min(id)+1 from r),reg_three=(select max(id) from r);
update schedule_context c set first_matchup=(select min(id) from public.matchups where competition_id=c.competition_id),
final_matchup=(select max(id) from public.matchups where competition_id=c.competition_id);
update schedule_context c set entry_one=(select s.entry_id from public.matchups m join public.competition_slots s on s.id=m.home_slot_id where m.id=c.first_matchup),
entry_two=(select s.entry_id from public.matchups m join public.competition_slots s on s.id=m.away_slot_id where m.id=c.first_matchup);
grant select,update on schedule_context to authenticated;
set local role authenticated;
select lives_ok($$select public.admin_prepare_matchup(final_matchup,0,'2025-02-01T15:00:00-03:00','Ginásio') from schedule_context$$,'future unresolved matchup can be prepared privately');
select is((select count(*) from public.games where competition_id=(select competition_id from schedule_context)),0::bigint,'unresolved participants create no fake game');
select lives_ok($$select public.admin_assign_competition_entry(entry_one,reg_one) from schedule_context$$,'explicit first entry assignment succeeds');
select lives_ok($$select public.admin_assign_competition_entry(entry_one,reg_one) from schedule_context$$,'same assignment is idempotent');
select throws_ok($$select public.admin_assign_competition_entry(entry_one,reg_two) from schedule_context$$,'BR021','BDB_ENTRY_ASSIGNMENT_IMMUTABLE','assigned position cannot silently change');
select throws_ok($$select public.admin_assign_competition_entry(entry_two,reg_one) from schedule_context$$,'BR024','BDB_REGISTRATION_ALREADY_ASSIGNED','same team cannot occupy two entries');
select lives_ok($$select public.admin_assign_competition_entry(entry_two,reg_two) from schedule_context$$,'second explicit entry resolves the matchup');
select is((select home_registration_id from public.matchups where id=(select first_matchup from schedule_context)),(select reg_one from schedule_context),'home derives from the actual slot');
select lives_ok($$update schedule_context set game_id=public.admin_prepare_matchup(first_matchup,0,'2025-03-01T19:30:00-03:00','Quadra 1')$$,'ready matchup creates a game transactionally');
select is((select status from public.games where id=(select game_id from schedule_context)),'scheduled','prepared dated game is scheduled');
select is(jsonb_array_length(public.admin_get_competition_schedule((select competition_id from schedule_context))->'matchups'),3,'AAL2 reads all reserved matchups');
select is((
  select count(distinct item->>'label')
  from schedule_context context
  cross join lateral jsonb_array_elements(public.admin_get_competition_schedule(context.competition_id)->'entries') item
),4::bigint,'active entry labels are unique and contextual');
select is((
  select count(distinct item->>'label')
  from schedule_context context
  cross join lateral jsonb_array_elements(public.admin_get_competition_schedule(context.competition_id)->'matchups') item
),3::bigint,'active matchup labels are unique and contextual');
select is((select count(*) from public.game_participants where game_id=(select game_id from schedule_context)),2::bigint,'exactly two participants generated');
select is((select count(*) from public.game_period_scores where game_id=(select game_id from schedule_context)),0::bigint,'scheduled game has no invented zero score');
select lives_ok($$
  select public.admin_prepare_matchups_batch(
    context.competition_id,
    jsonb_build_array(
      jsonb_build_object(
        'matchupId',context.first_matchup,
        'expectedRevision',0,
        'scheduledAt','2025-03-01T19:30:00-03:00',
        'venue','Quadra 1'
      ),
      jsonb_build_object(
        'matchupId',(
          select id from public.matchups
          where competition_id=context.competition_id
            and id not in(context.first_matchup,context.final_matchup)
          limit 1
        ),
        'expectedRevision',0,
        'scheduledAt','2025-04-01T18:00:00-03:00',
        'venue','Quadra 2'
      )
    )
  )
  from schedule_context context
$$,'multiple schedule rows are saved through one transactional RPC');
select is((
  select count(*) from public.matchup_preparations preparation
  where preparation.venue='Quadra 2'
),1::bigint,'batch preparation persists the unresolved matchup without inventing a game');
select throws_ok($$
  select public.admin_prepare_matchups_batch(
    context.competition_id,
    jsonb_build_array(
      jsonb_build_object(
        'matchupId',context.first_matchup,
        'expectedRevision',1,
        'scheduledAt','2025-03-01T19:30:00-03:00',
        'venue','Temporary venue'
      ),
      jsonb_build_object(
        'matchupId',(
          select id from public.matchups
          where competition_id=context.competition_id
            and id not in(context.first_matchup,context.final_matchup)
          limit 1
        ),
        'expectedRevision',0,
        'scheduledAt','2025-04-02T18:00:00-03:00',
        'venue','Stale venue'
      )
    )
  )
  from schedule_context context
$$,'BR026','BDB_SCHEDULE_CHANGED_RELOAD','one stale row rejects the complete schedule batch');
select is((select venue from public.games where id=(select game_id from schedule_context)),'Quadra 1'::text,'a rejected schedule batch rolls back earlier rows');
select throws_ok(
  $$select public.admin_prepare_matchups_batch((select competition_id from schedule_context),'[]'::jsonb)$$,
  'BR025','BDB_SCHEDULE_INPUT_INVALID','empty schedule batches are rejected'
);
select is((select public.admin_prepare_matchup(first_matchup,0,'2025-03-01T19:30:00-03:00','Quadra 1') from schedule_context),(select game_id from schedule_context),'retry returns same game even with original expected revision');
select throws_ok($$select public.admin_prepare_matchup(first_matchup,0,'2025-03-02T19:30:00-03:00','Quadra 2') from schedule_context$$,'BR026','BDB_SCHEDULE_CHANGED_RELOAD','stale schedule change rejected');
select throws_ok($$select public.admin_prepare_matchup(first_matchup,1,'2026-01-01T03:00:00Z','Quadra') from schedule_context$$,'BR025','BDB_SCHEDULE_INPUT_INVALID','Sao Paulo date outside edition interval rejected');
select lives_ok($$select public.admin_prepare_matchup(first_matchup,1,'2026-01-01T02:59:00Z','Quadra 2') from schedule_context$$,'UTC next year within Sao Paulo last day allowed');
select throws_ok($$update public.games set venue='Bypass' where id=(select game_id from schedule_context)$$,'42501',null,'direct game writes denied');
select throws_ok($$insert into public.competition_entry_assignments(entry_id) values(1)$$,'42501',null,'direct assignment writes denied');
reset role;
select is(private.preset_blueprint((select id from public.competition_ruleset_revisions where competition_id=(select competition_id from schedule_context))),private.compile_competition_preset_v1('single_elimination',4),'assignment preserves immutable canonical blueprint');
select throws_ok($$update public.matchups set matchup_order=20 where id=(select first_matchup from schedule_context)$$,'BR004','BDB_ACTIVE_RULESET_IMMUTABLE','operational exception cannot mutate graph');
select throws_ok($$update public.matchups set home_registration_id=(select reg_three from schedule_context) where id=(select first_matchup from schedule_context)$$,'BR004','BDB_ACTIVE_RULESET_IMMUTABLE','operational exception cannot invent participants');
select is((select count(*) from public.admin_mutation_audit where action='competition_entry_assigned' and entity_id in(select entry_one from schedule_context union all select entry_two from schedule_context)),2::bigint,'one audit per assignment');
update public.games set status='live',started_at=now() where id=(select game_id from schedule_context);
select throws_ok($$select public.admin_prepare_matchup(first_matchup,2,null,null) from schedule_context$$,'BR027','BDB_STARTED_GAME_SCHEDULE_IMMUTABLE','started game cannot be rescheduled');
select set_config('request.jwt.claims',jsonb_set(current_setting('request.jwt.claims')::jsonb,'{aal}','"aal1"')::text,true);
set local role authenticated;
select throws_ok($$select public.admin_prepare_matchup(null,null,null,null)$$,'BD401','BDB_ADMIN_AAL2_REQUIRED','AAL1 rejected before validating schedule');
select throws_ok($$select public.admin_prepare_matchups_batch(null,'[]'::jsonb)$$,'BD401','BDB_ADMIN_AAL2_REQUIRED','AAL1 batch scheduling rejected');
select throws_ok($$select public.admin_assign_competition_entry(null,null)$$,'BD401','BDB_ADMIN_AAL2_REQUIRED','AAL1 assignment rejected');
select throws_ok($$select public.admin_get_competition_schedule(null)$$,'BD401','BDB_ADMIN_AAL2_REQUIRED','AAL1 summary rejected');
select is((select count(*) from public.matchup_preparations),0::bigint,'AAL1 cannot read private preparation');
reset role;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select throws_ok($$select public.admin_prepare_matchup(null,null,null,null)$$,'BD401','BDB_ADMIN_AAL2_REQUIRED','non-admin AAL2 rejected');
select throws_ok($$select public.admin_prepare_matchups_batch(null,'[]'::jsonb)$$,'BD401','BDB_ADMIN_AAL2_REQUIRED','non-admin AAL2 batch scheduling rejected');
reset role;
set local role anon;
select throws_ok($$select public.admin_prepare_matchup(null,null,null,null)$$,'42501',null,'anon cannot execute');
select throws_ok($$select public.admin_prepare_matchups_batch(null,'[]'::jsonb)$$,'42501',null,'anon cannot execute batch scheduling');
select throws_ok($$select * from public.matchup_preparations$$,'42501',null,'anon cannot read preparation');
select throws_ok($$select public.admin_get_competition_schedule(null)$$,'42501',null,'anon cannot read summary RPC');
reset role;
set constraints all immediate;
select * from finish();
rollback;
