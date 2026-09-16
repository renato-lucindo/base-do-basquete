begin;
\ir ../../test-support/final_profile_fixtures.sql

create extension if not exists pgtap with schema extensions;
select plan(34);
set constraints all deferred;
select set_config('bdb.allow_internal_ingestion_game', 'on', true);

insert into private.admin_accounts (user_id)
select '11111111-1111-4111-8111-111111111111'
where not exists (select 1 from private.admin_accounts);

insert into public.competition_series (id, name, slug)
overriding system value values (9101, 'Liga Teste', 'liga-teste');
insert into public.categories (id, name, slug)
overriding system value values (9101, 'Teste Sub-15', 'teste-sub-15');
select pg_temp.create_final_competition(
  9101,9101,9101,2026,'Liga Teste 2026 Sub-15','published',now(),'male','manual_scoresheet'
);
select pg_temp.create_final_competition(
  9102,9101,9101,2027,'Liga Teste 2027 Sub-15','draft',null,'male','manual_scoresheet'
);
insert into public.teams (id, name, slug, abbreviation, is_public)
overriding system value values
  (9101, 'Equipe Azul', 'equipe-azul', 'AZL', true),
  (9102, 'Equipe Dourada', 'equipe-dourada', 'DOU', true),
  (9103, 'Equipe Verde', 'equipe-verde', 'VRD', false);
insert into public.players (id, full_name, slug, is_public)
overriding system value values
  (9101, 'Atleta Um', 'atleta-um', true),
  (9102, 'Atleta Dois', 'atleta-dois', true),
  (9103, 'Atleta Tres', 'atleta-tres', false);
insert into private.player_private(player_id,sex,sex_review_required)
values(9101,'male',false),(9102,'male',false),(9103,'male',false);
insert into public.team_registrations
  (id, competition_id, team_id, status, confirmed_at)
overriding system value values
  (9101, 9101, 9101, 'confirmed', now()),
  (9102, 9101, 9102, 'confirmed', now()),
  (9103, 9102, 9103, 'draft', null);
insert into public.roster_entries
  (id, competition_id, registration_id, player_id, jersey_number)
overriding system value values
  (9101, 9101, 9101, 9101, '00'),
  (9102, 9101, 9102, 9102, '7'),
  (9103, 9102, 9103, 9103, '1');
insert into public.games (id, competition_id, game_number, status, source)
overriding system value values
  (9101, 9101, 'T-01', 'scheduled', 'seed'),
  (9102, 9102, 'T-02', 'scheduled', 'seed'),
  (9103, 9101, 'T-03', 'draft', 'seed'),
  (9104, 9101, 'T-04', 'draft', 'seed');
insert into public.game_participants (game_id, competition_id, registration_id, side)
values
  (9101, 9101, 9101, 'home'),
  (9101, 9101, 9102, 'away'),
  (9102, 9102, 9103, 'home'),
  (9104, 9101, 9101, 'home');
insert into public.game_periods (game_id, period_number)
values (9101, 1), (9101, 6);
insert into public.game_period_scores (game_id, registration_id, period_number, points)
values
  (9101, 9101, 1, 10),
  (9101, 9101, 6, 4),
  (9101, 9102, 1, 12),
  (9101, 9102, 6, 1);
insert into public.game_roster_slots
  (id, game_id, registration_id, slot_number, roster_entry_id, jersey_number)
overriding system value values
  (9101, 9101, 9101, 1, 9101, '00'),
  (9102, 9101, 9102, 1, 9102, '7');
insert into public.player_period_stats
  (game_roster_slot_id, game_id, period_number, two_point_made,
   two_point_attempted, three_point_made, three_point_attempted,
   free_throw_made, free_throw_attempted)
values (9101, 9101, 1, 2, 3, 1, 2, 2, 2);
insert into public.foul_events
  (game_roster_slot_id, game_id, period_number, sequence_number, foul_code)
values (9101, 9101, 1, 1, 'U2');
insert into public.final_placements
  (id, competition_id, registration_id, placement, result_label, result_status, confirmed_by, confirmed_at)
overriding system value
select 9101, 9101, 9101, 1, 'Campeao', 'placed', user_id, now()
from private.admin_accounts;
insert into public.boxscore_imports
  (id, competition_id, game_id, sha256, storage_path, parser_version, created_by)
overriding system value
select
  9101, 9101, 9101, repeat('a', 64), 'tests/fixture-a.pdf', 'fiba-genius-v1', user_id
from private.admin_accounts;
insert into public.boxscore_import_player_matches
  (id, import_id, competition_id, source_team_name, source_player_name,
   roster_entry_id, status, decided_by, decided_at)
