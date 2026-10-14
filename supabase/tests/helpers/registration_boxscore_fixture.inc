-- FIBA v2 fixture derived from WP14: identical sporting facts, independent A/B identity.
\ir final_profile_fixtures.inc

create extension if not exists pgtap with schema extensions;
set constraints all deferred;
select set_config('bdb.allow_internal_ingestion_game', 'on', true);

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
select pg_temp.create_final_competition(
  9414,9414,9414,2026,'Liga WP14 2026','published',now(),'male','fiba_boxscore'
);
insert into public.teams (id, name, slug, abbreviation)
overriding system value values
  (9414, 'Lobos Global', 'equipe-wp14-casa', 'LOB'),
  (9415, 'Lobos B', 'equipe-wp14-fora', 'WPF');
insert into public.players (id, full_name, slug)
overriding system value
select 94140 + number, 'Atleta WP14 ' || number, 'atleta-wp14-' || number
from generate_series(1, 10) number;
insert into private.player_private(player_id,sex,sex_review_required)
select 94140+number,'male',false from generate_series(1,10) number;
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
  'active'
from generate_series(1, 10) number;

insert into public.competition_ruleset_revisions
  (id, competition_id, revision_number, structure_kind, status)
overriding system value values
  (9414, 9414, 1, 'regulated', 'active');
insert into public.competition_stages
  (id, competition_id, ruleset_revision_id, code, name, stage_order, structure_kind)
overriding system value values
  (9414, 9414, 9414, 'regular', 'Fase regular', 1, 'regulated');
insert into public.competition_rounds
  (id, competition_id, stage_id, code, name, round_order, structure_kind)
overriding system value values
  (9414, 9414, 9414, 'rodada_1', 'Rodada 1', 1, 'regulated');
insert into public.matchups
  (id, competition_id, round_id, home_registration_id, away_registration_id,
   matchup_order, structure_kind)
overriding system value values
  (94141, 9414, 9414, 9414, 9415, 1, 'regulated');
insert into public.games
  (id, competition_id, game_number, status, source, matchup_id, matchup_game_number)
overriding system value values
  (94141, 9414, 'WP14-ATOMIC-01', 'scheduled', 'seed', 94141, 1);
insert into public.game_participants
  (game_id, competition_id, registration_id, side)
values
  (94141, 9414, 9414, 'home'),
  (94141, 9414, 9415, 'away');
insert into storage.objects (id, bucket_id, name)
values (
  '94140000-0000-4000-8000-000000000001',
  'boxscore-pdfs',
  '9414/' || repeat('b', 64) || '.pdf'
);

create temp table wp14_test_data (
  case_key text not null default 'own',
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
    case when number <= 5 then 'Lobos A' else 'Lobos B' end as team_name,
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
      'name', 'Lobos A',
      'abbreviation', 'LAA',
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
      'name', 'Lobos B',
      'abbreviation', 'LBB',
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
  select jsonb_agg(jsonb_build_object(
    'sourceTeamName',team_name,'sourcePlayerName','Atleta WP14 ' || number,
    'sourceJersey',jersey::text,'kind','exact','playerId',94140+number,
    'rosterEntryId',94140+number,'score',1,'alternatives','[]'::jsonb
  ) order by number) as value from players
), resolution as (
  select jsonb_build_object('gameId',94141,'teams',jsonb_build_array(
    jsonb_build_object('sourceTeamName','Lobos A','registrationId',9414),
    jsonb_build_object('sourceTeamName','Lobos B','registrationId',9415)
  ),'players',jsonb_agg(jsonb_build_object(
    'sourceTeamName',team_name,'sourcePlayerName','Atleta WP14 ' || number,
    'action','existing_roster','rosterEntryId',94140+number
  ) order by number)) as value from players
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


update public.team_registrations
set team_id=9414, public_name=case id when 9414 then 'Lobos A' else 'Lobos B' end
where id in (9414,9415);
insert into public.teams(id,name,slug,abbreviation) overriding system value
values(9416,'Ursos','ursos-registration-bound','LOB');
insert into public.team_registrations(id,competition_id,team_id,public_name,status)
overriding system value values(9416,9414,9416,'Ursos','draft');
insert into public.matchups(id,competition_id,round_id,home_registration_id,away_registration_id,matchup_order,structure_kind)
overriding system value values(94142,9414,9414,9414,9415,2,'regulated');
insert into public.games(id,competition_id,game_number,status,source,matchup_id,matchup_game_number)
overriding system value values(94142,9414,'WP14-ATOMIC-02','scheduled','seed',94142,1);
insert into public.game_participants(game_id,competition_id,registration_id,side)
values(94142,9414,9414,'home'),(94142,9414,9415,'away');
insert into storage.objects(id,bucket_id,name)
values('94140000-0000-4000-8000-000000000002','boxscore-pdfs','9414/' || repeat('c',64) || '.pdf');
insert into wp14_test_data(case_key,parsed,matches,resolution)
select 'shared',jsonb_set(jsonb_set(jsonb_set(parsed,'{gameNumber}','"WP14-ATOMIC-02"'),
  '{teams,0,abbreviation}','"LOB"'),'{teams,1,abbreviation}','"LOB"'),
  matches,jsonb_set(resolution,'{gameId}','94142')
from wp14_test_data where case_key='own';
select set_config('request.jwt.claims',jsonb_build_object(
  'sub',(select user_id from private.admin_accounts limit 1),'role','authenticated','aal','aal2'
)::text,true);
set local role authenticated;
select public.admin_claim_boxscore_upload() from wp14_test_data;
update wp14_test_data set import_id=public.admin_create_boxscore_import_draft(
  9414,case case_key when 'own' then repeat('b',64) else repeat('c',64) end,
  '9414/' || case case_key when 'own' then repeat('b',64) else repeat('c',64) end || '.pdf',
  'registration-' || case_key || '.pdf',120000,'fiba-genius-v2',parsed,
  '{"valid":true,"issues":[]}',matches
);
