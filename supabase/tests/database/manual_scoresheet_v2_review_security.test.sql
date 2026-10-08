-- Stage 4 automated structural security gate. This is NOT an independent agent opinion.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_class where oid='public.manual_scoresheet_public_statistics_projection'::regclass),
  'manual projection enables and forces RLS'
);
select ok(
  has_table_privilege('anon','public.manual_scoresheet_public_statistics_projection','select'),
  'anon only receives projection SELECT grant (policy still applies)'
);
select ok(
  has_table_privilege('authenticated','public.manual_scoresheet_public_statistics_projection','select'),
  'authenticated role can query projection under RLS'
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
      and 'anon'=any(roles) and qual like '%game_is_currently_published%'),
  'anon projection policy checks current game publication'
);
select ok(
  exists(select 1 from pg_policies
    where schemaname='public' and tablename='manual_scoresheet_public_statistics_projection'
      and policyname='manual_scoresheet_public_statistics_projection_admin_select'
      and 'authenticated'=any(roles)
      and qual like '%game_is_currently_published%'
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

select * from finish();
rollback;
