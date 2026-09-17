begin;
\ir ../helpers/final_profile_fixtures.inc

create extension if not exists pgtap with schema extensions;
select plan(43);
set constraints all deferred;
select set_config('bdb.allow_internal_ingestion_game', 'on', true);

insert into private.admin_accounts (user_id)
select '11111111-1111-4111-8111-111111111111'
where not exists (select 1 from private.admin_accounts);

select has_function(
  'private',
  'game_data_snapshot_hash',
  array['bigint'],
  'historical sports snapshots have a deterministic hash helper'
);
select has_function(
  'private',
  'backfill_game_data_submissions',
  array[]::text[],
  'the historical backfill is encapsulated in a private function'
);
select has_function(
  'public',
  'admin_get_game_data_backfill_report',
  array[]::text[],
  'the administrator has an explicit reconciliation report'
);
select ok(
  (
    select procedure.prosecdef
    from pg_proc procedure
    where procedure.oid =
      'public.admin_get_game_data_backfill_report()'::regprocedure
  ),
  'the public report owns its protected read boundary'
);
select ok(
  not has_function_privilege(
    'public',
    'private.backfill_game_data_submissions()',
    'EXECUTE'
  ),
  'the migration helper is not public'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'private.backfill_game_data_submissions()',
    'EXECUTE'
  ),
  'authenticated clients cannot invoke the migration helper'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_get_game_data_backfill_report()',
    'EXECUTE'
  ),
  'authenticated clients can reach the report AAL2 guard'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.admin_get_game_data_backfill_report()',
    'EXECUTE'
  ),
  'anonymous clients cannot execute the report'
);

select ok(
  not exists (
    select 1
    from public.games game
    left join public.game_data_submissions submission
      on submission.game_id = game.id
     and submission.source_type = 'legacy_seed'
     and submission.submission_version = 1
    where game.source = 'seed' and submission.id is null
  ),
  'every deterministic seed game is encapsulated after seed completion'
);
select ok(
  not exists (
    select 1
    from public.games game
    join public.game_data_submissions submission on submission.game_id = game.id
    where game.source = 'seed'
      and (submission.status <> 'review' or submission.role <> 'primary')
  ),
  'legacy seed submissions remain review-only'
);
select ok(
  not exists (
    select 1
    from public.games game
    join public.game_data_submissions submission on submission.game_id = game.id
    where game.source = 'seed'
      and submission.payload_hash !~ '^[0-9a-f]{32}$'
  ),
  'legacy seed envelopes carry deterministic sports hashes'
);
select ok(
  not exists (
    select 1
    from public.games game
    join public.game_data_submissions submission on submission.game_id = game.id
    where game.source = 'seed'
      and (
        submission.submitted_by is not null
        or submission.validated_by is not null
        or submission.validated_at is not null
      )
  ),
  'the backfill never invents a seed actor or validation'
);
select ok(
  not exists (
    select 1
    from public.games game
    join public.game_data_domain_authority authority on authority.game_id = game.id
    where game.source = 'seed'
  ),
  'legacy seed envelopes never receive active domain authority'
);
select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      private.build_game_data_backfill_report() -> 'games'
    ) item
    where item ->> 'legacySource' = 'seed'
      and not (item ->> 'historicalReviewOnly')::boolean
  ),
  'the report identifies every seed origin as historical review only'
);
select lives_ok(
  $$select private.backfill_game_data_submissions()$$,
  'rerunning the completed seed backfill is idempotent'
);

insert into public.competition_series (id, name, slug)
overriding system value values (9941, 'Liga Backfill', 'liga-backfill');
insert into public.categories (id, name, slug)
overriding system value values (9941, 'Categoria Backfill', 'categoria-backfill');
select pg_temp.create_final_competition(
  9941,9941,9941,2026,'Liga Backfill 2026','draft',null,'male','manual_scoresheet'
);

