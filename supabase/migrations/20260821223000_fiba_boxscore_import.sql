-- WP-09: secure, reviewable and atomic FIBA/Genius Sports boxscore import.

alter table public.boxscore_imports
  add column source_filename text not null default 'legacy.pdf' check (
    source_filename = btrim(source_filename) and char_length(source_filename) between 1 and 160
  ),
  add column file_size_bytes integer not null default 1 check (
    file_size_bytes between 1 and 10485760
  ),
  add column parsed_payload jsonb not null default '{}'::jsonb check (
    jsonb_typeof(parsed_payload) = 'object'
  ),
  add column validation_payload jsonb not null default '{}'::jsonb check (
    jsonb_typeof(validation_payload) = 'object'
  ),
  add column resolution_payload jsonb check (
    resolution_payload is null or jsonb_typeof(resolution_payload) = 'object'
  );

alter table public.boxscore_import_player_matches
  add column source_jersey_number text not null default '0' check (
    source_jersey_number ~ '^(?:0|00|[1-9][0-9]?)$'
  ),
  add column suggestion_kind text not null default 'unmatched' check (
    suggestion_kind in ('exact', 'similar', 'unmatched')
  ),
  add column similarity_score numeric(5,4) check (
    similarity_score is null or similarity_score between 0 and 1
  );

alter table public.player_period_stats
  add column stat_scope text not null default 'period' check (
    stat_scope in ('period', 'game_total')
  );

alter table public.admin_mutation_audit
  drop constraint admin_mutation_audit_action_check,
  add constraint admin_mutation_audit_action_check check (
    action in (
      'registration_created',
      'registration_transitioned',
      'roster_replaced',
      'manual_scoresheet_saved',
      'boxscore_import_confirmed'
    )
  ),
  drop constraint admin_mutation_audit_entity_type_check,
  add constraint admin_mutation_audit_entity_type_check check (
    entity_type in ('team_registration', 'game', 'boxscore_import')
  );

create table private.boxscore_upload_attempts (
  user_id uuid not null references auth.users(id) on delete restrict,
  attempted_at timestamptz not null default now()
);

create index boxscore_upload_attempts_user_time_idx
  on private.boxscore_upload_attempts (user_id, attempted_at desc);

revoke all on private.boxscore_upload_attempts from public, anon, authenticated;

create or replace function public.admin_claim_boxscore_upload()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_attempts integer;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 901));
  select count(*) into recent_attempts
  from private.boxscore_upload_attempts attempt
  where attempt.user_id = auth.uid()
    and attempt.attempted_at >= now() - interval '10 minutes';

  if recent_attempts >= 5 then
    raise exception using errcode = 'BD304', message = 'BDB_PDF_RATE_LIMIT';
  end if;

  insert into private.boxscore_upload_attempts (user_id) values (auth.uid());
end;
$$;

