-- Password access is restricted to sessions admitted by the preview backend.
-- Ordinary AAL1 sessions (including production password logins) remain denied.
create table private.preview_password_auth (
  singleton_key boolean primary key default true check (singleton_key),
  secret_hash text not null check (secret_hash ~ '^[0-9a-f]{64}$')
);
create table private.preview_password_sessions (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null
);
create index preview_password_sessions_user_idx on private.preview_password_sessions(user_id);
alter table private.preview_password_auth enable row level security;
alter table private.preview_password_auth force row level security;
alter table private.preview_password_sessions enable row level security;
alter table private.preview_password_sessions force row level security;
revoke all on private.preview_password_auth, private.preview_password_sessions from public, anon, authenticated;

create function private.is_preview_password_session()
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select private.is_admin())
    and exists (select 1 from private.preview_password_auth)
    and coalesce((select auth.jwt()->>'aal'), '') = 'aal1'
    and coalesce((select auth.jwt()->'amr'), '[]'::jsonb) @> '[{"method":"password"}]'::jsonb
    and exists (
      select 1 from private.preview_password_sessions allowed
      join auth.sessions actual on actual.id=allowed.session_id and actual.user_id=allowed.user_id
      where allowed.session_id::text=(select auth.jwt()->>'session_id')
        and allowed.user_id=(select auth.uid())
        and allowed.expires_at>now()
        and (actual.not_after is null or actual.not_after>now())
    );
$$;
revoke all on function private.is_preview_password_session() from public, anon;
grant execute on function private.is_preview_password_session() to authenticated;

create function public.admin_open_preview_session(p_secret text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  session_text text := coalesce(auth.jwt()->>'session_id', '');
  user_identity uuid := auth.uid();
begin
  if not private.is_admin()
    or coalesce(auth.jwt()->>'aal', '') not in ('aal1','aal2')
    or not (coalesce(auth.jwt()->'amr', '[]'::jsonb) @> '[{"method":"password"}]'::jsonb)
    or session_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or p_secret is null or length(p_secret)<32
    or not exists (
      select 1 from private.preview_password_auth
      where secret_hash=encode(sha256(convert_to(p_secret,'UTF8')),'hex')
    )
    or not exists (
      select 1 from auth.sessions
      where id=session_text::uuid and user_id=user_identity
        and (not_after is null or not_after>now())
    ) then return false; end if;

  delete from private.preview_password_sessions where expires_at<=now();
  insert into private.preview_password_sessions(session_id,user_id,expires_at)
  values(session_text::uuid,user_identity,now()+interval '8 hours')
  on conflict(session_id) do nothing;
  return true;
end;
$$;
revoke all on function public.admin_open_preview_session(text) from public, anon;
grant execute on function public.admin_open_preview_session(text) to authenticated;

-- Preserve existing RLS/RPC entry points. JWT assurance is never rewritten.
create or replace function private.is_admin_aal2()
returns boolean language sql stable security invoker set search_path = ''
as $$
  select (select private.is_admin()) and (
    coalesce((select auth.jwt()->>'aal'), 'aal1') = 'aal2'
    or (select private.is_preview_password_session())
  );
$$;
comment on function private.is_admin_aal2() is
  'Singleton admin with AAL2, or an AAL1 password session explicitly admitted by the preview backend. Production backend still requires actual AAL2.';
comment on function public.admin_open_preview_session(text) is
  'Preview backend capability: authorizes only the current real admin Auth session for at most eight hours. Auth sign-out cascades revocation.';
