-- Align PDF resolution with independent registration identity.
create or replace function private.admin_resolve_boxscore_team_registrations_impl(
  p_import_id bigint,
  p_resolution jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  import_record public.boxscore_imports;
  source_team jsonb;
  requested jsonb;
  source_name text;
  source_abbreviation text;
  requested_action text;
  requested_source_name text;
  requested_count integer;
  source_ordinal integer := 0;
  selected_team public.teams;
  selected_registration public.team_registrations;
  selected_team_id bigint;
  selected_registration_id bigint;
  duplicate_count integer;
  slug_base text;
  slug_candidate text;
  slug_suffix integer;
  created_team boolean;
  created_registration boolean;
  transitioned_registration boolean;
  results jsonb := '[]'::jsonb;
  canonical_resolution jsonb;
  prior_resolution public.boxscore_team_resolutions;
  resolved_registration_ids bigint[] := '{}'::bigint[];
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  if p_import_id is null
    or p_import_id <= 0
    or p_resolution is null
    or jsonb_typeof(p_resolution) <> 'object'
    or jsonb_typeof(p_resolution -> 'teams') <> 'array'
    or jsonb_array_length(p_resolution -> 'teams') <> 2
  then
    raise exception using errcode = 'BD305', message = 'BDB_PDF_TEAM_RESOLUTION_INVALID';
  end if;

  select jsonb_build_object(
    'teams',
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'sourceTeamName', btrim(coalesce(team_resolution.value ->> 'sourceTeamName', '')),
        'action', coalesce(team_resolution.value ->> 'action', ''),
        'registrationId', nullif(btrim(coalesce(team_resolution.value ->> 'registrationId', '')), ''),
        'teamId', nullif(btrim(coalesce(team_resolution.value ->> 'teamId', '')), '')
      ))
      order by btrim(coalesce(team_resolution.value ->> 'sourceTeamName', ''))
    )
  ) into canonical_resolution
  from jsonb_array_elements(p_resolution -> 'teams') as team_resolution(value);

  select import_item.* into import_record
  from public.boxscore_imports import_item
  where import_item.id = p_import_id
    and import_item.created_by = auth.uid()
  for update;

  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_PDF_IMPORT_NOT_FOUND';
  end if;
  if import_record.status <> 'review' then
    raise exception using errcode = 'BD305', message = 'BDB_PDF_IMPORT_NOT_REVIEWABLE';
  end if;
  if jsonb_typeof(import_record.parsed_payload -> 'teams') <> 'array'
    or jsonb_array_length(import_record.parsed_payload -> 'teams') <> 2
  then
    raise exception using errcode = 'BD305', message = 'BDB_PDF_TEAM_RESOLUTION_INVALID';
  end if;

  select resolution.* into prior_resolution
  from public.boxscore_team_resolutions resolution
  where resolution.import_id = p_import_id;
  if found then
    if prior_resolution.request_payload <> canonical_resolution then
      raise exception using errcode = 'BD318', message = 'BDB_PDF_TEAM_RESOLUTION_CONFLICT';
    end if;
    return jsonb_build_object('teams', prior_resolution.results, 'idempotent', true);
  end if;

  for source_team in
    select value from jsonb_array_elements(import_record.parsed_payload -> 'teams')
  loop
    source_ordinal := source_ordinal + 1;
    source_name := btrim(coalesce(source_team ->> 'name', ''));
    source_abbreviation := upper(btrim(coalesce(source_team ->> 'abbreviation', '')));

    if char_length(source_name) < 2 or char_length(source_name) > 120
      or source_abbreviation !~ '^[A-Z0-9]{2,8}$'
    then
      raise exception using errcode = 'BD305', message = 'BDB_PDF_TEAM_RESOLUTION_INVALID';
    end if;

    select count(*) into requested_count
    from jsonb_array_elements(p_resolution -> 'teams') as team_resolution(value)
    where btrim(coalesce(team_resolution.value ->> 'sourceTeamName', '')) = source_name;

    if requested_count <> 1 then
      raise exception using errcode = 'BD305', message = 'BDB_PDF_TEAM_RESOLUTION_INVALID';
    end if;
    select team_resolution.value into requested
    from jsonb_array_elements(p_resolution -> 'teams') as team_resolution(value)
    where btrim(coalesce(team_resolution.value ->> 'sourceTeamName', '')) = source_name
    limit 1;

    requested_source_name := btrim(coalesce(requested ->> 'sourceTeamName', ''));
    requested_action := requested ->> 'action';
    if requested_source_name <> source_name then
      raise exception using errcode = 'BD305', message = 'BDB_PDF_TEAM_RESOLUTION_INVALID';
    end if;

    selected_team_id := null;
    selected_registration_id := null;
    selected_team := null;
    selected_registration := null;
    created_team := false;
    created_registration := false;
    transitioned_registration := false;

    if requested_action = 'existing_registration' then
      begin
        selected_registration_id := (requested ->> 'registrationId')::bigint;
      exception when invalid_text_representation or numeric_value_out_of_range then
        raise exception using errcode = 'BD305', message = 'BDB_PDF_TEAM_RESOLUTION_INVALID';
      end;
      if selected_registration_id is null or selected_registration_id <= 0 then
        raise exception using errcode = 'BD305', message = 'BDB_PDF_TEAM_RESOLUTION_INVALID';
      end if;

      select registration.* into selected_registration
      from public.team_registrations registration
      where registration.id = selected_registration_id
        and registration.competition_id = import_record.competition_id
      for update;
      if not found then
        raise exception using errcode = 'BD404', message = 'BDB_REGISTRATION_NOT_FOUND';
      end if;
      select team.* into strict selected_team
      from public.teams team
      where team.id = selected_registration.team_id;
      if selected_registration.status <> 'confirmed' or not selected_team.is_active then
        raise exception using errcode = 'BD316', message = 'BDB_PDF_TEAM_REGISTRATION_UNAVAILABLE';
      end if;
      -- Same precedence as the server matcher: public registration name,
      -- then global name, then abbreviation. An exact A/B name must not be
      -- overridden by the shared team's abbreviation.
      if exists (
        select 1 from public.team_registrations candidate
        join public.teams team on team.id = candidate.team_id
        where candidate.competition_id = import_record.competition_id
          and candidate.status = 'confirmed' and team.is_active
          and private.normalize_team_name(candidate.public_name) = private.normalize_team_name(source_name)
      ) then
        if private.normalize_team_name(selected_registration.public_name) <> private.normalize_team_name(source_name) then
          raise exception using errcode = 'BD317', message = 'BDB_PDF_TEAM_MISMATCH';
        end if;
      elsif exists (
        select 1 from public.team_registrations candidate
        join public.teams team on team.id = candidate.team_id
        where candidate.competition_id = import_record.competition_id
          and candidate.status = 'confirmed' and team.is_active
          and private.normalize_team_name(team.name) = private.normalize_team_name(source_name)
      ) then
        if private.normalize_team_name(selected_team.name) <> private.normalize_team_name(source_name) then
          raise exception using errcode = 'BD317', message = 'BDB_PDF_TEAM_MISMATCH';
        end if;
      elsif coalesce(selected_team.abbreviation, '') <> source_abbreviation then
        raise exception using errcode = 'BD317', message = 'BDB_PDF_TEAM_MISMATCH';
      end if;
      selected_team_id := selected_team.id;

    elsif requested_action = 'register_existing_team' then
      begin
        selected_team_id := (requested ->> 'teamId')::bigint;
      exception when invalid_text_representation or numeric_value_out_of_range then
        raise exception using errcode = 'BD305', message = 'BDB_PDF_TEAM_RESOLUTION_INVALID';
      end;
      if selected_team_id is null or selected_team_id <= 0 then
        raise exception using errcode = 'BD305', message = 'BDB_PDF_TEAM_RESOLUTION_INVALID';
      end if;

      perform pg_advisory_xact_lock(
        hashtextextended(import_record.competition_id::text || ':' || selected_team_id::text, 916)
      );
      select team.* into selected_team
      from public.teams team
      where team.id = selected_team_id;
      if not found then
        raise exception using errcode = 'BD404', message = 'BDB_TEAM_NOT_FOUND';
      end if;
      if not selected_team.is_active then
        raise exception using errcode = 'BD316', message = 'BDB_PDF_TEAM_REGISTRATION_UNAVAILABLE';
      end if;
      if private.normalize_team_name(selected_team.name) <> private.normalize_team_name(source_name)
        and coalesce(selected_team.abbreviation, '') <> source_abbreviation
      then
        raise exception using errcode = 'BD317', message = 'BDB_PDF_TEAM_MISMATCH';
      end if;

      select registration.* into selected_registration
      from public.team_registrations registration
      where registration.competition_id = import_record.competition_id
        and registration.team_id = selected_team_id
      for update;

      if not found then
        insert into public.team_registrations(
          competition_id, team_id, status, confirmed_at
        ) values (
          import_record.competition_id, selected_team_id, 'confirmed', now()
        ) returning * into selected_registration;
        created_registration := true;
        insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
        values (
          'registration_created', 'team_registration', selected_registration.id,
          jsonb_build_object('competitionId', import_record.competition_id, 'source', 'boxscore_import')
        );
      elsif selected_registration.status = 'draft' then
        update public.team_registrations
        set status = 'confirmed', confirmed_at = coalesce(confirmed_at, now())
        where id = selected_registration.id
        returning * into selected_registration;
        transitioned_registration := true;
        insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
        values (
          'registration_transitioned', 'team_registration', selected_registration.id,
          jsonb_build_object('from', 'draft', 'to', 'confirmed', 'source', 'boxscore_import')
        );
      elsif selected_registration.status <> 'confirmed' then
        raise exception using errcode = 'BD316', message = 'BDB_PDF_TEAM_REGISTRATION_UNAVAILABLE';
      end if;
      selected_registration_id := selected_registration.id;

    elsif requested_action = 'create_team' then
      perform pg_advisory_xact_lock(
        hashtextextended(private.normalize_team_name(source_name), 915)
      );
      perform pg_advisory_xact_lock(hashtextextended(source_abbreviation, 917));

      select count(*) into duplicate_count
      from public.teams team
      where private.normalize_team_name(team.name) = private.normalize_team_name(source_name)
        or coalesce(team.abbreviation, '') = source_abbreviation;
      if duplicate_count > 0 then
        raise exception using errcode = 'BD315', message = 'BDB_PDF_TEAM_ALREADY_EXISTS';
      end if;

      slug_base := private.slugify_team_name(source_name);
      if slug_base = '' then slug_base := 'team'; end if;
      slug_candidate := slug_base;
      slug_suffix := 0;
      while exists (select 1 from public.teams team where team.slug = slug_candidate)
      loop
        slug_suffix := slug_suffix + 1;
        slug_candidate := slug_base || '-boxscore-' || p_import_id::text || '-' ||
          source_ordinal::text || case when slug_suffix = 1 then '' else '-' || slug_suffix::text end;
      end loop;

      insert into public.teams(name, slug, abbreviation, is_active, is_public)
      values (source_name, slug_candidate, source_abbreviation, true, false)
      returning * into selected_team;
      selected_team_id := selected_team.id;
      created_team := true;

      insert into public.team_registrations(
        competition_id, team_id, status, confirmed_at
      ) values (
        import_record.competition_id, selected_team_id, 'confirmed', now()
      ) returning * into selected_registration;
      selected_registration_id := selected_registration.id;
      created_registration := true;
      insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
      values (
        'registration_created', 'team_registration', selected_registration.id,
        jsonb_build_object('competitionId', import_record.competition_id, 'source', 'boxscore_import')
      );

    else
      raise exception using errcode = 'BD305', message = 'BDB_PDF_TEAM_RESOLUTION_INVALID';
    end if;

    if selected_registration_id = any(resolved_registration_ids)
    then
      raise exception using errcode = 'BD305', message = 'BDB_PDF_TEAM_RESOLUTION_INVALID';
    end if;
    resolved_registration_ids := array_append(resolved_registration_ids, selected_registration_id);

    results := results || jsonb_build_array(jsonb_build_object(
      'sourceTeamName', source_name,
      'teamId', selected_team_id,
      'registrationId', selected_registration_id,
      'action', requested_action,
      'createdTeam', created_team,
      'createdRegistration', created_registration,
      'transitionedRegistration', transitioned_registration
    ));
  end loop;

  if jsonb_array_length(results) <> 2 then
    raise exception using errcode = 'BD305', message = 'BDB_PDF_TEAM_RESOLUTION_INVALID';
  end if;

  insert into public.boxscore_team_resolutions(
    import_id,
    competition_id,
    source_team_1_name,
    registration_1_id,
    source_team_2_name,
    registration_2_id,
    request_payload,
    results,
    resolved_by
  ) values (
    p_import_id,
    import_record.competition_id,
    results -> 0 ->> 'sourceTeamName',
    (results -> 0 ->> 'registrationId')::bigint,
    results -> 1 ->> 'sourceTeamName',
    (results -> 1 ->> 'registrationId')::bigint,
    canonical_resolution,
    results,
    auth.uid()
  );

  insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
  values (
    'boxscore_team_registrations_resolved', 'boxscore_import', p_import_id,
    jsonb_build_object('results', results, 'requestPayload', canonical_resolution)
  );

  return jsonb_build_object('teams', results, 'idempotent', false);
end;
$$;

revoke all on function private.admin_resolve_boxscore_team_registrations_impl(bigint, jsonb)
from public, anon, authenticated;
grant execute on function private.admin_resolve_boxscore_team_registrations_impl(bigint, jsonb)
to authenticated;

