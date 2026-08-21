alter table public.games
  add column source text not null default 'manual',
  add column manual_idempotency_key uuid,
  add column manual_payload_hash text check (
    manual_payload_hash is null or manual_payload_hash ~ '^[0-9a-f]{32}$'
  ),
  add column created_by uuid references auth.users(id) on delete restrict
    deferrable initially immediate;

update public.games set source = 'seed';

alter table public.games
  add constraint games_source_check check (source in ('manual', 'boxscore', 'seed')),
  add constraint games_manual_idempotency_unique unique (manual_idempotency_key),
  add constraint games_manual_submission_consistent check (
    (source = 'manual' and manual_idempotency_key is not null and
      manual_payload_hash is not null and created_by is not null) or
    (source in ('boxscore', 'seed') and manual_idempotency_key is null and
      manual_payload_hash is null)
  );

alter table public.game_roster_slots
  add column disqualified_at_period smallint check (disqualified_at_period > 0),
  add column disqualification_reason text check (
    disqualification_reason in ('D', '2T', '2U', 'T+U')
  ),
  add constraint game_roster_slots_disqualification_consistent check (
    (disqualified_at_period is null and disqualification_reason is null) or
    (disqualified_at_period is not null and disqualification_reason is not null)
  );

alter table public.admin_mutation_audit
  drop constraint admin_mutation_audit_action_check,
  add constraint admin_mutation_audit_action_check check (
    action in (
      'registration_created',
      'registration_transitioned',
      'roster_replaced',
      'manual_scoresheet_saved'
    )
  );

create or replace view public.manual_scoresheet_prefill
with (security_invoker = true)
as
select
  registration.competition_id,
  registration.id as registration_id,
  latest.game_id,
  slot.slot_number,
  slot.roster_entry_id,
  slot.jersey_number
from public.team_registrations registration
join lateral (
  select participant.game_id
  from public.game_participants participant
  join public.games game on game.id = participant.game_id
  where participant.registration_id = registration.id
    and game.competition_id = registration.competition_id
    and game.status = 'final'
  order by game.scheduled_at desc nulls last, game.id desc
  limit 1
) latest on true
join public.game_roster_slots slot
  on slot.game_id = latest.game_id
  and slot.registration_id = registration.id
  and slot.is_applicable
join public.roster_entries roster
  on roster.id = slot.roster_entry_id
  and roster.registration_id = registration.id
  and roster.status = 'active';

revoke all on public.manual_scoresheet_prefill from public, anon, authenticated;
grant select on public.manual_scoresheet_prefill to authenticated;

