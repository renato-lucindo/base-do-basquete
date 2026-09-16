begin;
\ir ../helpers/final_profile_fixtures.sql

create extension if not exists pgtap with schema extensions;
select plan(40);
set constraints all deferred;
select set_config('bdb.allow_internal_ingestion_game', 'on', true);

insert into private.admin_accounts (user_id)
select '11111111-1111-4111-8111-111111111111'
where not exists (select 1 from private.admin_accounts);

insert into public.competition_series (id, name, slug)
overriding system value values (9831, 'Liga Submissões', 'liga-submissoes');
insert into public.categories (id, name, slug)
overriding system value values (9831, 'Categoria Submissões', 'categoria-submissoes');
select pg_temp.create_final_competition(
  9831,9831,9831,2026,'Liga Submissões 2026','draft',null,'male','manual_scoresheet'
);
insert into public.games (id, competition_id, game_number, source)
overriding system value values (9831, 9831, 'SUB-9831', 'seed');
insert into storage.objects (id, bucket_id, name)
values (
  '98310000-0000-4000-8000-000000000001',
  'boxscore-pdfs',
  'tests/9831.pdf'
);

select has_table(
  'public',
  'game_data_submissions',
  'versioned game submissions exist'
);
select has_column(
  'public',
  'game_data_submissions',
  'submission_version',
  'each submission has an explicit version'
);
select has_column(
  'public',
  'game_data_submissions',
  'storage_object_id',
  'boxscore submissions reference an opaque storage object'
);
select col_type_is(
  'public',
  'game_data_submissions',
  'storage_object_id',
  'uuid',
  'storage references use the Storage object identifier type'
);
select ok(
  (
    select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'public.game_data_submissions'::regclass
  ),
  'RLS is enabled and forced from table creation'
);
select has_fk(
  'public',
  'game_data_submissions',
  'submissions reference their game'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'game_data_submissions_active_source_parser_uidx'
  ),
  'active source and parser version use a partial unique index'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'game_data_submissions_game_status_submitted_idx'
  ),
  'game status lookups have a composite index'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'game_data_submissions_submitted_by_idx'
  ),
  'the submitter foreign key is indexed'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'game_data_submissions_validated_by_idx'
  ),
  'the validator foreign key is indexed'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'game_data_submissions_storage_object_idx'
  ),
  'the storage object foreign key is indexed'
);

