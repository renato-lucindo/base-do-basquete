begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

select has_column('public','player_period_stats','fouls_received',
  'canonical player totals preserve nullable received fouls');
select has_table('public','competition_publication_statistics',
  'statistics publication header exists');
select has_table('public','competition_player_statistics_publications',
  'player statistics publication rows exist');
select ok((select relrowsecurity and relforcerowsecurity from pg_class
  where oid='public.competition_publication_statistics'::regclass),
  'statistics headers enforce RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class
  where oid='public.competition_player_statistics_publications'::regclass),
  'statistics rows enforce RLS');
select ok(has_table_privilege('anon','public.competition_publication_statistics','select'),
  'anon receives explicit header read access');
select ok(not has_table_privilege('anon','public.competition_publication_statistics','insert'),
  'anon cannot insert headers');
select ok(has_table_privilege('authenticated','public.competition_player_statistics_publications','select'),
  'authenticated receives explicit row read access');
select ok(not has_table_privilege('authenticated','public.competition_player_statistics_publications','update'),
  'authenticated cannot update snapshot rows');
select has_trigger('public','competition_publication_statistics',
  'competition_publication_statistics_immutable','headers are append-only');
select has_trigger('public','competition_player_statistics_publications',
  'competition_player_statistics_publications_immutable','rows are append-only');
select has_trigger('public','competition_player_statistics_publications',
  'competition_player_statistics_publications_registration_identity',
  'future statistics snapshots normalize team identity from the registration');
select ok(
  lower(pg_get_functiondef(
    'private.normalize_published_player_registration_identity()'::regprocedure
  )) like '%public_name%'
  and lower(pg_get_functiondef(
    'private.normalize_published_player_registration_identity()'::regprocedure
  )) like '%inscricao-%',
  'statistics snapshot normalization freezes public registration name and slug'
);
select has_trigger('public','competition_publications',
  'competition_publications_snapshot_player_statistics',
  'player statistics are frozen in the publication transaction');
select has_trigger('public','boxscore_imports','boxscore_imports_project_fouls_received',
  'confirmed imports project received fouls');
select ok(lower(pg_get_functiondef(
  'private.hydrate_player_period_fouls_received()'::regprocedure
)) like '%new.stat_scope <> ''game_total''%',
  'received fouls hydrate only the canonical game total');
select ok(lower(pg_get_functiondef(
  'private.project_game_boxscore_fouls_received(bigint)'::regprocedure
)) like '%stat.stat_scope = ''game_total''%',
  'authority changes project or clear received fouls only on game totals');
select ok(not has_function_privilege('anon',
  'private.snapshot_competition_player_statistics()','execute'),
  'anonymous clients cannot invoke snapshot internals');
select ok(not has_function_privilege('authenticated',
  'private.competition_boxscore_statistics_fingerprint(bigint)','execute'),
  'authenticated clients cannot invoke fingerprint internals');
select ok(lower(pg_get_functiondef(
  'public.admin_publish_competition(bigint,integer,boolean)'::regprocedure
)) like '%source_fingerprint%',
  'publication idempotency includes the statistics fingerprint');
select ok(to_regclass('public.competition_boxscore_player_statistics') is not null,
  'legacy competition boxscore read model remains available for rollback');
select ok(to_regclass('public.game_boxscore_player_statistics') is not null,
  'legacy game boxscore read model remains available for rollback');

select * from finish();
rollback;
