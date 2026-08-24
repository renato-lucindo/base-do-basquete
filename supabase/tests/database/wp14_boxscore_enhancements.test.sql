begin;

create extension if not exists pgtap with schema extensions;
select plan(27);
set constraints all deferred;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '14141414-1414-4141-8141-141414141414',
  'authenticated',
  'authenticated',
  'wp14-fixture@example.invalid',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
)
on conflict (id) do nothing;

insert into private.admin_accounts (user_id)
select '14141414-1414-4141-8141-141414141414'
where not exists (select 1 from private.admin_accounts);

insert into public.competition_series (id, name, slug)
overriding system value values (9414, 'Liga WP14', 'liga-wp14');
insert into public.categories (id, name, slug)
overriding system value values (9414, 'Categoria WP14', 'categoria-wp14');
insert into public.competitions
  (id, series_id, category_id, year, display_name, status, published_at)
overriding system value values
  (9414, 9414, 9414, 2026, 'Liga WP14 2026', 'published', now());
insert into public.teams (id, name, slug, abbreviation)
overriding system value values
  (9414, 'Equipe WP14 Casa', 'equipe-wp14-casa', 'WPC'),
  (9415, 'Equipe WP14 Fora', 'equipe-wp14-fora', 'WPF');
insert into public.players (id, full_name, slug)
overriding system value
select 94140 + number, 'Atleta WP14 ' || number, 'atleta-wp14-' || number
from generate_series(1, 9) number;
insert into public.team_registrations
  (id, competition_id, team_id, status, confirmed_at)
overriding system value values
  (9414, 9414, 9414, 'confirmed', now()),
  (9415, 9414, 9415, 'confirmed', now());
insert into public.roster_entries
  (id, competition_id, registration_id, player_id, jersey_number, status)
overriding system value
select
  94140 + number,
  9414,
  case when number <= 5 then 9414 else 9415 end,
  94140 + number,
  case when number <= 5 then number::text else (number - 5)::text end,
  case when number = 5 then 'inactive' else 'active' end
from generate_series(1, 9) number;

create temp table wp14_test_data (
  parsed jsonb,
  matches jsonb,
  resolution jsonb,
  import_id bigint,
  game_id bigint
);
grant select, update on wp14_test_data to authenticated;

