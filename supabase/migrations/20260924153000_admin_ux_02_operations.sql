create function private.admin_resolve_team(
  p_name text,
  p_abbreviation text default null
)
returns public.teams
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  normalized_abbreviation text := nullif(upper(btrim(coalesce(p_abbreviation, ''))), '');
  slug_base text;
  slug_candidate text;
  suffix integer := 1;
  result public.teams;
begin
  if not (select public.is_current_admin_aal2()) then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if char_length(normalized_name) not between 2 and 120 then
    raise exception using errcode = 'BD102', message = 'BDB_TEAM_INPUT_INVALID';
  end if;
  if normalized_abbreviation is not null and normalized_abbreviation !~ '^[A-Z0-9]{2,8}$' then
    raise exception using errcode = 'BD102', message = 'BDB_TEAM_INPUT_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('team-name:' || lower(normalized_name), 0));

  select team.* into result
  from public.teams team
  where team.is_active
    and lower(regexp_replace(team.name, '\s+', ' ', 'g')) = lower(normalized_name)
  order by team.id
  limit 1;
  if found then
    return result;
  end if;

  slug_base := trim(both '-' from regexp_replace(
    translate(
      lower(normalized_name),
      'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
      'aaaaaaeeeeiiiiooooouuuucnyy'
    ),
    '[^a-z0-9]+',
    '-',
    'g'
  ));
  if slug_base = '' then
    raise exception using errcode = 'BD102', message = 'BDB_TEAM_INPUT_INVALID';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('team-slug:' || slug_base, 0));

  slug_candidate := slug_base;
  while exists(select 1 from public.teams where slug = slug_candidate) loop
    suffix := suffix + 1;
    slug_candidate := slug_base || '-' || suffix::text;
  end loop;

  insert into public.teams(name, slug, abbreviation, is_public)
  values(normalized_name, slug_candidate, normalized_abbreviation, false)
  returning * into result;
  return result;
end;
$$;

revoke all on function private.admin_resolve_team(text, text) from public, anon;
grant execute on function private.admin_resolve_team(text, text) to authenticated;

create function public.admin_create_team(
  p_name text,
  p_abbreviation text default null
)
returns public.teams
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result public.teams;
begin
  if not (select public.is_current_admin_aal2()) then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  select * into strict result from private.admin_resolve_team(p_name, p_abbreviation);
  return result;
end;
$$;

revoke all on function public.admin_create_team(text, text) from public, anon, authenticated;
grant execute on function public.admin_create_team(text, text) to authenticated;

create function public.admin_create_and_register_team(
  p_competition_id bigint,
  p_name text,
  p_abbreviation text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  team public.teams;
  registration public.team_registrations;
begin
  if not (select public.is_current_admin_aal2()) then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if not exists(select 1 from public.competitions where id = p_competition_id) then
    raise exception using errcode = 'BD404', message = 'BDB_COMPETITION_NOT_FOUND';
  end if;

  select * into strict team from private.admin_resolve_team(p_name, p_abbreviation);
  select * into strict registration
  from public.admin_create_team_registration(p_competition_id, team.id);

  return jsonb_build_object(
    'teamId', team.id,
    'teamName', team.name,
    'teamSlug', team.slug,
    'registrationId', registration.id,
    'registrationStatus', registration.status
  );
end;
$$;

revoke all on function public.admin_create_and_register_team(bigint, text, text)
from public, anon, authenticated;
grant execute on function public.admin_create_and_register_team(bigint, text, text) to authenticated;

create function public.admin_prepare_matchups_batch(
  p_competition_id bigint,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  matchup_id bigint;
  expected_revision integer;
  scheduled_at timestamptz;
  venue text;
  game_id bigint;
  result jsonb := '[]'::jsonb;
begin
  if not (select public.is_current_admin_aal2()) then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if not exists(select 1 from public.competitions where id = p_competition_id) then
    raise exception using errcode = 'BD404', message = 'BDB_COMPETITION_NOT_FOUND';
  end if;
  if p_items is null
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0
    or jsonb_array_length(p_items) > 64 then
    raise exception using errcode = 'BR025', message = 'BDB_SCHEDULE_INPUT_INVALID';
  end if;
  if exists(
    select 1
    from jsonb_array_elements(p_items) value
    where jsonb_typeof(value) <> 'object'
      or coalesce(value->>'matchupId', '') !~ '^[1-9][0-9]*$'
      or coalesce(value->>'expectedRevision', '') !~ '^(0|[1-9][0-9]*)$'
      or (value->'scheduledAt' is not null and jsonb_typeof(value->'scheduledAt') not in ('string', 'null'))
      or (value->'venue' is not null and jsonb_typeof(value->'venue') not in ('string', 'null'))
  ) then
    raise exception using errcode = 'BR025', message = 'BDB_SCHEDULE_INPUT_INVALID';
  end if;
  if (
    select count(*)
    from jsonb_array_elements(p_items)
  ) <> (
    select count(distinct (value->>'matchupId')::bigint)
    from jsonb_array_elements(p_items) value
  ) then
    raise exception using errcode = 'BR025', message = 'BDB_SCHEDULE_INPUT_INVALID';
  end if;
  if exists(
    select 1
    from jsonb_array_elements(p_items) value
    left join public.matchups matchup on matchup.id = (value->>'matchupId')::bigint
    where matchup.id is null or matchup.competition_id <> p_competition_id
  ) then
    raise exception using errcode = 'BD404', message = 'BDB_MATCHUP_NOT_FOUND';
  end if;

  for item in select value from jsonb_array_elements(p_items) value loop
    matchup_id := (item->>'matchupId')::bigint;
    expected_revision := (item->>'expectedRevision')::integer;
    venue := nullif(btrim(item->>'venue'), '');
    if venue is not null and char_length(venue) > 160 then
      raise exception using errcode = 'BR025', message = 'BDB_SCHEDULE_INPUT_INVALID';
    end if;
    begin
      scheduled_at := case
        when item->>'scheduledAt' is null then null
        else (item->>'scheduledAt')::timestamptz
      end;
    exception when invalid_datetime_format or datetime_field_overflow then
      raise exception using errcode = 'BR025', message = 'BDB_SCHEDULE_INPUT_INVALID';
    end;

    game_id := public.admin_prepare_matchup(
      matchup_id,
      expected_revision,
      scheduled_at,
      venue
    );
    result := result || jsonb_build_array(jsonb_build_object(
      'matchupId', matchup_id,
      'gameId', game_id
    ));
  end loop;
  return result;
end;
$$;

revoke all on function public.admin_prepare_matchups_batch(bigint, jsonb)
from public, anon, authenticated;
grant execute on function public.admin_prepare_matchups_batch(bigint, jsonb) to authenticated;
