begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users(id)
values ('99140000-0000-4000-8000-000000000001')
on conflict (id) do nothing;
insert into private.admin_accounts(user_id)
select '99140000-0000-4000-8000-000000000001'
where not exists (select 1 from private.admin_accounts);

select ok(
  pg_get_constraintdef(
    (
      select constraint_item.oid
      from pg_constraint constraint_item
      where constraint_item.conname = 'admin_mutation_audit_action_check'
        and constraint_item.conrelid = 'public.admin_mutation_audit'::regclass
    )
  ) like '%manual_fallback_confirmed%'
    and pg_get_constraintdef(
      (
        select constraint_item.oid
        from pg_constraint constraint_item
        where constraint_item.conname = 'admin_mutation_audit_action_check'
          and constraint_item.conrelid = 'public.admin_mutation_audit'::regclass
      )
    ) like '%manual_fallback_finalized%',
  'fallback lifecycle audit actions are accepted by the closed audit vocabulary'
);

select has_column(
  'public', 'game_data_submissions', 'fallback_finalized_at',
  'fallback finalization time is stored on the immutable submission'
);
select has_column(
  'public', 'game_data_submissions', 'fallback_finalized_by',
  'fallback finalization actor is stored on the immutable submission'
);
select has_column(
  'public', 'game_data_submissions', 'fallback_finalization_reason',
  'fallback finalization requires a dedicated reason'
);
select has_function(
  'public', 'admin_create_manual_scoresheet', array['jsonb'],
  'the public manual ingestion contract is preserved'
);
select has_function(
  'private', 'admin_commit_boxscore_import_impl', array['bigint', 'jsonb'],
  'the private FIBA ingestion contract is preserved'
);
select has_function(
  'public', 'admin_finalize_manual_fallback', array['bigint', 'bigint', 'text'],
  'an explicit fallback finalization operation exists'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'game_data_submissions_apply_post01_role' and not tgisinternal
  ),
  'submission role selection is enforced inside the database transaction'
);
select ok(
  pg_get_functiondef('public.admin_create_manual_scoresheet(jsonb)'::regprocedure)
    like '%expected_primary_source = ''fiba_boxscore''%'
    and pg_get_functiondef('public.admin_create_manual_scoresheet(jsonb)'::regprocedure)
      like '%BDB_FALLBACK_REASON_REQUIRED%',
  'manual ingestion derives fallback from the immutable profile and requires a reason'
);
select ok(
  pg_get_functiondef('private.admin_commit_boxscore_import_impl(bigint,jsonb)'::regprocedure)
    like '%expected_primary_source = ''manual_scoresheet''%'
    and pg_get_functiondef('private.admin_commit_boxscore_import_impl(bigint,jsonb)'::regprocedure)
      like '%supplemental%',
  'FIBA ingestion derives the supplemental role for a manual edition'
);
select ok(
  pg_get_functiondef('public.admin_finalize_manual_fallback(bigint,bigint,text)'::regprocedure)
    like '%pg_advisory_xact_lock%'
    and pg_get_functiondef('public.admin_finalize_manual_fallback(bigint,bigint,text)'::regprocedure)
      like '%fallback_finalized_at is not null%',
  'fallback finalization is serialized and idempotent'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_finalize_manual_fallback(bigint,bigint,text)',
    'EXECUTE'
  ),
  'authenticated callers can reach the AAL2-guarded fallback operation'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.admin_finalize_manual_fallback(bigint,bigint,text)',
    'EXECUTE'
  ),
  'anonymous callers cannot execute fallback finalization'
);

select set_config('bdb.post01_submission_role', 'fallback', true);
select set_config(
  'bdb.post01_submission_reason',
  'Boxscore indisponível no encerramento da rodada',
  true
);
insert into public.game_data_submissions(
  game_id, submission_version, source_type, role, status,
  payload_hash, idempotency_key, reason, submitted_by
)
select
  game.id,
  coalesce((select max(existing.submission_version) + 100
    from public.game_data_submissions existing
    where existing.game_id = game.id and existing.source_type = 'manual_scoresheet'), 100),
  'manual_scoresheet', 'primary', 'draft', repeat('a', 32),
  'post01-role-trigger', null, (select user_id from private.admin_accounts)
from public.games game
order by game.id
limit 1;

select is(
  (select role from public.game_data_submissions where idempotency_key = 'post01-role-trigger'),
  'fallback'::text,
  'the protected transaction override changes only the inserted submission role'
);
select is(
  (select reason from public.game_data_submissions where idempotency_key = 'post01-role-trigger'),
  'Boxscore indisponível no encerramento da rodada'::text,
  'the fallback reason is persisted with the submission'
);

select set_config('bdb.post01_submission_role', '', true);
select set_config('bdb.post01_submission_reason', '', true);
select throws_ok(
  $$insert into public.game_data_submissions(
      game_id, submission_version, source_type, role, status,
      payload_hash, idempotency_key, submitted_by,
      fallback_finalized_at, fallback_finalized_by, fallback_finalization_reason
    )
    select game.id, 9999, 'manual_scoresheet', 'primary', 'draft', repeat('b', 32),
      'post01-invalid-finalization', (select user_id from private.admin_accounts),
      now(), (select user_id from private.admin_accounts), 'Decisão inválida em fonte primária'
    from public.games game order by game.id limit 1$$,
  '23514',
  'new row for relation "game_data_submissions" violates check constraint "game_data_submissions_fallback_finalization_consistent"',
  'only fallback submissions can carry a finalization decision'
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
  $$select public.admin_finalize_manual_fallback(1, 1, 'Decisão administrativa documentada')$$,
  'BD401',
  'BDB_ADMIN_AAL2_REQUIRED',
  'the singleton administrator at AAL1 cannot finalize a fallback'
);

select * from finish();
rollback;