with players as (
  select
    number,
    case when number <= 5 then 'Equipe WP14 Casa' else 'Equipe WP14 Fora' end as team_name,
    case when number <= 5 then number else number - 5 end as jersey,
    jsonb_build_object(
      'jerseyNumber', (case when number <= 5 then number else number - 5 end)::text,
      'name', 'Atleta WP14 ' || number,
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
      'points', case when number = 1 then 10 when number = 6 then 8 else 0 end
    ) as player
  from generate_series(1, 10) number
), teams as (
  select jsonb_build_array(
    jsonb_build_object(
      'name', 'Equipe WP14 Casa',
      'abbreviation', 'WPC',
      'score', 10,
      'periodScores', '[3,2,3,2]'::jsonb,
      'teamStatistics', jsonb_build_object(
        'pointsFromTurnovers', 2,
        'pointsInPaint', 6,
        'pointsInPaintMade', 3,
        'pointsInPaintAttempted', 5,
        'secondChancePoints', 2,
        'fastBreakPoints', 4,
        'fastBreakPointsFromTurnovers', 2,
        'benchPoints', 0,
        'largestLead', 4,
        'largestScoringRun', 5,
        'pointsPerPossession', 0.91,
        'timeLeadingSeconds', 1300
      ),
      'players', (select jsonb_agg(player order by number) from players where number <= 5)
    ),
    jsonb_build_object(
      'name', 'Equipe WP14 Fora',
      'abbreviation', 'WPF',
      'score', 8,
      'periodScores', '[2,2,2,2]'::jsonb,
      'teamStatistics', jsonb_build_object(
        'pointsFromTurnovers', 1,
        'pointsInPaint', 4,
        'pointsInPaintMade', 2,
        'pointsInPaintAttempted', 4,
        'secondChancePoints', 0,
        'fastBreakPoints', 2,
        'fastBreakPointsFromTurnovers', 0,
        'benchPoints', 0,
        'largestLead', 2,
        'largestScoringRun', 4,
        'pointsPerPossession', 0.80,
        'timeLeadingSeconds', 800
      ),
      'players', (select jsonb_agg(player order by number) from players where number > 5)
    )
  ) as value
), matches as (
  select jsonb_agg(
    jsonb_build_object(
      'sourceTeamName', team_name,
      'sourcePlayerName', 'Atleta WP14 ' || number,
      'sourceJersey', jersey::text,
      'kind', case when number = 10 then 'unmatched' else 'exact' end,
      'playerId', case when number <= 9 then 94140 + number else null end,
      'rosterEntryId', case when number <> 5 and number <= 9 then 94140 + number else null end,
      'score', case when number = 10 then null else 1 end,
      'alternatives', case
        when number = 5 then jsonb_build_array(jsonb_build_object(
          'playerId', 94145,
          'rosterEntryId', null,
          'registrationId', null,
          'playerName', 'Atleta WP14 5',
          'jerseyNumber', null,
          'teamName', null,
          'score', 1
        ))
        else '[]'::jsonb
      end
    ) order by number
  ) as value
  from players
), resolution as (
  select jsonb_build_object(
    'teams', jsonb_build_array(
      jsonb_build_object('sourceTeamName', 'Equipe WP14 Casa', 'registrationId', 9414),
      jsonb_build_object('sourceTeamName', 'Equipe WP14 Fora', 'registrationId', 9415)
    ),
    'players', jsonb_agg(
      jsonb_build_object(
        'sourceTeamName', team_name,
        'sourcePlayerName', 'Atleta WP14 ' || number,
        'action', case
          when number = 5 then 'add_existing'
          when number = 10 then 'create_new'
          else 'existing_roster'
        end,
        'playerId', case when number = 5 then 94145 else null end,
        'rosterEntryId', case when number <> 5 and number <= 9 then 94140 + number else null end
      ) order by number
    )
  ) as value
  from players
)
insert into wp14_test_data (parsed, matches, resolution)
select
  jsonb_build_object(
    'format', 'FIBA_GENIUS_SPORTS',
    'parserVersion', 'fiba-genius-v2',
    'competitionName', 'Liga WP14',
    'gameNumber', 'WP14-ATOMIC-01',
    'scheduledLocal', '2026-08-24T17:00',
    'durationSeconds', 7200,
    'venue', 'Ginasio WP14',
    'teams', teams.value,
    'gameStatistics', jsonb_build_object('leadChanges', 2, 'timesTied', 1),
    'warnings', '[]'::jsonb
  ),
  matches.value,
  resolution.value
from teams, matches, resolution;

