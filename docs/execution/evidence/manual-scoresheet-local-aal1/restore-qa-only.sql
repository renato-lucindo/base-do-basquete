-- QA ONLY: restore the original definition from 20260821152039_single_admin_auth.sql.
create or replace function private.is_admin_aal2()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (select private.is_admin())
    and coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2';
$$;