insert into public.games (
  id,
  competition_id,
  game_number,
  source,
  status,
  manual_idempotency_key,
  manual_payload_hash,
  created_by
)
overriding system value values
  (
    9941,
    9941,
    'BACKFILL-MANUAL',
    'manual',
    'final',
    '99410000-0000-4000-8000-000000000001',
    repeat('a', 32),
    (select user_id from private.admin_accounts)
  ),
  (
    9942,
    9941,
    'BACKFILL-FIBA',
    'boxscore',
    'final',
    null,
    null,
    (select user_id from private.admin_accounts)
  );

insert into storage.objects (id, bucket_id, name)
values (
  '99410000-0000-4000-8000-000000000002',
  'boxscore-pdfs',
  'tests/backfill-fixture.pdf'
);

insert into public.boxscore_imports (
  id,
  competition_id,
  game_id,
  sha256,
  storage_path,
  parser_version,
  status,
  created_by,
  confirmed_at
)
overriding system value values (
  9941,
  9941,
  9942,
  repeat('b', 64),
  'tests/backfill-fixture.pdf',
  'fiba-genius-v2',
  'confirmed',
  (select user_id from private.admin_accounts),
  now()
);

create temporary table backfill_integrity_baseline as
select private.build_classification_backfill_report()
  -> 'historicalIntegrity' as value;

select lives_ok(
  $$select private.backfill_game_data_submissions()$$,
  'manual and FIBA evidence can be backfilled together'
);
select is(
  (
    select count(*)::integer
    from public.game_data_submissions
    where game_id = 9941 and source_type = 'manual_scoresheet'
  ),
  1,
  'one manual submission is created'
);
select is(
  (
    select status from public.game_data_submissions
    where game_id = 9941 and source_type = 'manual_scoresheet'
  ),
  'active'::text,
  'proven manual data becomes active'
);
select is(
  (
    select payload_hash from public.game_data_submissions
    where game_id = 9941 and source_type = 'manual_scoresheet'
  ),
  repeat('a', 32),
  'the legacy manual payload hash is preserved verbatim'
);
select is(
  (
    select idempotency_key from public.game_data_submissions
    where game_id = 9941 and source_type = 'manual_scoresheet'
  ),
  '99410000-0000-4000-8000-000000000001'::text,
  'the legacy manual idempotency key is preserved verbatim'
);
select ok(
  (
    select parser_version is null and storage_object_id is null
    from public.game_data_submissions
    where game_id = 9941 and source_type = 'manual_scoresheet'
  ),
  'manual data does not invent parser or Storage evidence'
);
select ok(
  (
    select submitted_by = validated_by and validated_at is not null
    from public.game_data_submissions
    where game_id = 9941 and source_type = 'manual_scoresheet'
  ),
  'the proven manual actor is retained as historical validator'
);
select is(
  (
    select count(*)::integer
    from public.game_data_submissions
    where game_id = 9942 and source_type = 'fiba_boxscore'
  ),
  1,
  'one FIBA submission is created'
);
select is(
  (
    select status from public.game_data_submissions
    where game_id = 9942 and source_type = 'fiba_boxscore'
  ),
  'active'::text,
  'a confirmed FIBA import becomes active'
);
select is(
  (
    select payload_hash from public.game_data_submissions
    where game_id = 9942 and source_type = 'fiba_boxscore'
  ),
  repeat('b', 64),
  'the confirmed FIBA SHA-256 is preserved verbatim'
);
select is(
  (
    select parser_version from public.game_data_submissions
    where game_id = 9942 and source_type = 'fiba_boxscore'
  ),
  'fiba-genius-v2'::text,
  'the confirmed parser version is preserved verbatim'
);
select is(
  (
    select storage_object_id from public.game_data_submissions
    where game_id = 9942 and source_type = 'fiba_boxscore'
  ),
  '99410000-0000-4000-8000-000000000002'::uuid,
  'the exact private Storage object is linked opaquely'
);
select ok(
  (
    select submitted_by = validated_by and validated_at is not null
    from public.game_data_submissions
    where game_id = 9942 and source_type = 'fiba_boxscore'
  ),
  'the confirmed FIBA actor and confirmation are retained'
);
select is(
  (
    select count(*)::integer
    from public.game_data_domain_authority
    where game_id = 9941
  ),
  6,
  'manual authority covers exactly its six declared domains'
);
select is(
  (
    select count(*)::integer
    from public.game_data_domain_authority
    where game_id = 9942
  ),
  8,
  'FIBA authority covers exactly its eight declared domains'
);
select is(
  (
    select coalesce(sum(jsonb_array_length(item -> 'missingAuthorityDomains')), 0)::integer
    from jsonb_array_elements(
      private.build_game_data_backfill_report() -> 'games'
    ) item
    where (item ->> 'gameId')::bigint in (9941, 9942)
  ),
  0,
  'the report finds no missing active domain'
);
select is(
  private.build_game_data_backfill_report() ->> 'ready',
  'true'::text,
  'the complete historical backfill is ready'
);
select is(
  private.build_game_data_backfill_report() -> 'historicalIntegrity',
  (select value from backfill_integrity_baseline),
  'the backfill changes no game, score, point, foul or import fact'
);
select lives_ok(
  $$select private.backfill_game_data_submissions()$$,
  'the mixed-source backfill is idempotent on a second run'
);
select is(
  (
    select count(*)::integer
    from public.game_data_submissions
    where game_id in (9941, 9942)
  ),
  2,
  'idempotency creates no duplicate submission'
);
select is(
  (
    select count(*)::integer
    from public.game_data_domain_authority
    where game_id in (9941, 9942)
  ),
  14,
  'idempotency creates no duplicate authority'
);

