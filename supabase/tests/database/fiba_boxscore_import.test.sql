begin;
\ir ../helpers/final_profile_fixtures.inc

create extension if not exists pgtap with schema extensions;
select plan(51);
set constraints all deferred;
select set_config('bdb.allow_internal_ingestion_game', 'on', true);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '11111111-1111-4111-8111-111111111111',
  'authenticated',
  'authenticated',
  'boxscore-fixture@example.invalid',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
)
on conflict (id) do nothing;

insert into private.admin_accounts (user_id)
select '11111111-1111-4111-8111-111111111111'
where not exists (select 1 from private.admin_accounts);

insert into public.competition_series (id, name, slug)
overriding system value values (9401, 'Liga PDF', 'liga-pdf');
insert into public.categories (id, name, slug)
overriding system value values (9401, 'Categoria PDF', 'categoria-pdf');
select pg_temp.create_final_competition(
  9401,9401,9401,2026,'Liga PDF 2026','published',now(),'male','fiba_boxscore'
);
insert into public.teams (id, name, slug, abbreviation)
overriding system value values
  (9401, 'Equipe PDF Casa', 'equipe-pdf-casa', 'PDC'),
  (9402, 'Equipe PDF Fora', 'equipe-pdf-fora', 'PDF');
insert into public.players (id, full_name, slug)
overriding system value
select 9400 + number, 'Atleta PDF ' || number, 'atleta-pdf-' || number
from generate_series(1, 10) number;
insert into private.player_private(player_id,sex,sex_review_required)
select 9400+number,'male',false from generate_series(1,10) number;
insert into public.team_registrations
  (id, competition_id, team_id, status, confirmed_at)
overriding system value values
  (9401, 9401, 9401, 'confirmed', now()),
  (9402, 9401, 9402, 'confirmed', now());
insert into public.roster_entries
  (id, competition_id, registration_id, player_id, jersey_number, status)
overriding system value
select
  9400 + number,
  9401,
  case when number <= 5 then 9401 else 9402 end,
  9400 + number,
  case when number <= 5 then number::text else (number - 5)::text end,
  'active'
from generate_series(1, 10) number;

insert into public.competition_ruleset_revisions
  (id, competition_id, revision_number, structure_kind, status)
overriding system value values
  (9401, 9401, 1, 'regulated', 'active');
insert into public.competition_stages
  (id, competition_id, ruleset_revision_id, code, name, stage_order, structure_kind)
overriding system value values
  (9401, 9401, 9401, 'regular', 'Fase regular', 1, 'regulated');
insert into public.competition_rounds
  (id, competition_id, stage_id, code, name, round_order, structure_kind)
overriding system value values
  (9401, 9401, 9401, 'rodada_1', 'Rodada 1', 1, 'regulated');
insert into public.matchups
  (id, competition_id, round_id, home_registration_id, away_registration_id,
   matchup_order, structure_kind)
overriding system value values
  (94001, 9401, 9401, 9401, 9402, 1, 'regulated');
insert into public.games
  (id, competition_id, game_number, status, source, matchup_id, matchup_game_number)
overriding system value values
  (94001, 9401, 'PDF-ATOMIC-01', 'scheduled', 'seed', 94001, 1);
insert into public.game_participants
  (game_id, competition_id, registration_id, side)
values
  (94001, 9401, 9401, 'home'),
  (94001, 9401, 9402, 'away');
insert into storage.objects (id, bucket_id, name, metadata)
values (
  '94010000-0000-4000-8000-000000000001',
  'boxscore-pdfs',
  '9401/' || repeat('a', 64) || '.pdf',
  '{"size":104676,"mimetype":"application/pdf"}'::jsonb
);

create temp table boxscore_test_data (
  parsed jsonb,
  matches jsonb,
  resolution jsonb,
  import_id bigint
);
grant select, update on boxscore_test_data to authenticated;

