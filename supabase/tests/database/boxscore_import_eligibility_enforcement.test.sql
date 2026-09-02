begin;

create extension if not exists pgtap with schema extensions;
select plan(32);
set constraints all deferred;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '16161616-1616-4161-8161-161616161616',
  'authenticated',
  'authenticated',
  'boxscore-eligibility@example.invalid',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
)
on conflict (id) do nothing;

insert into private.admin_accounts (user_id)
select '16161616-1616-4161-8161-161616161616'
where not exists (select 1 from private.admin_accounts);

insert into public.competition_series (id, name, slug)
overriding system value values (9781, 'Liga Import Elegibilidade', 'liga-import-elegibilidade');
insert into public.categories (id, name, slug)
overriding system value values (9781, 'Categoria Import Elegibilidade', 'categoria-import-elegibilidade');
insert into public.competitions (
  id,
  series_id,
  category_id,
  year,
  display_name,
  gender_division,
  gender_division_review_required,
  status,
  published_at
)
overriding system value values (
  9781,
  9781,
  9781,
  2092,
  'Liga Import Elegibilidade 2092',
  'male',
  false,
  'published',
  now()
);
insert into public.teams (id, name, slug, abbreviation)
overriding system value values
  (9781, 'Equipe Import Casa', 'equipe-import-casa', 'EIC'),
  (9782, 'Equipe Import Fora', 'equipe-import-fora', 'EIF');
insert into public.players (id, full_name, slug)
overriding system value
select 9780 + number, 'Atleta Import ' || number, 'atleta-import-' || number
from generate_series(1, 10) number;
insert into public.team_registrations (
  id, competition_id, team_id, status, confirmed_at
)
overriding system value values
  (9781, 9781, 9781, 'confirmed', now()),
  (9782, 9781, 9782, 'confirmed', now());
insert into public.roster_entries (
  id, competition_id, registration_id, player_id, jersey_number, status
)
overriding system value
select
  9780 + number,
  9781,
  case when number <= 5 then 9781 else 9782 end,
  9780 + number,
  case when number <= 5 then number::text else (number - 5)::text end,
  case when number = 10 then 'inactive' else 'active' end
from generate_series(1, 10) number;

update private.player_private
set sex = null, sex_review_required = true
where player_id = 9790;

create temp table boxscore_eligibility_test_data (
  parsed jsonb,
  matches jsonb,
  resolution jsonb,
  import_id bigint,
  game_id bigint,
  last_error jsonb
);
grant select, update on boxscore_eligibility_test_data to authenticated;

with players as (
  select
    number,
    case when number <= 5 then 'Equipe Import Casa' else 'Equipe Import Fora' end as team_name,
    case when number <= 5 then number else number - 5 end as jersey,
    jsonb_build_object(
      'jerseyNumber', (case when number <= 5 then number else number - 5 end)::text,
      'name', 'Atleta Import ' || number,
      'starter', true,
      'captain', number in (1, 6),
      'didNotPlay', false,
      'secondsPlayed', 2400,
      'fieldGoals', jsonb_build_object('made', 0, 'attempted', 0),
      'twoPoints', jsonb_build_object('made', 0, 'attempted', 0),
      'threePoints', jsonb_build_object('made', 0, 'attempted', 0),
      'freeThrows', jsonb_build_object('made', 0, 'attempted', 0),
      'offensiveRebounds', 0,
      'defensiveRebounds', 0,
      'rebounds', 0,
      'assists', 0,
      'turnovers', 0,
      'steals', 0,
      'blocks', 0,
      'foulsCommitted', 0,
      'foulsReceived', 0,
      'plusMinus', 0,
      'efficiency', 0,
      'points', 0
    ) as player
  from generate_series(1, 10) number
), teams as (
  select jsonb_build_array(
    jsonb_build_object(
      'name', 'Equipe Import Casa',
      'abbreviation', 'EIC',
      'score', 0,
      'periodScores', '[0,0,0,0]'::jsonb,
      'players', (select jsonb_agg(player order by number) from players where number <= 5)
    ),
    jsonb_build_object(
      'name', 'Equipe Import Fora',
      'abbreviation', 'EIF',
      'score', 0,
      'periodScores', '[0,0,0,0]'::jsonb,
      'players', (select jsonb_agg(player order by number) from players where number > 5)
    )
  ) as value
), matches as (
  select jsonb_agg(jsonb_build_object(
    'sourceTeamName', team_name,
    'sourcePlayerName', 'Atleta Import ' || number,
    'sourceJersey', jersey::text,
    'kind', 'exact',
    'playerId', 9780 + number,
    'rosterEntryId', case when number = 10 then null else 9780 + number end,
    'score', 1
  ) order by number) as value
  from players
), resolution as (
  select jsonb_build_object(
    'teams', jsonb_build_array(
      jsonb_build_object('sourceTeamName', 'Equipe Import Casa', 'registrationId', 9781),
      jsonb_build_object('sourceTeamName', 'Equipe Import Fora', 'registrationId', 9782)
    ),
    'players', jsonb_agg(jsonb_build_object(
      'sourceTeamName', team_name,
      'sourcePlayerName', 'Atleta Import ' || number,
      'action', case when number = 10 then 'add_existing' else 'existing_roster' end,
      'playerId', case when number = 10 then 9790 else null end,
      'rosterEntryId', case when number = 10 then null else 9780 + number end
    ) order by number)
  ) as value
  from players
)
insert into boxscore_eligibility_test_data (parsed, matches, resolution)
select
  jsonb_build_object(
    'format', 'FIBA_GENIUS_SPORTS',
    'parserVersion', 'fiba-genius-v1',
    'competitionName', 'Liga Import Elegibilidade',
    'gameNumber', 'IMPORT-ELIGIBILITY-01',
    'scheduledLocal', '2092-05-09T17:00',
    'durationSeconds', 7200,
    'venue', 'Ginasio Import',
    'teams', teams.value,
    'warnings', '[]'::jsonb
  ),
  matches.value,
  resolution.value
