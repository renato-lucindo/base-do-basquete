-- Stage 4 automated structural security gate. This is NOT an independent agent opinion.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_class where oid='public.manual_scoresheet_public_statistics_projection'::regclass),
  'manual projection enables and forces RLS'
);
select ok(
  has_column_privilege('anon','public.manual_scoresheet_public_statistics_projection','game_id','select')
    and has_column_privilege('anon','public.manual_scoresheet_public_statistics_projection','free_throw_summary','select')
    and not has_column_privilege('anon','public.manual_scoresheet_public_statistics_projection','submission_id','select'),
  'anon can read only the public projection columns under RLS'
);
select ok(
  has_column_privilege('authenticated','public.manual_scoresheet_public_statistics_projection','game_id','select')
    and has_column_privilege('authenticated','public.manual_scoresheet_public_statistics_projection','free_throw_summary','select')
    and not has_column_privilege('authenticated','public.manual_scoresheet_public_statistics_projection','submission_id','select'),
  'authenticated role can read public projection columns only'
);
select ok(
  not has_table_privilege('anon','public.manual_scoresheet_public_statistics_projection','insert'),
  'anon cannot insert projection rows'
);
select ok(
  not has_table_privilege('authenticated','public.manual_scoresheet_public_statistics_projection','update'),
  'authenticated cannot update projection rows'
);
select ok(
  exists(select 1 from pg_policies
    where schemaname='public' and tablename='manual_scoresheet_public_statistics_projection'
      and policyname='manual_scoresheet_public_statistics_projection_select'
      and 'anon'=any(roles) and qual like '%manual_scoresheet_projection_is_current%'),
  'anon projection policy checks effective manual scoring submission and publication'
);
select ok(
  exists(select 1 from pg_policies
    where schemaname='public' and tablename='manual_scoresheet_public_statistics_projection'
      and policyname='manual_scoresheet_public_statistics_projection_admin_select'
      and 'authenticated'=any(roles)
      and qual like '%manual_scoresheet_projection_is_current%'
      and qual like '%is_current_admin_aal2%'),
  'authenticated projection policy requires publication or admin AAL2'
);
select ok(
  (select reloptions @> array['security_invoker=true']
   from pg_class where oid='public.game_player_statistics'::regclass),
  'legacy game statistics view uses security invoker'
);
select ok(
  not has_function_privilege('anon','public.admin_create_manual_scoresheet_v2(jsonb)','execute'),
  'anon cannot execute manual creation RPC'
);
select ok(
  not has_function_privilege('anon','public.admin_revise_manual_scoresheet_v2(jsonb)','execute'),
  'anon cannot execute manual revision RPC'
);
select ok(
  has_function_privilege('authenticated','public.admin_create_manual_scoresheet_v2(jsonb)','execute'),
  'authenticated can reach creation RPC with internal AAL2 guard'
);
select ok(
  has_function_privilege('authenticated','public.admin_revise_manual_scoresheet_v2(jsonb)','execute'),
  'authenticated can reach revision RPC with internal AAL2 guard'
);
select ok(
  not has_table_privilege('anon','public.manual_scoresheet_submission_payloads','select'),
  'anon cannot access immutable submission payloads'
);
select ok(
  not has_table_privilege('anon','public.manual_scoresheet_revisions','select'),
  'anon cannot access revision audit rows'
);
select ok(
  exists(select 1 from pg_trigger where tgrelid='public.manual_scoresheet_submission_payloads'::regclass
    and tgname='manual_scoresheet_submission_payloads_immutable' and tgenabled='O'),
  'submission payloads have an enabled immutable-history trigger'
);
select ok(
  exists(select 1 from pg_trigger where tgrelid='public.manual_scoresheet_revisions'::regclass
    and tgname='manual_scoresheet_revisions_immutable' and tgenabled='O'),
  'revision history has an enabled immutable-history trigger'
);
select ok(
  exists(select 1 from pg_trigger where tgrelid='public.manual_scoresheet_submission_payloads'::regclass
    and tgname='manual_scoresheet_submission_payload_public_projection' and tgenabled='O'),
  'first submission automatically refreshes the collective projection'
);
select ok(
  (select prosecdef from pg_proc where oid='private.refresh_manual_scoresheet_public_projection(bigint,bigint)'::regprocedure),
  'internal projection refresh has explicit security-definer rights'
);
select ok(
  (select prosecdef from pg_proc where oid='public.admin_create_manual_scoresheet_v2(jsonb)'::regprocedure),
  'creation RPC uses security definer and guards the caller'
);
select ok(
  (select prosecdef from pg_proc where oid='public.admin_revise_manual_scoresheet_v2(jsonb)'::regprocedure),
  'revision RPC uses security definer and guards the caller'
);
select ok(
  not has_table_privilege('anon','public.game_team_staff','select'),
  'anon cannot read private team staff data'
);

select ok(
  (select pg_get_expr(conbin, conrelid)
   from pg_constraint
   where conrelid='public.admin_mutation_audit'::regclass
     and conname='admin_mutation_audit_action_check') like '%competition_season_created%',
  'manual revision migration preserves season creation audit action'
);
select ok(
  (select pg_get_expr(conbin, conrelid)
   from pg_constraint
   where conrelid='public.admin_mutation_audit'::regclass
     and conname='admin_mutation_audit_action_check') like '%edition_workflow_created%',
  'manual revision migration preserves edition workflow audit action'
);
select ok(
  (select pg_get_expr(conbin, conrelid)
   from pg_constraint
   where conrelid='public.admin_mutation_audit'::regclass
     and conname='admin_mutation_audit_action_check') like '%manual_scoresheet_revised%',
  'manual revision audit action remains admitted'
);

select * from finish();
rollback;
