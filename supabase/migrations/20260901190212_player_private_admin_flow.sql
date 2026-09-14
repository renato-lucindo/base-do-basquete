-- ADM-REF-01D: collect and edit eligibility sex only through dedicated AAL2 RPCs.

create function public.admin_create_player_with_private_profile(
  p_full_name text,
  p_sex text,
  p_nickname text default null,
  p_allow_similar boolean default false
)
returns public.players
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.players;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if p_sex not in ('male', 'female') then
    raise exception using errcode = 'BD501', message = 'BDB_PLAYER_SEX_INVALID';
  end if;

  select * into strict result
  from public.admin_create_player(p_full_name, p_nickname, p_allow_similar);

  insert into private.player_private (player_id, sex, sex_review_required)
  values (result.id, p_sex, false)
  on conflict on constraint player_private_pkey do update
  set
    sex = excluded.sex,
    sex_review_required = false;

  insert into public.admin_mutation_audit (
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    'player_sex_reviewed',
    'player',
    result.id,
    jsonb_build_object(
      'reason', 'Cadastro inicial do atleta',
      'impact', jsonb_build_object(
        'rosterEntries', 0,
        'activeRosterEntries', 0,
        'competitions', 0
      )
    )
  );

  return result;
end;
$$;

create function public.admin_get_player_private_profile(p_player_id bigint)
returns table (
  player_id bigint,
  full_name text,
  sex text,
  eligibility_pending boolean,
  roster_entries bigint,
  active_roster_entries bigint,
  affected_competitions bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  return query
  select
    player.id,
    player.full_name,
    private_data.sex,
    coalesce(private_data.sex_review_required, true),
    count(roster.id),
    count(roster.id) filter (where roster.status = 'active'),
    count(distinct roster.competition_id)
  from public.players player
  left join private.player_private private_data on private_data.player_id = player.id
  left join public.roster_entries roster on roster.player_id = player.id
  where player.id = p_player_id
  group by player.id, player.full_name, private_data.sex, private_data.sex_review_required;

  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_PLAYER_NOT_FOUND';
  end if;
end;
$$;

create or replace function public.admin_set_player_sex(
  p_player_id bigint,
  p_sex text,
  p_reason text
)
returns table (
  player_id bigint,
  eligibility_pending boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_reason text := btrim(coalesce(p_reason, ''));
  current_sex text;
  review_required boolean;
  roster_count bigint;
  active_roster_count bigint;
  competition_count bigint;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if p_sex not in ('male', 'female') then
    raise exception using errcode = 'BD501', message = 'BDB_PLAYER_SEX_INVALID';
  end if;
  if char_length(clean_reason) not between 10 and 500 then
    raise exception using errcode = 'BD501', message = 'BDB_PLAYER_SEX_REASON_REQUIRED';
  end if;
  if not exists (
    select 1 from public.players player where player.id = p_player_id
  ) then
    raise exception using errcode = 'BD404', message = 'BDB_PLAYER_NOT_FOUND';
  end if;

  insert into private.player_private (player_id)
  values (p_player_id)
  on conflict on constraint player_private_pkey do nothing;

  select private_data.sex, private_data.sex_review_required
  into current_sex, review_required
  from private.player_private private_data
  where private_data.player_id = p_player_id
  for update;

  if current_sex is not distinct from p_sex and not review_required then
    return query select p_player_id, false;
    return;
  end if;

  select
    count(roster.id),
    count(roster.id) filter (where roster.status = 'active'),
    count(distinct roster.competition_id)
  into roster_count, active_roster_count, competition_count
  from public.roster_entries roster
  where roster.player_id = p_player_id;

  update private.player_private as private_data
  set
    sex = p_sex,
    sex_review_required = false
  where private_data.player_id = p_player_id;

  insert into public.admin_mutation_audit (
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    'player_sex_reviewed',
    'player',
    p_player_id,
    jsonb_build_object(
      'reason', clean_reason,
      'impact', jsonb_build_object(
        'rosterEntries', roster_count,
        'activeRosterEntries', active_roster_count,
        'competitions', competition_count
      )
    )
  );

  return query select p_player_id, false;
end;
$$;

revoke all on function public.admin_create_player(text, text, boolean)
  from public, anon, authenticated;
revoke all on function public.admin_create_player_with_private_profile(text, text, text, boolean)
  from public, anon, authenticated;
revoke all on function public.admin_get_player_private_profile(bigint)
  from public, anon, authenticated;
revoke all on function public.admin_set_player_sex(bigint, text, text)
  from public, anon, authenticated;

grant execute on function public.admin_create_player_with_private_profile(text, text, text, boolean)
  to authenticated;
grant execute on function public.admin_get_player_private_profile(bigint)
  to authenticated;
grant execute on function public.admin_set_player_sex(bigint, text, text)
  to authenticated;

comment on function public.admin_create_player_with_private_profile(text, text, text, boolean) is
  'AAL2-only atomic player creation with explicit private eligibility data.';
comment on function public.admin_get_player_private_profile(bigint) is
  'AAL2-only dedicated private player form payload with roster impact.';
comment on function public.admin_set_player_sex(bigint, text, text) is
  'AAL2-only idempotent private eligibility update with reason and value-free impact audit.';