overriding system value
select
  9101, 9101, 9101, 'Equipe Azul', 'Atleta Um', 9101, 'confirmed', user_id, now()
from private.admin_accounts;

select has_table('public', 'competitions', 'canonical competitions table exists');
select has_view('public', 'game_scores', 'game scores are exposed as a derived view');
select throws_ok(
  $$select pg_temp.create_final_competition(
      null,9101,9101,2026,'Duplicada','published',now(),'male','manual_scoresheet'
    )$$,
  '23505',
  'duplicate key value violates unique constraint "competitions_context_unique"',
  'unclassified series/category/year context is unique'
);
select throws_ok(
  $$insert into public.teams (name, slug) values ('Slug Ruim', 'Slug Ruim')$$,
  '23514',
  'new row for relation "teams" violates check constraint "teams_slug_check"',
  'slugs are canonical'
);
select throws_ok(
  $$insert into public.team_registrations
      (competition_id, team_id, status, confirmed_at)
    values (9101, 9101, 'confirmed', now())$$,
  '23505',
  'duplicate key value violates unique constraint "team_registrations_competition_team_unique"',
  'a team registers once per edition'
);
select throws_ok(
  $$insert into public.roster_entries
      (competition_id, registration_id, player_id, jersey_number)
    values (9101, 9102, 9101, '8')$$,
  '23505',
  'duplicate key value violates unique constraint "roster_entries_active_competition_player_uidx"',
  'a player cannot represent two teams in the same edition'
);
select lives_ok(
  $$insert into public.players (id, full_name, slug)
      overriding system value values (9104, 'Atleta Quatro', 'atleta-quatro');
    insert into private.player_private(player_id,sex,sex_review_required)
      values(9104,'male',false);
    insert into public.roster_entries
      (competition_id, registration_id, player_id, jersey_number)
    values (9102, 9103, 9104, '8')$$,
  'the same athlete rule remains scoped to one edition'
);
select is(
  (select jersey_number from public.roster_entries where id = 9101),
  '00'::text,
  'jersey 00 is preserved as text'
);
select throws_ok(
  $$insert into public.players (id, full_name, slug)
      overriding system value values (9105, 'Atleta Cinco', 'atleta-cinco');
    insert into private.player_private(player_id,sex,sex_review_required)
      values(9105,'male',false);
    insert into public.roster_entries
      (competition_id, registration_id, player_id, jersey_number)
    values (9101, 9101, 9105, '00')$$,
  '23505',
  'duplicate key value violates unique constraint "roster_entries_active_registration_jersey_uidx"',
  'active jerseys are unique inside a team registration'
);
select throws_ok(
    $$insert into public.game_participants
      (game_id, competition_id, registration_id, side)
    values (9103, 9101, 9103, 'home')$$,
  '23503',
  'insert or update on table "game_participants" violates foreign key constraint "game_participants_registration_competition_fkey"',
  'game participants must be registered in the same edition'
);
select throws_ok(
    $$insert into public.game_participants
      (game_id, competition_id, registration_id, side)
    values (9104, 9101, 9101, 'away')$$,
  '23505',
  'duplicate key value violates unique constraint "game_participants_game_registration_unique"',
  'one registration cannot occupy both sides'
);
select ok(
  exists (select 1 from public.game_periods where game_id = 9101 and period_number = 6),
  'overtime period numbers are unlimited'
);
select throws_ok(
  $$insert into public.game_periods (game_id, period_number) values (9101, 0)$$,
  '23514',
  'new row for relation "game_periods" violates check constraint "game_periods_period_number_check"',
  'period numbers must be positive'
);
select throws_ok(
  $$insert into public.game_period_scores
      (game_id, registration_id, period_number, points)
    values (9101, 9101, 2, -1)$$,
  '23514',
  'new row for relation "game_period_scores" violates check constraint "game_period_scores_points_check"',
  'negative period scores are rejected'
);
select is(
  (select points from public.player_period_stats
   where game_roster_slot_id = 9101 and period_number = 1),
  9::smallint,
  'player points are generated from made shots'
);
select throws_ok(
  $$insert into public.player_period_stats
      (game_roster_slot_id, game_id, period_number, two_point_made, two_point_attempted)
    values (9102, 9101, 1, 2, 1)$$,
  '23514',
  'new row for relation "player_period_stats" violates check constraint "player_period_stats_check"',
  'made shots cannot exceed attempts'
);
select is(
  (select foul_code from public.foul_events
   where game_roster_slot_id = 9101 and sequence_number = 1),
  'U2'::text,
  'the FIBA/Genius U2 foul code is supported'
);
select throws_ok(
  $$insert into public.foul_events
      (game_roster_slot_id, game_id, period_number, sequence_number, foul_code)
    values (9102, 9101, 1, 1, 'GD')$$,
  '23514',
  'new row for relation "foul_events" violates check constraint "foul_events_foul_code_check"',
  'derived GD is not persisted as a foul code'
);
select throws_ok(
  $$insert into public.boxscore_imports
      (competition_id, game_id, sha256, storage_path, parser_version, created_by)
    select 9101, 9101, repeat('a', 64), 'tests/duplicate.pdf', 'fiba-genius-v1', user_id
    from private.admin_accounts$$,
  '23505',
  'duplicate key value violates unique constraint "boxscore_imports_sha256_key"',
  'a source PDF hash can be imported only once'
);
select throws_ok(
  $$insert into public.boxscore_imports
      (competition_id, game_id, sha256, storage_path, parser_version, created_by)
    select 9102, 9101, repeat('b', 64), 'tests/wrong-game.pdf', 'fiba-genius-v1', user_id
    from private.admin_accounts$$,
  '23503',
  'insert or update on table "boxscore_imports" violates foreign key constraint "boxscore_imports_game_competition_fkey"',
  'an import game must belong to its edition'
);
select throws_ok(
  $$insert into public.boxscore_import_player_matches
      (import_id, competition_id, source_team_name, source_player_name,
       roster_entry_id, status, decided_by, decided_at)
    select 9101, 9101, 'Equipe Azul', 'Atleta Tres', 9103, 'confirmed', user_id, now()
    from private.admin_accounts$$,
  '23503',
  'insert or update on table "boxscore_import_player_matches" violates foreign key constraint "boxscore_import_player_matches_roster_competition_fkey"',
  'an import match cannot cross edition rosters'
);
select is(
  (select score from public.game_scores where game_id = 9101 and side = 'home'),
  14,
  'game score is derived from every period'
);
select is(
  (select count(*) from public.team_achievements where competition_id = 9101),
  1::bigint,
  'team achievements are derived from confirmed placements'
);
select is(
  (select count(*) from public.player_achievements where competition_id = 9101),
  1::bigint,
  'player achievements are derived from confirmed placements and rosters'
);

