begin;
\ir ../helpers/final_profile_fixtures.inc

create extension if not exists pgtap with schema extensions;
select plan(29);
set constraints all deferred;
select set_config('bdb.allow_internal_ingestion_game', 'on', true);

insert into auth.users(id)
values ('11111111-1111-4111-8111-111111111111')
on conflict do nothing;
insert into private.admin_accounts(user_id)
values ('11111111-1111-4111-8111-111111111111')
on conflict do nothing;

select ok(
  pg_get_functiondef('public.admin_create_manual_scoresheet_v2(jsonb)'::regprocedure)
    like '%pg_advisory_xact_lock%',
  'idempotent creation is serialized by a transaction-scoped advisory lock'
);

insert into public.competition_series (id, name, slug)
overriding system value values (9831, 'Liga Sumula V2', 'liga-sumula-v2');
insert into public.categories (id, name, slug)
overriding system value values (9831, 'Categoria Sumula V2', 'categoria-sumula-v2');
select pg_temp.create_final_competition(
  9831,9831,9831,2026,'Liga Sumula V2 2026','published',now(),'male','manual_scoresheet'
);
insert into public.teams (id, name, slug)
overriding system value values
  (9831, 'Time Sumula V2 Casa', 'time-sumula-v2-casa'),
  (9832, 'Time Sumula V2 Fora', 'time-sumula-v2-fora'),
  (9833, 'Time Sumula V2 Rascunho', 'time-sumula-v2-rascunho');
insert into public.players (id, full_name, slug)
overriding system value values
  (9831, 'Atleta Sumula V2 Casa', 'atleta-sumula-v2-casa'),
  (9832, 'Atleta Sumula V2 Fora', 'atleta-sumula-v2-fora');
insert into private.player_private(player_id,sex,sex_review_required)
values(9831,'male',false),(9832,'male',false);
insert into public.team_registrations
  (id, competition_id, team_id, status, confirmed_at)
overriding system value values
  (9831, 9831, 9831, 'confirmed', now()),
  (9832, 9831, 9832, 'confirmed', now()),
  (9833, 9831, 9833, 'draft', null);
insert into public.roster_entries
  (id, competition_id, registration_id, player_id, jersey_number, status)
overriding system value values
  (9831, 9831, 9831, 9831, '00', 'active'),
  (9832, 9831, 9832, 9832, '0', 'active');
insert into public.competition_ruleset_revisions
  (id, competition_id, revision_number, structure_kind, status)
overriding system value values
  (9831, 9831, 1, 'regulated', 'active');
insert into public.competition_stages
  (id, competition_id, ruleset_revision_id, code, name, stage_order, structure_kind)
overriding system value values
  (9831, 9831, 9831, 'regular', 'Fase regular', 1, 'regulated');

create temp table manual_v2_payloads(name text primary key, payload jsonb);
grant select on manual_v2_payloads to authenticated;
insert into manual_v2_payloads(name,payload) values (
  'base',
  '{
    "idempotencyKey":"98310000-0000-4000-8000-000000000001",
    "competitionId":9831,
    "game":{"date":"2026-10-07"},
    "teams":[
      {
        "side":"home","registrationId":9831,
        "slots":[{"slotNumber":1,"rosterEntryId":9831,"jerseyNumber":"00","isStarter":true,"isCaptain":true}],
        "staff":[{"role":"coach","name":"Treinador Casa","origin":"manual"}]
      },
      {
        "side":"away","registrationId":9832,
        "slots":[{"slotNumber":1,"rosterEntryId":9832,"jerseyNumber":"0","isStarter":true,"isCaptain":true}],
        "staff":[{"role":"coach","name":"Treinador Fora","origin":"manual"}]
      }
    ],
    "periods":[
      {"periodNumber":1,"stats":[
        {"rosterEntryId":9831,"twoPointMade":1,"threePointMade":0,"freeThrowMade":0},
        {"rosterEntryId":9832,"twoPointMade":0,"threePointMade":0,"freeThrowMade":1}
      ]},
      {"periodNumber":2,"stats":[
        {"rosterEntryId":9831,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0},
        {"rosterEntryId":9832,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0}
      ]},
      {"periodNumber":3,"stats":[
        {"rosterEntryId":9831,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0},
        {"rosterEntryId":9832,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0}
      ]},
      {"periodNumber":4,"stats":[
        {"rosterEntryId":9831,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0},
        {"rosterEntryId":9832,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0}
      ]}
    ],
    "fouls":[
      {"periodNumber":1,"sequenceNumber":1,"target":{"kind":"player","registrationId":9831,"rosterEntryId":9831},"type":"U","penaltyFtCount":2,"originalNotation":"U2","rulesVersion":"FIBA_2024"},
      {"periodNumber":1,"sequenceNumber":1,"target":{"kind":"staff","registrationId":9831,"staffRole":"coach"},"type":"T","penaltyFtCount":1,"originalNotation":"C1","rulesVersion":"FIBA_2024"},
      {"periodNumber":2,"sequenceNumber":1,"target":{"kind":"team","registrationId":9832},"type":"T","penaltyFtCount":0,"originalNotation":"T","rulesVersion":"FIBA_2024"}
    ],
    "officials":[{"role":"Árbitro","name":"Oficial Principal"}]
  }'::jsonb
);