select throws_ok(
  $$insert into public.game_data_submissions (
      game_id, submission_version, source_type, role, payload_hash,
      idempotency_key, submitted_by
    ) values (
      9831, 1, 'spreadsheet', 'primary', repeat('a', 32),
      'invalid-source', (select user_id from private.admin_accounts)
    )$$,
  '23514',
  'new row for relation "game_data_submissions" violates check constraint "game_data_submissions_source_type_check"',
  'unknown sources are rejected'
);
select throws_ok(
  $$insert into public.game_data_submissions (
      game_id, submission_version, source_type, role, payload_hash,
      idempotency_key, submitted_by
    ) values (
      9831, 1, 'manual_scoresheet', 'backup', repeat('a', 32),
      'invalid-role', (select user_id from private.admin_accounts)
    )$$,
  '23514',
  'new row for relation "game_data_submissions" violates check constraint "game_data_submissions_role_check"',
  'unknown roles are rejected'
);
select throws_ok(
  $$insert into public.game_data_submissions (
      game_id, submission_version, source_type, role, status, payload_hash,
      idempotency_key, submitted_by
    ) values (
      9831, 1, 'manual_scoresheet', 'primary', 'confirmed', repeat('a', 32),
      'invalid-status', (select user_id from private.admin_accounts)
    )$$,
  '23514',
  'new row for relation "game_data_submissions" violates check constraint "game_data_submissions_status_check"',
  'unknown statuses are rejected'
);
select throws_ok(
  $$insert into public.game_data_submissions (
      game_id, submission_version, source_type, role, payload_hash,
      idempotency_key, submitted_by
    ) values (
      9831, 1, 'manual_scoresheet', 'fallback', repeat('a', 32),
      'fallback-without-reason', (select user_id from private.admin_accounts)
    )$$,
  '23514',
  'new row for relation "game_data_submissions" violates check constraint "game_data_submissions_reason_required"',
  'fallback submissions require a reason'
);
select throws_ok(
  $$insert into public.game_data_submissions (
      game_id, submission_version, source_type, role, status, payload_hash,
      idempotency_key, submitted_by, validated_by, validated_at
    ) values (
      9831, 1, 'manual_scoresheet', 'primary', 'rejected', repeat('a', 32),
      'rejected-without-reason', (select user_id from private.admin_accounts),
      (select user_id from private.admin_accounts), now()
    )$$,
  '23514',
  'new row for relation "game_data_submissions" violates check constraint "game_data_submissions_reason_required"',
  'rejected submissions require a reason'
);
select throws_ok(
  $$insert into public.game_data_submissions (
      game_id, submission_version, source_type, role, status, payload_hash,
      idempotency_key, submitted_by
    ) values (
      9831, 1, 'manual_scoresheet', 'primary', 'active', repeat('a', 32),
      'active-without-validation', (select user_id from private.admin_accounts)
    )$$,
  '23514',
  'new row for relation "game_data_submissions" violates check constraint "game_data_submissions_validation_consistent"',
  'active submissions require explicit validation'
);
select throws_ok(
  $$insert into public.game_data_submissions (
      game_id, submission_version, source_type, role, parser_version,
      payload_hash, idempotency_key, submitted_by
    ) values (
      9831, 1, 'fiba_boxscore', 'primary', 'fiba-genius-v2',
      repeat('b', 64), 'boxscore-without-object',
      (select user_id from private.admin_accounts)
    )$$,
  '23514',
  'new row for relation "game_data_submissions" violates check constraint "game_data_submissions_source_payload_consistent"',
  'boxscore submissions require their private storage object'
);
select throws_ok(
  $$insert into public.game_data_submissions (
      game_id, submission_version, source_type, role, parser_version,
      payload_hash, idempotency_key, submitted_by
    ) values (
      9831, 1, 'manual_scoresheet', 'primary', 'manual-v1',
      repeat('a', 32), 'manual-with-parser',
      (select user_id from private.admin_accounts)
    )$$,
  '23514',
  'new row for relation "game_data_submissions" violates check constraint "game_data_submissions_source_payload_consistent"',
  'manual submissions do not pretend to have a parser'
);
select throws_ok(
  $$insert into public.game_data_submissions (
      game_id, submission_version, source_type, role, payload_hash,
      idempotency_key, submitted_by
    ) values (
      9831, 1, 'manual_scoresheet', 'primary', 'ABC',
      'invalid-hash', (select user_id from private.admin_accounts)
    )$$,
  '23514',
  'new row for relation "game_data_submissions" violates check constraint "game_data_submissions_payload_hash_check"',
  'payload hashes must use a supported canonical digest'
);

insert into public.game_data_submissions (
  id, game_id, submission_version, source_type, role, status, payload_hash,
  idempotency_key, submitted_by, validated_by, validated_at
)
overriding system value values (
  9831, 9831, 1, 'manual_scoresheet', 'primary', 'active', repeat('a', 32),
  'manual-9831-v1', (select user_id from private.admin_accounts),
  (select user_id from private.admin_accounts), now()
);
insert into public.game_data_submissions (
  id, game_id, submission_version, source_type, role, status, parser_version,
  payload_hash, storage_object_id, idempotency_key, submitted_by,
  validated_by, validated_at
)
overriding system value values (
  9832, 9831, 1, 'fiba_boxscore', 'supplemental', 'active',
  'fiba-genius-v2', repeat('b', 64),
  '98310000-0000-4000-8000-000000000001', 'boxscore-9831-v1',
  (select user_id from private.admin_accounts),
  (select user_id from private.admin_accounts), now()
);

