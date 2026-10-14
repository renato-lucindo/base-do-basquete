-- PR79: bind reviewed registration identity through every write.
-- Preserve the existing eligibility, selected-game and authority wrappers.

-- Every matching path uses the same ranking. A shared global abbreviation
-- cannot override an exact public registration name elsewhere in the dispute.
create function private.match_boxscore_registration(
  p_competition_id bigint,
  p_source_name text,
  p_source_abbreviation text,
  p_selected_registration_id bigint,
  p_allowed_registration_ids bigint[]
)
returns bigint language sql stable security invoker set search_path = '' as $$
  with ranked as (
    select registration.id,
      case
        when private.normalize_team_name(registration.public_name) = private.normalize_team_name(p_source_name) then 0
        when private.normalize_team_name(team.name) = private.normalize_team_name(p_source_name) then 1
        when nullif(btrim(p_source_abbreviation), '') is not null
          and upper(coalesce(team.abbreviation, '')) = upper(p_source_abbreviation) then 2
      end as priority
    from public.team_registrations registration
    join public.teams team on team.id = registration.team_id
    where registration.competition_id = p_competition_id
      and registration.status = 'confirmed' and team.is_active
  )
  select case when count(*) = 1 then min(id) end
  from ranked
  where priority = (select min(priority) from ranked)
    and (p_selected_registration_id is null or id = p_selected_registration_id)
    and (p_allowed_registration_ids is null or id = any(p_allowed_registration_ids));
$$;
revoke all on function private.match_boxscore_registration(bigint,text,text,bigint,bigint[])
  from public, anon, authenticated;

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
      or (source_abbreviation !~ '^[A-Z0-9]{2,8}$'
        and not (import_record.parser_version = 'basketball-site-v1' and source_abbreviation = ''))
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

      select count(*) into duplicate_count
      from public.team_registrations registration
      where registration.competition_id = import_record.competition_id
        and registration.team_id = selected_team_id;
      if duplicate_count > 1 then
        raise exception using errcode = 'BD319', message = 'BDB_PDF_TEAM_REGISTRATION_AMBIGUOUS';
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
        or (source_abbreviation <> '' and coalesce(team.abbreviation, '') = source_abbreviation);
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
      values (source_name, slug_candidate, nullif(source_abbreviation, ''), true, false)
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

    -- Applies also to register_existing_team and create_team, after selection.
    if private.match_boxscore_registration(
      import_record.competition_id, source_name, source_abbreviation,
      selected_registration_id, null
    ) is distinct from selected_registration_id then
      raise exception using errcode = 'BD317', message = 'BDB_PDF_TEAM_MISMATCH';
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