create or replace function public.admin_create_manual_scoresheet(p_payload jsonb)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_variable
declare
  submission_key uuid;
  payload_hash text;
  competition_id bigint;
  scheduled_local timestamp;
  scheduled_instant timestamptz;
  game_number text;
  venue text;
  created_game_id bigint;
  existing_game_id bigint;
  existing_hash text;
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
  slot_record record;
  foul_record record;
  technical_count integer;
  unsportsmanlike_count integer;
  dq_period smallint;
  dq_sequence smallint;
  dq_reason text;
  home_score integer;
  away_score integer;
  checkpoint smallint;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = 'BD201', message = 'BDB_INVALID_SCORESHEET';
  end if;

  begin
    submission_key := (p_payload ->> 'idempotencyKey')::uuid;
    competition_id := (p_payload ->> 'competitionId')::bigint;
    scheduled_local := (p_payload ->> 'scheduledLocal')::timestamp;
  exception when invalid_text_representation or datetime_field_overflow then
    raise exception using errcode = 'BD203', message = 'BDB_INVALID_GAME_HEADER';
  end;

  if competition_id <= 0 or submission_key is null or scheduled_local is null then
    raise exception using errcode = 'BD203', message = 'BDB_INVALID_GAME_HEADER';
  end if;

  scheduled_instant := scheduled_local at time zone 'America/Sao_Paulo';
  game_number := nullif(btrim(p_payload ->> 'gameNumber'), '');
  venue := btrim(coalesce(p_payload ->> 'venue', ''));
  if venue = '' or char_length(venue) > 160 or
    (game_number is not null and char_length(game_number) > 40)
  then
    raise exception using errcode = 'BD203', message = 'BDB_INVALID_GAME_HEADER';
  end if;

  if not exists (
    select 1 from public.competitions competition
    where competition.id = competition_id and competition.status = 'published'
  ) then
    raise exception using errcode = 'BD202', message = 'BDB_INVALID_COMPETITION';
  end if;

  payload_hash := md5(p_payload::text);
  perform pg_advisory_xact_lock(hashtextextended(submission_key::text, 0));
  select game.id, game.manual_payload_hash
  into existing_game_id, existing_hash
  from public.games game
  where game.manual_idempotency_key = submission_key;

  if existing_game_id is not null then
    if existing_hash = payload_hash then
      return existing_game_id;
    end if;
    raise exception using errcode = 'BD209', message = 'BDB_IDEMPOTENCY_CONFLICT';
  end if;

  if jsonb_typeof(p_payload -> 'teams') <> 'array' or
    jsonb_array_length(p_payload -> 'teams') <> 2
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

  insert into public.games (
    competition_id,
    game_number,
    scheduled_at,
    venue,
    status,
    started_at,
    ended_at,
    source,
    manual_idempotency_key,
    manual_payload_hash,
    created_by
  )
  values (
    competition_id,
    game_number,
    scheduled_instant,
    venue,
    'final',
    scheduled_instant,
    scheduled_instant + interval '2 hours',
    'manual',
    submission_key,
    payload_hash,
    auth.uid()
  )
  returning id into created_game_id;

  for team in select value from jsonb_array_elements(p_payload -> 'teams')
  loop
    begin
      side := team ->> 'side';
      registration_id := (team ->> 'registrationId')::bigint;
    exception when invalid_text_representation then
      raise exception using errcode = 'BD202', message = 'BDB_INVALID_PARTICIPANTS';
    end;

    if side not in ('home', 'away') or registration_id <= 0 or
      jsonb_typeof(team -> 'slots') <> 'array' or
      jsonb_array_length(team -> 'slots') < 1 or
      jsonb_array_length(team -> 'slots') > 12 or
      not exists (
        select 1 from public.team_registrations registration
        where registration.id = registration_id
          and registration.competition_id = competition_id
          and registration.status = 'confirmed'
      )
    then
      raise exception using errcode = 'BD202', message = 'BDB_INVALID_PARTICIPANTS';
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

    insert into public.game_participants (game_id, competition_id, registration_id, side)
    values (created_game_id, competition_id, registration_id, side);

    for slot in select value from jsonb_array_elements(team -> 'slots')
    loop
      begin
        slot_number := (slot ->> 'slotNumber')::smallint;
        roster_entry_id := (slot ->> 'rosterEntryId')::bigint;
      exception when invalid_text_representation or numeric_value_out_of_range then
        raise exception using errcode = 'BD204', message = 'BDB_INVALID_SLOT';
      end;
      jersey_number := slot ->> 'jerseyNumber';

      if slot_number not between 1 and 12 or roster_entry_id <= 0 or
        jersey_number is null or jersey_number !~ '^(?:0|00|[1-9][0-9]?)$' or
        not exists (
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
          created_game_id, registration_id, slot_number, roster_entry_id, jersey_number
        );
      exception when unique_violation then
        raise exception using errcode = 'BD205', message = 'BDB_DUPLICATE_PLAYER_OR_JERSEY';
      end;
    end loop;
  end loop;

  if home_registration_id is null or away_registration_id is null or
    home_registration_id = away_registration_id
  then
    raise exception using errcode = 'BD202', message = 'BDB_INVALID_PARTICIPANTS';
  end if;

  select count(*) into slot_count
  from public.game_roster_slots game_slot
  where game_slot.game_id = created_game_id;

  for period in select value from jsonb_array_elements(p_payload -> 'periods')
  loop
    begin
      period_number := (period ->> 'periodNumber')::smallint;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode = 'BD206', message = 'BDB_INVALID_PERIODS';
    end;

    if period_number <> expected_period or jsonb_typeof(period -> 'stats') <> 'array' or
      jsonb_array_length(period -> 'stats') <> slot_count
    then
      raise exception using errcode = 'BD206', message = 'BDB_INVALID_PERIODS';
    end if;
    expected_period := expected_period + 1;
    insert into public.game_periods (game_id, period_number)
    values (created_game_id, period_number);

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
      where game_slot.game_id = created_game_id
        and game_slot.roster_entry_id = roster_entry_id;

      if slot_id is null or made_two not between 0 and 99 or
        made_three not between 0 and 99 or made_free not between 0 and 99 or
        jsonb_typeof(fouls) <> 'array' or jsonb_array_length(fouls) > 20
      then
        raise exception using errcode = 'BD206', message = 'BDB_INVALID_STATS';
      end if;

      begin
        insert into public.player_period_stats (
          game_roster_slot_id,
          game_id,
          period_number,
          two_point_made,
          two_point_attempted,
          three_point_made,
          three_point_attempted,
          free_throw_made,
          free_throw_attempted
        ) values (
          slot_id,
          created_game_id,
          period_number,
          made_two,
          made_two,
          made_three,
          made_three,
          made_free,
          made_free
        );
      exception when unique_violation then
        raise exception using errcode = 'BD206', message = 'BDB_DUPLICATE_PERIOD_STATS';
      end;

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
          slot_id, created_game_id, period_number, foul_sequence, foul_code
        );
      end loop;
    end loop;
  end loop;

  for slot_record in
    select game_slot.id
    from public.game_roster_slots game_slot
    where game_slot.game_id = created_game_id
  loop
    technical_count := 0;
    unsportsmanlike_count := 0;
    dq_period := null;
    dq_sequence := null;
    dq_reason := null;

    for foul_record in
      select foul.period_number, foul.sequence_number, foul.foul_code
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

      if dq_reason is not null then
        dq_period := foul_record.period_number;
        dq_sequence := foul_record.sequence_number;
      end if;
    end loop;

    if dq_period is not null then
      if exists (
        select 1 from public.player_period_stats player_stat
        where player_stat.game_roster_slot_id = slot_record.id
          and player_stat.period_number > dq_period
          and (
            player_stat.two_point_made > 0 or
            player_stat.three_point_made > 0 or
            player_stat.free_throw_made > 0
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
    created_game_id,
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
  where participant.game_id = created_game_id and game_period.game_id = created_game_id
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
      where score.game_id = created_game_id;

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
  where score.game_id = created_game_id;

  if home_score = away_score then
    raise exception using errcode = 'BD208', message = 'BDB_FINAL_GAME_TIED';
  end if;

  insert into public.admin_mutation_audit (action, entity_type, entity_id, metadata)
  values (
    'manual_scoresheet_saved',
    'team_registration',
    home_registration_id,
    jsonb_build_object(
      'gameId', created_game_id,
      'competitionId', competition_id,
      'periodCount', period_count,
      'homeScore', home_score,
      'awayScore', away_score
    )
  );

  return created_game_id;
exception
  when unique_violation then
    raise exception using errcode = 'BD205', message = 'BDB_DUPLICATE_GAME_DATA';
end;
$$;

revoke execute on function public.admin_create_manual_scoresheet(jsonb) from public, anon;
grant execute on function public.admin_create_manual_scoresheet(jsonb) to authenticated;

comment on view public.manual_scoresheet_prefill is
  'Latest final lineup per registration, filtered through base-table RLS and the current active roster.';
comment on function public.admin_create_manual_scoresheet(jsonb) is
  'Creates and finalizes one complete manual scoresheet atomically, idempotently and only for the singleton admin in aal2.';