set local role anon;
select throws_ok(
  $$select public.admin_get_game_data_backfill_report()$$,
  '42501',
  'permission denied for function admin_get_game_data_backfill_report',
  'anonymous clients cannot read the reconciliation report'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.admin_get_game_data_backfill_report()$$,
  'BD401',
  'BDB_ADMIN_AAL2_REQUIRED',
  'a non-admin at aal2 cannot read the report'
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
  $$select public.admin_get_game_data_backfill_report()$$,
  'BD401',
  'BDB_ADMIN_AAL2_REQUIRED',
  'the singleton administrator at aal1 cannot read the report'
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
select is(
  public.admin_get_game_data_backfill_report() ->> 'ready',
  'true'::text,
  'the singleton administrator at aal2 can read the report'
);
select throws_ok(
  $$select private.backfill_game_data_submissions()$$,
  '42501',
  'permission denied for function backfill_game_data_submissions',
  'even the administrator cannot invoke the private migration helper'
);

reset role;
insert into storage.objects (id, bucket_id, name)
values (
  '99410000-0000-4000-8000-000000000003',
  'boxscore-pdfs',
  'tests/backfill-ambiguous.pdf'
);
insert into public.boxscore_imports (
  id,
  competition_id,
  game_id,
  sha256,
  storage_path,
  parser_version,
  status,
  created_by,
  confirmed_at
)
overriding system value values (
  9942,
  9941,
  9942,
  repeat('c', 64),
  'tests/backfill-ambiguous.pdf',
  'fiba-genius-v2',
  'confirmed',
  (select user_id from private.admin_accounts),
  now()
);
select throws_ok(
  $$select private.backfill_game_data_submissions()$$,
  'BD708',
  'BDB_BACKFILL_BOXSCORE_IMPORT_AMBIGUOUS',
  'ambiguous confirmed FIBA history fails closed'
);
select is(
  (
    select count(*)::integer
    from public.game_data_submissions
    where game_id in (9941, 9942)
  ),
  2,
  'failed ambiguity validation leaves submissions untouched'
);

select * from finish();
rollback;