do $$begin
  perform private.backfill_legacy_competition_publication(9101,'published');
end$$;
set local role anon;
select is(
  (select count(*) from public.competitions where id in (9101, 9102)),
  1::bigint,
  'anonymous users see only published editions'
);
select is(
  (select count(*) from public.games where id in (9101, 9102)),
  1::bigint,
  'anonymous users cannot infer games from draft editions'
);
select is(
  (select score from public.game_scores where game_id = 9101 and side = 'away'),
  13,
  'the derived score view respects public RLS'
);
select throws_ok(
  $$insert into public.competition_series (name, slug) values ('Anon', 'anon')$$,
  '42501',
  'permission denied for table competition_series',
  'anonymous users cannot write canonical data'
);
select throws_ok(
  $$select count(*) from public.boxscore_imports$$,
  '42501',
  'permission denied for table boxscore_imports',
  'anonymous users cannot read private imports'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select throws_ok(
  $$insert into public.competition_series (name, slug) values ('Outro', 'outro')$$,
  '42501',
  'new row violates row-level security policy for table "competition_series"',
  'a non-admin at aal2 cannot write'
);

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (select user_id from private.admin_accounts),
    'role', 'authenticated',
    'aal', 'aal1'
  )::text,
  true
);
set local role authenticated;
select throws_ok(
  $$insert into public.competition_series (name, slug) values ('AAL Um', 'aal-um')$$,
  '42501',
  'new row violates row-level security policy for table "competition_series"',
  'the administrator at aal1 cannot write'
);

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (select user_id from private.admin_accounts),
    'role', 'authenticated',
    'aal', 'aal2'
  )::text,
  true
);
set local role authenticated;
select lives_ok(
  $$insert into public.competition_series (name, slug) values ('AAL Dois', 'aal-dois')$$,
  'the single administrator at aal2 can write'
);
select is(
  (select count(*) from public.boxscore_imports where id = 9101),
  1::bigint,
  'the single administrator at aal2 can inspect imports'
);
select throws_ok(
  $$delete from public.competition_series where slug = 'aal-dois'$$,
  '42501',
  'permission denied for table competition_series',
  'destructive deletes are not granted to the application role'
);

reset role;
select * from finish();
rollback;
