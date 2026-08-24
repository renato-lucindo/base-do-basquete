-- WP-14: persist the supported FIBA/Genius team metrics and allow reviewed,
-- atomic player creation/roster attachment during boxscore confirmation.

create table public.game_team_statistics (
  game_id bigint not null,
  registration_id bigint not null,
  points_from_turnovers smallint not null check (points_from_turnovers >= 0),
  points_in_paint smallint not null check (points_in_paint >= 0),
  points_in_paint_made smallint not null check (points_in_paint_made >= 0),
  points_in_paint_attempted smallint not null check (
    points_in_paint_attempted >= 0 and points_in_paint_made <= points_in_paint_attempted
  ),
  second_chance_points smallint not null check (second_chance_points >= 0),
  fast_break_points smallint not null check (fast_break_points >= 0),
  fast_break_points_from_turnovers smallint not null check (
    fast_break_points_from_turnovers >= 0 and
    fast_break_points_from_turnovers <= fast_break_points
  ),
  bench_points smallint not null check (bench_points >= 0),
  largest_lead smallint not null check (largest_lead >= 0),
  largest_scoring_run smallint not null check (largest_scoring_run >= 0),
  points_per_possession numeric(4,2) not null check (
    points_per_possession >= 0 and points_per_possession <= 10
  ),
  time_leading_seconds integer not null check (time_leading_seconds >= 0),
  source_parser_version text not null check (
    source_parser_version = btrim(source_parser_version) and
    char_length(source_parser_version) between 1 and 40
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (game_id, registration_id),
  constraint game_team_statistics_participant_fkey
    foreign key (game_id, registration_id)
    references public.game_participants(game_id, registration_id) on delete restrict,
  constraint game_team_statistics_paint_consistent check (
    points_in_paint = points_in_paint_made * 2
  )
);

create table public.game_statistics (
  game_id bigint primary key references public.games(id) on delete restrict,
  lead_changes smallint not null check (lead_changes >= 0),
  times_tied smallint not null check (times_tied >= 0),
  source_parser_version text not null check (
    source_parser_version = btrim(source_parser_version) and
    char_length(source_parser_version) between 1 and 40
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger game_team_statistics_set_updated_at
before update on public.game_team_statistics
for each row execute function private.set_updated_at();

create trigger game_statistics_set_updated_at
before update on public.game_statistics
for each row execute function private.set_updated_at();

alter table public.game_team_statistics enable row level security;
alter table public.game_team_statistics force row level security;
alter table public.game_statistics enable row level security;
alter table public.game_statistics force row level security;

create policy game_team_statistics_admin_select
on public.game_team_statistics for select to authenticated
using ((select public.is_current_admin_aal2()));

create policy game_statistics_admin_select
on public.game_statistics for select to authenticated
using ((select public.is_current_admin_aal2()));

create policy game_team_statistics_public_select
on public.game_team_statistics for select to anon
using (exists (
  select 1 from public.games game
  where game.id = game_id and game.status in ('scheduled', 'live', 'final')
));

create policy game_statistics_public_select
on public.game_statistics for select to anon
using (exists (
  select 1 from public.games game
  where game.id = game_id and game.status in ('scheduled', 'live', 'final')
));

revoke all on public.game_team_statistics, public.game_statistics
from public, anon, authenticated;
grant select on public.game_team_statistics, public.game_statistics to anon, authenticated;

alter table public.boxscore_import_player_matches
  add column suggested_player_id bigint references public.players(id) on delete restrict,
  add column suggestion_payload jsonb not null default '[]'::jsonb check (
    jsonb_typeof(suggestion_payload) = 'array' and jsonb_array_length(suggestion_payload) <= 3
  ),
  add column resolution_kind text check (
    resolution_kind is null or
    resolution_kind in ('existing_roster', 'added_existing', 'created_new')
  );

create index boxscore_import_matches_suggested_player_idx
  on public.boxscore_import_player_matches (suggested_player_id)
  where suggested_player_id is not null;

alter table public.admin_mutation_audit
  drop constraint admin_mutation_audit_action_check,
  add constraint admin_mutation_audit_action_check check (
    action in (
      'registration_created',
      'registration_transitioned',
      'roster_replaced',
      'manual_scoresheet_saved',
      'boxscore_import_confirmed',
      'boxscore_team_stats_refreshed',
      'final_placement_confirmed'
    )
  );

create function private.normalize_person_name(value text)
returns text
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select btrim(regexp_replace(
    translate(
      lower(value),
      'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
      'aaaaaaeeeeiiiiooooouuuucnyy'
    ),
    '[^a-z0-9]+',
    ' ',
    'g'
  ));
$$;

create function private.slugify_person_name(value text)
returns text
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(
    translate(
      lower(value),
      'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
      'aaaaaaeeeeiiiiooooouuuucnyy'
    ),
    '[^a-z0-9]+',
    '-',
    'g'
  ));
$$;

create function private.upsert_boxscore_statistics(
  p_game_id bigint,
  p_parser_version text,
  p_parsed jsonb
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

  for team in select value from jsonb_array_elements(p_parsed -> 'teams')
  loop
    statistics := team -> 'teamStatistics';
    if jsonb_typeof(statistics) <> 'object' or
      jsonb_typeof(team -> 'periodScores') <> 'array' or
      jsonb_array_length(team -> 'periodScores') <> period_count
    then
      raise exception using errcode = 'BD310', message = 'BDB_PDF_TEAM_STATS_INVALID';
    end if;

    select participant.registration_id into resolved_registration_id
    from public.game_participants participant
    join public.team_registrations registration on registration.id = participant.registration_id
    join public.teams selected_team on selected_team.id = registration.team_id
    where participant.game_id = p_game_id
      and (
        lower(selected_team.name) = lower(team ->> 'name') or
        upper(coalesce(selected_team.abbreviation, '')) = upper(team ->> 'abbreviation')
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

create or replace function private.admin_create_boxscore_import_draft_impl(
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
  candidate_player_id bigint;
  player_count integer;
  suggestions jsonb;
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
    p_parser_version not in ('fiba-genius-v1', 'fiba-genius-v2') or
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
      candidate_player_id := nullif(source_match ->> 'playerId', '')::bigint;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode = 'BD302', message = 'BDB_PDF_MATCH_INVALID';
    end;
    if candidate_roster_id is not null and candidate_player_id is null then
      select roster.player_id into candidate_player_id
      from public.roster_entries roster
      where roster.id = candidate_roster_id
        and roster.competition_id = p_competition_id
        and roster.status = 'active';
    end if;
    suggestions := coalesce(source_match -> 'alternatives', '[]'::jsonb);
    if coalesce(source_match ->> 'sourceTeamName', '') = '' or
      coalesce(source_match ->> 'sourcePlayerName', '') = '' or
      coalesce(source_match ->> 'sourceJersey', '') !~ '^(?:0|00|[1-9][0-9]?)$' or
      coalesce(source_match ->> 'kind', '') not in ('exact', 'similar', 'unmatched') or
      jsonb_typeof(suggestions) <> 'array' or jsonb_array_length(suggestions) > 3 or
      not exists (
        select 1
        from jsonb_array_elements(p_parsed_payload -> 'teams') as source_team(team),
          jsonb_array_elements(team -> 'players') as source_player(player)
        where team ->> 'name' = source_match ->> 'sourceTeamName'
          and player ->> 'name' = source_match ->> 'sourcePlayerName'
          and player ->> 'jerseyNumber' = source_match ->> 'sourceJersey'
      ) or
      (candidate_player_id is not null and not exists (
        select 1 from public.players player
        where player.id = candidate_player_id and player.is_active
      )) or
      (candidate_roster_id is not null and not exists (
        select 1 from public.roster_entries roster
        where roster.id = candidate_roster_id
          and roster.competition_id = p_competition_id
          and roster.player_id = candidate_player_id
          and roster.status = 'active'
      ))
    then
      raise exception using errcode = 'BD302', message = 'BDB_PDF_MATCH_INVALID';
    end if;

    insert into public.boxscore_import_player_matches (
      import_id, competition_id, source_team_name, source_player_name,
      source_jersey_number, roster_entry_id, suggested_player_id, suggestion_payload,
      status, suggestion_kind, similarity_score
    ) values (
      created_import_id,
      p_competition_id,
      source_match ->> 'sourceTeamName',
      source_match ->> 'sourcePlayerName',
      source_match ->> 'sourceJersey',
      candidate_roster_id,
      candidate_player_id,
      suggestions,
      case when candidate_player_id is null then 'unmatched' else 'suggested' end,
      source_match ->> 'kind',
      nullif(source_match ->> 'score', '')::numeric
    );
  end loop;

  return created_import_id;
exception when unique_violation then
  raise exception using errcode = 'BD309', message = 'BDB_PDF_DUPLICATE';
end;
$$;

create or replace function private.admin_commit_boxscore_import_impl(
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
      and (
        lower(selected_team.name) = lower(team ->> 'name') or
        upper(coalesce(selected_team.abbreviation, '')) = upper(team ->> 'abbreviation')
      )
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
      and (lower(selected_team.name) = lower(team ->> 'name') or
        upper(coalesce(selected_team.abbreviation, '')) = upper(team ->> 'abbreviation'));
    if actual_score is distinct from expected_score then
      raise exception using errcode = 'BD307', message = 'BDB_PDF_SCORE_MISMATCH';
    end if;
  end loop;

  if import_record.parser_version = 'fiba-genius-v2' then
    perform private.upsert_boxscore_statistics(created_game_id, import_record.parser_version, parsed);
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

create function private.admin_refresh_boxscore_team_statistics_impl(
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

  perform private.upsert_boxscore_statistics(
    import_record.game_id,
    'fiba-genius-v2',
    p_parsed_payload
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

create function public.admin_refresh_boxscore_team_statistics(
  p_import_id bigint,
  p_parsed_payload jsonb,
  p_validation_payload jsonb
)
returns bigint
language sql
security invoker
set search_path = ''
as $$
  select private.admin_refresh_boxscore_team_statistics_impl(
    p_import_id,
    p_parsed_payload,
    p_validation_payload
  );
$$;

revoke all on function private.normalize_person_name(text) from public, anon, authenticated;
revoke all on function private.slugify_person_name(text) from public, anon, authenticated;
revoke all on function private.upsert_boxscore_statistics(bigint, text, jsonb)
  from public, anon, authenticated;
revoke all on function private.admin_refresh_boxscore_team_statistics_impl(bigint, jsonb, jsonb)
  from public, anon;
grant execute on function private.admin_refresh_boxscore_team_statistics_impl(bigint, jsonb, jsonb)
  to authenticated;

revoke all on function public.admin_refresh_boxscore_team_statistics(bigint, jsonb, jsonb)
  from public, anon;
grant execute on function public.admin_refresh_boxscore_team_statistics(bigint, jsonb, jsonb)
  to authenticated;

comment on table public.game_team_statistics is
  'Team-level FIBA/Genius metrics parsed from the supported boxscore PDF.';
comment on table public.game_statistics is
  'Game-level lead-change and tie metrics parsed from the supported boxscore PDF.';
comment on function public.admin_refresh_boxscore_team_statistics(bigint, jsonb, jsonb) is
  'Reprocesses a confirmed private PDF with parser v2 and atomically upserts only its collective metrics.';
