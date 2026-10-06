-- PR2: independent registrations for the same team and reviewed roster copies.

alter table public.team_registrations
  add column public_name text;

update public.team_registrations registration
set public_name = team.name
from public.teams team
where team.id = registration.team_id
  and registration.public_name is null;

create function private.normalize_team_registration_public_name()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  fallback_name text;
begin
  if new.public_name is null or btrim(new.public_name) = '' then
    select team.name into fallback_name
    from public.teams team
    where team.id = new.team_id;
    new.public_name := fallback_name;
  else
    new.public_name := regexp_replace(btrim(new.public_name), '\s+', ' ', 'g');
  end if;
  return new;
end;
$$;

revoke all on function private.normalize_team_registration_public_name()
  from public, anon, authenticated;

create trigger team_registrations_public_name_normalize
before insert or update of team_id, public_name on public.team_registrations
for each row execute function private.normalize_team_registration_public_name();

alter table public.team_registrations
  alter column public_name set not null,
  add constraint team_registrations_public_name_check check (
    public_name = btrim(public_name)
    and char_length(public_name) between 2 and 120
  ),
  drop constraint team_registrations_competition_team_unique;

create unique index team_registrations_competition_public_name_uidx
  on public.team_registrations (competition_id, lower(public_name));

create index team_registrations_competition_team_idx
  on public.team_registrations (competition_id, team_id, id);

create table private.registration_copy_requests (
  request_id uuid primary key,
  actor_id uuid not null references auth.users(id) on delete restrict,
  source_competition_id bigint not null references public.competitions(id) on delete restrict,
  target_competition_id bigint not null references public.competitions(id) on delete restrict,
  input jsonb not null check (jsonb_typeof(input) = 'array'),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now()
);

create index registration_copy_requests_actor_idx
  on private.registration_copy_requests (actor_id, created_at desc);

alter table private.registration_copy_requests enable row level security;
alter table private.registration_copy_requests force row level security;
revoke all on private.registration_copy_requests from public, anon, authenticated;

-- Keep the legacy two-argument contract idempotent. New A/B registrations use
-- admin_create_named_team_registration explicitly.
create or replace function public.admin_create_team_registration(
  p_competition_id bigint,
  p_team_id bigint
)
returns public.team_registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.team_registrations;
  team_name text;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if not exists(select 1 from public.competitions where id = p_competition_id) then
    raise exception using errcode = 'BD404', message = 'BDB_COMPETITION_NOT_FOUND';
  end if;
  select team.name into team_name
  from public.teams team
  where team.id = p_team_id and team.is_active
  for share;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_TEAM_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_competition_id::text || ':' || p_team_id::text,
    511
  ));

  select registration.* into result
  from public.team_registrations registration
  where registration.competition_id = p_competition_id
    and registration.team_id = p_team_id
    and registration.status <> 'withdrawn'
  order by registration.id
  limit 1;
  if found then
    return result;
  end if;

  begin
    insert into public.team_registrations (competition_id, team_id, public_name, status)
    values (p_competition_id, p_team_id, team_name, 'draft')
    returning * into strict result;
  exception when unique_violation then
    raise exception using errcode = 'BD409', message = 'BDB_REGISTRATION_PUBLIC_NAME_CONFLICT';
  end;

  insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
  values (
    'registration_created',
    'team_registration',
    result.id,
    jsonb_build_object('publicName', result.public_name, 'legacyContract', true)
  );
  return result;
end;
$$;

revoke all on function public.admin_create_team_registration(bigint, bigint)
  from public, anon, authenticated;
grant execute on function public.admin_create_team_registration(bigint, bigint)
  to authenticated;

create function public.admin_create_named_team_registration(
  p_competition_id bigint,
  p_team_id bigint,
  p_public_name text
)
returns public.team_registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.team_registrations;
  clean_name text := regexp_replace(btrim(coalesce(p_public_name, '')), '\s+', ' ', 'g');
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if char_length(clean_name) not between 2 and 120 then
    raise exception using errcode = 'BD102', message = 'BDB_REGISTRATION_PUBLIC_NAME_INVALID';
  end if;
  if not exists(select 1 from public.competitions where id = p_competition_id) then
    raise exception using errcode = 'BD404', message = 'BDB_COMPETITION_NOT_FOUND';
  end if;
  if not exists(select 1 from public.teams where id = p_team_id and is_active) then
    raise exception using errcode = 'BD404', message = 'BDB_TEAM_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_competition_id::text || ':' || lower(clean_name),
    512
  ));

  begin
    insert into public.team_registrations (competition_id, team_id, public_name, status)
    values (p_competition_id, p_team_id, clean_name, 'draft')
    returning * into strict result;
  exception when unique_violation then
    raise exception using errcode = 'BD409', message = 'BDB_REGISTRATION_PUBLIC_NAME_CONFLICT';
  end;

  insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
  values (
    'registration_created',
    'team_registration',
    result.id,
    jsonb_build_object('publicName', result.public_name, 'namedContract', true)
  );
  return result;
