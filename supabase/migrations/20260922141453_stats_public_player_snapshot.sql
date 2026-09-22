-- STATS-01: immutable public player-statistics snapshots for published boxscore editions.

alter table public.player_period_stats
  add column fouls_received smallint
  constraint player_period_stats_fouls_received_check
  check (fouls_received is null or fouls_received >= 0);

create function private.boxscore_fouls_received_for_slot(
  p_game_id bigint,
  p_roster_entry_id bigint,
  p_jersey_number text
)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select (source_player.player ->> 'foulsReceived')::smallint
  from public.boxscore_imports import_item
  join public.boxscore_import_player_matches player_match
    on player_match.import_id = import_item.id
   and player_match.roster_entry_id = p_roster_entry_id
   and player_match.source_jersey_number = p_jersey_number
  join public.game_data_submissions submission
    on submission.game_id = import_item.game_id
   and submission.source_type = 'fiba_boxscore'
   and submission.status = 'active'
   and submission.idempotency_key = 'boxscore-import:' || import_item.id::text
  join public.game_data_domain_authority authority
    on authority.game_id = submission.game_id
   and authority.domain = 'player_advanced'
   and authority.submission_id = submission.id
  cross join lateral jsonb_array_elements(import_item.parsed_payload -> 'teams') source_team(team)
  cross join lateral jsonb_array_elements(source_team.team -> 'players') source_player(player)
  where import_item.game_id = p_game_id
    and import_item.status = 'confirmed'
    and source_team.team ->> 'name' = player_match.source_team_name
    and source_player.player ->> 'name' = player_match.source_player_name
    and source_player.player ->> 'jerseyNumber' = player_match.source_jersey_number
    and jsonb_typeof(source_player.player -> 'foulsReceived') = 'number'
  order by import_item.confirmed_at desc nulls last, import_item.id desc
  limit 1;
$$;

revoke all on function private.boxscore_fouls_received_for_slot(bigint,bigint,text)
from public, anon, authenticated;

create function private.hydrate_player_period_fouls_received()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  roster_entry_id bigint;
  jersey_number text;
begin
  if new.fouls_received is not null then
    return new;
  end if;
  select slot.roster_entry_id, slot.jersey_number
  into roster_entry_id, jersey_number
  from public.game_roster_slots slot
  where slot.id = new.game_roster_slot_id and slot.game_id = new.game_id;
  if roster_entry_id is not null and jersey_number is not null then
    new.fouls_received := private.boxscore_fouls_received_for_slot(
      new.game_id, roster_entry_id, jersey_number
    );
  end if;
  return new;
end;
$$;

revoke all on function private.hydrate_player_period_fouls_received()
from public, anon, authenticated;

create trigger player_period_stats_hydrate_fouls_received
before insert on public.player_period_stats
for each row execute function private.hydrate_player_period_fouls_received();

