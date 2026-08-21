create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table private.admin_accounts (
  singleton_key boolean primary key default true check (singleton_key),
  user_id uuid not null unique,
  created_at timestamptz not null default now(),
  constraint admin_accounts_user_id_fkey
    foreign key (user_id)
    references auth.users (id)
    on update cascade
    on delete restrict
    deferrable initially deferred
);

alter table private.admin_accounts enable row level security;
alter table private.admin_accounts force row level security;

revoke all on table private.admin_accounts from public, anon, authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.admin_accounts
    where user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

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

revoke all on function private.is_admin_aal2() from public;
grant execute on function private.is_admin_aal2() to authenticated;

create or replace function public.is_current_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_admin();
$$;

create or replace function public.is_current_admin_aal2()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_admin_aal2();
$$;

revoke all on function public.is_current_admin() from public, anon;
revoke all on function public.is_current_admin_aal2() from public, anon;
grant execute on function public.is_current_admin() to authenticated;
grant execute on function public.is_current_admin_aal2() to authenticated;

create table public.auth_audit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(),
  event_type text not null check (
    event_type in ('mfa_verified', 'session_refreshed', 'admin_access', 'logout')
  ),
  correlation_id uuid not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  constraint auth_audit_events_user_id_fkey
    foreign key (user_id)
    references auth.users (id)
    on update cascade
    on delete restrict
    deferrable initially deferred
);

create index auth_audit_events_user_occurred_idx
  on public.auth_audit_events (user_id, occurred_at desc);

alter table public.auth_audit_events enable row level security;
alter table public.auth_audit_events force row level security;

revoke all on table public.auth_audit_events from public, anon, authenticated;
revoke all on sequence public.auth_audit_events_id_seq from public, anon, authenticated;
grant select, insert on table public.auth_audit_events to authenticated;
grant usage, select on sequence public.auth_audit_events_id_seq to authenticated;

create policy auth_audit_events_admin_select
on public.auth_audit_events
for select
to authenticated
using ((select private.is_admin_aal2()));

create policy auth_audit_events_admin_insert
on public.auth_audit_events
for insert
to authenticated
with check (
  (select private.is_admin_aal2())
  and user_id = (select auth.uid())
);

comment on schema private is 'Backend-controlled authorization data; not exposed by the Data API.';
comment on table private.admin_accounts is 'Singleton authorization record for the first-season administrator.';
comment on table public.auth_audit_events is 'Essential, append-only audit trail for authenticated administrator events.';