end;
$$;

revoke all on function public.admin_create_named_team_registration(bigint, bigint, text)
  from public, anon, authenticated;
grant execute on function public.admin_create_named_team_registration(bigint, bigint, text)
  to authenticated;

create function public.admin_create_and_register_named_team(
  p_competition_id bigint,
  p_name text,
  p_abbreviation text,
  p_public_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  team public.teams;
  registration public.team_registrations;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  select * into strict team from private.admin_resolve_team(p_name, p_abbreviation);
  select * into strict registration
  from public.admin_create_named_team_registration(
    p_competition_id,
    team.id,
    coalesce(nullif(btrim(p_public_name), ''), team.name)
  );
  return jsonb_build_object(
    'teamId', team.id,
    'teamName', team.name,
    'teamSlug', team.slug,
    'registrationId', registration.id,
    'registrationPublicName', registration.public_name,
    'registrationStatus', registration.status
  );
end;
$$;

revoke all on function public.admin_create_and_register_named_team(bigint, text, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_create_and_register_named_team(bigint, text, text, text)
  to authenticated;

create function public.admin_preview_registration_copy(
  p_source_competition_id bigint,
  p_target_competition_id bigint
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  source_competition public.competitions;
  target_competition public.competitions;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  select * into source_competition from public.competitions where id = p_source_competition_id;
  select * into target_competition from public.competitions where id = p_target_competition_id;
  if source_competition.id is null or target_competition.id is null then
    raise exception using errcode = 'BD404', message = 'BDB_COMPETITION_NOT_FOUND';
  end if;
  if source_competition.id = target_competition.id
    or source_competition.season_id is null
    or source_competition.season_id is distinct from target_competition.season_id
  then
    raise exception using errcode = 'BD409', message = 'BDB_REGISTRATION_COPY_CONTEXT_INVALID';
  end if;
  if target_competition.gender_division is null
    or target_competition.gender_division_review_required
  then
    raise exception using errcode = 'BD505', message = 'BDB_COMPETITION_GENDER_REVIEW_REQUIRED';
  end if;

  return jsonb_build_object(
    'sourceCompetitionId', source_competition.id,
    'targetCompetitionId', target_competition.id,
    'registrations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sourceRegistrationId', registration.id,
        'teamId', registration.team_id,
        'teamName', team.name,
        'publicName', registration.public_name,
        'publicNameConflict', exists(
          select 1 from public.team_registrations target_registration
          where target_registration.competition_id = target_competition.id
            and lower(target_registration.public_name) = lower(registration.public_name)
        ),
        'players', coalesce((
          select jsonb_agg(jsonb_build_object(
            'playerId', roster.player_id,
            'fullName', player.full_name,
            'jerseyNumber', roster.jersey_number,
            'conflict', case
              when not player.is_active then 'player_inactive'
              when exists(
                select 1 from public.roster_entries target_roster
                where target_roster.competition_id = target_competition.id
                  and target_roster.player_id = roster.player_id
                  and target_roster.status = 'active'
              ) then 'already_registered'
              when private_data.player_id is null
                or private_data.sex is null
                or private_data.sex_review_required
                then 'eligibility_pending'
              when private_data.sex <> target_competition.gender_division
                then 'gender_incompatible'
              else null
            end
          ) order by roster.jersey_number nulls last, roster.player_id)
          from public.roster_entries roster
          join public.players player on player.id = roster.player_id
          left join private.player_private private_data on private_data.player_id = roster.player_id
          where roster.registration_id = registration.id
            and roster.status = 'active'
        ), '[]'::jsonb)
      ) order by registration.public_name, registration.id)
      from public.team_registrations registration
      join public.teams team on team.id = registration.team_id
      where registration.competition_id = source_competition.id
        and registration.status <> 'withdrawn'
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_preview_registration_copy(bigint, bigint)
  from public, anon, authenticated;
grant execute on function public.admin_preview_registration_copy(bigint, bigint)
  to authenticated;

create function public.admin_copy_team_registrations(
  p_request_id uuid,
  p_source_competition_id bigint,
  p_target_competition_id bigint,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_competition public.competitions;
  target_competition public.competitions;
  previous private.registration_copy_requests;
  item jsonb;
  source_registration public.team_registrations;
  target_registration public.team_registrations;
  clean_name text;
  player_ids bigint[];
  copied_players integer;
  result_items jsonb := '[]'::jsonb;
  violated_constraint text;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if p_request_id is null
    or p_items is null
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0
    or jsonb_array_length(p_items) > 32
  then
    raise exception using errcode = 'BD102', message = 'BDB_REGISTRATION_COPY_INPUT_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 513));
  select request.* into previous
  from private.registration_copy_requests request
  where request.request_id = p_request_id;
  if found then
    if previous.actor_id is distinct from auth.uid()
      or previous.source_competition_id <> p_source_competition_id
      or previous.target_competition_id <> p_target_competition_id
      or previous.input <> p_items
    then
      raise exception using errcode = 'BD409', message = 'BDB_IDEMPOTENCY_KEY_REUSED';
    end if;
    return previous.result;
  end if;

  select * into source_competition
  from public.competitions where id = p_source_competition_id for share;
  select * into target_competition
  from public.competitions where id = p_target_competition_id for update;
  if source_competition.id is null or target_competition.id is null then
    raise exception using errcode = 'BD404', message = 'BDB_COMPETITION_NOT_FOUND';
  end if;
  if source_competition.id = target_competition.id
    or source_competition.season_id is null
    or source_competition.season_id is distinct from target_competition.season_id
  then
    raise exception using errcode = 'BD409', message = 'BDB_REGISTRATION_COPY_CONTEXT_INVALID';
  end if;
  if target_competition.gender_division is null
    or target_competition.gender_division_review_required
  then
    raise exception using errcode = 'BD505', message = 'BDB_COMPETITION_GENDER_REVIEW_REQUIRED';
  end if;

  if exists(
    select 1 from jsonb_array_elements(p_items) value
    where jsonb_typeof(value) <> 'object'
      or not (value ? 'sourceRegistrationId')
      or coalesce(value->>'sourceRegistrationId', '') !~ '^[1-9][0-9]*$'
      or not (value ? 'publicName')
      or jsonb_typeof(value->'publicName') <> 'string'
      or char_length(regexp_replace(btrim(value->>'publicName'), '\s+', ' ', 'g')) not between 2 and 120
      or not (value ? 'playerIds')
      or jsonb_typeof(value->'playerIds') <> 'array'
      or jsonb_array_length(value->'playerIds') > 30
      or exists(
        select 1 from jsonb_array_elements_text(value->'playerIds') player_id
        where player_id !~ '^[1-9][0-9]*$'
      )
  ) then
    raise exception using errcode = 'BD102', message = 'BDB_REGISTRATION_COPY_INPUT_INVALID';
  end if;
  if (select count(*) from jsonb_array_elements(p_items)) <>
     (select count(distinct (value->>'sourceRegistrationId')::bigint) from jsonb_array_elements(p_items) value)
  then
    raise exception using errcode = 'BD102', message = 'BDB_REGISTRATION_COPY_INPUT_INVALID';
  end if;
  if (select count(*) from jsonb_array_elements(p_items)) <>
     (select count(distinct lower(regexp_replace(btrim(value->>'publicName'), '\s+', ' ', 'g')))
      from jsonb_array_elements(p_items) value)
  then
    raise exception using errcode = 'BD409', message = 'BDB_REGISTRATION_PUBLIC_NAME_CONFLICT';
  end if;

  perform registration.id
  from public.team_registrations registration
  join jsonb_array_elements(p_items) value
    on registration.id = (value->>'sourceRegistrationId')::bigint
  where registration.competition_id = source_competition.id
    and registration.status <> 'withdrawn'
  order by registration.id
  for share of registration;

  if (
    select count(*) from public.team_registrations registration
    where registration.competition_id = source_competition.id
      and registration.status <> 'withdrawn'
      and registration.id in (
        select (value->>'sourceRegistrationId')::bigint from jsonb_array_elements(p_items) value
      )
  ) <> jsonb_array_length(p_items) then
    raise exception using errcode = 'BD404', message = 'BDB_REGISTRATION_NOT_FOUND';
  end if;

  if exists(
    select 1
    from jsonb_array_elements(p_items) value
    join public.team_registrations existing_target_registration
      on existing_target_registration.competition_id = target_competition.id
     and lower(existing_target_registration.public_name) = lower(regexp_replace(btrim(value->>'publicName'), '\s+', ' ', 'g'))
  ) then
    raise exception using errcode = 'BD409', message = 'BDB_REGISTRATION_PUBLIC_NAME_CONFLICT';
  end if;

  -- Lock all selected private rows and active target roster rows before the
  -- eligibility decision. The source rows themselves are never mutated.
  perform private_data.player_id
  from private.player_private private_data
  where private_data.player_id in (
    select player_id::bigint
    from jsonb_array_elements(p_items) value,
         jsonb_array_elements_text(value->'playerIds') player_id
  )
  order by private_data.player_id
  for share;

  perform target_roster.id
  from public.roster_entries target_roster
  where target_roster.competition_id = target_competition.id
    and target_roster.status = 'active'
    and target_roster.player_id in (
      select player_id::bigint
      from jsonb_array_elements(p_items) value,
           jsonb_array_elements_text(value->'playerIds') player_id
    )
  order by target_roster.id
  for share;

  if exists(
    select 1
    from jsonb_array_elements(p_items) value,
         jsonb_array_elements_text(value->'playerIds') selected(player_id)
    left join public.roster_entries source_roster
      on source_roster.registration_id = (value->>'sourceRegistrationId')::bigint
     and source_roster.player_id = selected.player_id::bigint
     and source_roster.status = 'active'
    where source_roster.id is null
  ) then
    raise exception using errcode = 'BD102', message = 'BDB_REGISTRATION_COPY_PLAYER_NOT_IN_SOURCE';
  end if;

  if exists(
    select 1
    from jsonb_array_elements(p_items) value,
         jsonb_array_elements_text(value->'playerIds') selected(player_id)
    join public.players player on player.id = selected.player_id::bigint
    left join private.player_private private_data on private_data.player_id = player.id
    where not player.is_active
      or private_data.player_id is null
      or private_data.sex is null
      or private_data.sex_review_required
  ) then
    raise exception using errcode = 'BD601', message = 'BDB_PLAYER_ELIGIBILITY_PENDING';
  end if;
  if exists(
    select 1
    from jsonb_array_elements(p_items) value,
         jsonb_array_elements_text(value->'playerIds') selected(player_id)
    join private.player_private private_data on private_data.player_id = selected.player_id::bigint
    where private_data.sex <> target_competition.gender_division
  ) then
    raise exception using errcode = 'BD602', message = 'BDB_PLAYER_NOT_ELIGIBLE_FOR_DIVISION';
  end if;
  if exists(
    select 1
    from jsonb_array_elements(p_items) value,
         jsonb_array_elements_text(value->'playerIds') selected(player_id)
    join public.roster_entries target_roster
      on target_roster.competition_id = target_competition.id
     and target_roster.player_id = selected.player_id::bigint
     and target_roster.status = 'active'
  ) then
    raise exception using errcode = 'BD104', message = 'BDB_PLAYER_ALREADY_REGISTERED';
  end if;

  for item in select value from jsonb_array_elements(p_items) value loop
    select * into strict source_registration
    from public.team_registrations registration
    where registration.id = (item->>'sourceRegistrationId')::bigint;
    clean_name := regexp_replace(btrim(item->>'publicName'), '\s+', ' ', 'g');
    select coalesce(array_agg(player_id::bigint), '{}'::bigint[]) into player_ids
    from jsonb_array_elements_text(item->'playerIds') player_id;

    begin
      insert into public.team_registrations(competition_id, team_id, public_name, status)
      values(target_competition.id, source_registration.team_id, clean_name, 'draft')
      returning * into strict target_registration;
    exception when unique_violation then
      get stacked diagnostics violated_constraint = constraint_name;
      if violated_constraint = 'team_registrations_competition_public_name_uidx' then
        raise exception using errcode = 'BD409', message = 'BDB_REGISTRATION_PUBLIC_NAME_CONFLICT';
      end if;
      raise;
    end;

    insert into public.roster_entries(
      competition_id, registration_id, player_id, jersey_number, status, joined_on, left_on
    )
    select
      target_competition.id,
      target_registration.id,
      source_roster.player_id,
      source_roster.jersey_number,
      'active',
      null,
      null
    from public.roster_entries source_roster
    where source_roster.registration_id = source_registration.id
      and source_roster.status = 'active'
      and source_roster.player_id = any(player_ids);
    get diagnostics copied_players = row_count;

    insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
    values (
      'registration_created',
      'team_registration',
      target_registration.id,
      jsonb_build_object(
        'publicName', target_registration.public_name,
        'copiedFromRegistrationId', source_registration.id,
        'copiedPlayerCount', copied_players
      )
    );
    if copied_players > 0 then
      insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
      values (
        'roster_replaced',
        'team_registration',
        target_registration.id,
        jsonb_build_object(
          'entryCount', copied_players,
          'copiedFromRegistrationId', source_registration.id
        )
      );
    end if;

    result_items := result_items || jsonb_build_array(jsonb_build_object(
      'sourceRegistrationId', source_registration.id,
      'registrationId', target_registration.id,
      'publicName', target_registration.public_name,
      'copiedPlayerCount', copied_players
    ));
  end loop;

  insert into private.registration_copy_requests(
    request_id, actor_id, source_competition_id, target_competition_id, input, result
  ) values (
    p_request_id,
    auth.uid(),
    source_competition.id,
    target_competition.id,
    p_items,
    jsonb_build_object('registrations', result_items)
  );

  return jsonb_build_object('registrations', result_items);
end;
$$;

revoke all on function public.admin_copy_team_registrations(uuid, bigint, bigint, jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_copy_team_registrations(uuid, bigint, bigint, jsonb)
  to authenticated;

create function public.admin_preview_dispute_context_change(
  p_competition_id bigint,
  p_category_id bigint,
  p_gender_division text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  competition public.competitions;
  source_profile public.series_category_data_profiles;
  target_profile_id bigint;
  game_count bigint;
  duplicate_competition_id bigint;
  player_conflicts jsonb;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if p_category_id is null or p_gender_division not in ('male', 'female') then
    raise exception using errcode = 'BD501', message = 'BDB_COMPETITION_CONTEXT_INVALID';
  end if;
  select * into competition from public.competitions where id = p_competition_id;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_COMPETITION_NOT_FOUND';
  end if;
  if not exists(select 1 from public.categories where id = p_category_id and is_active) then
    raise exception using errcode = 'BD404', message = 'BDB_CATEGORY_NOT_FOUND';
  end if;

  select * into source_profile
  from public.series_category_data_profiles
  where id = competition.data_profile_id;
  if source_profile.id is not null then
    select profile.id into target_profile_id
    from public.series_category_data_profiles profile
    where profile.series_id = competition.series_id
      and profile.category_id = p_category_id
      and profile.gender_division = p_gender_division
      and profile.primary_source = source_profile.primary_source
      and profile.status = 'active'
    order by profile.version desc
    limit 1;
  end if;

  select count(*) into game_count from public.games where competition_id = competition.id;
  select other.id into duplicate_competition_id
  from public.competitions other
  where other.id <> competition.id
    and other.season_id = competition.season_id
    and other.category_id = p_category_id
    and other.gender_division = p_gender_division
    and other.competitive_division_value_id is not distinct from competition.competitive_division_value_id
  order by other.id
  limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'playerId', player.id,
    'fullName', player.full_name,
    'reason', case
      when private_data.player_id is null or private_data.sex is null or private_data.sex_review_required
        then 'eligibility_pending'
      when private_data.sex <> p_gender_division then 'gender_incompatible'
      else null
    end
  ) order by player.full_name, player.id) filter (
    where private_data.player_id is null
      or private_data.sex is null
      or private_data.sex_review_required
      or private_data.sex <> p_gender_division
  ), '[]'::jsonb)
  into player_conflicts
  from public.roster_entries roster
  join public.players player on player.id = roster.player_id
  left join private.player_private private_data on private_data.player_id = player.id
  where roster.competition_id = competition.id
    and roster.status = 'active';

  return jsonb_build_object(
    'competitionId', competition.id,
    'categoryId', p_category_id,
    'genderDivision', p_gender_division,
    'gameCount', game_count,
    'targetProfileId', target_profile_id,
    'duplicateCompetitionId', duplicate_competition_id,
    'playerConflicts', player_conflicts,
    'canApply', game_count = 0
      and target_profile_id is not null
      and duplicate_competition_id is null
      and jsonb_array_length(player_conflicts) = 0
  );
end;
$$;

revoke all on function public.admin_preview_dispute_context_change(bigint, bigint, text)
  from public, anon, authenticated;
grant execute on function public.admin_preview_dispute_context_change(bigint, bigint, text)
  to authenticated;

create function public.admin_apply_dispute_context_change(
  p_competition_id bigint,
  p_category_id bigint,
  p_gender_division text
)
returns public.competitions
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row public.competitions;
  result public.competitions;
  category public.categories;
  season public.competition_seasons;
  division public.competition_competitive_division_values;
  division_type public.competition_competitive_division_types;
  source_profile public.series_category_data_profiles;
  target_profile_id bigint;
  new_display_name text;
  conflict_constraint text;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if p_category_id is null or p_gender_division not in ('male', 'female') then
    raise exception using errcode = 'BD501', message = 'BDB_COMPETITION_CONTEXT_INVALID';
  end if;

  select * into current_row
  from public.competitions where id = p_competition_id for update;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_COMPETITION_NOT_FOUND';
  end if;
  if current_row.category_id = p_category_id
    and current_row.gender_division = p_gender_division
    and not current_row.gender_division_review_required
    and not current_row.data_profile_review_required
  then
    return current_row;
  end if;
  if exists(select 1 from public.games where competition_id = current_row.id) then
    raise exception using errcode = 'BD409', message = 'BDB_COMPETITION_CONTEXT_LOCKED_BY_GAMES';
  end if;

  select * into category from public.categories
  where id = p_category_id and is_active for share;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_CATEGORY_NOT_FOUND';
  end if;
  select * into season from public.competition_seasons
  where id = current_row.season_id for share;
  if not found then
    raise exception using errcode = 'BD409', message = 'BDB_COMPETITION_SEASON_CONTEXT_INVALID';
  end if;

  select * into source_profile
  from public.series_category_data_profiles
  where id = current_row.data_profile_id for share;
  if not found then
    raise exception using errcode = 'BD409', message = 'BDB_COMPETITION_PROFILE_MAPPING_NOT_FOUND';
  end if;
  select profile.id into target_profile_id
  from public.series_category_data_profiles profile
  where profile.series_id = current_row.series_id
    and profile.category_id = category.id
    and profile.gender_division = p_gender_division
    and profile.primary_source = source_profile.primary_source
    and profile.status = 'active'
  order by profile.version desc
  limit 1
  for share of profile;
  if not found then
    raise exception using errcode = 'BD409', message = 'BDB_COMPETITION_PROFILE_MAPPING_NOT_FOUND';
  end if;

  perform private_data.player_id
  from private.player_private private_data
  where private_data.player_id in (
    select roster.player_id
    from public.roster_entries roster
    where roster.competition_id = current_row.id and roster.status = 'active'
  )
  order by private_data.player_id
  for share;
  if exists(
    select 1
    from public.roster_entries roster
    left join private.player_private private_data on private_data.player_id = roster.player_id
    where roster.competition_id = current_row.id
      and roster.status = 'active'
      and (
        private_data.player_id is null
        or private_data.sex is null
        or private_data.sex_review_required
      )
  ) then
    raise exception using errcode = 'BD601', message = 'BDB_PLAYER_ELIGIBILITY_PENDING';
  end if;
  if exists(
    select 1
    from public.roster_entries roster
    join private.player_private private_data on private_data.player_id = roster.player_id
    where roster.competition_id = current_row.id
      and roster.status = 'active'
      and private_data.sex <> p_gender_division
  ) then
    raise exception using errcode = 'BD602', message = 'BDB_PLAYER_NOT_ELIGIBLE_FOR_DIVISION';
  end if;
  if exists(
    select 1 from public.competitions other
    where other.id <> current_row.id
      and other.season_id = current_row.season_id
      and other.category_id = category.id
      and other.gender_division = p_gender_division
      and other.competitive_division_value_id is not distinct from current_row.competitive_division_value_id
  ) then
    raise exception using errcode = 'BD506', message = 'BDB_COMPETITION_CONTEXT_ALREADY_EXISTS';
  end if;

  new_display_name := season.name || case when category.age_kind = 'adult' then '' else ' - ' || category.name end;
  if current_row.competitive_division_value_id is not null then
    select * into division from public.competition_competitive_division_values
    where id = current_row.competitive_division_value_id;
    select * into division_type from public.competition_competitive_division_types
    where id = division.competitive_division_type_id;
    new_display_name := new_display_name
      || case when category.age_kind = 'adult' then ' - ' else ' · ' end
      || division_type.name || ' ' || division.name;
  end if;

  begin
    update public.competitions
    set category_id = category.id,
        gender_division = p_gender_division,
        gender_division_review_required = false,
        data_profile_id = target_profile_id,
        data_profile_review_required = false,
        data_profile_validated_at = now(),
        data_profile_validated_by = auth.uid(),
        display_name = new_display_name,
        updated_at = now()
    where id = current_row.id
    returning * into strict result;
  exception when unique_violation then
    get stacked diagnostics conflict_constraint = constraint_name;
    if conflict_constraint = 'competitions_dispute_unique' then
      raise exception using errcode = 'BD506', message = 'BDB_COMPETITION_CONTEXT_ALREADY_EXISTS';
    end if;
    raise;
  end;

  insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
  values (
    'competition_gender_reviewed',
    'competition',
    result.id,
    jsonb_build_object(
      'previousCategoryId', current_row.category_id,
      'categoryId', result.category_id,
      'previousGenderDivision', current_row.gender_division,
      'genderDivision', result.gender_division,
      'seasonId', result.season_id,
      'competitiveDivisionValueId', result.competitive_division_value_id,
      'previousDataProfileId', current_row.data_profile_id,
      'dataProfileId', result.data_profile_id,
      'contextCorrection', true
    )
  );
  return result;
end;
$$;

revoke all on function public.admin_apply_dispute_context_change(bigint, bigint, text)
  from public, anon, authenticated;
grant execute on function public.admin_apply_dispute_context_change(bigint, bigint, text)
  to authenticated;

-- Harden the legacy gender-only correction too. It now delegates to the same
-- transactional correction path, preserving its public signature.
create or replace function public.admin_review_competition_gender(
  p_competition_id bigint,
  p_gender_division text
)
returns public.competitions
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_category_id bigint;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  select competition.category_id into current_category_id
  from public.competitions competition
  where competition.id = p_competition_id;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_COMPETITION_NOT_FOUND';
  end if;
  return public.admin_apply_dispute_context_change(
    p_competition_id,
    current_category_id,
    p_gender_division
  );
end;
$$;

revoke all on function public.admin_review_competition_gender(bigint, text)
  from public, anon, authenticated;
grant execute on function public.admin_review_competition_gender(bigint, text)
  to authenticated;

-- The legacy boxscore resolver accepts a team id when a registration does not
-- exist yet. Once a global team may have A/B registrations, that request is
-- only safe while the team has at most one registration in the dispute. The
-- resolution row is inserted in the same transaction, so rejecting it here
-- rolls back any draft transition or registration created by the legacy RPC.
create function private.guard_boxscore_team_resolution_ambiguity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  requested jsonb;
  requested_team_id bigint;
  registration_count integer;
begin
  if jsonb_typeof(new.request_payload -> 'teams') <> 'array' then
    return new;
  end if;

  for requested in
    select value from jsonb_array_elements(new.request_payload -> 'teams')
  loop
    if requested ->> 'action' <> 'register_existing_team' then
      continue;
    end if;
    begin
      requested_team_id := (requested ->> 'teamId')::bigint;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode = 'BD305', message = 'BDB_PDF_TEAM_RESOLUTION_INVALID';
    end;

    select count(*) into registration_count
    from public.team_registrations registration
    where registration.competition_id = new.competition_id
      and registration.team_id = requested_team_id;

    if registration_count > 1 then
      raise exception using
        errcode = 'BD319',
        message = 'BDB_PDF_TEAM_REGISTRATION_AMBIGUOUS',
        detail = jsonb_build_object(
          'teamId', requested_team_id,
          'registrationCount', registration_count
        )::text;
    end if;
  end loop;
  return new;
end;
$$;

revoke all on function private.guard_boxscore_team_resolution_ambiguity()
  from public, anon, authenticated;

create trigger boxscore_team_resolutions_registration_ambiguity
before insert on public.boxscore_team_resolutions
for each row execute function private.guard_boxscore_team_resolution_ambiguity();

-- Registration display identity is part of publication freshness. A public-name
-- change must hide the mutable base row until an explicit republish freezes the
-- new identity in a publication snapshot.
create or replace function private.publication_registration_fingerprint(
  p_registration_id bigint
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select md5(jsonb_build_object(
    'id', registration.id,
    'competitionId', registration.competition_id,
    'teamId', registration.team_id,
    'publicName', registration.public_name,
    'status', registration.status,
    'confirmedAt', registration.confirmed_at
  )::text)
  from public.team_registrations registration
  where registration.id = p_registration_id;
$$;

revoke all on function private.publication_registration_fingerprint(bigint)
  from public, anon, authenticated;

-- The versioned boxscore statistics snapshot already stores registration_id,
-- but its historical source view exposes the global team name/slug. Normalize
-- future snapshot rows at insertion time so filters and links preserve the
-- dispute-local registration identity without rewriting immutable publications.
create or replace function private.normalize_published_player_registration_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  registration_name text;
begin
  select registration.public_name
  into registration_name
  from public.team_registrations registration
  where registration.id = new.registration_id
    and registration.competition_id = new.competition_id;

  if registration_name is null then
    raise exception using errcode = 'BD404', message = 'BDB_REGISTRATION_NOT_FOUND';
  end if;

  new.team_name := registration_name;
  new.team_slug := 'inscricao-' || new.registration_id::text;
  return new;
end;
$$;

revoke all on function private.normalize_published_player_registration_identity()
  from public, anon, authenticated;

create trigger competition_player_statistics_publications_registration_identity
before insert on public.competition_player_statistics_publications
for each row execute function private.normalize_published_player_registration_identity();

-- Future publication snapshots use registration identity so two registrations
-- backed by one global team stay independent in standings, games and search.
-- Existing immutable publication rows are intentionally left unchanged.
create or replace function private.competition_publication_snapshot(p_competition_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'schemaVersion', 1,
    'competition', jsonb_build_object(
      'id', competition.id,
      'displayName', competition.display_name,
      'year', competition.year,
      'startsOn', competition.starts_on,
      'endsOn', competition.ends_on,
      'genderDivision', competition.gender_division
    ),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'registrationId', registration.id,
        'teamId', team.id,
        'id', registration.id,
        'name', registration.public_name,
        'slug', 'inscricao-' || registration.id::text,
        'abbreviation', team.abbreviation
      ) order by registration.public_name, registration.id)
      from public.team_registrations registration
      join public.teams team on team.id = registration.team_id
      where registration.competition_id = competition.id
        and registration.status in ('confirmed', 'completed')
    ), '[]'::jsonb),
    'games', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', game.id,
        'label', case
          when game.game_number is null then 'Jogo ' || game.id::text
          else 'Jogo ' || game.game_number
        end,
        'gameNumber', game.game_number,
        'status', game.status,
        'scheduledAt', game.scheduled_at,
        'venue', game.venue,
        'trackCode', track.code,
        'stageCode', stage.code,
        'stageName', stage.name,
        'roundCode', round_item.code,
        'roundName', round_item.name,
        'roundOrder', round_item.round_order,
        'matchupCode', matchup.code,
        'matchupOrder', matchup.matchup_order,
        'home', jsonb_build_object(
          'registrationId', home_participant.registration_id,
          'teamId', home_team.id,
          'id', home_registration.id,
          'name', home_registration.public_name,
          'slug', 'inscricao-' || home_registration.id::text,
          'abbreviation', home_team.abbreviation
        ),
        'away', jsonb_build_object(
          'registrationId', away_participant.registration_id,
          'teamId', away_team.id,
          'id', away_registration.id,
          'name', away_registration.public_name,
          'slug', 'inscricao-' || away_registration.id::text,
          'abbreviation', away_team.abbreviation
        ),
        'homeScore', case when game.status = 'scheduled' then null else (
          select sum(score.points)::integer
          from public.game_period_scores score
          where score.game_id = game.id
            and score.registration_id = home_participant.registration_id
        ) end,
        'awayScore', case when game.status = 'scheduled' then null else (
          select sum(score.points)::integer
          from public.game_period_scores score
          where score.game_id = game.id
            and score.registration_id = away_participant.registration_id
        ) end
      ) order by
        coalesce(round_item.round_order, 32767),
        coalesce(matchup.matchup_order, 32767),
        game.scheduled_at,
        game.id)
      from public.games game
      join public.game_participants home_participant
        on home_participant.game_id = game.id and home_participant.side = 'home'
      join public.game_participants away_participant
        on away_participant.game_id = game.id and away_participant.side = 'away'
      join public.team_registrations home_registration
        on home_registration.id = home_participant.registration_id
      join public.teams home_team on home_team.id = home_registration.team_id
      join public.team_registrations away_registration
        on away_registration.id = away_participant.registration_id
      join public.teams away_team on away_team.id = away_registration.team_id
      left join public.matchups matchup on matchup.id = game.matchup_id
      left join public.competition_rounds round_item on round_item.id = matchup.round_id
      left join public.competition_stages stage on stage.id = round_item.stage_id
      left join public.competition_tracks track on track.id = stage.track_id
      where game.competition_id = competition.id
        and game.status in ('scheduled', 'live', 'final')
    ), '[]'::jsonb)
  )
  from public.competitions competition
  where competition.id = p_competition_id;