create function private.upsert_boxscore_statistics_by_registration(
  p_game_id bigint,
  p_parser_version text,
  p_parsed jsonb,
  p_resolution jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  team jsonb;
  statistics jsonb;
  resolved_registration_id bigint;
  resolution_count integer;
  competition_id bigint;
  participant_ids bigint[];
  expected_score integer;
  actual_score integer;
  period_count integer;
  game_clock_seconds integer;
  leading_total integer := 0;
  resolved_registration_ids bigint[] := '{}'::bigint[];
begin
  if p_parser_version <> 'fiba-genius-v2' or
    p_parsed ->> 'format' <> 'FIBA_GENIUS_SPORTS' or
    jsonb_typeof(p_parsed -> 'teams') <> 'array' or
    jsonb_array_length(p_parsed -> 'teams') <> 2 or
    jsonb_typeof(p_parsed -> 'gameStatistics') <> 'object' or
    jsonb_typeof(p_parsed -> 'teams' -> 0 -> 'periodScores') <> 'array'
  then
    raise exception using errcode = 'BD310', message = 'BDB_PDF_TEAM_STATS_INVALID';
  end if;
  period_count := jsonb_array_length(p_parsed -> 'teams' -> 0 -> 'periodScores');
  if period_count < 4 or period_count > 10 then
    raise exception using errcode = 'BD310', message = 'BDB_PDF_TEAM_STATS_INVALID';
  end if;
  game_clock_seconds := 2400 + greatest(period_count - 4, 0) * 300;

  select game.competition_id into competition_id
  from public.games game where game.id = p_game_id;
  select array_agg(participant.registration_id) into participant_ids
  from public.game_participants participant where participant.game_id = p_game_id;

  for team in select value from jsonb_array_elements(p_parsed -> 'teams')
  loop
    statistics := team -> 'teamStatistics';
    if jsonb_typeof(statistics) <> 'object' or
      jsonb_typeof(team -> 'periodScores') <> 'array' or
      jsonb_array_length(team -> 'periodScores') <> period_count
    then
      raise exception using errcode = 'BD310', message = 'BDB_PDF_TEAM_STATS_INVALID';
    end if;

    if p_resolution is not null then
      select count(*), min((item ->> 'registrationId')::bigint)
      into resolution_count, resolved_registration_id
      from jsonb_array_elements(p_resolution -> 'teams') item
      where item ->> 'sourceTeamName' = team ->> 'name';
      if resolution_count <> 1 then
        raise exception using errcode = 'BD310', message = 'BDB_PDF_TEAM_STATS_INVALID';
      end if;
    else
      resolved_registration_id := null;
    end if;
    resolved_registration_id := private.match_boxscore_registration(
      competition_id, team ->> 'name', team ->> 'abbreviation',
      resolved_registration_id, participant_ids
    );
    if resolved_registration_id is null then
      raise exception using errcode = 'BD310', message = 'BDB_PDF_TEAM_STATS_INVALID';
    end if;
    if resolved_registration_id = any(resolved_registration_ids) then
      raise exception using errcode = 'BD310', message = 'BDB_PDF_TEAM_STATS_INVALID';
    end if;
    resolved_registration_ids := array_append(
      resolved_registration_ids,
      resolved_registration_id
    );

    expected_score := (team ->> 'score')::integer;
    select score into actual_score
    from public.game_scores
    where game_id = p_game_id and registration_id = resolved_registration_id;
    if actual_score is distinct from expected_score then
      raise exception using errcode = 'BD307', message = 'BDB_PDF_SCORE_MISMATCH';
    end if;

    begin
      if (statistics ->> 'timeLeadingSeconds')::integer > game_clock_seconds then
        raise exception using errcode = 'BD310', message = 'BDB_PDF_TEAM_STATS_INVALID';
      end if;
      leading_total := leading_total + (statistics ->> 'timeLeadingSeconds')::integer;
      insert into public.game_team_statistics (
        game_id, registration_id, points_from_turnovers, points_in_paint,
        points_in_paint_made, points_in_paint_attempted, second_chance_points,
        fast_break_points, fast_break_points_from_turnovers, bench_points,
        largest_lead, largest_scoring_run, points_per_possession,
        time_leading_seconds, source_parser_version
      ) values (
        p_game_id,
        resolved_registration_id,
        (statistics ->> 'pointsFromTurnovers')::smallint,
        (statistics ->> 'pointsInPaint')::smallint,
        (statistics ->> 'pointsInPaintMade')::smallint,
        (statistics ->> 'pointsInPaintAttempted')::smallint,
        (statistics ->> 'secondChancePoints')::smallint,
        (statistics ->> 'fastBreakPoints')::smallint,
        (statistics ->> 'fastBreakPointsFromTurnovers')::smallint,
        (statistics ->> 'benchPoints')::smallint,
        (statistics ->> 'largestLead')::smallint,
        (statistics ->> 'largestScoringRun')::smallint,
        (statistics ->> 'pointsPerPossession')::numeric,
        (statistics ->> 'timeLeadingSeconds')::integer,
        p_parser_version
      )
      on conflict (game_id, registration_id) do update
      set points_from_turnovers = excluded.points_from_turnovers,
          points_in_paint = excluded.points_in_paint,
          points_in_paint_made = excluded.points_in_paint_made,
          points_in_paint_attempted = excluded.points_in_paint_attempted,
          second_chance_points = excluded.second_chance_points,
          fast_break_points = excluded.fast_break_points,
          fast_break_points_from_turnovers = excluded.fast_break_points_from_turnovers,
          bench_points = excluded.bench_points,
          largest_lead = excluded.largest_lead,
          largest_scoring_run = excluded.largest_scoring_run,
          points_per_possession = excluded.points_per_possession,
          time_leading_seconds = excluded.time_leading_seconds,
          source_parser_version = excluded.source_parser_version;
    exception
      when invalid_text_representation or numeric_value_out_of_range or
        check_violation or not_null_violation
      then
        raise exception using errcode = 'BD310', message = 'BDB_PDF_TEAM_STATS_INVALID';
    end;
  end loop;
  if leading_total > game_clock_seconds then
    raise exception using errcode = 'BD310', message = 'BDB_PDF_TEAM_STATS_INVALID';
  end if;

  begin
    insert into public.game_statistics (
      game_id, lead_changes, times_tied, source_parser_version
    ) values (
      p_game_id,
      (p_parsed -> 'gameStatistics' ->> 'leadChanges')::smallint,
      (p_parsed -> 'gameStatistics' ->> 'timesTied')::smallint,
      p_parser_version
    )
    on conflict (game_id) do update
    set lead_changes = excluded.lead_changes,
        times_tied = excluded.times_tied,
        source_parser_version = excluded.source_parser_version;
  exception
    when invalid_text_representation or numeric_value_out_of_range or
      check_violation or not_null_violation
    then
      raise exception using errcode = 'BD310', message = 'BDB_PDF_TEAM_STATS_INVALID';
  end;
end;
$$;

-- Compatibility for private historical callers: only an unambiguous participant
-- match is allowed without the explicit reviewed source-to-registration mapping.
create or replace function private.upsert_boxscore_statistics(
  p_game_id bigint, p_parser_version text, p_parsed jsonb
)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform private.upsert_boxscore_statistics_by_registration(p_game_id,p_parser_version,p_parsed,null);
end;
$$;

create or replace function private.admin_commit_boxscore_import_without_eligibility(
  p_import_id bigint,
  p_resolution jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  import_record public.boxscore_imports;
  parsed jsonb;
  team jsonb;
  team_resolution jsonb;
  player jsonb;
  player_resolution jsonb;
  registration_id bigint;
  resolved_roster_entry_id bigint;
  resolved_player_id bigint;
  created_game_id bigint;
  created_slot_id bigint;
  team_index integer := 0;
  slot_number smallint;
  period_number smallint;
  source_side text;
  period_points jsonb;
  duration_seconds integer;
  expected_score integer;
  actual_score integer;
  foul_count integer;
  foul_sequence integer;
  resolution_action text;
  source_name text;
  source_jersey text;
  slug_base text;
  player_slug text;
  violated_constraint text;
  existing_count integer := 0;
  attached_count integer := 0;
  created_count integer := 0;
  parsed_player_count integer;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if jsonb_typeof(p_resolution) <> 'object' or
    jsonb_typeof(p_resolution -> 'teams') <> 'array' or
    jsonb_array_length(p_resolution -> 'teams') <> 2 or
    jsonb_typeof(p_resolution -> 'players') <> 'array'
  then
    raise exception using errcode = 'BD305', message = 'BDB_PDF_RESOLUTION_INVALID';
  end if;

  select * into import_record
  from public.boxscore_imports
  where id = p_import_id
  for update;
  if not found or import_record.created_by <> auth.uid() then
    raise exception using errcode = 'BD404', message = 'BDB_PDF_IMPORT_NOT_FOUND';
  end if;
  if import_record.status = 'confirmed' then
    return import_record.game_id;
  end if;
  if import_record.status <> 'review' then
    raise exception using errcode = 'BD305', message = 'BDB_PDF_IMPORT_NOT_REVIEWABLE';
  end if;
  parsed := import_record.parsed_payload;
  duration_seconds := (parsed ->> 'durationSeconds')::integer;
  select coalesce(sum(jsonb_array_length(source_team.team -> 'players')), 0)::integer
  into parsed_player_count
  from jsonb_array_elements(parsed -> 'teams') as source_team(team);
  if jsonb_array_length(p_resolution -> 'players') <> parsed_player_count then
    raise exception using errcode = 'BD305', message = 'BDB_PDF_RESOLUTION_INVALID';
  end if;

  begin
    insert into public.games (
      competition_id, game_number, scheduled_at, venue, status,
      started_at, ended_at, source, created_by
    ) values (
      import_record.competition_id,
      parsed ->> 'gameNumber',
      (parsed ->> 'scheduledLocal')::timestamp at time zone 'America/Sao_Paulo',
      parsed ->> 'venue',
      'final',
      (parsed ->> 'scheduledLocal')::timestamp at time zone 'America/Sao_Paulo',
      ((parsed ->> 'scheduledLocal')::timestamp at time zone 'America/Sao_Paulo') + make_interval(secs => duration_seconds),
      'boxscore',
      auth.uid()
    ) returning id into created_game_id;
  exception when unique_violation then
    raise exception using errcode = 'BD306', message = 'BDB_PDF_GAME_CONFLICT';
  end;

  for period_number in 1..jsonb_array_length(parsed -> 'teams' -> 0 -> 'periodScores')
  loop
    insert into public.game_periods (game_id, period_number)
    values (created_game_id, period_number);
  end loop;

  for team in select value from jsonb_array_elements(parsed -> 'teams')
  loop
    team_index := team_index + 1;
    source_side := case when team_index = 1 then 'home' else 'away' end;
    select value into team_resolution
    from jsonb_array_elements(p_resolution -> 'teams')
    where value ->> 'sourceTeamName' = team ->> 'name';
    begin
      registration_id := (team_resolution ->> 'registrationId')::bigint;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode = 'BD305', message = 'BDB_PDF_TEAM_RESOLUTION_INVALID';
    end;
    perform 1
    from public.team_registrations registration
    join public.teams selected_team on selected_team.id = registration.team_id
    where registration.id = registration_id
      and registration.competition_id = import_record.competition_id
      and registration.status = 'confirmed'
      and private.match_boxscore_registration(
        import_record.competition_id, team ->> 'name', team ->> 'abbreviation',
        registration.id, null
      ) = registration.id
    for update of registration;
    if not found then
      raise exception using errcode = 'BD305', message = 'BDB_PDF_TEAM_RESOLUTION_INVALID';
    end if;

    insert into public.game_participants (game_id, competition_id, registration_id, side)
    values (created_game_id, import_record.competition_id, registration_id, source_side);

    period_number := 0;
    for period_points in select value from jsonb_array_elements(team -> 'periodScores')
    loop
      period_number := period_number + 1;
      insert into public.game_period_scores (game_id, registration_id, period_number, points)
      values (created_game_id, registration_id, period_number, (period_points #>> '{}')::integer);
    end loop;

    slot_number := 0;
    for player in select value from jsonb_array_elements(team -> 'players')
    loop
      slot_number := slot_number + 1;
      source_name := player ->> 'name';
      source_jersey := player ->> 'jerseyNumber';
      select value into player_resolution
      from jsonb_array_elements(p_resolution -> 'players')
      where value ->> 'sourceTeamName' = team ->> 'name'
        and value ->> 'sourcePlayerName' = source_name;
      resolution_action := player_resolution ->> 'action';
      if resolution_action is null and player_resolution ? 'rosterEntryId' then
        resolution_action := 'existing_roster';
      end if;
      resolved_roster_entry_id := null;
      resolved_player_id := null;

      if resolution_action = 'existing_roster' then
        begin
          resolved_roster_entry_id := (player_resolution ->> 'rosterEntryId')::bigint;
        exception when invalid_text_representation or numeric_value_out_of_range then
          raise exception using errcode = 'BD305', message = 'BDB_PDF_PLAYER_RESOLUTION_INVALID';
        end;
        select roster.player_id into resolved_player_id
        from public.roster_entries roster
        where roster.id = resolved_roster_entry_id
          and roster.registration_id = registration_id
          and roster.competition_id = import_record.competition_id
          and roster.status = 'active';
        if resolved_player_id is null then
          raise exception using errcode = 'BD305', message = 'BDB_PDF_PLAYER_RESOLUTION_INVALID';
        end if;
        existing_count := existing_count + 1;
      elsif resolution_action = 'add_existing' then
        begin
          resolved_player_id := (player_resolution ->> 'playerId')::bigint;
        exception when invalid_text_representation or numeric_value_out_of_range then
          raise exception using errcode = 'BD305', message = 'BDB_PDF_PLAYER_RESOLUTION_INVALID';
        end;
        if not exists (
          select 1 from public.players selected_player
          where selected_player.id = resolved_player_id and selected_player.is_active
        ) then
          raise exception using errcode = 'BD305', message = 'BDB_PDF_PLAYER_RESOLUTION_INVALID';
        end if;
        select roster.id into resolved_roster_entry_id
        from public.roster_entries roster
        where roster.competition_id = import_record.competition_id
          and roster.player_id = resolved_player_id
          and roster.status = 'active';
        if resolved_roster_entry_id is not null then
          if not exists (
            select 1 from public.roster_entries roster
            where roster.id = resolved_roster_entry_id and roster.registration_id = registration_id
          ) then
            raise exception using errcode = 'BD104', message = 'BDB_PLAYER_ALREADY_REGISTERED';
          end if;
          existing_count := existing_count + 1;
        else
          select roster.id into resolved_roster_entry_id
          from public.roster_entries roster
          where roster.registration_id = registration_id
            and roster.player_id = resolved_player_id
          for update;
          begin
            if resolved_roster_entry_id is null then
              insert into public.roster_entries (
                competition_id, registration_id, player_id, jersey_number, status, left_on
              ) values (
                import_record.competition_id, registration_id, resolved_player_id,
                source_jersey, 'active', null
              ) returning id into resolved_roster_entry_id;
            else
              update public.roster_entries
              set jersey_number = source_jersey,
                  status = 'active',
                  left_on = null
              where id = resolved_roster_entry_id;
            end if;
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
          attached_count := attached_count + 1;
        end if;
      elsif resolution_action = 'create_new' then
        perform pg_advisory_xact_lock(hashtextextended(
          private.normalize_person_name(source_name),
          914
        ));
        if exists (
          select 1 from public.players existing_player
          where private.normalize_person_name(existing_player.full_name) =
            private.normalize_person_name(source_name)
        ) then
          raise exception using errcode = 'BD308', message = 'BDB_PDF_PLAYER_ALREADY_EXISTS';
        end if;
        slug_base := private.slugify_person_name(source_name);
        if slug_base = '' then slug_base := 'jogador'; end if;
        player_slug := slug_base;
        if exists (select 1 from public.players existing_player where existing_player.slug = player_slug) then
          player_slug := slug_base || '-' || p_import_id::text || '-' || slot_number::text;
        end if;
        insert into public.players (full_name, slug, is_active, is_public)
        values (source_name, player_slug, true, true)
        returning id into resolved_player_id;
        begin
          insert into public.roster_entries (
            competition_id, registration_id, player_id, jersey_number, status
          ) values (
            import_record.competition_id, registration_id, resolved_player_id,
            source_jersey, 'active'
          ) returning id into resolved_roster_entry_id;
        exception when unique_violation then
          get stacked diagnostics violated_constraint = constraint_name;
          if violated_constraint = 'roster_entries_active_registration_jersey_uidx' then
            raise exception using errcode = 'BD105', message = 'BDB_DUPLICATE_ACTIVE_JERSEY';
          else
            raise;
          end if;
        end;
        created_count := created_count + 1;
      else
        raise exception using errcode = 'BD305', message = 'BDB_PDF_PLAYER_RESOLUTION_INVALID';
      end if;

      update public.boxscore_import_player_matches
      set roster_entry_id = resolved_roster_entry_id,
        resolution_kind = case resolution_action
          when 'existing_roster' then 'existing_roster'
          when 'add_existing' then 'added_existing'
          else 'created_new'
        end,
        status = 'confirmed',
        decided_by = auth.uid(),
        decided_at = now()
      where import_id = p_import_id
        and source_team_name = team ->> 'name'
        and source_player_name = source_name;
      if not found then
        raise exception using errcode = 'BD305', message = 'BDB_PDF_PLAYER_RESOLUTION_INVALID';
      end if;

      insert into public.game_roster_slots (
        game_id, registration_id, slot_number, roster_entry_id, jersey_number,
        is_starter, is_captain, did_not_play
      ) values (
        created_game_id, registration_id, slot_number, resolved_roster_entry_id,
        source_jersey,
        (player ->> 'starter')::boolean,
        (player ->> 'captain')::boolean,
        (player ->> 'didNotPlay')::boolean
      ) returning id into created_slot_id;

      insert into public.player_period_stats (
        game_roster_slot_id, game_id, period_number, seconds_played,
        two_point_made, two_point_attempted, three_point_made, three_point_attempted,
        free_throw_made, free_throw_attempted, offensive_rebounds, defensive_rebounds,
        assists, turnovers, steals, blocks, plus_minus, stat_scope
      ) values (
        created_slot_id, created_game_id, 1, (player ->> 'secondsPlayed')::integer,
        (player -> 'twoPoints' ->> 'made')::smallint,
        (player -> 'twoPoints' ->> 'attempted')::smallint,
        (player -> 'threePoints' ->> 'made')::smallint,
        (player -> 'threePoints' ->> 'attempted')::smallint,
        (player -> 'freeThrows' ->> 'made')::smallint,
        (player -> 'freeThrows' ->> 'attempted')::smallint,
        (player ->> 'offensiveRebounds')::smallint,
        (player ->> 'defensiveRebounds')::smallint,
        (player ->> 'assists')::smallint,
        (player ->> 'turnovers')::smallint,
        (player ->> 'steals')::smallint,
        (player ->> 'blocks')::smallint,
        (player ->> 'plusMinus')::smallint,
        'game_total'
      );

      foul_count := (player ->> 'foulsCommitted')::integer;
      for foul_sequence in 1..foul_count
      loop
        insert into public.foul_events (
          game_roster_slot_id, game_id, period_number, sequence_number, foul_code
        ) values (created_slot_id, created_game_id, 1, foul_sequence, 'P');
      end loop;
    end loop;
  end loop;

  for team in select value from jsonb_array_elements(parsed -> 'teams')
  loop
    expected_score := (team ->> 'score')::integer;
    select scores.score into actual_score
    from public.game_scores scores
    join public.game_participants participant
      on participant.game_id = scores.game_id
     and participant.registration_id = scores.registration_id
    join public.team_registrations registration on registration.id = participant.registration_id
    join public.teams selected_team on selected_team.id = registration.team_id
    where scores.game_id = created_game_id
      and scores.registration_id = (
        select (item ->> 'registrationId')::bigint
        from jsonb_array_elements(p_resolution -> 'teams') item
        where item ->> 'sourceTeamName' = team ->> 'name'
      );
    if actual_score is distinct from expected_score then
      raise exception using errcode = 'BD307', message = 'BDB_PDF_SCORE_MISMATCH';
    end if;
  end loop;

  if import_record.parser_version = 'fiba-genius-v2' then
    perform private.upsert_boxscore_statistics_by_registration(created_game_id, import_record.parser_version, parsed, p_resolution);
  end if;

  update public.boxscore_imports
  set game_id = created_game_id,
    status = 'confirmed',
    error_code = null,
    resolution_payload = p_resolution,
    confirmed_at = now()
  where id = p_import_id;

  insert into public.admin_mutation_audit (
    action, entity_type, entity_id, metadata
  ) values (
    'boxscore_import_confirmed',
    'boxscore_import',
    p_import_id,
    jsonb_build_object(
      'gameId', created_game_id,
      'parserVersion', import_record.parser_version,
      'existingPlayers', existing_count,
      'attachedPlayers', attached_count,
      'createdPlayers', created_count
    )
  );

  return created_game_id;
exception
  when sqlstate 'BD104' or sqlstate 'BD105' or sqlstate 'BD308' or
    sqlstate 'BD305' or sqlstate 'BD306' or sqlstate 'BD307' or sqlstate 'BD310'
  then raise;
  when unique_violation then
    raise exception using errcode = 'BD306', message = 'BDB_PDF_GAME_CONFLICT';
  when others then
    raise;
end;
$$;

create or replace function private.admin_refresh_boxscore_team_statistics_impl(
  p_import_id bigint,
  p_parsed_payload jsonb,
  p_validation_payload jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  import_record public.boxscore_imports;
  stored_game_number text;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  select * into import_record
  from public.boxscore_imports
  where id = p_import_id
  for update;
  if not found or import_record.created_by <> auth.uid() or
    import_record.status <> 'confirmed' or import_record.game_id is null
  then
    raise exception using errcode = 'BD404', message = 'BDB_PDF_IMPORT_NOT_FOUND';
  end if;
  select game_number into stored_game_number
  from public.games where id = import_record.game_id;
  if p_parsed_payload ->> 'format' <> 'FIBA_GENIUS_SPORTS' or
    p_parsed_payload ->> 'parserVersion' <> 'fiba-genius-v2' or
    p_parsed_payload ->> 'gameNumber' is distinct from stored_game_number or
    jsonb_typeof(p_validation_payload) <> 'object' or
    p_validation_payload ->> 'valid' <> 'true'
  then
    raise exception using errcode = 'BD310', message = 'BDB_PDF_TEAM_STATS_INVALID';
  end if;

  perform private.upsert_boxscore_statistics_by_registration(
    import_record.game_id,
    'fiba-genius-v2',
    p_parsed_payload,
    import_record.resolution_payload
  );
  update public.boxscore_imports
  set parser_version = 'fiba-genius-v2',
      parsed_payload = p_parsed_payload,
      validation_payload = p_validation_payload
  where id = p_import_id;
  insert into public.admin_mutation_audit (action, entity_type, entity_id, metadata)
  values (
    'boxscore_team_stats_refreshed',
    'boxscore_import',
    p_import_id,
    jsonb_build_object('gameId', import_record.game_id, 'parserVersion', 'fiba-genius-v2')
  );
  return import_record.game_id;
end;
$$;

revoke all on function private.upsert_boxscore_statistics_by_registration(bigint,text,jsonb,jsonb),
  private.upsert_boxscore_statistics(bigint,text,jsonb),
  private.admin_commit_boxscore_import_without_eligibility(bigint,jsonb)
  from public, anon, authenticated;
revoke all on function private.admin_resolve_boxscore_team_registrations_impl(bigint,jsonb),
  private.admin_refresh_boxscore_team_statistics_impl(bigint,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function private.admin_resolve_boxscore_team_registrations_impl(bigint,jsonb),
  private.admin_refresh_boxscore_team_statistics_impl(bigint,jsonb,jsonb)
  to authenticated;