from teams, matches, resolution;

create function pg_temp.capture_boxscore_commit(p_import_id bigint, p_resolution jsonb)
returns jsonb
language plpgsql
as $$
declare
  error_code text;
  error_message text;
  error_detail text;
begin
  perform public.admin_commit_boxscore_import(p_import_id, p_resolution);
  return null;
exception when others then
  get stacked diagnostics
    error_code = returned_sqlstate,
    error_message = message_text,
    error_detail = pg_exception_detail;
  return jsonb_build_object(
    'code', error_code,
    'message', error_message,
    'detail', error_detail
  );
end;
$$;
grant execute on function pg_temp.capture_boxscore_commit(bigint, jsonb) to authenticated;

select has_function(
  'public',
  'admin_commit_boxscore_import',
  array['bigint', 'jsonb'],
  'the public atomic commit RPC exists'
);
select ok(
  not has_function_privilege('anon', 'public.admin_commit_boxscore_import(bigint,jsonb)', 'execute'),
  'anonymous users cannot confirm an import'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'private.admin_commit_boxscore_import_without_eligibility(bigint,jsonb)',
    'execute'
  ),
  'authenticated users cannot bypass the eligibility wrapper'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.admin_commit_boxscore_import(1, '{}'::jsonb)$$,
  'BD401', 'BDB_ADMIN_AAL2_REQUIRED',
  'an authenticated non-admin cannot confirm an import'
);

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
  $$select public.admin_commit_boxscore_import(1, '{}'::jsonb)$$,
  'BD401', 'BDB_ADMIN_AAL2_REQUIRED',
  'the administrator at aal1 cannot confirm an import'
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
select lives_ok(
  $$select public.admin_claim_boxscore_upload()$$,
  'the aal2 administrator claims an upload slot'
);
select lives_ok($$
  update boxscore_eligibility_test_data
  set import_id = public.admin_create_boxscore_import_draft(
    9781,
    repeat('e', 64),
    '9781/' || repeat('e', 64) || '.pdf',
    'eligibility-fixture.pdf',
    104676,
    'fiba-genius-v1',
    parsed,
    '{"valid":true,"issues":[]}'::jsonb,
    matches
  )
$$, 'a validated draft is created');
select is(
  (select status from public.boxscore_imports
   where id = (select import_id from boxscore_eligibility_test_data)),
  'review',
  'the import starts in review'
);
select lives_ok($$
  update boxscore_eligibility_test_data
  set last_error = pg_temp.capture_boxscore_commit(import_id, resolution)
$$, 'the pending decision is captured');
select is(
  (select last_error ->> 'code' from boxscore_eligibility_test_data),
  'BD601',
  'a pending private profile returns the stable code'
);
select is(
  (select last_error ->> 'message' from boxscore_eligibility_test_data),
  'BDB_PLAYER_ELIGIBILITY_PENDING',
  'the pending decision keeps the stable message'
);
select ok(
  (select (last_error ->> 'detail')::jsonb -> 'players'
     @> '[{"sourcePlayerName":"Atleta Import 10"}]'::jsonb
   from boxscore_eligibility_test_data),
  'the pending response identifies the source athlete'
);
select ok(
  (select last_error ->> 'detail' from boxscore_eligibility_test_data)
    !~ 'male|female|"sex"',
  'the pending response contains no private value'
);
select is(
  (select status from public.boxscore_imports
   where id = (select import_id from boxscore_eligibility_test_data)),
  'review',
  'a pending decision leaves the import in review'
);
select is(
  (select count(*)::integer from public.games where game_number = 'IMPORT-ELIGIBILITY-01'),
  0,
  'a pending decision creates no game'
);
select is(
  (select count(*)::integer from public.game_participants
   where game_id in (select id from public.games where game_number = 'IMPORT-ELIGIBILITY-01')),
  0,
  'a pending decision creates no participants'
);
select is(
  (select count(*)::integer from public.boxscore_import_player_matches
   where import_id = (select import_id from boxscore_eligibility_test_data)
     and status = 'confirmed'),
  0,
  'a pending decision confirms no player match'
);
select is(
  (select status from public.roster_entries where id = 9790),
  'inactive',
  'a pending decision does not reactivate the roster entry'
);
select is(
  (select count(*)::integer from public.admin_mutation_audit
   where action = 'boxscore_import_confirmed'
     and entity_id = (select import_id from boxscore_eligibility_test_data)),
  0,
  'a pending decision writes no confirmation audit'
);