create temp table manual_v2_result(game_id bigint);
grant select, insert on manual_v2_result to authenticated;

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.admin_create_manual_scoresheet_v2((select payload from manual_v2_payloads where name='base'))$$,
  'BD401','BDB_ADMIN_AAL2_REQUIRED','non-admin aal2 cannot create a v2 manual scoresheet'
);

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub',(select user_id from private.admin_accounts),'role','authenticated','aal','aal1')::text,
  true
);
set local role authenticated;
select throws_ok(
  $$select public.admin_create_manual_scoresheet_v2((select payload from manual_v2_payloads where name='base'))$$,
  'BD401','BDB_ADMIN_AAL2_REQUIRED','admin aal1 cannot create a v2 manual scoresheet'
);

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub',(select user_id from private.admin_accounts),'role','authenticated','aal','aal2')::text,
  true
);
set local role authenticated;

select lives_ok(
  $$insert into manual_v2_result(game_id)
    select public.admin_create_manual_scoresheet_v2((select payload from manual_v2_payloads where name='base'))$$,
  'admin aal2 atomically creates matchup, game and full manual scoresheet'
);
select is((select count(*) from public.games where competition_id=9831),1::bigint,'successful create writes exactly one game');
select is((select count(*) from public.matchups where competition_id=9831),1::bigint,'successful create writes exactly one matchup');
select results_eq(
  $$select status,source from public.games where id=(select game_id from manual_v2_result)$$,
  $$values ('final'::text,'manual'::text)$$,
  'game becomes final and manual only after the complete write succeeds'
);
select results_eq(
  $$select scheduled_date,scheduled_time from public.manual_scoresheet_game_details where game_id=(select game_id from manual_v2_result)$$,
  $$values ('2026-10-07'::date,null::time)$$,
  'date is required while time stays optional'
);
select is(
  (select count(*) from public.game_roster_slots where game_id=(select game_id from manual_v2_result)),
  2::bigint,
  'both roster slots persist'
);
select results_eq(
  $$select registration_id,jersey_number,is_starter,is_captain from public.game_roster_slots where game_id=(select game_id from manual_v2_result) order by registration_id$$,
  $$values (9831::bigint,'00'::text,true,true),(9832::bigint,'0'::text,true,true)$$,
  'jerseys, starters and captains persist'
);
select is(
  (select count(*) from public.game_team_staff where game_id=(select game_id from manual_v2_result)),
  2::bigint,
  'team staff persists'
);
select results_eq(
  $$select role,display_name from public.game_officials where game_id=(select game_id from manual_v2_result)$$,
  $$values ('Árbitro'::text,'Oficial Principal'::text)$$,
  'officials persist'
);
select results_eq(
  $$select registration_id,sum(points)::integer from public.game_period_scores where game_id=(select game_id from manual_v2_result) group by registration_id order by registration_id$$,
  $$values (9831::bigint,2::integer),(9832::bigint,1::integer)$$,
  'period scores derive from persisted player conversions'
);
select results_eq(
  $$select target_kind,foul_type,penalty_ft_count,original_notation,foul_code from public.foul_events where game_id=(select game_id from manual_v2_result) order by period_number,target_kind$$,
  $$values
    ('player'::text,'U'::text,2::smallint,'U2'::text,'U2'::text),
    ('staff'::text,'T'::text,1::smallint,'C1'::text,'T'::text),
    ('team'::text,'T'::text,0::smallint,'T'::text,'T'::text)$$,
  'semantic player, staff and team fouls persist with original notation'
);
select is(
  (select count(*) from public.manual_scoresheet_submission_payloads where game_id=(select game_id from manual_v2_result)),
  1::bigint,
  'immutable submission payload snapshot persists'
);
select is(
  (select count(*) from public.game_data_domain_authority where game_id=(select game_id from manual_v2_result)),
  6::bigint,
  'six manual data authority domains become active'
);
select is(
  (select count(*) from public.admin_mutation_audit where action='manual_scoresheet_saved' and entity_id=(select game_id from manual_v2_result)),
  1::bigint,
  'successful creation writes one audit event'
);
select is(
  (select public.admin_create_manual_scoresheet_v2((select payload from manual_v2_payloads where name='base'))),
  (select game_id from manual_v2_result),
  'retry with the same idempotency key and payload returns the same game'
);
select is((select count(*) from public.games where competition_id=9831),1::bigint,'idempotent retry creates no additional game');
select is((select count(*) from public.game_data_submissions where game_id=(select game_id from manual_v2_result)),1::bigint,'idempotent retry creates no additional submission');
select throws_ok(
  $$select public.admin_create_manual_scoresheet_v2(
    jsonb_set((select payload from manual_v2_payloads where name='base'),'{game,notes}','"conteudo divergente"'::jsonb)
  )$$,
  'BD209','BDB_IDEMPOTENCY_CONFLICT','same key with divergent payload is rejected'
);
select throws_ok(
  $$select public.admin_create_manual_scoresheet_v2(
    jsonb_set(
      jsonb_set((select payload from manual_v2_payloads where name='base'),'{idempotencyKey}','"98310000-0000-4000-8000-000000000002"'::jsonb),
      '{periods,0,stats,1,freeThrowMade}','2'::jsonb
    )
  )$$,
  'BD208','BDB_FINAL_GAME_TIED','a validation failure after scheduling rolls the transaction back'
);
select is((select count(*) from public.games where competition_id=9831),1::bigint,'failed confirmation leaves no orphan game');
select is((select count(*) from public.matchups where competition_id=9831),1::bigint,'failed confirmation leaves no orphan matchup');

