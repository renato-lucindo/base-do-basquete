begin;
\ir ../helpers/final_profile_fixtures.sql

create extension if not exists pgtap with schema extensions;
select plan(16);

select has_table('public', 'competition_ruleset_revisions', 'rulesets are versioned');
select has_table('public', 'competition_stages', 'stages exist');
select has_table('public', 'competition_rounds', 'rounds exist');
select has_table('public', 'matchups', 'matchups exist');
select has_column('public', 'games', 'matchup_id', 'games can reference a matchup');
select has_fk('public', 'games', 'game and matchup competition are enforced together');
select ok(
  (
    select relrowsecurity and relforcerowsecurity
    from pg_class where oid = 'public.matchups'::regclass
  ),
  'matchups have forced RLS'
);
select ok(
  exists (
    select 1 from pg_views
    where schemaname = 'public' and viewname = 'legacy_unclassified_games'
  ),
  'legacy review report exists'
);
select function_returns(
  'public', 'admin_create_manual_scoresheet', array['jsonb'], 'bigint',
  'manual confirmation keeps its RPC contract'
);
select function_returns(
  'private', 'admin_commit_boxscore_import_impl', array['bigint', 'jsonb'], 'bigint',
  'FIBA confirmation keeps its private RPC contract'
);
select ok(
  pg_get_functiondef('private.admin_create_manual_scoresheet_post01_base(jsonb)'::regprocedure)
    like '%selected_game_id := (p_payload ->> ''gameId'')::bigint%',
  'manual confirmation requires an existing selected game'
);
select ok(
  pg_get_functiondef('private.admin_commit_boxscore_import_post01_base(bigint,jsonb)'::regprocedure)
    like '%selected_game_id := (p_resolution ->> ''gameId'')::bigint%',
  'FIBA confirmation requires an existing selected game'
);
select ok(
  pg_get_functiondef('private.admin_create_manual_scoresheet_post01_base(jsonb)'::regprocedure)
    not like '%insert into public.games%',
  'manual confirmation never inserts a parallel game'
);
select ok(
  pg_get_functiondef('private.admin_commit_boxscore_import_post01_base(bigint,jsonb)'::regprocedure)
    like '%delete from public.games where id = temporary_game_id%',
  'the compatibility adapter cannot persist its internal temporary game'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'games_require_matchup_for_application' and not tgisinternal
  ) and pg_get_functiondef('private.enforce_matchup_bound_game()'::regprocedure)
    not like '%auth.uid() is not null%',
  'all new games, including service-role writes, require a matchup'
);

insert into public.competition_series (id, name, slug)
overriding system value values (99101, 'Liga Matchup Gate', 'liga-matchup-gate');
insert into public.categories (id, name, slug)
overriding system value values (99101, 'Categoria Matchup Gate', 'categoria-matchup-gate');
select pg_temp.create_final_competition(
  99101,99101,99101,2026,'Liga Matchup Gate 2026','draft',null,'male','manual_scoresheet'
);
select throws_ok(
  $$insert into public.games (competition_id, game_number, source)
    values (99101, 'SEM-CONFRONTO', 'seed')$$,
  'BD710', 'BDB_GAME_MATCHUP_REQUIRED',
  'direct privileged writes also require the explicit internal ingestion gate'
);

select * from finish();
rollback;