with players as (
  select
    number,
    case when number <= 5 then 'Equipe PDF Casa' else 'Equipe PDF Fora' end as team_name,
    case when number <= 5 then number else number - 5 end as jersey,
    jsonb_build_object(
      'jerseyNumber', (case when number <= 5 then number else number - 5 end)::text,
      'name', 'Atleta PDF ' || number,
      'starter', number in (1,2,3,4,5,6,7,8,9,10),
      'captain', number in (1,6),
      'didNotPlay', false,
      'secondsPlayed', 2400,
      'fieldGoals', jsonb_build_object('made', 0, 'attempted', 0),
      'twoPoints', jsonb_build_object('made', 0, 'attempted', 0),
      'threePoints', jsonb_build_object('made', 0, 'attempted', 0),
      'freeThrows', jsonb_build_object('made', case when number = 1 then 1 else 0 end, 'attempted', case when number = 1 then 1 else 0 end),
      'offensiveRebounds', 0,
      'defensiveRebounds', 0,
      'rebounds', 0,
      'assists', 0,
      'turnovers', 0,
      'steals', 0,
      'blocks', 0,
      'foulsCommitted', case when number = 1 then 2 else 0 end,
      'foulsReceived', case when number = 1 then 1 else 0 end,
      'plusMinus', 0,
      'efficiency', 0,
      'points', case when number = 1 then 1 else 0 end
    ) as player
  from generate_series(1, 10) number
), teams as (
  select jsonb_build_array(
    jsonb_build_object(
      'name', 'Equipe PDF Casa', 'abbreviation', 'PDC', 'score', 1,
      'periodScores', '[1,0,0,0]'::jsonb,
      'players', (select jsonb_agg(player order by number) from players where number <= 5)
    ),
    jsonb_build_object(
      'name', 'Equipe PDF Fora', 'abbreviation', 'PDF', 'score', 0,
      'periodScores', '[0,0,0,0]'::jsonb,
      'players', (select jsonb_agg(player order by number) from players where number > 5)
    )
  ) as value
), matches as (
  select jsonb_agg(jsonb_build_object(
    'sourceTeamName', team_name,
    'sourcePlayerName', 'Atleta PDF ' || number,
    'sourceJersey', jersey::text,
    'kind', 'exact',
    'rosterEntryId', 9400 + number,
    'score', 1
  ) order by number) as value
  from players
), resolution as (
  select jsonb_build_object(
    'gameId', 94001,
    'teams', jsonb_build_array(
      jsonb_build_object('sourceTeamName', 'Equipe PDF Casa', 'registrationId', 9401),
      jsonb_build_object('sourceTeamName', 'Equipe PDF Fora', 'registrationId', 9402)
    ),
    'players', jsonb_agg(jsonb_build_object(
      'sourceTeamName', team_name,
      'sourcePlayerName', 'Atleta PDF ' || number,
      'rosterEntryId', 9400 + number
    ) order by number)
  ) as value
  from players
)
insert into boxscore_test_data (parsed, matches, resolution)
select
  jsonb_build_object(
    'format', 'FIBA_GENIUS_SPORTS',
    'parserVersion', 'fiba-genius-v1',
    'competitionName', 'Liga PDF',
    'gameNumber', 'PDF-ATOMIC-01',
    'scheduledLocal', '2026-05-09T17:00',
    'durationSeconds', 7500,
    'venue', 'Ginasio PDF',
    'teams', teams.value,
    'warnings', '[]'::jsonb
  ),
  matches.value,
  resolution.value
from teams, matches, resolution;

select has_function('public', 'admin_claim_boxscore_upload', array[]::text[], 'rate-limit RPC exists');
select has_function('public', 'admin_create_boxscore_import_draft', array['bigint','text','text','text','integer','text','jsonb','jsonb','jsonb'], 'draft RPC exists');
select has_function('public', 'admin_commit_boxscore_import', array['bigint','jsonb'], 'commit RPC exists');
select has_function('public', 'admin_begin_boxscore_import', array['bigint','text','text','text','integer','text','jsonb','jsonb','jsonb'], 'recoverable begin RPC exists');
select has_function('public', 'admin_mark_boxscore_import_ready', array['bigint','text','integer'], 'ready transition RPC exists');
select has_function('public', 'admin_commit_boxscore_import_v2', array['bigint','jsonb','jsonb'], 'atomic target commit RPC exists');
select ok(
  has_function_privilege('authenticated', 'public.admin_begin_boxscore_import(bigint,text,text,text,integer,text,jsonb,jsonb,jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.admin_begin_boxscore_import(bigint,text,text,text,integer,text,jsonb,jsonb,jsonb)', 'EXECUTE'),
  'begin RPC is restricted to authenticated callers'
);
select ok(
  has_function_privilege('authenticated', 'public.admin_mark_boxscore_import_ready(bigint,text,integer)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.admin_mark_boxscore_import_ready(bigint,text,integer)', 'EXECUTE'),
  'ready RPC is restricted to authenticated callers'
);
select ok(
  has_function_privilege('authenticated', 'public.admin_commit_boxscore_import_v2(bigint,jsonb,jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.admin_commit_boxscore_import_v2(bigint,jsonb,jsonb)', 'EXECUTE'),
  'commit v2 RPC is restricted to authenticated callers'
);
select ok(not has_table_privilege('authenticated', 'public.boxscore_imports', 'INSERT'), 'direct import inserts are revoked');
select ok(not has_table_privilege('authenticated', 'public.boxscore_imports', 'UPDATE'), 'direct import updates are revoked');
select ok(not has_table_privilege('authenticated', 'private.boxscore_upload_attempts', 'SELECT'), 'rate-limit keys are private');

