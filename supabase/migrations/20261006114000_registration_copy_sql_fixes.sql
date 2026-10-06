-- Additive corrections found by the disposable CI database gate.
-- Preserve published migrations, RPC signatures, authorization and grants.
-- Disambiguate the existing-target alias and restore legacy audit context.

create or replace function public.admin_copy_team_registrations(
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

create or replace function public.admin_apply_dispute_context_change(
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
      'previousDataProfileId', current_row.data_profile_id,
      'dataProfileId', result.data_profile_id,
      'seasonId', result.season_id,
      'competitiveDivisionValueId', result.competitive_division_value_id,
      'contextCorrection', true
    )
  );
  return result;
end;
$$;