select is(
  (select count(*)::integer from public.game_data_submissions where game_id = 9831),
  2,
  'manual and boxscore sources coexist on one game identity'
);
select is(
  (
    select array_agg(source_type order by source_type)
    from public.game_data_submissions
    where game_id = 9831 and status = 'active'
  ),
  array['fiba_boxscore', 'manual_scoresheet']::text[],
  'both source roles remain independently active'
);
select throws_ok(
  $$insert into public.game_data_submissions (
      game_id, submission_version, source_type, role, status, payload_hash,
      idempotency_key, submitted_by, validated_by, validated_at
    ) values (
      9831, 2, 'manual_scoresheet', 'primary', 'active', repeat('c', 32),
      'manual-9831-v2', (select user_id from private.admin_accounts),
      (select user_id from private.admin_accounts), now()
    )$$,
  '23505',
  'duplicate key value violates unique constraint "game_data_submissions_active_source_parser_uidx"',
  'one game cannot have duplicate active manual source versions'
);
select throws_ok(
  $$insert into public.game_data_submissions (
      game_id, submission_version, source_type, role, status, parser_version,
      payload_hash, storage_object_id, idempotency_key, submitted_by,
      validated_by, validated_at
    ) values (
      9831, 2, 'fiba_boxscore', 'supplemental', 'active',
      'fiba-genius-v2', repeat('c', 64),
      '98310000-0000-4000-8000-000000000001', 'boxscore-9831-v2',
      (select user_id from private.admin_accounts),
      (select user_id from private.admin_accounts), now()
    )$$,
  '23505',
  'duplicate key value violates unique constraint "game_data_submissions_active_source_parser_uidx"',
  'one game cannot have duplicate active boxscore parser versions'
);
select throws_ok(
  $$insert into public.game_data_submissions (
      game_id, submission_version, source_type, role, payload_hash,
      idempotency_key, submitted_by
    ) values (
      9831, 1, 'manual_scoresheet', 'primary', repeat('c', 32),
      'manual-9831-other-key', (select user_id from private.admin_accounts)
    )$$,
  '23505',
  'duplicate key value violates unique constraint "game_data_submissions_game_source_version_unique"',
  'a source revision number is unique within its game'
);
select throws_ok(
  $$insert into public.game_data_submissions (
      game_id, submission_version, source_type, role, payload_hash,
      idempotency_key, submitted_by
    ) values (
      9831, 3, 'manual_scoresheet', 'primary', repeat('d', 32),
      'manual-9831-v1', (select user_id from private.admin_accounts)
    )$$,
  '23505',
  'duplicate key value violates unique constraint "game_data_submissions_source_idempotency_unique"',
  'idempotency keys cannot be replayed with another version'
);
select throws_ok(
  $$update public.game_data_submissions
    set payload_hash = repeat('e', 32)
    where id = 9831$$,
  '23514',
  'BDB_GAME_DATA_SUBMISSION_IMMUTABLE',
  'submitted content cannot be rewritten in place'
);
select lives_ok(
  $$update public.game_data_submissions
    set status = 'superseded', reason = 'Substituída por revisão posterior'
    where id = 9831$$,
  'lifecycle metadata can change without rewriting the submitted version'
);
select is(
  (select status from public.game_data_submissions where id = 9831),
  'superseded'::text,
  'the allowed lifecycle change is persisted'
);

select ok(
  not has_table_privilege('anon', 'public.game_data_submissions', 'SELECT'),
  'anonymous clients have no submission-table grant'
);
select ok(
  has_table_privilege('authenticated', 'public.game_data_submissions', 'SELECT'),
  'authenticated clients receive only the deliberate read grant'
);
select ok(
  not has_table_privilege('authenticated', 'public.game_data_submissions', 'INSERT'),
  'authenticated clients cannot insert submissions directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.game_data_submissions', 'UPDATE'),
  'authenticated clients cannot update submissions directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.game_data_submissions', 'DELETE'),
  'authenticated clients cannot delete submissions'
);
select ok(
  not has_sequence_privilege(
    'authenticated',
    'public.game_data_submissions_id_seq',
    'USAGE'
  ),
  'the identity sequence is not exposed to authenticated clients'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.game_data_submissions$$,
  '42501',
  'permission denied for table game_data_submissions',
  'anonymous reads are denied before RLS evaluation'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select is(
  (select count(*)::integer from public.game_data_submissions),
  0,
  'a non-admin at aal2 cannot read submission metadata'
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
select is(
  (select count(*)::integer from public.game_data_submissions),
  0,
  'the singleton administrator at aal1 cannot read submission metadata'
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
  (select count(*)::integer from public.game_data_submissions where game_id = 9831),
  2,
  'the singleton administrator at aal2 can read submission metadata'
);
select throws_ok(
  $$insert into public.game_data_submissions (
      game_id, submission_version, source_type, role, payload_hash,
      idempotency_key, submitted_by
    ) values (
      9831, 3, 'manual_scoresheet', 'primary', repeat('f', 32),
      'direct-client-write', (select user_id from private.admin_accounts)
    )$$,
  '42501',
  'permission denied for table game_data_submissions',
  'even the aal2 administrator cannot bypass future server-side write contracts'
);

reset role;
select * from finish();
rollback;
