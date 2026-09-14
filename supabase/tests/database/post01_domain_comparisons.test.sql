begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users(id)
values ('99140000-0000-4000-8000-000000000003')
on conflict (id) do nothing;
insert into private.admin_accounts(user_id)
select '99140000-0000-4000-8000-000000000003'
where not exists (select 1 from private.admin_accounts);

select has_table(
  'public', 'game_data_domain_comparisons',
  'per-domain comparison evidence exists'
);
select has_function(
  'private', 'compare_game_data_submissions', array['bigint', 'bigint'],
  'the private snapshot comparator exists'
);
select has_function(
  'public', 'admin_get_game_data_conflict', array['bigint'],
  'the AAL2 conflict read contract exists'
);
select ok(
  (select relrowsecurity and relforcerowsecurity
    from pg_class where oid = 'public.game_data_domain_comparisons'::regclass),
  'comparison evidence has forced RLS'
);
select ok(
  not has_table_privilege('anon', 'public.game_data_domain_comparisons', 'select'),
  'anonymous callers cannot read comparisons'
);
select ok(
  has_function_privilege(
    'authenticated', 'public.admin_get_game_data_conflict(bigint)', 'execute'
  ),
  'authenticated callers can reach the AAL2-guarded conflict query'
);
select ok(
  not has_function_privilege(
    'anon', 'public.admin_get_game_data_conflict(bigint)', 'execute'
  ),
  'anonymous callers cannot execute the conflict query'
);
select ok(
  pg_get_functiondef('private.compare_game_data_submissions(bigint,bigint)'::regprocedure)
    like '%pg_advisory_xact_lock%'
    and pg_get_functiondef(
      'private.compare_game_data_submissions(bigint,bigint)'::regprocedure
    ) like '%payload_hash = candidate_snapshot.payload_hash%',
  'comparison is serialized and uses immutable canonical hashes'
);

select set_config('bdb.allow_internal_ingestion_game', 'on', true);
insert into public.games(
  id, competition_id, game_number, status, scheduled_at, venue, source
)
overriding system value
select
  991401,
  competition.id,
  '__post01_comparison_test__',
  'draft',
  now(),
  'Ginásio de teste',
  'structural'
from public.competitions competition
order by competition.id
limit 1;

insert into storage.objects(id, bucket_id, name)
values (
  '99140100-0000-4000-8000-000000000001',
  'boxscore-pdfs',
  '__post01_comparison_test__.pdf'
);

select set_config('bdb.post01_submission_role', '', true);
insert into public.game_data_submissions(
  id, game_id, submission_version, source_type, role, status,
  payload_hash, idempotency_key, reason, submitted_by,
  validated_by, validated_at
)
overriding system value
values (
  9914011, 991401, 1, 'manual_scoresheet', 'fallback', 'active',
  repeat('a', 32), '__post01_comparison_manual__', 'Fallback de teste documentado',
  (select user_id from private.admin_accounts),
  (select user_id from private.admin_accounts), now()
);

insert into public.game_data_submissions(
  id, game_id, submission_version, source_type, role, status,
  parser_version, payload_hash, storage_object_id, idempotency_key,
  submitted_by, validated_by, validated_at
)
overriding system value
values (
  9914012, 991401, 1, 'fiba_boxscore', 'primary', 'active',
  'post01-test', repeat('b', 64), '99140100-0000-4000-8000-000000000001',
  '__post01_comparison_fiba__',
  (select user_id from private.admin_accounts),
  (select user_id from private.admin_accounts), now()
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (select user_id from private.admin_accounts),
    'role', 'authenticated',
    'aal', 'aal2'
  )::text,
  true
);

select is(
  private.compare_game_data_submissions(9914011, 9914012),
  5,
  'the comparator creates the five domains shared by manual and FIBA sources'
);
select is(
  (select count(*)::integer from public.game_data_domain_comparisons
    where candidate_submission_id = 9914012),
  5,
  'one durable comparison row exists for every shared domain'
);
select is(
  (select count(*)::integer from public.game_data_domain_comparisons
    where candidate_submission_id = 9914012 and comparison_result = 'matching'),
  5,
  'identical canonical snapshots are classified as matching'
);
select is(
  private.compare_game_data_submissions(9914011, 9914012),
  0,
  'a repeated comparison is idempotent'
);
select is(
  (select count(*)::integer from public.admin_mutation_audit
    where action = 'game_data_comparison_created'
      and metadata ->> 'candidateSubmissionId' = '9914012'),
  1,
  'the comparison audit event is also idempotent'
);
select is(
  (public.admin_get_game_data_conflict(991401) ->> 'pendingCount')::integer,
  0,
  'the AAL2 read model reports no pending conflict for matching evidence'
);
select is(
  jsonb_array_length(public.admin_get_game_data_conflict(991401) -> 'domains'),
  5,
  'the AAL2 read model returns all comparable domains'
);
select throws_ok(
  $$update public.game_data_domain_comparisons
    set resolution_status = 'resolved', decision = 'candidate',
      decided_by = (select user_id from private.admin_accounts), decided_at = now(),
      decision_reason = 'Tentativa inválida sobre comparação equivalente'
    where candidate_submission_id = 9914012 and domain = 'official_result'$$,
  'BD717',
  'BDB_DOMAIN_COMPARISON_ALREADY_DECIDED',
  'matching evidence cannot be rewritten as a manual decision'
);

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
  $$select public.admin_get_game_data_conflict(991401)$$,
  'BD401',
  'BDB_ADMIN_AAL2_REQUIRED',
  'AAL1 cannot read conflict evidence'
);

select * from finish();
rollback;
