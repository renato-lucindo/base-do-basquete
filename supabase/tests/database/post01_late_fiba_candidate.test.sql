begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select has_function(
  'private', 'admin_stage_late_fiba_candidate', array['bigint', 'jsonb'],
  'the isolated late-FIBA staging operation exists'
);
select has_function(
  'private', 'admin_commit_boxscore_import_impl', array['bigint', 'jsonb'],
  'the existing private commit contract remains available'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'private.admin_stage_late_fiba_candidate(bigint,jsonb)',
    'execute'
  ),
  'clients cannot call the internal staging operation directly'
);
select ok(
  pg_get_functiondef(
    'private.admin_commit_boxscore_import_impl(bigint,jsonb)'::regprocedure
  ) like '%selected_game_status = ''final''%'
    and pg_get_functiondef(
      'private.admin_commit_boxscore_import_impl(bigint,jsonb)'::regprocedure
    ) like '%admin_stage_late_fiba_candidate%',
  'the commit wrapper recognizes a final game backed by a manual fallback'
);
select ok(
  pg_get_functiondef(
    'private.admin_stage_late_fiba_candidate(bigint,jsonb)'::regprocedure
  ) like '%pg_advisory_xact_lock%'
    and pg_get_functiondef(
      'private.admin_stage_late_fiba_candidate(bigint,jsonb)'::regprocedure
    ) like '%late-fiba:%',
  'late source processing is serialized per selected game'
);
select ok(
  pg_get_functiondef(
    'private.admin_stage_late_fiba_candidate(bigint,jsonb)'::regprocedure
  ) like '%admin_commit_boxscore_import_with_eligibility_legacy_game%'
    and pg_get_functiondef(
      'private.admin_stage_late_fiba_candidate(bigint,jsonb)'::regprocedure
    ) like '%bdb.allow_internal_ingestion_game%',
  'the hardened parser and player-resolution transaction is reused in isolation'
);
select ok(
  pg_get_functiondef(
    'private.admin_stage_late_fiba_candidate(bigint,jsonb)'::regprocedure
  ) like '%bdb.skip_submission_snapshot%'
    and pg_get_functiondef(
      'private.admin_stage_late_fiba_candidate(bigint,jsonb)'::regprocedure
    ) like '%capture_game_data_submission_snapshots%',
  'the candidate snapshot is captured from staging rather than current materialized facts'
);
select ok(
  pg_get_functiondef(
    'private.admin_stage_late_fiba_candidate(bigint,jsonb)'::regprocedure
  ) like '%compare_game_data_submissions%'
    and pg_get_functiondef(
      'private.admin_stage_late_fiba_candidate(bigint,jsonb)'::regprocedure
    ) like '%fiba_candidate_staged%',
  'comparison and essential audit are part of the same transaction'
);
select ok(
  pg_get_functiondef(
    'private.admin_stage_late_fiba_candidate(bigint,jsonb)'::regprocedure
  ) like '%delete from public.player_period_stats%'
    and pg_get_functiondef(
      'private.admin_stage_late_fiba_candidate(bigint,jsonb)'::regprocedure
    ) like '%delete from public.games%',
  'temporary relational facts are removed before commit'
);
select ok(
  pg_get_functiondef(
    'public.admin_commit_boxscore_import_v2(bigint,jsonb,jsonb)'::regprocedure
  ) like '%target_game_status <> ''final''%'
    and pg_get_functiondef(
      'public.admin_commit_boxscore_import_v2(bigint,jsonb,jsonb)'::regprocedure
    ) like '%private.admin_commit_supported_boxscore_import_impl%',
  'v2 stages late FIBA through the dispatcher without rewriting final-game metadata'
);
select ok(
  pg_get_functiondef(
    'private.admin_stage_late_fiba_candidate(bigint,jsonb)'::regprocedure
  ) not like '%delete from public.game_data_submissions%'
    and pg_get_functiondef(
      'private.admin_stage_late_fiba_candidate(bigint,jsonb)'::regprocedure
    ) not like '%update public.game_data_submissions%status = ''superseded''%',
  'staging never deletes or silently supersedes source evidence'
);
select ok(
  pg_get_constraintdef(
    (
      select constraint_item.oid
      from pg_constraint constraint_item
      where constraint_item.conname = 'admin_mutation_audit_action_check'
        and constraint_item.conrelid = 'public.admin_mutation_audit'::regclass
    )
  ) like '%fiba_candidate_staged%',
  'the closed audit vocabulary accepts candidate staging'
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
  $$select public.admin_commit_boxscore_import(1, '{"gameId":1}'::jsonb)$$,
  'BD401',
  'BDB_ADMIN_AAL2_REQUIRED',
  'AAL1 remains blocked before any late-source lookup or write'
);

select * from finish();
rollback;
