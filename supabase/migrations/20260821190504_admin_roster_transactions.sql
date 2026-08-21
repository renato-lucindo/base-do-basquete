create table public.admin_mutation_audit (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict
    deferrable initially immediate,
  action text not null check (
    action in ('registration_created', 'registration_transitioned', 'roster_replaced')
  ),
  entity_type text not null check (entity_type in ('team_registration')),
  entity_id bigint not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default now()
);

create index admin_mutation_audit_user_occurred_idx
  on public.admin_mutation_audit (user_id, occurred_at desc);
create index admin_mutation_audit_entity_idx
  on public.admin_mutation_audit (entity_type, entity_id, occurred_at desc);

alter table public.admin_mutation_audit enable row level security;
alter table public.admin_mutation_audit force row level security;

revoke all on public.admin_mutation_audit from public, anon, authenticated;
revoke all on sequence public.admin_mutation_audit_id_seq from public, anon, authenticated;
grant select, insert on public.admin_mutation_audit to authenticated;
grant usage, select on sequence public.admin_mutation_audit_id_seq to authenticated;

create policy admin_mutation_audit_admin_select
on public.admin_mutation_audit for select to authenticated
using ((select public.is_current_admin_aal2()));

create policy admin_mutation_audit_admin_insert
on public.admin_mutation_audit for insert to authenticated
with check (
  (select public.is_current_admin_aal2()) and user_id = (select auth.uid())
);

create or replace function public.admin_create_team_registration(
  p_competition_id bigint,
  p_team_id bigint
)
returns public.team_registrations
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result public.team_registrations;
  was_created boolean := false;
begin
  if not (select public.is_current_admin_aal2()) then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  if not exists (select 1 from public.competitions where id = p_competition_id) then
    raise exception using errcode = 'BD404', message = 'BDB_COMPETITION_NOT_FOUND';
  end if;
  if not exists (select 1 from public.teams where id = p_team_id and is_active) then
    raise exception using errcode = 'BD404', message = 'BDB_TEAM_NOT_FOUND';
  end if;

  insert into public.team_registrations (competition_id, team_id, status)
  values (p_competition_id, p_team_id, 'draft')
  on conflict (competition_id, team_id) do nothing
  returning * into result;

  if found then
    was_created := true;
  else
    select * into strict result
    from public.team_registrations
    where competition_id = p_competition_id and team_id = p_team_id;
  end if;

  if was_created then
    insert into public.admin_mutation_audit (action, entity_type, entity_id)
    values ('registration_created', 'team_registration', result.id);
  end if;

  return result;
end;
$$;

create or replace function public.admin_transition_team_registration(
  p_registration_id bigint,
  p_status text
)
returns public.team_registrations
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_row public.team_registrations;
  result public.team_registrations;
begin
  if not (select public.is_current_admin_aal2()) then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  select * into current_row
  from public.team_registrations
  where id = p_registration_id
  for update;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_REGISTRATION_NOT_FOUND';
  end if;

  if p_status not in ('confirmed', 'withdrawn', 'completed') or not (
    (current_row.status = 'draft' and p_status in ('confirmed', 'withdrawn')) or
    (current_row.status = 'confirmed' and p_status in ('withdrawn', 'completed')) or
    current_row.status = p_status
  ) then
    raise exception using errcode = 'BD102', message = 'BDB_INVALID_REGISTRATION_TRANSITION';
  end if;

  if current_row.status = p_status then
    return current_row;
  end if;

  update public.team_registrations
  set status = p_status,
      confirmed_at = coalesce(confirmed_at, now())
  where id = p_registration_id
  returning * into strict result;

  insert into public.admin_mutation_audit (action, entity_type, entity_id, metadata)
  values (
    'registration_transitioned',
    'team_registration',
    result.id,
    jsonb_build_object('from', current_row.status, 'to', result.status)
  );

  return result;
end;
$$;

