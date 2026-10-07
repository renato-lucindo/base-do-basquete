-- MANUAL-SCORESHEET-V2-FIBA2024
-- Etapa 3: atomic and idempotent matchup + game + manual scoresheet creation.

create table public.manual_scoresheet_game_details (
  game_id bigint primary key references public.games(id) on delete restrict,
  scheduled_date date not null,
  scheduled_time time,
  phase_round text check (
    phase_round is null or (phase_round = btrim(phase_round) and char_length(phase_round) between 1 and 120)
  ),
  notes text check (notes is null or (notes = btrim(notes) and char_length(notes) <= 2000)),
  updated_at timestamptz not null default now()
);

create table public.manual_scoresheet_submission_payloads (
  submission_id bigint primary key,
  game_id bigint not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{32}$'),
  created_by uuid not null references auth.users(id) on delete restrict deferrable initially immediate,
  created_at timestamptz not null default now(),
  constraint manual_scoresheet_submission_payloads_submission_fkey
    foreign key (submission_id, game_id)
    references public.game_data_submissions(id, game_id) on delete restrict
);

create index manual_scoresheet_submission_payloads_game_idx
  on public.manual_scoresheet_submission_payloads(game_id, submission_id desc);

alter table public.manual_scoresheet_game_details enable row level security;
alter table public.manual_scoresheet_game_details force row level security;
alter table public.manual_scoresheet_submission_payloads enable row level security;
alter table public.manual_scoresheet_submission_payloads force row level security;

create policy manual_scoresheet_game_details_admin_select
on public.manual_scoresheet_game_details for select to authenticated
using ((select public.is_current_admin_aal2()));
create policy manual_scoresheet_submission_payloads_admin_select
on public.manual_scoresheet_submission_payloads for select to authenticated
using ((select public.is_current_admin_aal2()));

revoke all on public.manual_scoresheet_game_details from public, anon, authenticated;
revoke all on public.manual_scoresheet_submission_payloads from public, anon, authenticated;
grant select on public.manual_scoresheet_game_details to authenticated;
grant select on public.manual_scoresheet_submission_payloads to authenticated;

