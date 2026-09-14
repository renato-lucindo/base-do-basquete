begin;
create extension if not exists pgtap with schema extensions;
select plan(18);
set constraints all deferred;

select has_function(
  'public', 'admin_resolve_game_data_conflict',
  array['bigint', 'bigint', 'text', 'text'],
  'the AAL2 conflict decision contract exists'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_resolve_game_data_conflict(bigint,bigint,text,text)',
    'execute'
  ),
  'authenticated callers can reach the guarded decision contract'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.admin_resolve_game_data_conflict(bigint,bigint,text,text)',
    'execute'
  ),
  'anonymous callers cannot resolve a conflict'
);
select ok(
  pg_get_functiondef(
    'public.admin_resolve_game_data_conflict(bigint,bigint,text,text)'::regprocedure
  ) like '%pg_advisory_xact_lock%'
    and pg_get_functiondef(
      'public.admin_resolve_game_data_conflict(bigint,bigint,text,text)'::regprocedure
    ) like '%BDB_AUTHORITY_CONFLICT%',
  'the decision is serialized and compare-and-swap protected'
);
select ok(
  pg_get_functiondef(
    'public.admin_resolve_game_data_conflict(bigint,bigint,text,text)'::regprocedure
  ) like '%BDB_CONFLICT_DOMAINS_INCOMPATIBLE%'
    and pg_get_functiondef(
      'public.admin_resolve_game_data_conflict(bigint,bigint,text,text)'::regprocedure
    ) like '%player_foul_total%',
  'FIBA promotion rejects incompatible rosters and preserves the manual foul domain'
);

select set_config('bdb.allow_internal_ingestion_game', 'on', true);
insert into public.games(
  id, competition_id, game_number, status, scheduled_at, venue, source
)
overriding system value
select
  991402,
  competition.id,
  '__post01_resolution_test__',
  'final',
  now(),
  'Ginásio de teste',
  'structural'
from public.competitions competition
order by competition.id
limit 1;

insert into storage.objects(id, bucket_id, name)
values (
  '99140200-0000-4000-8000-000000000001',
  'boxscore-pdfs',
  '__post01_resolution_test__.pdf'
);

select set_config('bdb.post01_submission_role', '', true);
insert into public.game_data_submissions(
  id, game_id, submission_version, source_type, role, status,
  payload_hash, idempotency_key, reason, submitted_by,
  validated_by, validated_at
)
overriding system value
values (
  9914021, 991402, 1, 'manual_scoresheet', 'fallback', 'active',
  repeat('a', 32), '__post01_resolution_manual__', 'Fallback de teste documentado',
  (select user_id from private.admin_accounts),
  (select user_id from private.admin_accounts), now()
);

select set_config('bdb.skip_submission_snapshot', 'on', true);
insert into public.game_data_submissions(
  id, game_id, submission_version, source_type, role, status,
  parser_version, payload_hash, storage_object_id, idempotency_key,
  submitted_by, validated_by, validated_at
)
overriding system value
values (
  9914022, 991402, 1, 'fiba_boxscore', 'primary', 'active',
  'post01-test', repeat('b', 64), '99140200-0000-4000-8000-000000000001',
  '__post01_resolution_fiba__',
  (select user_id from private.admin_accounts),
  (select user_id from private.admin_accounts), now()
);
select set_config('bdb.skip_submission_snapshot', '', true);

insert into public.game_data_submission_snapshots(
  submission_id, game_id, domain, payload, payload_hash
)
select
  9914022,
  991402,
  capability.domain,
  case
    when capability.domain in ('official_result', 'game_advanced')
      then '{"candidate":true}'::jsonb
    else '[{"candidate":true}]'::jsonb
  end,
  md5(case
    when capability.domain in ('official_result', 'game_advanced')
      then '{"candidate":true}'::jsonb::text
    else '[{"candidate":true}]'::jsonb::text
  end)
from public.game_data_source_capabilities capability
where capability.source_type = 'fiba_boxscore';

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
  private.compare_game_data_submissions(9914021, 9914022),
  5,
  'all five shared domains are compared'
);
select is(
  (select count(*)::integer from public.game_data_domain_comparisons
    where candidate_submission_id = 9914022 and resolution_status = 'pending'),
  5,
  'divergent immutable snapshots produce five pending decisions'
);
select throws_ok(
  $$select public.admin_resolve_game_data_conflict(
    991402, 9914022, 'unknown', 'Decisão inválida documentada para teste'
  )$$,
  'BD720',
  'BDB_CONFLICT_DECISION_INVALID',
  'unknown decisions are rejected'
);
select throws_ok(
  $$select public.admin_resolve_game_data_conflict(
    991402, 9914022, 'keep_fallback', 'curta'
  )$$,
  'BD705',
  'BDB_AUTHORITY_REASON_REQUIRED',
  'a decision requires an adequate reason'
);
select is(
  public.admin_resolve_game_data_conflict(
    991402,
    9914022,
    'keep_fallback',
    'O documento posterior diverge da conferência manual validada'
  ),
  9914022::bigint,
  'the reviewed fallback decision succeeds'
);
select is(
  (select count(*)::integer from public.game_data_domain_comparisons
    where candidate_submission_id = 9914022
      and resolution_status = 'resolved' and decision = 'base'),
  5,
  'every pending domain records the explicit base-source decision'
);
select is(
  (select status from public.game_data_submissions where id = 9914022),
  'superseded'::text,
  'the rejected candidate remains in history as superseded evidence'
);
select is(
  (select status from public.game_data_submissions where id = 9914021),
  'active'::text,
  'the accepted manual fallback remains active'
);
select is(
  (select count(*)::integer from public.game_data_submission_snapshots
    where submission_id in (9914021, 9914022)),
  14,
  'both sources retain all fourteen immutable domain snapshots'
);
select is(
  (select count(*)::integer from public.admin_mutation_audit
    where action = 'game_data_conflict_resolved'
      and metadata ->> 'candidateSubmissionId' = '9914022'),
  1,
  'one essential audit event records the decision without its raw reason'
);
select is(
  public.admin_resolve_game_data_conflict(
    991402,
    9914022,
    'keep_fallback',
    'O documento posterior diverge da conferência manual validada'
  ),
  9914022::bigint,
  'an exact retry is idempotent after candidate supersession'
);
select is(
  (select count(*)::integer from public.admin_mutation_audit
    where action = 'game_data_conflict_resolved'
      and metadata ->> 'candidateSubmissionId' = '9914022'),
  1,
  'the idempotent retry creates no duplicate audit event'
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
  $$select public.admin_resolve_game_data_conflict(
    991402, 9914022, 'keep_fallback', 'Tentativa bloqueada sem fator adicional'
  )$$,
  'BD401',
  'BDB_ADMIN_AAL2_REQUIRED',
  'AAL1 cannot resolve a conflict'
);

select * from finish();
rollback;
