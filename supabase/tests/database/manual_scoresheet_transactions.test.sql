begin;

create extension if not exists pgtap with schema extensions;
select plan(19);
set constraints all deferred;

insert into private.admin_accounts (user_id)
select '11111111-1111-4111-8111-111111111111'
where not exists (select 1 from private.admin_accounts);

insert into public.competition_series (id, name, slug)
overriding system value values (9301, 'Liga Sumula', 'liga-sumula');
insert into public.categories (id, name, slug)
overriding system value values (9301, 'Categoria Sumula', 'categoria-sumula');
insert into public.competitions
  (id, series_id, category_id, year, display_name, status, published_at)
overriding system value values
  (9301, 9301, 9301, 2026, 'Liga Sumula 2026', 'published', now());
insert into public.teams (id, name, slug)
overriding system value values
  (9301, 'Time Sumula Casa', 'time-sumula-casa'),
  (9302, 'Time Sumula Fora', 'time-sumula-fora');
insert into public.players (id, full_name, slug)
overriding system value values
  (9301, 'Atleta Sumula Um', 'atleta-sumula-um'),
  (9302, 'Atleta Sumula Dois', 'atleta-sumula-dois'),
  (9303, 'Atleta Sumula Tres', 'atleta-sumula-tres');
insert into public.team_registrations
  (id, competition_id, team_id, status, confirmed_at)
overriding system value values
  (9301, 9301, 9301, 'confirmed', now()),
  (9302, 9301, 9302, 'confirmed', now());
insert into public.roster_entries
  (id, competition_id, registration_id, player_id, jersey_number, status)
overriding system value values
  (9301, 9301, 9301, 9301, '00', 'active'),
  (9302, 9301, 9301, 9302, '0', 'active'),
  (9303, 9301, 9302, 9303, '00', 'active');

create temp table scoresheet_payloads (name text primary key, payload jsonb);
grant select on scoresheet_payloads to authenticated;

insert into scoresheet_payloads (name, payload)
values (
  'base',
  '{
    "idempotencyKey":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "competitionId":9301,
    "gameNumber":null,
    "scheduledLocal":"2026-08-20T18:00",
    "venue":"Ginasio de teste",
    "teams":[
      {"side":"home","registrationId":9301,"slots":[
        {"slotNumber":1,"rosterEntryId":9301,"jerseyNumber":"00"},
        {"slotNumber":2,"rosterEntryId":9302,"jerseyNumber":"0"}
      ]},
      {"side":"away","registrationId":9302,"slots":[
        {"slotNumber":1,"rosterEntryId":9303,"jerseyNumber":"00"}
      ]}
    ],
    "periods":[
      {"periodNumber":1,"stats":[
        {"rosterEntryId":9301,"twoPointMade":1,"threePointMade":0,"freeThrowMade":0,"fouls":[]},
        {"rosterEntryId":9302,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0,"fouls":[]},
        {"rosterEntryId":9303,"twoPointMade":0,"threePointMade":0,"freeThrowMade":1,"fouls":[]}
      ]},
      {"periodNumber":2,"stats":[
        {"rosterEntryId":9301,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0,"fouls":[]},
        {"rosterEntryId":9302,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0,"fouls":[]},
        {"rosterEntryId":9303,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0,"fouls":[]}
      ]},
      {"periodNumber":3,"stats":[
        {"rosterEntryId":9301,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0,"fouls":[]},
        {"rosterEntryId":9302,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0,"fouls":[]},
        {"rosterEntryId":9303,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0,"fouls":[]}
      ]},
      {"periodNumber":4,"stats":[
        {"rosterEntryId":9301,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0,"fouls":[]},
        {"rosterEntryId":9302,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0,"fouls":[]},
        {"rosterEntryId":9303,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0,"fouls":[]}
      ]}
    ]
  }'::jsonb
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.admin_create_manual_scoresheet((select payload from scoresheet_payloads where name = 'base'))$$,
  'BD401', 'BDB_ADMIN_AAL2_REQUIRED',
  'a non-admin at aal2 cannot create a manual scoresheet'
);

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', (select user_id from private.admin_accounts), 'role', 'authenticated', 'aal', 'aal1')::text,
  true
);
set local role authenticated;
select throws_ok(
  $$select public.admin_create_manual_scoresheet((select payload from scoresheet_payloads where name = 'base'))$$,
  'BD401', 'BDB_ADMIN_AAL2_REQUIRED',
  'the singleton administrator at aal1 cannot create a manual scoresheet'
);

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', (select user_id from private.admin_accounts), 'role', 'authenticated', 'aal', 'aal2')::text,
  true
);
set local role authenticated;

select lives_ok(
  $$select public.admin_create_manual_scoresheet((select payload from scoresheet_payloads where name = 'base'))$$,
  'aal2 creates and finalizes a complete scoresheet'
);
select is(
  (select count(*) from public.games where competition_id = 9301),
  1::bigint,
  'one game is committed'
);
select is(
  (select public.admin_create_manual_scoresheet((select payload from scoresheet_payloads where name = 'base'))),
  (select id from public.games where competition_id = 9301),
  'the same submission is idempotent and returns its game id'
);
select is(
  (select status from public.games where competition_id = 9301),
  'final'::text,
  'the manual game is final only after the transaction succeeds'
);
select results_eq(
  $$select side, score from public.game_scores where game_id =
      (select id from public.games where competition_id = 9301) order by side$$,
  $$values ('away'::text, 1::integer), ('home'::text, 2::integer)$$,
  'team scores are derived from player conversions'
);
select results_eq(
  $$select jersey_number from public.game_roster_slots where game_id =
      (select id from public.games where competition_id = 9301) and registration_id = 9301
      order by jersey_number$$,
  $$values ('0'::text), ('00'::text)$$,
  'jerseys 0 and 00 stay distinct in one lineup'
);
select is(
  (select count(*) from public.admin_mutation_audit where action = 'manual_scoresheet_saved'),
  1::bigint,
  'one append-only audit event is written'
);

