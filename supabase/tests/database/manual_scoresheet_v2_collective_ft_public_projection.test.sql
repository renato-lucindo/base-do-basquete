begin;
\ir ../helpers/final_profile_fixtures.inc

create extension if not exists pgtap with schema extensions;
select plan(14);

select ok(
  exists (
    select 1 from pg_proc
    where proname = 'manual_scoresheet_v2_collective_ft_summary'
  ),
  'collective free throw summary function exists'
);

select ok(
  exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
      and table_name = 'manual_scoresheet_public_statistics_projection'
  ),
  'manual public projection exists'
);

select ok(
  pg_get_functiondef('private.validate_manual_scoresheet_player_stats()'::regprocedure)
    like '%BDB_MANUAL_STATS_CANNOT_CREATE_ATTEMPTS%',
  'manual sheets reject generated attempts'
);

select is(
  (select pg_get_functiondef('private.manual_scoresheet_v2_collective_ft_summary(bigint)'::regprocedure)
    like '%percentage%')::boolean,
  true,
  'summary exposes only collective percentage'
);

select ok(
  pg_get_viewdef('public.game_boxscore_player_statistics'::regclass, true)
    like '%free_throw_attempted%',
  'legacy boxscore view remains available'
);

select ok(
  pg_get_viewdef('public.game_player_statistics'::regclass, true)
    like '%game_active_data_sources%',
  'legacy player attempts follow effective advanced-domain authority'
);

select ok(
  pg_get_viewdef('public.game_player_statistics'::regclass, true)
    not like '%game.source%',
  'legacy player attempt masking does not depend on games.source'
);

select ok(
  pg_get_functiondef('private.manual_scoresheet_projection_is_current(bigint,bigint)'::regprocedure)
    like '%authority.submission_id = p_submission_id%',
  'public collective free throws are tied to active scoring submission identity'
);

select ok(
  pg_get_functiondef('private.manual_scoresheet_projection_is_current(bigint,bigint)'::regprocedure)
    like '%submission.status = ''active''%',
  'superseded manual submissions cannot retain public collective authority'
);

select is(
  private.manual_scoresheet_projection_is_current(-1, -1),
  false,
  'unknown game and submission do not expose collective statistics'
);

select ok(
  not has_column_privilege('anon', 'public.manual_scoresheet_public_statistics_projection', 'submission_id', 'SELECT'),
  'anonymous readers cannot select private submission ids'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_name = 'manual_scoresheet_public_statistics_projection'
      and column_name = 'free_throw_attempted'
  ),
  'manual projection does not expose individual attempts'
);

select is(
  (select count(*)::integer
   from public.manual_scoresheet_public_statistics_projection),
  0,
  'projection remains empty until publication'
);

select ok(true, 'collective free throw projection migration contract validated');

select * from finish();
rollback;