$$;

revoke all on function private.competition_publication_snapshot(bigint)
  from public, anon, authenticated;

-- Public achievement links must preserve the registration identity. Existing
-- team-slug URLs remain readable in the route layer, while new links target a
-- stable registration reference.
create or replace view public.player_achievements
with (security_invoker = true)
as
select
  placement.competition_id,
  placement.registration_id,
  roster.player_id,
  placement.placement,
  placement.result_label,
  placement.confirmed_at,
  registration.team_id,
  registration.public_name as team_name,
  'inscricao-' || registration.id::text as team_slug,
  series.name as series_name,
  series.slug as series_slug,
  competition.year,
  category.name as category_name,
  category.slug as category_slug,
  competition.display_name as competition_display_name,
  competition.gender_division
from public.final_placements placement
join public.team_registrations registration on registration.id = placement.registration_id
join public.teams team on team.id = registration.team_id
join public.roster_entries roster
  on roster.registration_id = registration.id
 and roster.competition_id = placement.competition_id
join public.competitions competition on competition.id = placement.competition_id
join public.competition_series series on series.id = competition.series_id
join public.categories category on category.id = competition.category_id
where placement.result_status = 'placed'
  and placement.confirmed_at is not null;

comment on column public.team_registrations.public_name is
  'Public identity of this registration inside one dispute; independent from the global team name.';
comment on function public.admin_preview_registration_copy(bigint, bigint) is
  'AAL2 preview for copying independent registrations and selected roster links between disputes of the same edition; private eligibility values are never returned.';
comment on function public.admin_copy_team_registrations(uuid, bigint, bigint, jsonb) is
  'AAL2 idempotent transactional copy of selected registrations and roster rows; source teams, players and roster rows are never mutated.';
comment on function public.admin_preview_dispute_context_change(bigint, bigint, text) is
  'AAL2 read-only preview of category/gender correction blockers without exposing private sex values.';
comment on function public.admin_apply_dispute_context_change(bigint, bigint, text) is
  'AAL2 transactional category/gender correction allowed only before games and after profile and roster eligibility validation.';