select throws_ok(
  $$select public.admin_create_manual_scoresheet(
      jsonb_set((select payload from scoresheet_payloads where name = 'base'),
        '{venue}', '"Outro local"'::jsonb)
    )$$,
  'BD209', 'BDB_IDEMPOTENCY_CONFLICT',
  'reusing an idempotency key with other content is rejected'
);

select throws_ok(
  $$select public.admin_create_manual_scoresheet(
      jsonb_set(
        jsonb_set((select payload from scoresheet_payloads where name = 'base'),
          '{idempotencyKey}', '"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"'::jsonb),
        '{periods,0,stats,2,freeThrowMade}', '2'::jsonb
      )
    )$$,
  'BD208', 'BDB_FINAL_GAME_TIED',
  'a tied final game is rejected'
);
select is(
  (select count(*) from public.games where competition_id = 9301),
  1::bigint,
  'a rejected tie leaves no partial game'
);

select throws_ok(
  $$select public.admin_create_manual_scoresheet(
      jsonb_set(
        jsonb_set((select payload from scoresheet_payloads where name = 'base'),
          '{idempotencyKey}', '"cccccccc-cccc-4ccc-8ccc-cccccccccccc"'::jsonb),
        '{teams,0,slots,1,jerseyNumber}', '"00"'::jsonb
      )
    )$$,
  'BD205', 'BDB_DUPLICATE_PLAYER_OR_JERSEY',
  'duplicate jerseys in one team are rejected atomically'
);

select lives_ok(
  $$select public.admin_create_manual_scoresheet(
      jsonb_set(
        jsonb_set((select payload from scoresheet_payloads where name = 'base'),
          '{idempotencyKey}', '"dddddddd-dddd-4ddd-8ddd-dddddddddddd"'::jsonb),
        '{periods,0,stats,0,fouls}', '["T","T"]'::jsonb
      )
    )$$,
  'two technical fouls derive and persist GD'
);
select is(
  (select disqualification_reason from public.game_roster_slots
    where roster_entry_id = 9301 order by game_id desc limit 1),
  '2T'::text,
  'the GD reason is auditable'
);

select throws_ok(
  $$select public.admin_create_manual_scoresheet(
      jsonb_set(
        jsonb_set(
          jsonb_set((select payload from scoresheet_payloads where name = 'base'),
            '{idempotencyKey}', '"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"'::jsonb),
          '{periods,0,stats,0,fouls}', '["T","T"]'::jsonb),
        '{periods,1,stats,0,twoPointMade}', '1'::jsonb
      )
    )$$,
  'BD207', 'BDB_DATA_AFTER_DISQUALIFICATION',
  'statistics after GD are rejected by the backend'
);

select throws_ok(
  $$select public.admin_create_manual_scoresheet(
      jsonb_set(
        jsonb_set((select payload from scoresheet_payloads where name = 'base'),
          '{idempotencyKey}', '"ffffffff-ffff-4fff-8fff-ffffffffffff"'::jsonb),
        '{periods,0,stats}',
        ((select payload from scoresheet_payloads where name = 'base') #> '{periods,0,stats}') - 2
      )
    )$$,
  'BD206', 'BDB_INVALID_PERIODS',
  'every active player must have one stat row in every period'
);

select lives_ok(
  $$select public.admin_create_manual_scoresheet(
      jsonb_set(
        jsonb_set(
          jsonb_set((select payload from scoresheet_payloads where name = 'base'),
            '{idempotencyKey}', '"12345678-1234-4234-8234-123456789abc"'::jsonb),
          '{gameNumber}', '"MAN-OT"'::jsonb),
        '{periods}',
        '[
          {"periodNumber":1,"stats":[
            {"rosterEntryId":9301,"twoPointMade":1,"threePointMade":0,"freeThrowMade":0,"fouls":[]},
            {"rosterEntryId":9302,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0,"fouls":[]},
            {"rosterEntryId":9303,"twoPointMade":1,"threePointMade":0,"freeThrowMade":0,"fouls":[]}
          ]},
          {"periodNumber":2,"stats":[
            {"rosterEntryId":9301,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0,"fouls":[]},
            {"rosterEntryId":9302,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0,"fouls":[]},
            {"rosterEntryId":9303,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0,"fouls":[]}
          ]},
          {"periodNumber":3,"stats":[
            {"rosterEntryId":9301,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0,"fouls":[]},
            {"rosterEntryId":9302,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0,"fouls":[]},
            {"rosterEntryId":9303,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0,"fouls":[]}
          ]},
          {"periodNumber":4,"stats":[
            {"rosterEntryId":9301,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0,"fouls":[]},
            {"rosterEntryId":9302,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0,"fouls":[]},
            {"rosterEntryId":9303,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0,"fouls":[]}
          ]},
          {"periodNumber":5,"stats":[
            {"rosterEntryId":9301,"twoPointMade":0,"threePointMade":0,"freeThrowMade":1,"fouls":[]},
            {"rosterEntryId":9302,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0,"fouls":[]},
            {"rosterEntryId":9303,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0,"fouls":[]}
          ]}
        ]'::jsonb
      )
    )$$,
  'OT1 is accepted only after a tied Q4 and ends with a winner'
);
select is(
  (select count(*) from public.game_periods where game_id =
    (select id from public.games where game_number = 'MAN-OT')),
  5::bigint,
  'OT1 is persisted as the fifth sequential period'
);

reset role;
select * from finish();
rollback;