select has_table('public', 'game_team_statistics', 'team statistics table exists');
select has_table('public', 'game_statistics', 'game statistics table exists');
select has_function(
  'public',
  'admin_refresh_boxscore_team_statistics',
  array['bigint','jsonb','jsonb'],
  'refresh RPC exists'
);
select ok(
  has_table_privilege('anon', 'public.game_team_statistics', 'SELECT'),
  'anonymous users receive only the deliberate select grant'
);
select ok(
  not has_table_privilege('authenticated', 'public.game_team_statistics', 'INSERT'),
  'authenticated direct team-stat inserts are revoked'
);
select ok(
  not has_table_privilege('authenticated', 'public.game_statistics', 'UPDATE'),
  'authenticated direct game-stat updates are revoked'
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
select lives_ok($$select public.admin_claim_boxscore_upload()$$, 'aal2 admin claims upload slot');
select lives_ok($$
  update wp14_test_data
  set import_id = public.admin_create_boxscore_import_draft(
    9414,
    repeat('b', 64),
    '9414/' || repeat('b', 64) || '.pdf',
    'wp14-fixture.pdf',
    120000,
    'fiba-genius-v2',
    parsed,
    '{"valid":true,"issues":[]}'::jsonb,
    matches
  )
$$, 'v2 review draft is created');
select is(
  (select count(*)::integer from public.boxscore_import_player_matches
   where import_id = (select import_id from wp14_test_data)
     and jsonb_array_length(suggestion_payload) = 1),
  1,
  'similar-name alternatives are persisted for review'
);
select throws_ok($$
  select public.admin_commit_boxscore_import(
    import_id,
    jsonb_set(resolution, '{players,4,action}', '"create_new"'::jsonb)
  )
  from wp14_test_data
$$, 'BD308', 'BDB_PDF_PLAYER_ALREADY_EXISTS', 'exact normalized duplicates cannot be created');
select is(
  (select count(*)::integer from public.games where game_number = 'WP14-ATOMIC-01'),
  0,
  'a rejected player resolution rolls back the entire game'
);
select lives_ok($$
  update wp14_test_data
  set game_id = public.admin_commit_boxscore_import(import_id, resolution)
$$, 'review atomically commits existing, attached and new players');
select is(
  (select count(*)::integer from public.game_team_statistics
   where game_id = (select game_id from wp14_test_data)),
  2,
  'both teams receive collective metrics'
);
select is(
  (select points_in_paint from public.game_team_statistics
   where game_id = (select game_id from wp14_test_data) and registration_id = 9414),
  6::smallint,
  'points in the paint are persisted exactly'
);
select is(
  (select fast_break_points_from_turnovers from public.game_team_statistics
   where game_id = (select game_id from wp14_test_data) and registration_id = 9414),
  2::smallint,
  'fast-break points from turnovers are persisted exactly'
);
select is(
  (select lead_changes from public.game_statistics
   where game_id = (select game_id from wp14_test_data)),
  2::smallint,
  'lead changes are persisted'
);
select is(
  (select count(*)::integer from public.players where full_name = 'Atleta WP14 10'),
  1,
  'one missing player is created'
);
select is(
  (select count(*)::integer from public.roster_entries roster
   join public.players player on player.id = roster.player_id
   where roster.competition_id = 9414 and roster.status = 'active'
     and player.full_name in ('Atleta WP14 5', 'Atleta WP14 10')),
  2,
  'existing and new players are attached to the selected rosters'
);
select is(
  (select count(*)::integer from public.boxscore_import_player_matches
   where import_id = (select import_id from wp14_test_data)
     and resolution_kind = 'added_existing'),
  1,
  'the attached existing-player decision is audited per match'
);
select is(
  (select count(*)::integer from public.boxscore_import_player_matches
   where import_id = (select import_id from wp14_test_data)
     and resolution_kind = 'created_new'),
  1,
  'the created-player decision is audited per match'
);
select is(
  (select (metadata ->> 'createdPlayers')::integer from public.admin_mutation_audit
   where action = 'boxscore_import_confirmed'
     and entity_id = (select import_id from wp14_test_data)),
  1,
  'confirmation audit records the created-player count'
);
select throws_ok($$
  select public.admin_refresh_boxscore_team_statistics(
    (select import_id from wp14_test_data),
    jsonb_set((select parsed from wp14_test_data), '{gameNumber}', '"WRONG"'::jsonb),
    '{"valid":true,"issues":[]}'::jsonb
  )
$$, 'BD310', 'BDB_PDF_TEAM_STATS_INVALID', 'refresh rejects a mismatched game number');

reset role;
delete from public.game_team_statistics where game_id = (select game_id from wp14_test_data);
delete from public.game_statistics where game_id = (select game_id from wp14_test_data);
update public.boxscore_imports
set parser_version = 'fiba-genius-v1'
where id = (select import_id from wp14_test_data);

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
  select public.admin_refresh_boxscore_team_statistics(
    (select import_id from wp14_test_data),
    (select parsed from wp14_test_data),
    '{"valid":true,"issues":[]}'::jsonb
  )
$$, 'stored PDF can be safely reprocessed with parser v2');
select is(
  (select parser_version from public.boxscore_imports
   where id = (select import_id from wp14_test_data)),
  'fiba-genius-v2',
  'refresh upgrades the recorded parser version'
);
select is(
  (select count(*)::integer from public.game_team_statistics
   where game_id = (select game_id from wp14_test_data)),
  2,
  'refresh restores both team-stat rows'
);
select is(
  (select count(*)::integer from public.admin_mutation_audit
   where action = 'boxscore_team_stats_refreshed'
     and entity_id = (select import_id from wp14_test_data)),
  1,
  'refresh writes one essential audit record'
);
select throws_ok($$
  insert into public.game_statistics (game_id, lead_changes, times_tied, source_parser_version)
  values ((select game_id from wp14_test_data), 0, 0, 'forbidden')
$$, '42501', null, 'authenticated users cannot write statistics directly');
select is(
  public.admin_commit_boxscore_import(
    (select import_id from wp14_test_data),
    (select resolution from wp14_test_data)
  ),
  (select game_id from wp14_test_data),
  'commit remains idempotent after refresh'
);

select * from finish();
rollback;