reset role;
update private.player_private
set sex = 'female', sex_review_required = false
where player_id = 9790;
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
select lives_ok($$
  update boxscore_eligibility_test_data
  set last_error = pg_temp.capture_boxscore_commit(import_id, resolution)
$$, 'the incompatible decision is captured');
select is(
  (select last_error ->> 'code' from boxscore_eligibility_test_data),
  'BD602',
  'an incompatible private profile returns the stable code'
);
select is(
  (select status from public.boxscore_imports
   where id = (select import_id from boxscore_eligibility_test_data)),
  'review',
  'an incompatible decision leaves the import in review'
);
select is(
  (select count(*)::integer from public.games where game_number = 'IMPORT-ELIGIBILITY-01'),
  0,
  'an incompatible decision leaves no partial game'
);

reset role;
update private.player_private
set sex = 'male', sex_review_required = false
where player_id = 9790;
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
select lives_ok($$
  update boxscore_eligibility_test_data
  set game_id = public.admin_commit_boxscore_import(import_id, resolution)
$$, 'a compatible resolution commits atomically');
select is(
  (select status from public.boxscore_imports
   where id = (select import_id from boxscore_eligibility_test_data)),
  'confirmed',
  'the compatible import is confirmed'
);
select is(
  (select count(*)::integer from public.games where game_number = 'IMPORT-ELIGIBILITY-01'),
  1,
  'the compatible import creates exactly one game'
);
select is(
  (select status from public.roster_entries where id = 9790),
  'active',
  'the compatible player is reactivated'
);
select ok(
  (select resolution_payload::text from public.boxscore_imports
   where id = (select import_id from boxscore_eligibility_test_data))
    !~ 'eligibilitySex|"sex"|male|female',
  'the persisted resolution contains no private value'
);
select is(
  (select count(*)::integer from public.admin_mutation_audit
   where action = 'boxscore_import_confirmed'
     and entity_id = (select import_id from boxscore_eligibility_test_data)),
  1,
  'the compatible confirmation writes one audit event'
);
select is(
  public.admin_commit_boxscore_import(
    (select import_id from boxscore_eligibility_test_data),
    (select resolution from boxscore_eligibility_test_data)
  ),
  (select game_id from boxscore_eligibility_test_data),
  'a confirmation retry is idempotent'
);
select is(
  (select count(*)::integer from public.admin_mutation_audit
   where action = 'boxscore_import_confirmed'
     and entity_id = (select import_id from boxscore_eligibility_test_data)),
  1,
  'the idempotent retry does not duplicate audit events'
);
select ok(
  not has_table_privilege('authenticated', 'private.player_private', 'SELECT'),
  'authenticated users still cannot read the private table directly'
);

select * from finish();
rollback;
