create or replace function public.admin_create_manual_scoresheet(p_payload jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  submission_key uuid;
  payload_hash text;
  competition_id bigint;
  selected_game_id bigint;
  selected_game public.games;
  existing_submission public.game_data_submissions;
  team jsonb;
  slot jsonb;
  period jsonb;
  stat jsonb;
  side text;
  registration_id bigint;
  home_registration_id bigint;
  away_registration_id bigint;
  roster_entry_id bigint;
  slot_number smallint;
  jersey_number text;
  period_number smallint;
  expected_period smallint := 1;
  period_count integer;
  slot_count integer;
  slot_id bigint;
  made_two smallint;
  made_three smallint;
  made_free smallint;
  fouls jsonb;
  foul_code text;
  foul_sequence integer;
  home_score integer;
  away_score integer;
  checkpoint smallint;
  slot_record record;
  foul_record record;
  technical_count integer;
  unsportsmanlike_count integer;
  dq_period smallint;
  dq_reason text;
  submission_id bigint;
  authority_domain text;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = 'BD201', message = 'BDB_INVALID_SCORESHEET';
  end if;

  begin
    submission_key := (p_payload ->> 'idempotencyKey')::uuid;
    competition_id := (p_payload ->> 'competitionId')::bigint;
    selected_game_id := (p_payload ->> 'gameId')::bigint;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode = 'BD203', message = 'BDB_INVALID_GAME_HEADER';
  end;
  if submission_key is null or competition_id <= 0 or selected_game_id <= 0 then
    raise exception using errcode = 'BD203', message = 'BDB_INVALID_GAME_HEADER';
  end if;

  payload_hash := md5(p_payload::text);
  perform pg_advisory_xact_lock(hashtextextended('manual:' || submission_key::text, 2001));
  select submission.* into existing_submission
  from public.game_data_submissions submission
  where submission.source_type = 'manual_scoresheet'
    and submission.idempotency_key = submission_key::text;
  if found then
    if existing_submission.game_id = selected_game_id
      and existing_submission.payload_hash = payload_hash
    then
      return selected_game_id;
    end if;
    raise exception using errcode = 'BD209', message = 'BDB_IDEMPOTENCY_CONFLICT';
  end if;

  select game.* into selected_game
  from public.games game
  where game.id = selected_game_id
    and game.competition_id = competition_id
  for update;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_GAME_NOT_FOUND';
  end if;
  if selected_game.matchup_id is null then
    raise exception using errcode = 'BD710', message = 'BDB_GAME_MATCHUP_REQUIRED';
  end if;
  if selected_game.status not in ('draft', 'scheduled', 'live') then
    raise exception using errcode = 'BD711', message = 'BDB_GAME_NOT_CONFIRMABLE';
  end if;
  if exists (
    select 1 from public.game_data_submissions submission
    where submission.game_id = selected_game_id
      and submission.status = 'active'
      and submission.role = 'primary'
  ) or exists (
    select 1 from public.game_periods game_period where game_period.game_id = selected_game_id
  ) or exists (
    select 1 from public.game_roster_slots game_slot where game_slot.game_id = selected_game_id
  ) then
    raise exception using errcode = 'BD714', message = 'BDB_GAME_ALREADY_CONFIRMED';
  end if;

  if jsonb_typeof(p_payload -> 'teams') <> 'array'
    or jsonb_array_length(p_payload -> 'teams') <> 2
  then
    raise exception using errcode = 'BD202', message = 'BDB_INVALID_PARTICIPANTS';
  end if;
  if jsonb_typeof(p_payload -> 'periods') <> 'array' then
    raise exception using errcode = 'BD206', message = 'BDB_INVALID_PERIODS';
  end if;
  period_count := jsonb_array_length(p_payload -> 'periods');
  if period_count < 4 or period_count > 12 then
    raise exception using errcode = 'BD206', message = 'BDB_INVALID_PERIODS';
  end if;

  for team in select value from jsonb_array_elements(p_payload -> 'teams')
  loop
    begin
      side := team ->> 'side';
      registration_id := (team ->> 'registrationId')::bigint;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode = 'BD202', message = 'BDB_INVALID_PARTICIPANTS';
    end;
    if side not in ('home', 'away') or registration_id <= 0
      or jsonb_typeof(team -> 'slots') <> 'array'
      or jsonb_array_length(team -> 'slots') not between 1 and 12
      or not exists (
        select 1 from public.game_participants participant
        where participant.game_id = selected_game_id
          and participant.competition_id = competition_id
          and participant.registration_id = registration_id
          and participant.side = side
      )
    then
      raise exception using errcode = 'BD712', message = 'BDB_GAME_PARTICIPANTS_MISMATCH';
    end if;

    if side = 'home' then
      if home_registration_id is not null then
        raise exception using errcode = 'BD202', message = 'BDB_INVALID_PARTICIPANTS';
      end if;
      home_registration_id := registration_id;
    else
      if away_registration_id is not null then
        raise exception using errcode = 'BD202', message = 'BDB_INVALID_PARTICIPANTS';
      end if;
      away_registration_id := registration_id;
    end if;

    for slot in select value from jsonb_array_elements(team -> 'slots')
    loop
      begin
        slot_number := (slot ->> 'slotNumber')::smallint;
        roster_entry_id := (slot ->> 'rosterEntryId')::bigint;
      exception when invalid_text_representation or numeric_value_out_of_range then
        raise exception using errcode = 'BD204', message = 'BDB_INVALID_SLOT';
      end;
      jersey_number := slot ->> 'jerseyNumber';
      if slot_number not between 1 and 12 or roster_entry_id <= 0
        or jersey_number is null or jersey_number !~ '^(?:0|00|[1-9][0-9]?)$'
        or not exists (
          select 1 from public.roster_entries roster
          where roster.id = roster_entry_id
            and roster.registration_id = registration_id
            and roster.competition_id = competition_id
            and roster.status = 'active'
        )
      then
        raise exception using errcode = 'BD204', message = 'BDB_INVALID_SLOT';
      end if;
      begin
        insert into public.game_roster_slots (
          game_id, registration_id, slot_number, roster_entry_id, jersey_number
        ) values (
          selected_game_id, registration_id, slot_number, roster_entry_id, jersey_number
        );
      exception when unique_violation then
        raise exception using errcode = 'BD205', message = 'BDB_DUPLICATE_PLAYER_OR_JERSEY';
      end;
    end loop;
  end loop;

  if home_registration_id is null or away_registration_id is null
    or home_registration_id = away_registration_id
  then
    raise exception using errcode = 'BD202', message = 'BDB_INVALID_PARTICIPANTS';
  end if;
  select count(*) into slot_count
  from public.game_roster_slots game_slot
  where game_slot.game_id = selected_game_id;

  for period in select value from jsonb_array_elements(p_payload -> 'periods')
  loop
    begin
      period_number := (period ->> 'periodNumber')::smallint;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode = 'BD206', message = 'BDB_INVALID_PERIODS';
    end;
    if period_number <> expected_period or jsonb_typeof(period -> 'stats') <> 'array'
      or jsonb_array_length(period -> 'stats') <> slot_count
    then
      raise exception using errcode = 'BD206', message = 'BDB_INVALID_PERIODS';
    end if;
    expected_period := expected_period + 1;
    insert into public.game_periods (game_id, period_number)
    values (selected_game_id, period_number);

    for stat in select value from jsonb_array_elements(period -> 'stats')
    loop
      begin
        roster_entry_id := (stat ->> 'rosterEntryId')::bigint;
        made_two := (stat ->> 'twoPointMade')::smallint;
        made_three := (stat ->> 'threePointMade')::smallint;
        made_free := (stat ->> 'freeThrowMade')::smallint;
      exception when invalid_text_representation or numeric_value_out_of_range then
        raise exception using errcode = 'BD206', message = 'BDB_INVALID_STATS';
      end;
      fouls := stat -> 'fouls';
      select game_slot.id into slot_id
      from public.game_roster_slots game_slot
      where game_slot.game_id = selected_game_id
        and game_slot.roster_entry_id = roster_entry_id;
      if slot_id is null or made_two not between 0 and 99
        or made_three not between 0 and 99 or made_free not between 0 and 99
        or jsonb_typeof(fouls) <> 'array' or jsonb_array_length(fouls) > 20
      then
        raise exception using errcode = 'BD206', message = 'BDB_INVALID_STATS';
      end if;
      insert into public.player_period_stats (
        game_roster_slot_id, game_id, period_number,
        two_point_made, two_point_attempted,
        three_point_made, three_point_attempted,
        free_throw_made, free_throw_attempted
      ) values (
        slot_id, selected_game_id, period_number,
        made_two, made_two, made_three, made_three, made_free, made_free
      );
      foul_sequence := 0;
      for foul_code in select value #>> '{}' from jsonb_array_elements(fouls)
      loop
        foul_sequence := foul_sequence + 1;
        if foul_code not in ('P', 'T', 'U', 'U2', 'D') then
          raise exception using errcode = 'BD206', message = 'BDB_INVALID_FOUL';
        end if;
        insert into public.foul_events (
          game_roster_slot_id, game_id, period_number, sequence_number, foul_code
        ) values (
          slot_id, selected_game_id, period_number, foul_sequence, foul_code
        );
      end loop;
    end loop;
  end loop;

  for slot_record in
    select game_slot.id
    from public.game_roster_slots game_slot
    where game_slot.game_id = selected_game_id
  loop
    technical_count := 0;
    unsportsmanlike_count := 0;
    dq_period := null;
    dq_reason := null;
    for foul_record in
      select foul.period_number, foul.foul_code
      from public.foul_events foul
      where foul.game_roster_slot_id = slot_record.id
      order by foul.period_number, foul.sequence_number
    loop
      if dq_period is not null then
        raise exception using errcode = 'BD207', message = 'BDB_DATA_AFTER_DISQUALIFICATION';
      end if;
      if foul_record.foul_code = 'T' then
        technical_count := technical_count + 1;
      elsif foul_record.foul_code = 'U' then
        unsportsmanlike_count := unsportsmanlike_count + 1;
      elsif foul_record.foul_code = 'U2' then
        unsportsmanlike_count := unsportsmanlike_count + 2;
      end if;
      if foul_record.foul_code = 'D' then
        dq_reason := 'D';
      elsif technical_count >= 2 then
        dq_reason := '2T';
      elsif unsportsmanlike_count >= 2 then
        dq_reason := '2U';
      elsif technical_count >= 1 and unsportsmanlike_count >= 1 then
        dq_reason := 'T+U';
      end if;
      if dq_reason is not null then dq_period := foul_record.period_number; end if;
    end loop;

    if dq_period is not null then
      if exists (
        select 1 from public.player_period_stats player_stat
        where player_stat.game_roster_slot_id = slot_record.id
          and player_stat.period_number > dq_period
          and (
            player_stat.two_point_made > 0
            or player_stat.three_point_made > 0
            or player_stat.free_throw_made > 0
          )
      ) then
        raise exception using errcode = 'BD207', message = 'BDB_DATA_AFTER_DISQUALIFICATION';
      end if;
      update public.game_roster_slots game_slot
      set disqualified_at_period = dq_period,
          disqualification_reason = dq_reason
      where game_slot.id = slot_record.id;
    end if;
  end loop;

  insert into public.game_period_scores (game_id, registration_id, period_number, points)
  select
    selected_game_id,
    participant.registration_id,
    game_period.period_number,
    coalesce(sum(player_stat.points), 0)::integer
  from public.game_participants participant
  cross join public.game_periods game_period
  left join public.game_roster_slots game_slot
    on game_slot.game_id = participant.game_id
    and game_slot.registration_id = participant.registration_id
  left join public.player_period_stats player_stat
    on player_stat.game_roster_slot_id = game_slot.id
    and player_stat.period_number = game_period.period_number
  where participant.game_id = selected_game_id
    and game_period.game_id = selected_game_id
  group by participant.registration_id, game_period.period_number;

  if period_count > 4 then
    for checkpoint in 4..(period_count - 1)
    loop
      select
        coalesce(sum(score.points) filter (
          where score.registration_id = home_registration_id and score.period_number <= checkpoint
        ), 0),
        coalesce(sum(score.points) filter (
          where score.registration_id = away_registration_id and score.period_number <= checkpoint
        ), 0)
      into home_score, away_score
      from public.game_period_scores score
      where score.game_id = selected_game_id;
      if home_score <> away_score then
        raise exception using errcode = 'BD206', message = 'BDB_UNNECESSARY_OVERTIME';
      end if;
    end loop;
  end if;

  select
    coalesce(sum(score.points) filter (where score.registration_id = home_registration_id), 0),
    coalesce(sum(score.points) filter (where score.registration_id = away_registration_id), 0)
  into home_score, away_score
  from public.game_period_scores score
  where score.game_id = selected_game_id;
  if home_score = away_score then
    raise exception using errcode = 'BD208', message = 'BDB_FINAL_GAME_TIED';
  end if;

  update public.games game
  set status = 'final',
      started_at = coalesce(game.started_at, game.scheduled_at, now()),
      ended_at = coalesce(game.ended_at, game.scheduled_at + interval '2 hours', now()),
      source = 'manual',
      manual_idempotency_key = submission_key,
      manual_payload_hash = payload_hash,
      created_by = coalesce(game.created_by, auth.uid())
  where game.id = selected_game_id;

  insert into public.game_data_submissions (
    game_id, submission_version, source_type, role, status,
    payload_hash, idempotency_key, submitted_by, submitted_at,
    validated_by, validated_at
  ) values (
    selected_game_id,
    coalesce((select max(s.submission_version) + 1 from public.game_data_submissions s
      where s.game_id = selected_game_id and s.source_type = 'manual_scoresheet'), 1),
    'manual_scoresheet', 'primary', 'active', payload_hash,
    submission_key::text, auth.uid(), now(), auth.uid(), now()
  ) returning id into submission_id;

  foreach authority_domain in array array[
    'official_result', 'period_scores', 'participation', 'player_scoring',
    'player_foul_total', 'player_foul_timeline'
  ]::text[]
  loop
    perform private.activate_game_data_domain_authority(
      selected_game_id, authority_domain, submission_id, null, null
    );
  end loop;

  insert into public.admin_mutation_audit (action, entity_type, entity_id, metadata)
  values (
    'manual_scoresheet_saved',
    'game',
    selected_game_id,
    jsonb_build_object(
      'competitionId', competition_id,
      'submissionId', submission_id,
      'periodCount', period_count,
      'homeScore', home_score,
      'awayScore', away_score
    )
  );
  return selected_game_id;
exception
  when sqlstate 'BD401' or sqlstate 'BD404' or sqlstate 'BD710'
    or sqlstate 'BD711' or sqlstate 'BD712' or sqlstate 'BD714'
    or sqlstate 'BD201' or sqlstate 'BD202' or sqlstate 'BD203'
    or sqlstate 'BD204' or sqlstate 'BD205' or sqlstate 'BD206'
    or sqlstate 'BD207' or sqlstate 'BD208' or sqlstate 'BD209'
  then raise;
  when unique_violation then
    raise exception using errcode = 'BD205', message = 'BDB_DUPLICATE_GAME_DATA';
end;
$$;

revoke all on function public.admin_create_manual_scoresheet(jsonb)
from public, anon, authenticated;
grant execute on function public.admin_create_manual_scoresheet(jsonb) to authenticated;

comment on function public.admin_create_manual_scoresheet(jsonb) is
  'Atomically confirms a manual scoresheet on an existing matchup-bound game, creates its active submission and activates compatible domain authorities.';

alter function private.admin_commit_boxscore_import_impl(bigint, jsonb)
  rename to admin_commit_boxscore_import_with_eligibility_legacy_game;

revoke all on function private.admin_commit_boxscore_import_with_eligibility_legacy_game(bigint, jsonb)
from public, anon, authenticated;

create function private.admin_commit_boxscore_import_impl(
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
  selected_game public.games;
  selected_game_id bigint;
  temporary_game_id bigint;
  original_parsed jsonb;
  source_home_registration_id bigint;
  source_away_registration_id bigint;
  selected_home_registration_id bigint;
  selected_away_registration_id bigint;
  allow_side_inversion boolean;
  slot_record record;
  new_slot_id bigint;
  storage_object_id uuid;
  submission_id bigint;
  authority_domain text;
  previous_internal_ingestion_setting text;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if jsonb_typeof(p_resolution) <> 'object'
    or coalesce(p_resolution ->> 'gameId', '') !~ '^[1-9][0-9]*$'
  then
    raise exception using errcode = 'BD305', message = 'BDB_PDF_RESOLUTION_INVALID';
  end if;
  selected_game_id := (p_resolution ->> 'gameId')::bigint;

  select * into import_record
  from public.boxscore_imports
  where id = p_import_id
  for update;
  if not found or import_record.created_by <> auth.uid() then
    raise exception using errcode = 'BD404', message = 'BDB_PDF_IMPORT_NOT_FOUND';
  end if;
  if import_record.status = 'confirmed' then
    if import_record.game_id = selected_game_id then return selected_game_id; end if;
    raise exception using errcode = 'BD713', message = 'BDB_GAME_DATA_CONFLICT';
  end if;

  select game.* into selected_game
  from public.games game
  where game.id = selected_game_id
    and game.competition_id = import_record.competition_id
  for update;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_GAME_NOT_FOUND';
  end if;
  if selected_game.matchup_id is null then
    raise exception using errcode = 'BD710', message = 'BDB_GAME_MATCHUP_REQUIRED';
  end if;
  if selected_game.status not in ('draft', 'scheduled', 'live') then
    raise exception using errcode = 'BD711', message = 'BDB_GAME_NOT_CONFIRMABLE';
  end if;
  if exists (
    select 1 from public.game_data_submissions submission
    where submission.game_id = selected_game_id
      and submission.status = 'active'
      and submission.role = 'primary'
  ) or exists (
    select 1 from public.game_periods game_period where game_period.game_id = selected_game_id
  ) or exists (
    select 1 from public.game_roster_slots game_slot where game_slot.game_id = selected_game_id
  ) then
    raise exception using errcode = 'BD714', message = 'BDB_GAME_ALREADY_CONFIRMED';
  end if;

  original_parsed := import_record.parsed_payload;
  begin
    select (team.value ->> 'registrationId')::bigint
    into source_home_registration_id
    from jsonb_array_elements(p_resolution -> 'teams') team(value)
    where team.value ->> 'sourceTeamName' = original_parsed -> 'teams' -> 0 ->> 'name';
    select (team.value ->> 'registrationId')::bigint
    into source_away_registration_id
    from jsonb_array_elements(p_resolution -> 'teams') team(value)
    where team.value ->> 'sourceTeamName' = original_parsed -> 'teams' -> 1 ->> 'name';
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode = 'BD305', message = 'BDB_PDF_TEAM_RESOLUTION_INVALID';
  end;
  select participant.registration_id into selected_home_registration_id
  from public.game_participants participant
  where participant.game_id = selected_game_id and participant.side = 'home';
  select participant.registration_id into selected_away_registration_id
  from public.game_participants participant
  where participant.game_id = selected_game_id and participant.side = 'away';
  select matchup.allow_side_inversion into allow_side_inversion
  from public.matchups matchup where matchup.id = selected_game.matchup_id;

  if source_home_registration_id is null or source_away_registration_id is null
    or not (
      source_home_registration_id = selected_home_registration_id
      and source_away_registration_id = selected_away_registration_id
    ) and not (
      allow_side_inversion
      and source_home_registration_id = selected_away_registration_id
      and source_away_registration_id = selected_home_registration_id
    )
  then
    raise exception using errcode = 'BD712', message = 'BDB_GAME_PARTICIPANTS_MISMATCH';
  end if;
  if selected_game.game_number is not null
    and original_parsed ->> 'gameNumber' is not null
    and selected_game.game_number <> original_parsed ->> 'gameNumber'
  then
    raise exception using errcode = 'BD713', message = 'BDB_GAME_DATA_CONFLICT';
  end if;

  -- Reuse the already hardened player-resolution transaction. Its temporary
  -- game remains invisible until commit and is removed below in this same
  -- transaction; only the selected structural game can persist.
  update public.boxscore_imports
  set parsed_payload = jsonb_set(
    original_parsed,
    '{gameNumber}',
    to_jsonb('__mvp01_' || p_import_id::text || '_' || selected_game_id::text)
  )
  where id = p_import_id;
  previous_internal_ingestion_setting := coalesce(
    current_setting('bdb.allow_internal_ingestion_game', true),
    ''
  );
  begin
    perform set_config('bdb.allow_internal_ingestion_game', 'on', true);
    temporary_game_id := private.admin_commit_boxscore_import_with_eligibility_legacy_game(
      p_import_id,
      p_resolution - 'gameId'
    );
    perform set_config(
      'bdb.allow_internal_ingestion_game',
      previous_internal_ingestion_setting,
      true
    );
  exception when others then
    perform set_config(
      'bdb.allow_internal_ingestion_game',
      previous_internal_ingestion_setting,
      true
    );
    raise;
  end;
  if temporary_game_id = selected_game_id then
    raise exception using errcode = 'BD713', message = 'BDB_GAME_DATA_CONFLICT';
  end if;

  insert into public.game_periods (game_id, period_number, started_at, ended_at)
  select selected_game_id, period.period_number, period.started_at, period.ended_at
  from public.game_periods period where period.game_id = temporary_game_id;

  for slot_record in
    select * from public.game_roster_slots source_slot
    where source_slot.game_id = temporary_game_id
    order by source_slot.registration_id, source_slot.slot_number
  loop
    insert into public.game_roster_slots (
      game_id, registration_id, slot_number, roster_entry_id, jersey_number,
      is_applicable, is_starter, is_captain, did_not_play,
      disqualified_at_period, disqualification_reason
    ) values (
      selected_game_id, slot_record.registration_id, slot_record.slot_number,
      slot_record.roster_entry_id, slot_record.jersey_number,
      slot_record.is_applicable, slot_record.is_starter, slot_record.is_captain,
      slot_record.did_not_play, slot_record.disqualified_at_period,
      slot_record.disqualification_reason
    ) returning id into new_slot_id;

    insert into public.player_period_stats (
      game_roster_slot_id, game_id, period_number, seconds_played,
      two_point_made, two_point_attempted, three_point_made, three_point_attempted,
      free_throw_made, free_throw_attempted, offensive_rebounds, defensive_rebounds,
      assists, turnovers, steals, blocks, plus_minus, stat_scope
    )
    select
      new_slot_id, selected_game_id, stat.period_number, stat.seconds_played,
      stat.two_point_made, stat.two_point_attempted,
      stat.three_point_made, stat.three_point_attempted,
      stat.free_throw_made, stat.free_throw_attempted,
      stat.offensive_rebounds, stat.defensive_rebounds,
      stat.assists, stat.turnovers, stat.steals, stat.blocks,
      stat.plus_minus, stat.stat_scope
    from public.player_period_stats stat
    where stat.game_id = temporary_game_id
      and stat.game_roster_slot_id = slot_record.id;

    insert into public.foul_events (
      game_roster_slot_id, game_id, period_number,
      sequence_number, elapsed_seconds, foul_code
    )
    select
      new_slot_id, selected_game_id, foul.period_number,
      foul.sequence_number, foul.elapsed_seconds, foul.foul_code
    from public.foul_events foul
    where foul.game_id = temporary_game_id
      and foul.game_roster_slot_id = slot_record.id;
  end loop;

  insert into public.game_period_scores (game_id, registration_id, period_number, points)
  select selected_game_id, score.registration_id, score.period_number, score.points
  from public.game_period_scores score where score.game_id = temporary_game_id;

  insert into public.game_team_statistics (
    game_id, registration_id, points_from_turnovers, points_in_paint,
    points_in_paint_made, points_in_paint_attempted, second_chance_points,
    fast_break_points, fast_break_points_from_turnovers, bench_points,
    largest_lead, largest_scoring_run, points_per_possession,
    time_leading_seconds, source_parser_version
  )
  select
    selected_game_id, statistics.registration_id, statistics.points_from_turnovers,
    statistics.points_in_paint, statistics.points_in_paint_made,
    statistics.points_in_paint_attempted, statistics.second_chance_points,
    statistics.fast_break_points, statistics.fast_break_points_from_turnovers,
    statistics.bench_points, statistics.largest_lead,
    statistics.largest_scoring_run, statistics.points_per_possession,
    statistics.time_leading_seconds, statistics.source_parser_version
  from public.game_team_statistics statistics
  where statistics.game_id = temporary_game_id;

  insert into public.game_statistics (
    game_id, lead_changes, times_tied, source_parser_version
  )
  select selected_game_id, statistics.lead_changes, statistics.times_tied,
    statistics.source_parser_version
  from public.game_statistics statistics where statistics.game_id = temporary_game_id;

  update public.boxscore_imports
  set game_id = selected_game_id, parsed_payload = original_parsed
  where id = p_import_id;
  update public.admin_mutation_audit audit
  set metadata = jsonb_set(audit.metadata, '{gameId}', to_jsonb(selected_game_id))
  where audit.action = 'boxscore_import_confirmed'
    and audit.entity_type = 'boxscore_import'
    and audit.entity_id = p_import_id
    and audit.metadata ->> 'gameId' = temporary_game_id::text;

  delete from public.foul_events where game_id = temporary_game_id;
  delete from public.player_period_stats where game_id = temporary_game_id;
  delete from public.game_team_statistics where game_id = temporary_game_id;
  delete from public.game_statistics where game_id = temporary_game_id;
  delete from public.game_period_scores where game_id = temporary_game_id;
  delete from public.game_roster_slots where game_id = temporary_game_id;
  delete from public.game_periods where game_id = temporary_game_id;
  delete from public.game_participants where game_id = temporary_game_id;
  delete from public.games where id = temporary_game_id;

  update public.games game
  set status = 'final',
      started_at = coalesce(
        game.started_at,
        (original_parsed ->> 'scheduledLocal')::timestamp at time zone 'America/Sao_Paulo'
      ),
      ended_at = coalesce(
        game.ended_at,
        ((original_parsed ->> 'scheduledLocal')::timestamp at time zone 'America/Sao_Paulo')
          + make_interval(secs => (original_parsed ->> 'durationSeconds')::integer)
      ),
      source = 'boxscore',
      created_by = coalesce(game.created_by, auth.uid())
  where game.id = selected_game_id;

  select object.id into storage_object_id
  from storage.objects object
  where object.bucket_id = 'boxscore-pdfs'
    and object.name = import_record.storage_path
  order by object.created_at desc
  limit 1;
  if storage_object_id is null then
    raise exception using errcode = 'BD404', message = 'BDB_PDF_STORAGE_OBJECT_NOT_FOUND';
  end if;

  insert into public.game_data_submissions (
    game_id, submission_version, source_type, role, status,
    parser_version, payload_hash, storage_object_id, idempotency_key,
    submitted_by, submitted_at, validated_by, validated_at
  ) values (
    selected_game_id,
    coalesce((select max(s.submission_version) + 1 from public.game_data_submissions s
      where s.game_id = selected_game_id and s.source_type = 'fiba_boxscore'), 1),
    'fiba_boxscore', 'primary', 'active', import_record.parser_version,
    import_record.sha256, storage_object_id, 'boxscore-import:' || p_import_id::text,
    auth.uid(), now(), auth.uid(), now()
  ) returning id into submission_id;

  foreach authority_domain in array array[
    'official_result', 'period_scores', 'participation', 'player_scoring',
    'player_advanced', 'player_foul_total', 'team_advanced', 'game_advanced'
  ]::text[]
  loop
    perform private.activate_game_data_domain_authority(
      selected_game_id, authority_domain, submission_id, null, null
    );
  end loop;

  return selected_game_id;
exception
  when sqlstate 'BD401' or sqlstate 'BD404' or sqlstate 'BD710'
    or sqlstate 'BD711' or sqlstate 'BD712' or sqlstate 'BD713'
    or sqlstate 'BD714' or sqlstate 'BD305' or sqlstate 'BD306'
    or sqlstate 'BD307' or sqlstate 'BD308' or sqlstate 'BD310'
    or sqlstate 'BD505' or sqlstate 'BD601' or sqlstate 'BD602'
  then raise;
  when unique_violation then
    raise exception using errcode = 'BD306', message = 'BDB_PDF_GAME_CONFLICT';
end;
$$;

revoke all on function private.admin_commit_boxscore_import_impl(bigint, jsonb)
from public, anon, authenticated;
grant execute on function private.admin_commit_boxscore_import_impl(bigint, jsonb)
to authenticated;

comment on function private.admin_commit_boxscore_import_impl(bigint, jsonb) is
  'Atomically confirms the supported private FIBA/Genius PDF on one existing matchup-bound game and activates compatible authorities.';
