-- QA ONLY: apply solely to payumtvegfqfejmowxiy; never add to supabase/migrations.
-- The AAL1 exception requires the QA issuer, the existing singleton and an unexpired lease.
create or replace function private.is_admin_aal2()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (select private.is_admin())
    and (
      coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
      or (
        (select auth.jwt() ->> 'iss') = 'https://payumtvegfqfejmowxiy.supabase.co/auth/v1'
        and statement_timestamp() < timestamptz '2026-10-14 15:00:00+00'
      )
    );
$$;