reset role;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select user_id from private.admin_accounts limit 1),
    'role', 'authenticated',
    'aal', 'aal1'
  )::text,
  true
);
set local role authenticated;
select throws_ok(
  $$select public.admin_claim_boxscore_upload()$$,
  'BD401', 'BDB_ADMIN_AAL2_REQUIRED',
  'aal1 cannot claim an upload slot'
);
select throws_ok(
  $$select public.admin_mark_boxscore_import_ready(1,repeat('a',64),1)$$,
  'BD401', 'BDB_ADMIN_AAL2_REQUIRED',
  'aal1 cannot advance a recoverable import'
);

reset role;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select user_id from private.admin_accounts limit 1),
    'role', 'authenticated',
    'aal', 'aal2'
  )::text,
  true
);
set local role authenticated;
select lives_ok($$select public.admin_claim_boxscore_upload()$$, 'aal2 admin can claim an upload slot');
select lives_ok($$
  update boxscore_test_data
  set import_id = (public.admin_begin_boxscore_import(
    9401,
    repeat('a', 64),
    '9401/' || repeat('a', 64) || '.pdf',
    'fixture.pdf',
    104676,
    'fiba-genius-v1',
    parsed,
    '{"valid":true,"issues":[]}'::jsonb,
    matches
  ) ->> 'importId')::bigint
$$, 'a validated recoverable import is reserved');

select is((select status from public.boxscore_imports where id = (select import_id from boxscore_test_data)), 'uploaded', 'reserved import waits for its private object');
select throws_ok($$
  select public.admin_mark_boxscore_import_ready(import_id,repeat('f',64),104676)
  from boxscore_test_data
$$, 'BD309', 'BDB_PDF_STORAGE_OBJECT_MISMATCH', 'ready transition rejects divergent object evidence');
select is((select status from public.boxscore_imports where id = (select import_id from boxscore_test_data)), 'uploaded', 'object mismatch preserves the recoverable state');
select lives_ok($$
  select public.admin_mark_boxscore_import_ready(import_id,repeat('a',64),104676) from boxscore_test_data
$$, 'the exact private object moves the import to review');
select is((select status from public.boxscore_imports where id = (select import_id from boxscore_test_data)), 'review', 'ready import waits for review');
select is((select count(*)::integer from public.boxscore_import_player_matches where import_id = (select import_id from boxscore_test_data)), 10, 'every source player has a persisted match');
select lives_ok($$
  select public.admin_commit_boxscore_import_v2(
    import_id,
    resolution - 'gameId',
    jsonb_build_object(
      'mode','existing','gameId',94001,'applyReviewedMetadata',false,
      'scheduledAt','2026-05-09T20:00:00Z','venue','Ginasio PDF'
    )
  ) from boxscore_test_data
$$, 'reviewed import commits atomically');
select is((select status from public.boxscore_imports where id = (select import_id from boxscore_test_data)), 'confirmed', 'import is confirmed');
select is((select game_id from public.boxscore_imports where id = (select import_id from boxscore_test_data)), 94001::bigint, 'the pre-created structural game is reused');
select is((select count(*)::integer from public.game_participants where game_id = (select game_id from public.boxscore_imports where id = (select import_id from boxscore_test_data))), 2, 'both participants are committed');
select is((select count(*)::integer from public.game_periods where game_id = (select game_id from public.boxscore_imports where id = (select import_id from boxscore_test_data))), 4, 'four periods are committed');
select is((select count(*)::integer from public.game_roster_slots where game_id = (select game_id from public.boxscore_imports where id = (select import_id from boxscore_test_data))), 10, 'all roster slots are committed');
select is((select count(*)::integer from public.player_period_stats where game_id = (select game_id from public.boxscore_imports where id = (select import_id from boxscore_test_data)) and stat_scope = 'game_total'), 10, 'all imported game totals are explicit');
select is((select count(*)::integer from public.foul_events where game_id = (select game_id from public.boxscore_imports where id = (select import_id from boxscore_test_data))), 2, 'reported committed fouls are preserved');
select is((select fouls_received from public.player_period_stats stat join public.game_roster_slots slot on slot.id=stat.game_roster_slot_id where stat.game_id=94001 and slot.roster_entry_id=9401),1::smallint,'reported received fouls are persisted canonically');