create function private.write_manual_scoresheet_v2_game(
  p_game_id bigint,
  p_competition_id bigint,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  team jsonb;
  slot jsonb;
  staff jsonb;
  official jsonb;
  period jsonb;
  stat jsonb;
  foul jsonb;
  side text;
  registration_id bigint;
  home_registration_id bigint;
  away_registration_id bigint;
  slot_number smallint;
  roster_entry_id bigint;
  jersey_number text;
  is_starter boolean;
  is_captain boolean;
  captain_count integer;
  coach_count integer;
  slot_count integer := 0;
  period_count integer;
  period_number smallint;
  expected_period smallint := 1;
  slot_id bigint;
  made_two smallint;
  made_three smallint;
  made_free smallint;
  foul_target jsonb;
  foul_target_kind text;
  foul_registration_id bigint;
  foul_roster_entry_id bigint;
  foul_staff_role text;
  foul_type text;
  foul_penalty smallint;
  foul_notation text;
  foul_rules_version text;
  foul_sequence smallint;
  staff_role text;
  staff_name text;
  staff_origin text;
  linked_captain_id bigint;
  official_role text;
  official_name text;
  home_score integer;
  away_score integer;
  checkpoint smallint;
  slot_record record;
  foul_record record;
  technical_count integer;
  unsportsmanlike_count integer;
  dq_period smallint;
  dq_sequence smallint;
  dq_reason text;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode='BD401', message='BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or jsonb_typeof(p_payload -> 'teams') <> 'array'
    or jsonb_array_length(p_payload -> 'teams') <> 2
    or jsonb_typeof(p_payload -> 'periods') <> 'array'
    or jsonb_typeof(p_payload -> 'fouls') <> 'array'
    or jsonb_typeof(p_payload -> 'officials') <> 'array'
  then
    raise exception using errcode='BD201', message='BDB_INVALID_SCORESHEET';
  end if;
  period_count := jsonb_array_length(p_payload -> 'periods');
  if period_count not between 4 and 12 or jsonb_array_length(p_payload -> 'officials') > 6 then
    raise exception using errcode='BD206', message='BDB_INVALID_PERIODS';
  end if;

  if exists(select 1 from public.game_roster_slots where game_id = p_game_id)
    or exists(select 1 from public.game_periods where game_id = p_game_id)
  then
    raise exception using errcode='BD714', message='BDB_GAME_ALREADY_CONFIRMED';
  end if;

  for team in select value from jsonb_array_elements(p_payload -> 'teams')
  loop
    begin
      side := team ->> 'side';
      registration_id := (team ->> 'registrationId')::bigint;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode='BD202', message='BDB_INVALID_PARTICIPANTS';
    end;
    if side not in ('home','away') or registration_id <= 0
      or jsonb_typeof(team -> 'slots') <> 'array'
      or jsonb_array_length(team -> 'slots') not between 1 and 12
      or not exists (
        select 1 from public.game_participants participant
        where participant.game_id = p_game_id
          and participant.competition_id = p_competition_id
          and participant.registration_id = registration_id
          and participant.side = side
      )
    then
      raise exception using errcode='BD712', message='BDB_GAME_PARTICIPANTS_MISMATCH';
    end if;
    if side = 'home' then
      if home_registration_id is not null then
        raise exception using errcode='BD202', message='BDB_INVALID_PARTICIPANTS';
      end if;
      home_registration_id := registration_id;
    else
      if away_registration_id is not null then
        raise exception using errcode='BD202', message='BDB_INVALID_PARTICIPANTS';
      end if;
      away_registration_id := registration_id;
    end if;

    captain_count := 0;
    for slot in select value from jsonb_array_elements(team -> 'slots')
    loop
      begin
        slot_number := (slot ->> 'slotNumber')::smallint;
        roster_entry_id := (slot ->> 'rosterEntryId')::bigint;
        is_starter := coalesce((slot ->> 'isStarter')::boolean, false);
        is_captain := coalesce((slot ->> 'isCaptain')::boolean, false);
      exception when invalid_text_representation or numeric_value_out_of_range then
        raise exception using errcode='BD204', message='BDB_INVALID_SLOT';
      end;
      jersey_number := nullif(btrim(coalesce(slot ->> 'jerseyNumber','')), '');
      if slot_number not between 1 and 12 or roster_entry_id <= 0
        or jersey_number is null or jersey_number !~ '^(?:0|00|[1-9][0-9]?)$'
        or not exists (
          select 1 from public.roster_entries roster
          where roster.id = roster_entry_id
            and roster.registration_id = registration_id
            and roster.competition_id = p_competition_id
            and roster.status = 'active'
        )
      then
        raise exception using errcode='BD204', message='BDB_INVALID_SLOT';
      end if;
      begin
        insert into public.game_roster_slots(
          game_id, registration_id, slot_number, roster_entry_id, jersey_number,
          is_starter, is_captain
        ) values(
          p_game_id, registration_id, slot_number, roster_entry_id, jersey_number,
          is_starter, is_captain
        );
      exception when unique_violation then
        raise exception using errcode='BD205', message='BDB_DUPLICATE_PLAYER_OR_JERSEY';
      end;
      if is_captain then captain_count := captain_count + 1; end if;
      slot_count := slot_count + 1;
    end loop;
    if captain_count <> 1 then
      raise exception using errcode='BD216', message='BDB_CAPTAIN_REQUIRED';
    end if;

    if team ? 'staff' and jsonb_typeof(team -> 'staff') <> 'array' then
      raise exception using errcode='BD217', message='BDB_INVALID_STAFF';
    end if;
    coach_count := 0;
    if jsonb_typeof(coalesce(team -> 'staff','[]'::jsonb)) = 'array' then
      for staff in select value from jsonb_array_elements(coalesce(team -> 'staff','[]'::jsonb))
      loop
        staff_role := staff ->> 'role';
        staff_origin := staff ->> 'origin';
        staff_name := nullif(btrim(coalesce(staff ->> 'name','')), '');
        linked_captain_id := null;
        if staff_role not in ('coach','assistant_1') or staff_origin not in ('manual','captain_placeholder') then
          raise exception using errcode='BD217', message='BDB_INVALID_STAFF';
        end if;
        if staff_role = 'coach' then
          coach_count := coach_count + 1;
        end if;
        if staff_origin = 'captain_placeholder' then
          if staff_role <> 'coach' then
            raise exception using errcode='BD217', message='BDB_INVALID_STAFF';
          end if;
          select game_slot.roster_entry_id, player.full_name
          into linked_captain_id, staff_name
          from public.game_roster_slots game_slot
          join public.roster_entries roster on roster.id = game_slot.roster_entry_id
          join public.players player on player.id = roster.player_id
          where game_slot.game_id = p_game_id
            and game_slot.registration_id = registration_id
            and game_slot.is_captain;
        elsif staff_name is null or char_length(staff_name) not between 2 and 160 then
          raise exception using errcode='BD217', message='BDB_INVALID_STAFF';
        end if;
        begin
          insert into public.game_team_staff(
            game_id, registration_id, role, display_name, origin, linked_captain_roster_entry_id
          ) values(
            p_game_id, registration_id, staff_role, staff_name, staff_origin, linked_captain_id
          );
        exception when unique_violation then
          raise exception using errcode='BD217', message='BDB_INVALID_STAFF';
        end;
      end loop;
    end if;
    if coach_count <> 1 then
      raise exception using errcode='BD217', message='BDB_INVALID_STAFF';
    end if;
  end loop;

  if home_registration_id is null or away_registration_id is null
    or home_registration_id = away_registration_id
  then
    raise exception using errcode='BD202', message='BDB_INVALID_PARTICIPANTS';
  end if;

  for official in select value from jsonb_array_elements(p_payload -> 'officials')
  loop
    official_role := official ->> 'role';
    official_name := nullif(btrim(coalesce(official ->> 'name','')), '');
    if official_role not in (
      'Árbitro','Fiscal 1','Fiscal 2','Apontador','Cronometrista','Operador de 24 Segundos'
    ) or official_name is null or char_length(official_name) not between 2 and 160 then
      raise exception using errcode='BD218', message='BDB_INVALID_OFFICIAL';
    end if;
    begin
      insert into public.game_officials(game_id, role, display_name)
      values(p_game_id, official_role, official_name);
    exception when unique_violation then
      raise exception using errcode='BD218', message='BDB_INVALID_OFFICIAL';
    end;
  end loop;

  for period in select value from jsonb_array_elements(p_payload -> 'periods')
  loop
    begin
      period_number := (period ->> 'periodNumber')::smallint;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode='BD206', message='BDB_INVALID_PERIODS';
    end;
    if period_number <> expected_period or jsonb_typeof(period -> 'stats') <> 'array'
      or jsonb_array_length(period -> 'stats') <> slot_count
    then
      raise exception using errcode='BD206', message='BDB_INVALID_PERIODS';
    end if;
    expected_period := expected_period + 1;
    insert into public.game_periods(game_id, period_number) values(p_game_id, period_number);
    for stat in select value from jsonb_array_elements(period -> 'stats')
    loop
      begin
        roster_entry_id := (stat ->> 'rosterEntryId')::bigint;
        made_two := (stat ->> 'twoPointMade')::smallint;
        made_three := (stat ->> 'threePointMade')::smallint;
        made_free := (stat ->> 'freeThrowMade')::smallint;
      exception when invalid_text_representation or numeric_value_out_of_range then
        raise exception using errcode='BD206', message='BDB_INVALID_STATS';
      end;
      select game_slot.id into slot_id
      from public.game_roster_slots game_slot
      where game_slot.game_id = p_game_id and game_slot.roster_entry_id = roster_entry_id;
      if slot_id is null or made_two not between 0 and 99
        or made_three not between 0 and 99 or made_free not between 0 and 99
      then
        raise exception using errcode='BD206', message='BDB_INVALID_STATS';
      end if;
      insert into public.player_period_stats(
        game_roster_slot_id, game_id, period_number,
        two_point_made, two_point_attempted,
        three_point_made, three_point_attempted,
        free_throw_made, free_throw_attempted
      ) values(
        slot_id, p_game_id, period_number,
        made_two, made_two, made_three, made_three, made_free, made_free
      );
    end loop;
  end loop;

  for foul in select value from jsonb_array_elements(p_payload -> 'fouls')
  loop
    foul_target := foul -> 'target';
    begin
      period_number := (foul ->> 'periodNumber')::smallint;
      foul_sequence := (foul ->> 'sequenceNumber')::smallint;
      foul_registration_id := (foul_target ->> 'registrationId')::bigint;
      foul_penalty := (foul ->> 'penaltyFtCount')::smallint;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode='BD219', message='BDB_INVALID_SEMANTIC_FOUL';
    end;
    foul_target_kind := foul_target ->> 'kind';
    foul_type := upper(coalesce(foul ->> 'type',''));
    foul_notation := upper(nullif(btrim(coalesce(foul ->> 'originalNotation','')), ''));
    foul_rules_version := foul ->> 'rulesVersion';
    foul_staff_role := nullif(foul_target ->> 'staffRole','');
    foul_roster_entry_id := null;
    if foul_target_kind = 'player' then
      begin
        foul_roster_entry_id := (foul_target ->> 'rosterEntryId')::bigint;
      exception when invalid_text_representation or numeric_value_out_of_range then
        raise exception using errcode='BD219', message='BDB_INVALID_SEMANTIC_FOUL';
      end;
    end if;
    if period_number not between 1 and period_count or foul_sequence <= 0
      or foul_registration_id not in (home_registration_id, away_registration_id)
      or foul_target_kind not in ('player','bench','staff','team')
      or foul_type not in ('P','T','U','D')
      or foul_penalty not between 0 and 3
      or foul_notation is null or char_length(foul_notation) > 8
      or (
        foul_notation in ('C1','B1')
        and (foul_type <> 'T' or foul_penalty <> 1)
      )
      or (
        foul_notation not in ('C1','B1')
        and (
          foul_notation !~ '^[PTUD][0-3]?$'
          or (foul_penalty = 0 and foul_notation not in (foul_type, foul_type || '0'))
          or (foul_penalty > 0 and foul_notation <> foul_type || foul_penalty::text)
        )
      )
      or foul_rules_version <> 'FIBA_2024'
    then
      raise exception using errcode='BD219', message='BDB_INVALID_SEMANTIC_FOUL';
    end if;
    if foul_target_kind = 'player' then
      select game_slot.id into slot_id
      from public.game_roster_slots game_slot
      where game_slot.game_id = p_game_id
        and game_slot.registration_id = foul_registration_id
        and game_slot.roster_entry_id = foul_roster_entry_id;
      if slot_id is null or foul_staff_role is not null then
        raise exception using errcode='BD219', message='BDB_INVALID_SEMANTIC_FOUL';
      end if;
    elsif foul_target_kind = 'staff' then
      slot_id := null;
      if foul_staff_role not in ('coach','assistant_1') or not exists (
        select 1 from public.game_team_staff team_staff
        where team_staff.game_id = p_game_id
          and team_staff.registration_id = foul_registration_id
          and team_staff.role = foul_staff_role
      ) then
        raise exception using errcode='BD219', message='BDB_INVALID_SEMANTIC_FOUL';
      end if;
    else
      slot_id := null;
      if foul_roster_entry_id is not null or foul_staff_role is not null then
        raise exception using errcode='BD219', message='BDB_INVALID_SEMANTIC_FOUL';
      end if;
    end if;
    insert into public.foul_events(
      game_roster_slot_id, game_id, registration_id, period_number, sequence_number,
      foul_code, target_kind, staff_role, foul_type, penalty_ft_count,
      original_notation, foul_rules_version
    ) values(
      slot_id, p_game_id, foul_registration_id, period_number, foul_sequence,
      case when foul_notation in ('P','T','U','U2','D') then foul_notation else foul_type end,
      foul_target_kind, foul_staff_role, foul_type, foul_penalty,
      foul_notation, foul_rules_version
    );
  end loop;

  for slot_record in
    select game_slot.id from public.game_roster_slots game_slot
    where game_slot.game_id = p_game_id
  loop
    technical_count := 0;
    unsportsmanlike_count := 0;
    dq_period := null;
    dq_sequence := null;
    dq_reason := null;
    for foul_record in
      select foul.period_number, foul.sequence_number, foul.foul_type
      from public.foul_events foul
      where foul.game_roster_slot_id = slot_record.id and foul.target_kind = 'player'
      order by foul.period_number, foul.sequence_number
    loop
      if dq_period is not null then
        raise exception using errcode='BD207', message='BDB_DATA_AFTER_DISQUALIFICATION';
      end if;
      if foul_record.foul_type = 'T' then
        technical_count := technical_count + 1;
      elsif foul_record.foul_type = 'U' then
        unsportsmanlike_count := unsportsmanlike_count + 1;
      end if;
      if foul_record.foul_type = 'D' then
        dq_reason := 'D';
      elsif technical_count >= 2 then
        dq_reason := '2T';
      elsif unsportsmanlike_count >= 2 then
        dq_reason := '2U';
      elsif technical_count >= 1 and unsportsmanlike_count >= 1 then
        dq_reason := 'T+U';
      end if;
      if dq_reason is not null then
        dq_period := foul_record.period_number;
        dq_sequence := foul_record.sequence_number;
      end if;
    end loop;
    if dq_period is not null then
      if exists(
        select 1 from public.player_period_stats player_stat
        where player_stat.game_roster_slot_id = slot_record.id
          and player_stat.period_number > dq_period
          and (player_stat.two_point_made > 0 or player_stat.three_point_made > 0 or player_stat.free_throw_made > 0)
      ) then
        raise exception using errcode='BD207', message='BDB_DATA_AFTER_DISQUALIFICATION';
      end if;
      update public.game_roster_slots game_slot
      set disqualified_at_period = dq_period, disqualification_reason = dq_reason
      where game_slot.id = slot_record.id;
    end if;
  end loop;

  insert into public.game_period_scores(game_id, registration_id, period_number, points)
  select
    p_game_id,
    participant.registration_id,
    game_period.period_number,
    coalesce(sum(player_stat.points),0)::integer
  from public.game_participants participant
  cross join public.game_periods game_period
  left join public.game_roster_slots game_slot
    on game_slot.game_id = participant.game_id and game_slot.registration_id = participant.registration_id
  left join public.player_period_stats player_stat
    on player_stat.game_roster_slot_id = game_slot.id and player_stat.period_number = game_period.period_number
  where participant.game_id = p_game_id and game_period.game_id = p_game_id
  group by participant.registration_id, game_period.period_number;

  if period_count > 4 then
    for checkpoint in 4..(period_count - 1)
    loop
      select
        coalesce(sum(score.points) filter(where score.registration_id = home_registration_id and score.period_number <= checkpoint),0),
        coalesce(sum(score.points) filter(where score.registration_id = away_registration_id and score.period_number <= checkpoint),0)
      into home_score, away_score
      from public.game_period_scores score where score.game_id = p_game_id;
      if home_score <> away_score then
        raise exception using errcode='BD206', message='BDB_UNNECESSARY_OVERTIME';
      end if;
    end loop;
  end if;
  select
    coalesce(sum(score.points) filter(where score.registration_id = home_registration_id),0),
    coalesce(sum(score.points) filter(where score.registration_id = away_registration_id),0)
  into home_score, away_score
  from public.game_period_scores score where score.game_id = p_game_id;
  if home_score = away_score then
    raise exception using errcode='BD208', message='BDB_FINAL_GAME_TIED';
  end if;

  return jsonb_build_object(
    'homeRegistrationId',home_registration_id,
    'awayRegistrationId',away_registration_id,
    'periodCount',period_count,
    'homeScore',home_score,
    'awayScore',away_score
  );
end;
$$;

revoke all on function private.write_manual_scoresheet_v2_game(bigint,bigint,jsonb)
from public, anon, authenticated;


create function public.admin_create_manual_scoresheet_v2(p_payload jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  submission_key uuid;
  competition_id bigint;
  round_id bigint;
  home_registration_id bigint;
  away_registration_id bigint;
  home_team jsonb;
  away_team jsonb;
  game_date date;
  game_time time;
  game_time_text text;
  scheduled_at timestamptz;
  normalized_venue text;
  normalized_game_number text;
  normalized_phase_round text;
  normalized_notes text;
  normalized_fallback_reason text := nullif(btrim(coalesce(p_payload ->> 'fallbackReason','')), '');
  canonical_payload jsonb;
  payload_hash text;
  existing_submission public.game_data_submissions;
  schedule_result jsonb;
  saved_game_id bigint;
  write_result jsonb;
  expected_primary_source text;
  submission_role text := 'primary';
  submission_id bigint;
  authority_domain text;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode='BD401', message='BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode='BD201', message='BDB_INVALID_SCORESHEET';
  end if;
  begin
    submission_key := (p_payload ->> 'idempotencyKey')::uuid;
    competition_id := (p_payload ->> 'competitionId')::bigint;
    round_id := nullif(p_payload ->> 'roundId','')::bigint;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode='BD203', message='BDB_INVALID_GAME_HEADER';
  end;
  if submission_key is null or competition_id is null or competition_id <= 0
    or jsonb_typeof(p_payload -> 'teams') <> 'array' or jsonb_array_length(p_payload -> 'teams') <> 2
    or jsonb_typeof(p_payload -> 'game') <> 'object'
  then
    raise exception using errcode='BD203', message='BDB_INVALID_GAME_HEADER';
  end if;

  select value into home_team from jsonb_array_elements(p_payload -> 'teams') where value ->> 'side' = 'home';
  select value into away_team from jsonb_array_elements(p_payload -> 'teams') where value ->> 'side' = 'away';
  begin
    home_registration_id := (home_team ->> 'registrationId')::bigint;
    away_registration_id := (away_team ->> 'registrationId')::bigint;
    game_date := (p_payload #>> '{game,date}')::date;
  exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then
    raise exception using errcode='BD203', message='BDB_INVALID_GAME_HEADER';
  end;
  game_time_text := nullif(btrim(coalesce(p_payload #>> '{game,time}','')), '');
  if game_time_text is not null then
    if game_time_text !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception using errcode='BD203', message='BDB_INVALID_GAME_HEADER';
    end if;
    game_time := game_time_text::time;
  end if;
  scheduled_at := ((game_date + coalesce(game_time, time '00:00'))::timestamp at time zone 'America/Sao_Paulo');
  normalized_venue := nullif(btrim(coalesce(p_payload #>> '{game,venue}','')), '');
  normalized_game_number := nullif(btrim(coalesce(p_payload #>> '{game,gameNumber}','')), '');
  normalized_phase_round := nullif(btrim(coalesce(p_payload #>> '{game,phaseRound}','')), '');
  normalized_notes := nullif(btrim(coalesce(p_payload #>> '{game,notes}','')), '');
  if game_date is null
    or home_registration_id is null or away_registration_id is null or home_registration_id = away_registration_id
    or char_length(normalized_venue) > 160 or char_length(normalized_game_number) > 40
    or char_length(normalized_phase_round) > 120 or char_length(normalized_notes) > 2000
  then
    raise exception using errcode='BD203', message='BDB_INVALID_GAME_HEADER';
  end if;

  canonical_payload := p_payload;
  payload_hash := md5(canonical_payload::text);
  perform pg_advisory_xact_lock(hashtextextended('manual-v2:' || submission_key::text, 2001));
  select submission.* into existing_submission
  from public.game_data_submissions submission
  where submission.source_type = 'manual_scoresheet' and submission.idempotency_key = submission_key::text;
  if found then
    if existing_submission.payload_hash = payload_hash then return existing_submission.game_id; end if;
    raise exception using errcode='BD209', message='BDB_IDEMPOTENCY_CONFLICT';
  end if;

  select profile.primary_source into expected_primary_source
  from public.competitions competition
  left join public.series_category_data_profiles profile on profile.id = competition.data_profile_id
  where competition.id = competition_id;
  if not found then
    raise exception using errcode='BD404', message='BDB_COMPETITION_NOT_FOUND';
  end if;
  if expected_primary_source = 'fiba_boxscore' then
    if normalized_fallback_reason is null or char_length(normalized_fallback_reason) not between 10 and 500 then
      raise exception using errcode='BD715', message='BDB_FALLBACK_REASON_REQUIRED';
    end if;
    submission_role := 'fallback';
  end if;

  schedule_result := public.admin_create_manual_matchup(
    submission_key, competition_id, round_id,
    home_registration_id, away_registration_id, scheduled_at, normalized_venue
  );
  saved_game_id := (schedule_result ->> 'gameId')::bigint;
  if saved_game_id is null then
    raise exception using errcode='BD203', message='BDB_INVALID_GAME_HEADER';
  end if;
  update public.games game
  set game_number = normalized_game_number,
      scheduled_at = scheduled_at,
      venue = normalized_venue
  where game.id = saved_game_id and game.competition_id = competition_id;

  write_result := private.write_manual_scoresheet_v2_game(saved_game_id, competition_id, canonical_payload);

  insert into public.manual_scoresheet_game_details(game_id, scheduled_date, scheduled_time, phase_round, notes)
  values(saved_game_id, game_date, game_time, normalized_phase_round, normalized_notes);

  update public.games game
  set status = 'final',
      started_at = coalesce(game.started_at, scheduled_at, now()),
      ended_at = coalesce(game.ended_at, scheduled_at + interval '2 hours', now()),
      source = 'manual',
      manual_idempotency_key = submission_key,
      manual_payload_hash = payload_hash,
      created_by = coalesce(game.created_by, auth.uid())
  where game.id = saved_game_id;

  insert into public.game_data_submissions(
    game_id, submission_version, source_type, role, status,
    payload_hash, idempotency_key, reason, submitted_by, submitted_at, validated_by, validated_at
  ) values(
    saved_game_id, 1, 'manual_scoresheet', submission_role, 'active',
    payload_hash, submission_key::text,
    case when submission_role='fallback' then normalized_fallback_reason else null end,
    auth.uid(), now(), auth.uid(), now()
  ) returning id into submission_id;

  insert into public.manual_scoresheet_submission_payloads(
    submission_id, game_id, payload, payload_hash, created_by
  ) values(submission_id, saved_game_id, canonical_payload, payload_hash, auth.uid());

  foreach authority_domain in array array[
    'official_result','period_scores','participation','player_scoring','player_foul_total','player_foul_timeline'
  ]::text[]
  loop
    perform private.activate_game_data_domain_authority(saved_game_id, authority_domain, submission_id, null, null);
  end loop;

  insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
  values('manual_scoresheet_saved','game',saved_game_id,jsonb_build_object(
    'competitionId',competition_id,
    'submissionId',submission_id,
    'periodCount',(write_result ->> 'periodCount')::integer,
    'homeScore',(write_result ->> 'homeScore')::integer,
    'awayScore',(write_result ->> 'awayScore')::integer,
    'foulRulesVersion','FIBA_2024'
  ));
  if submission_role = 'fallback' then
    insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
    values('manual_fallback_confirmed','game',saved_game_id,jsonb_build_object(
      'competitionId',competition_id,'submissionId',submission_id,'reasonProvided',true
    ));
  end if;
  return saved_game_id;
exception
  when unique_violation then
    raise exception using errcode='BD205', message='BDB_DUPLICATE_GAME_DATA';
end;
$$;

revoke all on function public.admin_create_manual_scoresheet_v2(jsonb) from public, anon, authenticated;
grant execute on function public.admin_create_manual_scoresheet_v2(jsonb) to authenticated;

comment on function public.admin_create_manual_scoresheet_v2(jsonb) is 'Creates matchup, game, semantic manual scoresheet, immutable submission snapshot and active domain authority in one transaction.';
