-- Manual overlay ONLY for a dedicated, disposable Supabase preview project.
-- Never add this file to supabase/migrations or run it on the shared project.
-- Replace the placeholder with the preview project's public 20-letter reference.
begin;
do $preview$
declare
  project_ref text := '__ISOLATED_PREVIEW_PROJECT_REF__';
begin
  if project_ref !~ '^[a-z]{20}$'
     or project_ref in ('yjnbemfeyjhxhomprlnm', 'payumtvegfqfejmowxiy') then
    raise exception 'Use a dedicated preview project reference';
  end if;

  -- Compile the issuer into the function. No JWT, metadata, request header or
  -- user-settable Postgres setting can enable this exception at request time.
  execute format($definition$
    create or replace function private.is_admin_aal2()
    returns boolean
    language sql stable security invoker set search_path = ''
    as $body$
      select (select private.is_admin()) and (
        coalesce((select auth.jwt()->>'aal'), 'aal1') = 'aal2'
        or (
          coalesce((select auth.jwt()->>'aal'), '') = 'aal1'
          and coalesce((select auth.jwt()->>'iss'), '') = %L
          and coalesce((select auth.jwt()->'amr'), '[]'::jsonb)
            @> '[{"method":"password"}]'::jsonb
        )
      );
    $body$;
  $definition$, 'https://' || project_ref || '.supabase.co/auth/v1');
end;
$preview$;

comment on function private.is_admin_aal2() is
  'PREVIEW ONLY: singleton admin with actual AAL2, or password AAL1 from the pinned isolated preview issuer. The legacy name is preserved for RLS/RPC compatibility; JWT assurance is never rewritten.';
commit;