reset role;
insert into public.player_period_stats (
  game_roster_slot_id, game_id, period_number, stat_scope, fouls_received
)
select id, game_id, 2, 'period', 7
from public.game_roster_slots
where game_id=94001 and roster_entry_id=9401;
insert into storage.objects (id, bucket_id, name, metadata)
values (
  '94010000-0000-4000-8000-000000000002',
  'boxscore-pdfs',
  '9401/' || repeat('b',64) || '.pdf',
  '{"size":104676,"mimetype":"application/pdf"}'::jsonb
);
insert into public.game_data_submissions (
  id, game_id, submission_version, source_type, role, status, parser_version,
  payload_hash, storage_object_id, idempotency_key, submitted_by,
  validated_by, validated_at
)
overriding system value values (
  94002, 94001, 2, 'fiba_boxscore', 'primary', 'active', 'basketball-site-v1',
  repeat('b',64), '94010000-0000-4000-8000-000000000002',
  'stats-authority-without-fr',
  (select user_id from private.admin_accounts),
  (select user_id from private.admin_accounts), now()
);

set local role authenticated;
select lives_ok($$
  select public.admin_activate_game_data_authority(
    94001,
    'player_advanced',
    94002,
    (select submission_id from public.game_data_domain_authority
      where game_id=94001 and domain='player_advanced'),
    'Fixture sem cobertura de faltas recebidas'
  )
$$,'switching to a source without received-foul coverage succeeds');
select is((select fouls_received from public.player_period_stats stat
  join public.game_roster_slots slot on slot.id=stat.game_roster_slot_id
  where stat.game_id=94001 and slot.roster_entry_id=9401
    and stat.stat_scope='game_total'),null::smallint,
  'authority without FR clears the previous canonical game total');
select is((select fouls_received from public.player_period_stats stat
  join public.game_roster_slots slot on slot.id=stat.game_roster_slot_id
  where stat.game_id=94001 and slot.roster_entry_id=9401
    and stat.stat_scope='period'),7::smallint,
  'authority reprojection does not overwrite period-level rows');
select lives_ok($$
  select public.admin_activate_game_data_authority(
    94001,
    'player_advanced',
    (select id from public.game_data_submissions
      where idempotency_key='boxscore-import:' ||
        (select import_id::text from boxscore_test_data)),
    94002,
    'Restaurar fixture FIBA com cobertura de FR'
  )
$$,'restoring the authoritative FIBA submission succeeds');
select is((select fouls_received from public.player_period_stats stat
  join public.game_roster_slots slot on slot.id=stat.game_roster_slot_id
  where stat.game_id=94001 and slot.roster_entry_id=9401
    and stat.stat_scope='game_total'),1::smallint,
  'restoring FIBA authority reprojects received fouls');
select is((select score from public.game_scores where game_id = (select game_id from public.boxscore_imports where id = (select import_id from boxscore_test_data)) and side = 'home'), 1, 'home score is derived from imported periods');
select is((select count(*)::integer from public.admin_mutation_audit where action = 'boxscore_import_confirmed' and entity_id = (select import_id from boxscore_test_data)), 1, 'confirmation has one append-only audit record');
select is(public.admin_commit_boxscore_import_v2(
  (select import_id from boxscore_test_data),
  (select resolution - 'gameId' from boxscore_test_data),
  jsonb_build_object(
    'mode','existing','gameId',94001,'applyReviewedMetadata',false,
    'scheduledAt','2026-05-09T20:00:00Z','venue','Ginasio PDF'
  )
), (select game_id from public.boxscore_imports where id = (select import_id from boxscore_test_data)), 'commit retry is idempotent');
select throws_ok($$
  select public.admin_commit_boxscore_import_v2(
    (select import_id from boxscore_test_data),
    (select resolution - 'gameId' from boxscore_test_data),
    jsonb_build_object(
      'mode','existing','gameId',94001,'applyReviewedMetadata',true,
      'scheduledAt','2026-05-09T21:00:00Z','venue','Local divergente'
    )
  )
$$, 'BR098', 'BDB_MANUAL_MATCHUP_REQUEST_CONFLICT', 'confirmed retry cannot rewrite reviewed metadata');
select is((select scheduled_at from public.games where id=94001), '2026-05-09T20:00:00Z'::timestamptz, 'divergent retry preserves confirmed metadata');