create or replace function public.admin_replace_roster(
  p_registration_id bigint,
  p_entries jsonb
)
returns setof public.roster_entries
language plpgsql
security invoker
set search_path = ''
as $$
declare
  registration public.team_registrations;
  entry_count integer;
  violated_constraint text;
begin
  if not (select public.is_current_admin_aal2()) then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if jsonb_typeof(p_entries) <> 'array' then
    raise exception using errcode = 'BD103', message = 'BDB_ROSTER_ARRAY_REQUIRED';
  end if;

  select * into registration
  from public.team_registrations
  where id = p_registration_id
  for update;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_REGISTRATION_NOT_FOUND';
  end if;
  if registration.status in ('withdrawn', 'completed') then
    raise exception using errcode = 'BD102', message = 'BDB_REGISTRATION_NOT_EDITABLE';
  end if;

  select count(*) into entry_count from jsonb_array_elements(p_entries);
  if entry_count > 30 then
    raise exception using errcode = 'BD103', message = 'BDB_ROSTER_TOO_LARGE';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_entries) item
    where jsonb_typeof(item) <> 'object'
      or not (item ? 'playerId')
      or (item->>'playerId') !~ '^[1-9][0-9]*$'
      or (item ? 'jerseyNumber' and item->>'jerseyNumber' is not null and
        btrim(item->>'jerseyNumber') !~ '^(?:0|00|[1-9][0-9]?)$')
  ) then
    raise exception using errcode = 'BD103', message = 'BDB_INVALID_ROSTER_ENTRY';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_entries) item
    group by (item->>'playerId')::bigint
    having count(*) > 1
  ) then
    raise exception using errcode = 'BD103', message = 'BDB_DUPLICATE_ROSTER_PLAYER';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_entries) item
    left join public.players player on player.id = (item->>'playerId')::bigint
    where player.id is null or not player.is_active
  ) then
    raise exception using errcode = 'BD404', message = 'BDB_ROSTER_PLAYER_NOT_FOUND';
  end if;

  update public.roster_entries
  set status = 'inactive', left_on = coalesce(left_on, current_date)
  where registration_id = p_registration_id and status = 'active';

  begin
    insert into public.roster_entries (
      competition_id, registration_id, player_id, jersey_number, status, left_on
    )
    select
      registration.competition_id,
      registration.id,
      (item->>'playerId')::bigint,
      nullif(btrim(item->>'jerseyNumber'), ''),
      'active',
      null
    from jsonb_array_elements(p_entries) item
    on conflict (registration_id, player_id) do update
    set jersey_number = excluded.jersey_number,
        status = 'active',
        left_on = null;
  exception when unique_violation then
    get stacked diagnostics violated_constraint = constraint_name;
    if violated_constraint = 'roster_entries_active_competition_player_uidx' then
      raise exception using errcode = 'BD104', message = 'BDB_PLAYER_ALREADY_REGISTERED';
    elsif violated_constraint = 'roster_entries_active_registration_jersey_uidx' then
      raise exception using errcode = 'BD105', message = 'BDB_DUPLICATE_ACTIVE_JERSEY';
    else
      raise;
    end if;
  end;

  insert into public.admin_mutation_audit (action, entity_type, entity_id, metadata)
  values (
    'roster_replaced',
    'team_registration',
    registration.id,
    jsonb_build_object('entryCount', entry_count)
  );

  return query
  select * from public.roster_entries
  where registration_id = p_registration_id and status = 'active'
  order by jersey_number nulls last, player_id;
end;
$$;

revoke all on function public.admin_create_team_registration(bigint, bigint) from public, anon;
revoke all on function public.admin_transition_team_registration(bigint, text) from public, anon;
revoke all on function public.admin_replace_roster(bigint, jsonb) from public, anon;
grant execute on function public.admin_create_team_registration(bigint, bigint) to authenticated;
grant execute on function public.admin_transition_team_registration(bigint, text) to authenticated;
grant execute on function public.admin_replace_roster(bigint, jsonb) to authenticated;

comment on table public.admin_mutation_audit is 'Essential append-only audit for administrative domain mutations.';