reset role;
select is(
  (select count(*) from private.manual_matchup_requests where request_id='98310000-0000-4000-8000-000000000002'),
  0::bigint,
  'failed confirmation also rolls back the matchup request ledger'
);

select set_config(
  'request.jwt.claims',
  json_build_object('sub',(select user_id from private.admin_accounts),'role','authenticated','aal','aal2')::text,
  true
);
set local role authenticated;
select throws_ok(
  $$select public.admin_create_manual_scoresheet_v2(
    jsonb_set(
      jsonb_set((select payload from manual_v2_payloads where name='base'),'{idempotencyKey}','"98310000-0000-4000-8000-000000000003"'::jsonb),
      '{teams,1,registrationId}','9833'::jsonb
    )
  )$$,
  'BR023','BDB_CONFIRMED_REGISTRATION_REQUIRED','unconfirmed team registration is rejected'
);
select is((select count(*) from public.games where competition_id=9831),1::bigint,'invalid registration creates no game');

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select is(
  (select count(*) from public.manual_scoresheet_game_details)
    + (select count(*) from public.manual_scoresheet_submission_payloads),
  0::bigint,
  'non-admin aal2 cannot read manual scoresheet v2 metadata or payload snapshots'
);

reset role;
set local role anon;
select throws_ok(
  $$select public.admin_create_manual_scoresheet_v2('{}'::jsonb)$$,
  '42501',null,'anon cannot execute the v2 creation RPC'
);

select * from finish();
rollback;