reset role;
insert into storage.objects (id, bucket_id, name, metadata)
values (
  '94010000-0000-4000-8000-000000000003',
  'boxscore-pdfs',
  '9401/' || repeat('c',64) || '.pdf',
  '{"size":104676,"mimetype":"application/pdf"}'::jsonb
);
update boxscore_test_data
set parsed = jsonb_set(parsed, '{gameNumber}', '"PDF-ATOMIC-02"'::jsonb);
set local role authenticated;
select lives_ok($$
  update boxscore_test_data
  set import_id = (public.admin_begin_boxscore_import(
    9401, repeat('c',64), '9401/' || repeat('c',64) || '.pdf', 'atomic-create.pdf',
    104676, 'fiba-genius-v1', parsed, '{"valid":true,"issues":[]}'::jsonb, matches
  ) ->> 'importId')::bigint
$$, 'a second import is reserved for atomic game creation');
select lives_ok($$
  select public.admin_mark_boxscore_import_ready(import_id,repeat('c',64),104676) from boxscore_test_data
$$, 'the second import reaches review');
select throws_ok($$
  select public.admin_commit_boxscore_import_v2(
    import_id,
    jsonb_set(resolution - 'gameId', '{players}', '[]'::jsonb),
    jsonb_build_object(
      'mode','create','requestId','94010000-0000-4000-8000-000000000099',
      'homeRegistrationId',9401,'scheduledAt','2026-05-10T20:00:00Z','venue','Ginasio PDF'
    )
  ) from boxscore_test_data
$$, 'an invalid final resolution aborts atomic game creation');
select is((select count(*)::integer from public.games where game_number='PDF-ATOMIC-02'), 0, 'failed confirmation leaves no game');
reset role;
select is((select count(*)::integer from private.manual_matchup_requests where request_id='94010000-0000-4000-8000-000000000099'), 0, 'failed confirmation rolls back its request key');
set local role authenticated;
select lives_ok($$
  select public.admin_commit_boxscore_import_v2(
    import_id,
    resolution - 'gameId',
    jsonb_build_object(
      'mode','create','requestId','94010000-0000-4000-8000-000000000099',
      'homeRegistrationId',9401,'scheduledAt','2026-05-10T20:00:00Z','venue','Ginasio PDF'
    )
  ) from boxscore_test_data
$$, 'valid confirmation creates and imports the game in one transaction');
select is((select count(*)::integer from public.games where game_number='PDF-ATOMIC-02' and status='final'), 1, 'atomic creation finishes exactly one game');
select is(public.admin_commit_boxscore_import_v2(
  (select import_id from boxscore_test_data),
  (select resolution-'gameId' from boxscore_test_data),
  jsonb_build_object(
    'mode','create','requestId','94010000-0000-4000-8000-000000000099',
    'homeRegistrationId',9401,'scheduledAt','2026-05-10T20:00:00Z','venue','Ginasio PDF'
  )
), (select game_id from public.boxscore_imports where id=(select import_id from boxscore_test_data)), 'confirmed create retry is idempotent');
select throws_ok($$
  select public.admin_commit_boxscore_import_v2(
    (select import_id from boxscore_test_data),
    (select resolution-'gameId' from boxscore_test_data),
    jsonb_build_object(
      'mode','create','requestId','94010000-0000-4000-8000-000000000099',
      'homeRegistrationId',9401,'scheduledAt','2026-05-10T20:00:00Z','venue','Local divergente'
    )
  )
$$, 'BR098', 'BDB_MANUAL_MATCHUP_REQUEST_CONFLICT', 'confirmed create retry rejects divergent metadata');

select throws_ok($$
  select public.admin_create_boxscore_import_draft(
    9401, repeat('a', 64), '9401/' || repeat('a', 64) || '.pdf', 'fixture.pdf', 104676,
    'fiba-genius-v1', parsed, '{"valid":true}'::jsonb, matches
  ) from boxscore_test_data
$$, 'BD309', 'BDB_PDF_DUPLICATE', 'duplicate hash is rejected');

select * from finish();
rollback;
