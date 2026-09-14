-- ADM-REF-01E: enforce private eligibility in the authoritative roster transaction.

create or replace function public.admin_replace_roster(
  p_registration_id bigint,
  p_entries jsonb
)
returns setof public.roster_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  registration public.team_registrations;
  competition_gender text;
  competition_review_required boolean;
  entry_count integer;
  violated_constraint text;
begin
  if not public.is_current_admin_aal2() then
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

  select competition.gender_division, competition.gender_division_review_required
  into competition_gender, competition_review_required
  from public.competitions competition
  where competition.id = registration.competition_id
  for share;
  if competition_gender is null or competition_review_required then
    raise exception using errcode = 'BD505', message = 'BDB_COMPETITION_GENDER_REVIEW_REQUIRED';
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

  -- An exact repeat is a no-op. This also preserves a historical association
  -- that predates the eligibility rollout without treating it as a new link.
  if entry_count = (
    select count(*)
    from public.roster_entries roster
    where roster.registration_id = registration.id and roster.status = 'active'
  ) and not exists (
    select 1
    from jsonb_array_elements(p_entries) item
    left join public.roster_entries roster
      on roster.registration_id = registration.id
     and roster.player_id = (item->>'playerId')::bigint
     and roster.status = 'active'
    where roster.id is null
       or roster.jersey_number is distinct from nullif(btrim(item->>'jerseyNumber'), '')
  ) then
    return query
    select roster.* from public.roster_entries roster
    where roster.registration_id = registration.id and roster.status = 'active'
    order by roster.jersey_number nulls last, roster.player_id;
    return;
  end if;

  -- Lock the private rows involved in new or reactivated associations so a
  -- concurrent private review cannot invalidate the decision before commit.
  perform private_data.player_id
  from private.player_private private_data
  join jsonb_array_elements(p_entries) item
    on private_data.player_id = (item->>'playerId')::bigint
  where not exists (
    select 1
    from public.roster_entries current_roster
    where current_roster.registration_id = registration.id
      and current_roster.player_id = private_data.player_id
      and current_roster.status = 'active'
  )
  order by private_data.player_id
  for share of private_data;

  if exists (
    select 1
    from jsonb_array_elements(p_entries) item
    left join private.player_private private_data
      on private_data.player_id = (item->>'playerId')::bigint
    where not exists (
      select 1
      from public.roster_entries current_roster
      where current_roster.registration_id = registration.id
        and current_roster.player_id = (item->>'playerId')::bigint
        and current_roster.status = 'active'
    ) and (
      private_data.player_id is null
      or private_data.sex is null
      or private_data.sex_review_required
    )
  ) then
    raise exception using errcode = 'BD601', message = 'BDB_PLAYER_ELIGIBILITY_PENDING';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_entries) item
    join private.player_private private_data
      on private_data.player_id = (item->>'playerId')::bigint
    where not exists (
      select 1
      from public.roster_entries current_roster
      where current_roster.registration_id = registration.id
        and current_roster.player_id = (item->>'playerId')::bigint
        and current_roster.status = 'active'
    ) and private_data.sex <> competition_gender
  ) then
    raise exception using errcode = 'BD602', message = 'BDB_PLAYER_NOT_ELIGIBLE_FOR_DIVISION';
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
  select roster.* from public.roster_entries roster
  where roster.registration_id = p_registration_id and roster.status = 'active'
  order by roster.jersey_number nulls last, roster.player_id;
end;
$$;

revoke all on function public.admin_replace_roster(bigint, jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_replace_roster(bigint, jsonb)
  to authenticated;

comment on function public.admin_replace_roster(bigint, jsonb) is
  'AAL2-only atomic roster replacement; validates private eligibility only for new associations and returns no private value.';