create function private.project_game_boxscore_fouls_received(p_game_id bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.player_period_stats stat
  set fouls_received = private.boxscore_fouls_received_for_slot(
    stat.game_id, slot.roster_entry_id, slot.jersey_number
  )
  from public.game_roster_slots slot
  where stat.game_id = p_game_id
    and slot.id = stat.game_roster_slot_id
    and slot.roster_entry_id is not null
    and slot.jersey_number is not null
    and private.boxscore_fouls_received_for_slot(
      stat.game_id, slot.roster_entry_id, slot.jersey_number
    ) is not null;
$$;

revoke all on function private.project_game_boxscore_fouls_received(bigint)
from public, anon, authenticated;

create function private.project_confirmed_boxscore_fouls_received()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'confirmed' and new.game_id is not null
    and (old.status is distinct from new.status or old.game_id is distinct from new.game_id)
  then
    perform private.project_game_boxscore_fouls_received(new.game_id);
  end if;
  return new;
end;
$$;

revoke all on function private.project_confirmed_boxscore_fouls_received()
from public, anon, authenticated;

create trigger boxscore_imports_project_fouls_received
after update of status, game_id on public.boxscore_imports
for each row execute function private.project_confirmed_boxscore_fouls_received();

create function private.project_authoritative_boxscore_fouls_received()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.domain = 'player_advanced' then
    perform private.project_game_boxscore_fouls_received(new.game_id);
  end if;
  return new;
end;
$$;

revoke all on function private.project_authoritative_boxscore_fouls_received()
from public, anon, authenticated;

create trigger game_data_domain_authority_project_fouls_received
after insert or update of submission_id on public.game_data_domain_authority
for each row execute function private.project_authoritative_boxscore_fouls_received();

-- Safe historical projection: immutable confirmed parser payloads are the source.
update public.player_period_stats stat
set fouls_received = private.boxscore_fouls_received_for_slot(
  stat.game_id, slot.roster_entry_id, slot.jersey_number
)
from public.game_roster_slots slot
where slot.id = stat.game_roster_slot_id
  and slot.roster_entry_id is not null
  and slot.jersey_number is not null
  and stat.fouls_received is null
  and private.boxscore_fouls_received_for_slot(
    stat.game_id, slot.roster_entry_id, slot.jersey_number
  ) is not null;

create table public.competition_publication_statistics (
  publication_id bigint not null,
  competition_id bigint not null,
  data_profile_id bigint not null,
  data_profile_version integer not null check (data_profile_version > 0),
  primary_source text not null check (primary_source = 'fiba_boxscore'),
  statistics_contract text not null default 'boxscore'
    check (statistics_contract = 'boxscore'),
  schema_version integer not null default 1 check (schema_version = 1),
  per_30_minimum_seconds integer not null default 600
    check (per_30_minimum_seconds = 600),
  source_fingerprint text not null check (source_fingerprint ~ '^[0-9a-f]{32}$'),
  snapshot_kind text not null default 'publication'
    check (snapshot_kind in ('publication', 'migration_backfill')),
  regular_games bigint not null check (regular_games >= 0),
  playoff_games bigint not null check (playoff_games >= 0),
  unclassified_games bigint not null check (unclassified_games >= 0),
  created_at timestamptz not null default now(),
  primary key (publication_id),
  unique (publication_id, competition_id),
  constraint competition_publication_statistics_publication_fkey
    foreign key (publication_id, competition_id)
    references public.competition_publications(id, competition_id) on delete restrict,
  constraint competition_publication_statistics_profile_fkey
    foreign key (data_profile_id) references public.series_category_data_profiles(id)
    on delete restrict
);

create index competition_publication_statistics_competition_idx
on public.competition_publication_statistics (competition_id, publication_id);

alter table public.competition_publication_statistics enable row level security;
alter table public.competition_publication_statistics force row level security;
revoke all on public.competition_publication_statistics from public, anon, authenticated;
grant select on public.competition_publication_statistics to anon, authenticated;

create policy competition_publication_statistics_public_current_select
on public.competition_publication_statistics
for select to anon, authenticated
using (exists (
  select 1
  from public.competitions competition
  where competition.id = competition_publication_statistics.competition_id
    and competition.current_publication_id = competition_publication_statistics.publication_id
    and competition.status in ('published', 'archived')
));

create policy competition_publication_statistics_admin_select
on public.competition_publication_statistics
for select to authenticated
using ((select private.is_admin_aal2()));

create table public.competition_player_statistics_publications (
  publication_id bigint not null,
  competition_id bigint not null,
  data_profile_id bigint not null,
  statistics_contract text not null default 'boxscore'
    check (statistics_contract = 'boxscore'),
  scope text not null check (scope in ('regular', 'playoffs', 'all')),
  registration_id bigint not null,
  team_id bigint not null,
  team_name text not null,
  team_slug text not null,
  team_abbreviation text,
  player_id bigint not null,
  player_name text not null,
  player_slug text not null,
  jersey_number text,
  jersey_varies boolean not null,
  games_played bigint not null check (games_played > 0),
  scoring_games_covered bigint not null check (
    scoring_games_covered between 0 and games_played
  ),
  advanced_games_covered bigint not null check (
    advanced_games_covered between 0 and games_played
  ),
  foul_games_covered bigint not null check (
    foul_games_covered between 0 and games_played
  ),
  fouls_received_games_covered bigint not null check (
    fouls_received_games_covered between 0 and games_played
  ),
  seconds_covered bigint check (seconds_covered is null or seconds_covered >= 0),
  official_points bigint check (official_points is null or official_points >= 0),
  advanced_points bigint check (advanced_points is null or advanced_points >= 0),
  two_point_made bigint check (two_point_made is null or two_point_made >= 0),
  two_point_attempted bigint check (
    two_point_attempted is null or two_point_attempted >= 0
  ),
  three_point_made bigint check (three_point_made is null or three_point_made >= 0),
  three_point_attempted bigint check (
    three_point_attempted is null or three_point_attempted >= 0
  ),
  free_throw_made bigint check (free_throw_made is null or free_throw_made >= 0),
  free_throw_attempted bigint check (
    free_throw_attempted is null or free_throw_attempted >= 0
  ),
  offensive_rebounds bigint check (
    offensive_rebounds is null or offensive_rebounds >= 0
  ),
  defensive_rebounds bigint check (
    defensive_rebounds is null or defensive_rebounds >= 0
  ),
  assists bigint check (assists is null or assists >= 0),
  turnovers bigint check (turnovers is null or turnovers >= 0),
  steals bigint check (steals is null or steals >= 0),
  blocks bigint check (blocks is null or blocks >= 0),
  fouls_committed bigint check (fouls_committed is null or fouls_committed >= 0),
  fouls_received bigint check (fouls_received is null or fouls_received >= 0),
  plus_minus bigint,
  regular_games bigint not null check (regular_games >= 0),
  playoff_games bigint not null check (playoff_games >= 0),
  unclassified_games bigint not null check (unclassified_games >= 0),
  per_30_minimum_seconds integer not null default 600
    check (per_30_minimum_seconds = 600),
  created_at timestamptz not null default now(),
  primary key (publication_id, scope, registration_id, player_id),
  constraint competition_player_stats_publication_fkey
    foreign key (publication_id, competition_id)
    references public.competition_publication_statistics(publication_id, competition_id)
    on delete restrict,
  constraint competition_player_stats_profile_fkey
    foreign key (data_profile_id) references public.series_category_data_profiles(id)
    on delete restrict,
  constraint competition_player_stats_registration_fkey
    foreign key (registration_id, competition_id)
    references public.team_registrations(id, competition_id) on delete restrict,
  constraint competition_player_stats_team_fkey
    foreign key (team_id) references public.teams(id) on delete restrict,
  constraint competition_player_stats_player_fkey
    foreign key (player_id) references public.players(id) on delete restrict,
  constraint competition_player_stats_scope_counts_check check (
    regular_games + playoff_games + unclassified_games = games_played
  )
);

create index competition_player_stats_current_lookup_idx
on public.competition_player_statistics_publications (
  competition_id, publication_id, scope, official_points desc, player_name, player_id
);

alter table public.competition_player_statistics_publications enable row level security;
alter table public.competition_player_statistics_publications force row level security;
revoke all on public.competition_player_statistics_publications
from public, anon, authenticated;
grant select on public.competition_player_statistics_publications to anon, authenticated;

create policy competition_player_stats_public_current_select
on public.competition_player_statistics_publications
for select to anon, authenticated
using (exists (
  select 1
  from public.competitions competition
  where competition.id = competition_player_statistics_publications.competition_id
    and competition.current_publication_id =
      competition_player_statistics_publications.publication_id
    and competition.status in ('published', 'archived')
));

create policy competition_player_stats_admin_select
on public.competition_player_statistics_publications
for select to authenticated
using ((select private.is_admin_aal2()));

create function private.prevent_statistics_publication_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using errcode = 'BD409', message = 'BDB_STATISTICS_PUBLICATION_IMMUTABLE';
end;
$$;

revoke all on function private.prevent_statistics_publication_mutation()
from public, anon, authenticated;

create trigger competition_player_statistics_publications_immutable
before update or delete on public.competition_player_statistics_publications
for each row execute function private.prevent_statistics_publication_mutation();

create trigger competition_publication_statistics_immutable
before update or delete on public.competition_publication_statistics
for each row execute function private.prevent_statistics_publication_mutation();

create function private.competition_boxscore_statistics_fingerprint(p_competition_id bigint)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select md5(coalesce(jsonb_agg(to_jsonb(source_row) order by source_row.game_id,
    source_row.game_roster_slot_id)::text, '[]'))
  from (
    select
      game_stats.*,
      coalesce(stage.stage_kind, 'legacy_unclassified') as stage_kind,
      stat.fouls_received
    from public.game_boxscore_player_statistics game_stats
    join public.games game on game.id = game_stats.game_id
    left join public.matchups matchup on matchup.id = game.matchup_id
    left join public.competition_rounds round_item on round_item.id = matchup.round_id
    left join public.competition_stages stage on stage.id = round_item.stage_id
    left join public.player_period_stats stat
      on stat.game_id = game_stats.game_id
     and stat.game_roster_slot_id = game_stats.game_roster_slot_id
     and stat.stat_scope = 'game_total'
    where game_stats.competition_id = p_competition_id
  ) source_row;
$$;

revoke all on function private.competition_boxscore_statistics_fingerprint(bigint)
from public, anon, authenticated;

create function private.snapshot_competition_player_statistics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.competition_publication_statistics (
    publication_id, competition_id, data_profile_id, data_profile_version,
    primary_source, source_fingerprint, regular_games, playoff_games,
    unclassified_games
  )
  select
    new.id, competition.id, profile.id, profile.version,
    profile.primary_source,
    private.competition_boxscore_statistics_fingerprint(competition.id),
    count(distinct game.id) filter (where stage.stage_kind = 'round_robin')::bigint,
    count(distinct game.id) filter (where stage.stage_kind = 'knockout')::bigint,
    count(distinct game.id) filter (
      where stage.stage_kind is null or stage.stage_kind not in ('round_robin', 'knockout')
    )::bigint
  from public.competitions competition
  join public.series_category_data_profiles profile
    on profile.id = competition.data_profile_id
   and profile.primary_source = 'fiba_boxscore'
   and profile.status = 'active'
  left join public.games game
    on game.competition_id = competition.id and game.status = 'final'
  left join public.matchups matchup on matchup.id = game.matchup_id
  left join public.competition_rounds round_item on round_item.id = matchup.round_id
  left join public.competition_stages stage on stage.id = round_item.stage_id
  where competition.id = new.competition_id
    and not competition.data_profile_review_required
  group by competition.id, profile.id, profile.version, profile.primary_source;

  insert into public.competition_player_statistics_publications (
    publication_id, competition_id, data_profile_id, scope,
    registration_id, team_id, team_name, team_slug, team_abbreviation,
    player_id, player_name, player_slug, jersey_number, jersey_varies,
    games_played, scoring_games_covered, advanced_games_covered,
    foul_games_covered, fouls_received_games_covered, seconds_covered,
    official_points, advanced_points, two_point_made, two_point_attempted,
    three_point_made, three_point_attempted, free_throw_made,
    free_throw_attempted, offensive_rebounds, defensive_rebounds,
    assists, turnovers, steals, blocks, fouls_committed, fouls_received,
    plus_minus, regular_games, playoff_games, unclassified_games
  )
  with eligible_games as (
    select
      game_stats.*,
      competition.data_profile_id,
      case
        when stage.stage_kind = 'round_robin' then 'regular'
        when stage.stage_kind = 'knockout' then 'playoffs'
        else 'unclassified'
      end as structural_scope,
      stat.fouls_received
    from public.game_boxscore_player_statistics game_stats
    join public.games game on game.id = game_stats.game_id
    join public.competitions competition on competition.id = game_stats.competition_id
    join public.series_category_data_profiles profile
      on profile.id = competition.data_profile_id
     and profile.primary_source = 'fiba_boxscore'
     and profile.status = 'active'
    left join public.matchups matchup on matchup.id = game.matchup_id
    left join public.competition_rounds round_item on round_item.id = matchup.round_id
    left join public.competition_stages stage on stage.id = round_item.stage_id
    left join public.player_period_stats stat
      on stat.game_id = game_stats.game_id
     and stat.game_roster_slot_id = game_stats.game_roster_slot_id
     and stat.stat_scope = 'game_total'
    where game_stats.competition_id = new.competition_id
      and not game_stats.did_not_play
  ), scoped_games as (
    select eligible_games.*, selected_scope.scope
    from eligible_games
    cross join lateral (
      select 'all'::text as scope
      union all
      select eligible_games.structural_scope
      where eligible_games.structural_scope in ('regular', 'playoffs')
    ) selected_scope
  ), aggregates as (
    select
      scope, competition_id, data_profile_id, registration_id, team_id,
      min(team_name) as team_name, min(team_slug) as team_slug,
      min(team_abbreviation) as team_abbreviation,
      player_id, min(player_name) as player_name, min(player_slug) as player_slug,
      case when count(distinct jersey_number) = 1 then min(jersey_number) end as jersey_number,
      count(distinct jersey_number) > 1 as jersey_varies,
      count(*)::bigint as games_played,
      count(official_points)::bigint as scoring_games_covered,
      count(advanced_points)::bigint as advanced_games_covered,
      count(fouls)::bigint as foul_games_covered,
      count(fouls_received)::bigint as fouls_received_games_covered,
      case when count(advanced_points) > 0 then sum(seconds_played)::bigint end as seconds_covered,
      case when count(official_points) > 0 then sum(official_points)::bigint end as official_points,
      case when count(advanced_points) > 0 then sum(advanced_points)::bigint end as advanced_points,
      case when count(advanced_points) > 0 then sum(two_point_made)::bigint end as two_point_made,
      case when count(advanced_points) > 0 then sum(two_point_attempted)::bigint end as two_point_attempted,
      case when count(advanced_points) > 0 then sum(three_point_made)::bigint end as three_point_made,
      case when count(advanced_points) > 0 then sum(three_point_attempted)::bigint end as three_point_attempted,
      case when count(advanced_points) > 0 then sum(free_throw_made)::bigint end as free_throw_made,
      case when count(advanced_points) > 0 then sum(free_throw_attempted)::bigint end as free_throw_attempted,
      case when count(advanced_points) > 0 then sum(offensive_rebounds)::bigint end as offensive_rebounds,
      case when count(advanced_points) > 0 then sum(defensive_rebounds)::bigint end as defensive_rebounds,
      case when count(advanced_points) > 0 then sum(assists)::bigint end as assists,
      case when count(advanced_points) > 0 then sum(turnovers)::bigint end as turnovers,
      case when count(advanced_points) > 0 then sum(steals)::bigint end as steals,
      case when count(advanced_points) > 0 then sum(blocks)::bigint end as blocks,
      case when count(fouls) > 0 then sum(fouls)::bigint end as fouls_committed,
      case when count(fouls_received) > 0 then sum(fouls_received)::bigint end as fouls_received,
      case when count(plus_minus) = count(advanced_points) and count(advanced_points) > 0
        then sum(plus_minus)::bigint end as plus_minus,
      count(*) filter (where structural_scope = 'regular')::bigint as regular_games,
      count(*) filter (where structural_scope = 'playoffs')::bigint as playoff_games,
      count(*) filter (where structural_scope = 'unclassified')::bigint as unclassified_games
    from scoped_games
    group by scope, competition_id, data_profile_id, registration_id, team_id, player_id
  )
  select
    new.id, competition_id, data_profile_id, scope,
    registration_id, team_id, team_name, team_slug, team_abbreviation,
    player_id, player_name, player_slug, jersey_number, jersey_varies,
    games_played, scoring_games_covered, advanced_games_covered,
    foul_games_covered, fouls_received_games_covered, seconds_covered,
    official_points, advanced_points, two_point_made, two_point_attempted,
    three_point_made, three_point_attempted, free_throw_made,
    free_throw_attempted, offensive_rebounds, defensive_rebounds,
    assists, turnovers, steals, blocks, fouls_committed, fouls_received,
    plus_minus, regular_games, playoff_games, unclassified_games
  from aggregates;
  return new;
end;
$$;

revoke all on function private.snapshot_competition_player_statistics()
from public, anon, authenticated;

create trigger competition_publications_snapshot_player_statistics
after insert on public.competition_publications
for each row execute function private.snapshot_competition_player_statistics();

create or replace function private.competition_publication_review(p_competition_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  competition public.competitions;
  data_profile public.series_category_data_profiles;
  snapshot jsonb;
  current_publication public.competition_publications;
  current_statistics public.competition_publication_statistics;
  blockers jsonb := '[]'::jsonb;
  confirmed_teams integer;
  eligible_games integer;
  invalid_games integer;
  unassigned_entries integer;
  snapshot_hash text;
  statistics_fingerprint text;
  statistics_changed boolean := false;
begin
  select * into competition from public.competitions where id = p_competition_id;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_COMPETITION_NOT_FOUND';
  end if;
  select * into data_profile from public.series_category_data_profiles
  where id = competition.data_profile_id;
  select * into current_publication from public.competition_publications
  where id = competition.current_publication_id;
  select * into current_statistics from public.competition_publication_statistics
  where publication_id = competition.current_publication_id;
  select count(*) into confirmed_teams from public.team_registrations
  where competition_id = competition.id and status in ('confirmed', 'completed');
  select count(*) into eligible_games from public.games
  where competition_id = competition.id and status in ('scheduled', 'live', 'final');
  select count(*) into invalid_games from public.games game
  where game.competition_id = competition.id and game.status in ('scheduled', 'live', 'final')
    and (select count(*) from public.game_participants participant
      where participant.game_id = game.id) <> 2;
  select count(*) into unassigned_entries from public.competition_entries entry
  join public.competition_ruleset_revisions revision
    on revision.id = entry.ruleset_revision_id and revision.status = 'active'
  left join public.competition_entry_assignments assignment on assignment.entry_id = entry.id
  where entry.competition_id = competition.id and assignment.entry_id is null;
  if competition.status = 'archived' then
    blockers := blockers || jsonb_build_array('ARCHIVED');
  end if;
  if competition.starts_on is null then
    blockers := blockers || jsonb_build_array('START_DATE_REQUIRED');
  elsif (clock_timestamp() at time zone 'America/Sao_Paulo')::date < competition.starts_on then
    blockers := blockers || jsonb_build_array('BEFORE_STARTS_ON');
  end if;
  if coalesce(competition.gender_division_review_required, true) then
    blockers := blockers || jsonb_build_array('GENDER_REVIEW_REQUIRED');
  end if;
  if coalesce(competition.data_profile_review_required, true) then
    blockers := blockers || jsonb_build_array('DATA_PROFILE_REVIEW_REQUIRED');
  end if;
  if confirmed_teams < 2 then
    blockers := blockers || jsonb_build_array('CONFIRMED_TEAMS_REQUIRED');
  end if;
  if invalid_games > 0 then
    blockers := blockers || jsonb_build_array('INVALID_PUBLIC_GAME');
  end if;
  if unassigned_entries > 0 then
    blockers := blockers || jsonb_build_array('UNASSIGNED_ENTRIES');
  end if;
  snapshot := private.competition_publication_snapshot(competition.id);
  snapshot_hash := md5(snapshot::text);
  if data_profile.primary_source = 'fiba_boxscore' and data_profile.status = 'active' then
    statistics_fingerprint := private.competition_boxscore_statistics_fingerprint(competition.id);
    statistics_changed := current_statistics.publication_id is null
      or current_statistics.source_fingerprint is distinct from statistics_fingerprint
      or current_statistics.data_profile_id is distinct from data_profile.id
      or current_statistics.data_profile_version is distinct from data_profile.version;
  end if;
  return jsonb_build_object(
    'competitionId', competition.id,
    'currentVersion', coalesce(current_publication.version, 0),
    'nextVersion', coalesce(current_publication.version, 0) + 1,
    'confirmedTeams', confirmed_teams,
    'eligibleGames', eligible_games,
    'unassignedEntries', unassigned_entries,
    'invalidGames', invalid_games,
    'startsOn', competition.starts_on,
    'canPublish', jsonb_array_length(blockers) = 0,
    'blockers', blockers,
    'changed', current_publication.id is null
      or current_publication.snapshot_hash <> snapshot_hash
      or statistics_changed
  );
end;
$$;

revoke all on function private.competition_publication_review(bigint)
from public, anon, authenticated;

create or replace function public.admin_publish_competition(
  p_competition_id bigint,
  p_expected_version integer,
  p_confirmed boolean
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  competition public.competitions;
  data_profile public.series_category_data_profiles;
  current_publication public.competition_publications;
  current_statistics public.competition_publication_statistics;
  review jsonb;
  snapshot jsonb;
  snapshot_hash text;
  statistics_fingerprint text;
  statistics_unchanged boolean := true;
  saved_publication_id bigint;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if p_confirmed is distinct from true then
    raise exception using errcode = 'BR043', message = 'BDB_PUBLICATION_CONFIRMATION_REQUIRED';
  end if;
  if p_expected_version is null or p_expected_version < 0 then
    raise exception using errcode = 'BR041', message = 'BDB_PUBLICATION_CHANGED_RELOAD';
  end if;
  select * into competition from public.competitions
  where id = p_competition_id for update;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_COMPETITION_NOT_FOUND';
  end if;
  select * into data_profile from public.series_category_data_profiles
  where id = competition.data_profile_id;
  select * into current_publication from public.competition_publications
  where id = competition.current_publication_id for update;
  select * into current_statistics from public.competition_publication_statistics
  where publication_id = competition.current_publication_id;
  review := private.competition_publication_review(competition.id);
  if not (review ->> 'canPublish')::boolean then
    raise exception using errcode = 'BR042', message = 'BDB_PUBLICATION_BLOCKED';
  end if;
  snapshot := private.competition_publication_snapshot(competition.id);
  snapshot_hash := md5(snapshot::text);
  if data_profile.primary_source = 'fiba_boxscore' and data_profile.status = 'active' then
    statistics_fingerprint := private.competition_boxscore_statistics_fingerprint(competition.id);
    statistics_unchanged := current_statistics.publication_id is not null
      and current_statistics.source_fingerprint = statistics_fingerprint
      and current_statistics.data_profile_id = data_profile.id
      and current_statistics.data_profile_version = data_profile.version;
  end if;
  if current_publication.id is not null
    and current_publication.snapshot_hash = snapshot_hash
    and statistics_unchanged
  then
    return current_publication.id;
  end if;
  if coalesce(current_publication.version, 0) <> p_expected_version then
    raise exception using errcode = 'BR041', message = 'BDB_PUBLICATION_CHANGED_RELOAD';
  end if;

  update public.teams team set is_public = true
  where exists (
    select 1 from public.team_registrations registration
    where registration.competition_id = competition.id
      and registration.team_id = team.id
      and registration.status in ('confirmed', 'completed')
  );
  update public.players player set is_public = true
  where exists (
    select 1 from public.roster_entries entry
    where entry.competition_id = competition.id
      and entry.player_id = player.id and entry.status = 'active'
  );

  insert into public.competition_publications (
    competition_id, version, snapshot, snapshot_hash, publication_kind, published_by
  ) values (
    competition.id, p_expected_version + 1, snapshot, snapshot_hash, 'admin', auth.uid()
  ) returning id into saved_publication_id;
  insert into private.competition_publication_registrations (
    publication_id, competition_id, registration_id, fingerprint
  )
  select saved_publication_id, competition.id, registration.id,
    private.publication_registration_fingerprint(registration.id)
  from public.team_registrations registration
  where registration.competition_id = competition.id
    and registration.status in ('confirmed', 'completed');
  insert into private.competition_publication_roster_entries (
    publication_id, competition_id, roster_entry_id, fingerprint
  )
  select saved_publication_id, competition.id, entry.id,
    private.publication_roster_fingerprint(entry.id)
  from public.roster_entries entry
  where entry.competition_id = competition.id and entry.status = 'active';
  insert into private.competition_publication_games (
    publication_id, competition_id, game_id, fingerprint
  )
  select saved_publication_id, competition.id, game.id,
    private.publication_game_fingerprint(game.id)
  from public.games game
  where game.competition_id = competition.id
    and game.status in ('scheduled', 'live', 'final')
    and (select count(*) from public.game_participants participant
      where participant.game_id = game.id) = 2;
  update public.competitions
  set status = 'published', published_at = coalesce(published_at, now()),
    current_publication_id = saved_publication_id
  where id = competition.id;
  insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
  values (
    'competition_published', 'competition', competition.id,
    jsonb_build_object(
      'publicationId', saved_publication_id,
      'version', p_expected_version + 1,
      'confirmedTeams', (review ->> 'confirmedTeams')::integer,
      'eligibleGames', (review ->> 'eligibleGames')::integer
    )
  );
  return saved_publication_id;
end;
$$;

revoke all on function public.admin_publish_competition(bigint,integer,boolean)
from public, anon, authenticated;
grant execute on function public.admin_publish_competition(bigint,integer,boolean)
to authenticated;

comment on column public.player_period_stats.fouls_received is
  'Canonical nullable received-foul total supplied by a supported boxscore source.';
comment on table public.competition_player_statistics_publications is
  'Append-only boxscore statistics frozen atomically for each explicit competition publication and structural scope.';
comment on table public.competition_publication_statistics is
  'Immutable boxscore statistics header and fingerprint for an explicit competition publication.';