create or replace function public.admin_create_boxscore_import_draft(
  p_competition_id bigint,
  p_sha256 text,
  p_storage_path text,
  p_source_filename text,
  p_file_size_bytes integer,
  p_parser_version text,
  p_parsed_payload jsonb,
  p_validation_payload jsonb,
  p_matches jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_import_id bigint;
  source_match jsonb;
  candidate_roster_id bigint;
  player_count integer;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if not exists (
    select 1 from private.boxscore_upload_attempts attempt
    where attempt.user_id = auth.uid()
      and attempt.attempted_at >= now() - interval '10 minutes'
  ) then
    raise exception using errcode = 'BD304', message = 'BDB_PDF_RATE_LIMIT_REQUIRED';
  end if;
  if not exists (
    select 1 from public.competitions competition
    where competition.id = p_competition_id and competition.status = 'published'
  ) then
    raise exception using errcode = 'BD302', message = 'BDB_PDF_COMPETITION_INVALID';
  end if;
  if p_sha256 !~ '^[0-9a-f]{64}$' or
    p_storage_path <> p_competition_id::text || '/' || p_sha256 || '.pdf' or
    p_source_filename is null or p_source_filename <> btrim(p_source_filename) or
    char_length(p_source_filename) not between 1 and 160 or
    p_file_size_bytes not between 1 and 10485760 or
    p_parser_version <> 'fiba-genius-v1' or
    jsonb_typeof(p_parsed_payload) <> 'object' or
    p_parsed_payload ->> 'format' <> 'FIBA_GENIUS_SPORTS' or
    jsonb_typeof(p_parsed_payload -> 'teams') <> 'array' or
    jsonb_array_length(p_parsed_payload -> 'teams') <> 2 or
    jsonb_typeof(p_validation_payload) <> 'object' or
    p_validation_payload ->> 'valid' <> 'true' or
    jsonb_typeof(p_matches) <> 'array'
  then
    raise exception using errcode = 'BD302', message = 'BDB_PDF_DRAFT_INVALID';
  end if;

  select coalesce(sum(jsonb_array_length(team -> 'players')), 0)::integer
  into player_count
  from jsonb_array_elements(p_parsed_payload -> 'teams') as source_team(team);
  if player_count < 10 or player_count > 24 or jsonb_array_length(p_matches) <> player_count then
    raise exception using errcode = 'BD302', message = 'BDB_PDF_PLAYER_COUNT_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_sha256, 902));
  if exists (select 1 from public.boxscore_imports where sha256 = p_sha256) then
    raise exception using errcode = 'BD309', message = 'BDB_PDF_DUPLICATE';
  end if;

  insert into public.boxscore_imports (
    competition_id, sha256, storage_path, source_filename, file_size_bytes,
    parser_version, status, parsed_payload, validation_payload, created_by
  ) values (
    p_competition_id, p_sha256, p_storage_path, p_source_filename, p_file_size_bytes,
    p_parser_version, 'review', p_parsed_payload, p_validation_payload, auth.uid()
  ) returning id into created_import_id;

  for source_match in select value from jsonb_array_elements(p_matches)
  loop
    begin
      candidate_roster_id := nullif(source_match ->> 'rosterEntryId', '')::bigint;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode = 'BD302', message = 'BDB_PDF_MATCH_INVALID';
    end;
    if coalesce(source_match ->> 'sourceTeamName', '') = '' or
      coalesce(source_match ->> 'sourcePlayerName', '') = '' or
      coalesce(source_match ->> 'sourceJersey', '') !~ '^(?:0|00|[1-9][0-9]?)$' or
      coalesce(source_match ->> 'kind', '') not in ('exact', 'similar', 'unmatched') or
      not exists (
        select 1
        from jsonb_array_elements(p_parsed_payload -> 'teams') as source_team(team),
          jsonb_array_elements(team -> 'players') as source_player(player)
        where team ->> 'name' = source_match ->> 'sourceTeamName'
          and player ->> 'name' = source_match ->> 'sourcePlayerName'
          and player ->> 'jerseyNumber' = source_match ->> 'sourceJersey'
      ) or
      (candidate_roster_id is not null and not exists (
        select 1 from public.roster_entries roster
        where roster.id = candidate_roster_id
          and roster.competition_id = p_competition_id
          and roster.status = 'active'
      ))
    then
      raise exception using errcode = 'BD302', message = 'BDB_PDF_MATCH_INVALID';
    end if;

    insert into public.boxscore_import_player_matches (
      import_id, competition_id, source_team_name, source_player_name,
      source_jersey_number, roster_entry_id, status, suggestion_kind, similarity_score
    ) values (
      created_import_id,
      p_competition_id,
      source_match ->> 'sourceTeamName',
      source_match ->> 'sourcePlayerName',
      source_match ->> 'sourceJersey',
      candidate_roster_id,
      case when candidate_roster_id is null then 'unmatched' else 'suggested' end,
      source_match ->> 'kind',
      nullif(source_match ->> 'score', '')::numeric
    );
  end loop;

  return created_import_id;
exception when unique_violation then
  raise exception using errcode = 'BD309', message = 'BDB_PDF_DUPLICATE';
end;
$$;

create or replace function public.admin_fail_boxscore_import(
  p_import_id bigint,
  p_error_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if p_error_code !~ '^[A-Z][A-Z0-9_]{2,63}$' then
    raise exception using errcode = 'BD302', message = 'BDB_PDF_ERROR_INVALID';
  end if;
  update public.boxscore_imports
  set status = 'failed', error_code = p_error_code
  where id = p_import_id and status <> 'confirmed' and created_by = auth.uid();
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_PDF_IMPORT_NOT_FOUND';
  end if;
end;
$$;

create or replace function public.admin_commit_boxscore_import(
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
    if registration_id is null or not exists (
      select 1
      from public.team_registrations registration
      join public.teams selected_team on selected_team.id = registration.team_id
      where registration.id = registration_id
        and registration.competition_id = import_record.competition_id
        and registration.status = 'confirmed'
        and (
          lower(selected_team.name) = lower(team ->> 'name') or
          upper(coalesce(selected_team.abbreviation, '')) = upper(team ->> 'abbreviation')
        )
    ) then
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
      select value into player_resolution
      from jsonb_array_elements(p_resolution -> 'players')
      where value ->> 'sourceTeamName' = team ->> 'name'
        and value ->> 'sourcePlayerName' = player ->> 'name';
      begin
        resolved_roster_entry_id := (player_resolution ->> 'rosterEntryId')::bigint;
      exception when invalid_text_representation or numeric_value_out_of_range then
        raise exception using errcode = 'BD305', message = 'BDB_PDF_PLAYER_RESOLUTION_INVALID';
      end;
      if resolved_roster_entry_id is null or not exists (
        select 1 from public.roster_entries roster
        where roster.id = resolved_roster_entry_id
          and roster.registration_id = registration_id
          and roster.competition_id = import_record.competition_id
          and roster.status = 'active'
      ) then
        raise exception using errcode = 'BD305', message = 'BDB_PDF_PLAYER_RESOLUTION_INVALID';
      end if;

      update public.boxscore_import_player_matches
      set roster_entry_id = resolved_roster_entry_id,
        status = 'confirmed',
        decided_by = auth.uid(),
        decided_at = now()
      where import_id = p_import_id
        and source_team_name = team ->> 'name'
        and source_player_name = player ->> 'name';
      if not found then
        raise exception using errcode = 'BD305', message = 'BDB_PDF_PLAYER_RESOLUTION_INVALID';
      end if;

      insert into public.game_roster_slots (
        game_id, registration_id, slot_number, roster_entry_id, jersey_number,
        is_starter, is_captain, did_not_play
      ) values (
        created_game_id, registration_id, slot_number, resolved_roster_entry_id,
        player ->> 'jerseyNumber',
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
      and (lower(selected_team.name) = lower(team ->> 'name') or
        upper(coalesce(selected_team.abbreviation, '')) = upper(team ->> 'abbreviation'));
    if actual_score is distinct from expected_score then
      raise exception using errcode = 'BD307', message = 'BDB_PDF_SCORE_MISMATCH';
    end if;
  end loop;

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
    jsonb_build_object('gameId', created_game_id, 'parserVersion', import_record.parser_version)
  );

  return created_game_id;
exception
  when sqlstate 'BD305' or sqlstate 'BD306' or sqlstate 'BD307' then raise;
  when unique_violation then
    raise exception using errcode = 'BD306', message = 'BDB_PDF_GAME_CONFLICT';
  when others then
    raise;
end;
$$;

revoke insert, update on public.boxscore_imports,
  public.boxscore_import_player_matches from authenticated;

revoke all on function public.admin_claim_boxscore_upload() from public, anon;
revoke all on function public.admin_create_boxscore_import_draft(
  bigint, text, text, text, integer, text, jsonb, jsonb, jsonb
) from public, anon;
revoke all on function public.admin_fail_boxscore_import(bigint, text) from public, anon;
revoke all on function public.admin_commit_boxscore_import(bigint, jsonb) from public, anon;

grant execute on function public.admin_claim_boxscore_upload() to authenticated;
grant execute on function public.admin_create_boxscore_import_draft(
  bigint, text, text, text, integer, text, jsonb, jsonb, jsonb
) to authenticated;
grant execute on function public.admin_fail_boxscore_import(bigint, text) to authenticated;
grant execute on function public.admin_commit_boxscore_import(bigint, jsonb) to authenticated;

comment on column public.player_period_stats.stat_scope is
  'period for manually captured rows; game_total for an imported PDF aggregate anchored to period 1.';
comment on function public.admin_claim_boxscore_upload() is
  'Database-backed singleton-admin upload limit: five attempts per rolling ten-minute window.';
comment on function public.admin_commit_boxscore_import(bigint, jsonb) is
  'Atomically confirms reviewed mappings and creates one complete final game from stored parser output.';
