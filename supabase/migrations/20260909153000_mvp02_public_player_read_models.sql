-- MVP-02: authority-aware public player read models.
-- Existing legacy views remain available during the additive rollout.

create policy game_data_domain_authority_public_source_select
on public.game_data_domain_authority
for select
to anon
using (
  exists (
    select 1
    from public.games game
    join public.competitions competition on competition.id = game.competition_id
    where game.id = game_data_domain_authority.game_id
      and game.status in ('scheduled', 'live', 'final')
      and competition.status in ('published', 'archived')
  )
);

grant select (game_id, domain, source_type)
on public.game_data_domain_authority
to anon;

create view public.game_active_data_sources
with (security_invoker = true)
as
select
  authority.game_id,
  game.competition_id,
  authority.domain,
  authority.source_type
from public.game_data_domain_authority authority
join public.games game on game.id = authority.game_id
join public.competitions competition on competition.id = game.competition_id
where game.status in ('scheduled', 'live', 'final')
  and competition.status in ('published', 'archived');

create view public.game_scoresheet_player_statistics
with (security_invoker = true)
as
with stat_totals as (
  select
    stats.game_id,
    stats.game_roster_slot_id,
    sum(stats.two_point_made)::bigint as two_point_made,
    sum(stats.three_point_made)::bigint as three_point_made,
    sum(stats.free_throw_made)::bigint as free_throw_made,
    sum(stats.points)::bigint as points
  from public.player_period_stats stats
  group by stats.game_id, stats.game_roster_slot_id
), foul_totals as (
  select
    foul.game_id,
    foul.game_roster_slot_id,
    count(*)::bigint as fouls,
    count(*) filter (where foul.foul_code = 'D')::bigint as disqualifications
  from public.foul_events foul
  group by foul.game_id, foul.game_roster_slot_id
)
select
  game.id as game_id,
  game.competition_id,
  game.game_number,
  game.scheduled_at,
  slot.id as game_roster_slot_id,
  slot.registration_id,
  participant.side,
  registration.team_id,
  team.name as team_name,
  team.slug as team_slug,
  team.abbreviation as team_abbreviation,
  roster.player_id,
  player.full_name as player_name,
  player.slug as player_slug,
  slot.jersey_number,
  slot.is_starter,
  slot.did_not_play,
  case
    when slot.did_not_play or scoring.game_id is null then null
    else coalesce(stats.points, 0)
  end::bigint as points,
  case
    when slot.did_not_play or scoring.game_id is null then null
    else coalesce(stats.two_point_made, 0)
  end::bigint as two_point_made,
  case
    when slot.did_not_play or scoring.game_id is null then null
    else coalesce(stats.three_point_made, 0)
  end::bigint as three_point_made,
  case
    when slot.did_not_play or scoring.game_id is null then null
    else coalesce(stats.free_throw_made, 0)
  end::bigint as free_throw_made,
  case
    when slot.did_not_play or foul_total.game_id is null then null
    else coalesce(fouls.fouls, 0)
  end::bigint as fouls,
  case
    when slot.did_not_play or foul_timeline.game_id is null then null
    else coalesce(fouls.disqualifications, 0)
  end::bigint as disqualifications
from public.games game
join public.competitions competition on competition.id = game.competition_id
join public.series_category_data_profiles profile
  on profile.id = competition.data_profile_id
 and profile.primary_source = 'manual_scoresheet'
join public.game_roster_slots slot
  on slot.game_id = game.id
 and slot.is_applicable
join public.roster_entries roster
  on roster.id = slot.roster_entry_id
 and roster.registration_id = slot.registration_id
join public.game_participants participant
  on participant.game_id = slot.game_id
 and participant.registration_id = slot.registration_id
join public.team_registrations registration
  on registration.id = slot.registration_id
 and registration.competition_id = game.competition_id
join public.teams team on team.id = registration.team_id
join public.players player on player.id = roster.player_id
join public.game_active_data_sources participation
  on participation.game_id = game.id
 and participation.domain = 'participation'
 and participation.source_type = 'manual_scoresheet'
left join public.game_active_data_sources scoring
  on scoring.game_id = game.id
 and scoring.domain = 'player_scoring'
 and scoring.source_type = 'manual_scoresheet'
left join public.game_active_data_sources foul_total
  on foul_total.game_id = game.id
 and foul_total.domain = 'player_foul_total'
 and foul_total.source_type = 'manual_scoresheet'
left join public.game_active_data_sources foul_timeline
  on foul_timeline.game_id = game.id
 and foul_timeline.domain = 'player_foul_timeline'
 and foul_timeline.source_type = 'manual_scoresheet'
left join stat_totals stats
  on stats.game_id = slot.game_id
 and stats.game_roster_slot_id = slot.id
left join foul_totals fouls
  on fouls.game_id = slot.game_id
 and fouls.game_roster_slot_id = slot.id
where game.status = 'final'
  and not competition.data_profile_review_required;

create view public.competition_scoresheet_player_statistics
with (security_invoker = true)
as
with aggregates as (
  select
    game_stats.competition_id,
    game_stats.player_id,
    count(*) filter (
      where not game_stats.did_not_play and game_stats.points is not null
    )::bigint as games_played,
    count(*) filter (where game_stats.did_not_play)::bigint as dnp_count,
    count(*) filter (
      where not game_stats.did_not_play and game_stats.is_starter
    )::bigint as starter_appearances,
    sum(game_stats.points) filter (where not game_stats.did_not_play)::bigint as points,
    sum(game_stats.two_point_made) filter (where not game_stats.did_not_play)::bigint
      as two_point_made,
    sum(game_stats.three_point_made) filter (where not game_stats.did_not_play)::bigint
      as three_point_made,
    sum(game_stats.free_throw_made) filter (where not game_stats.did_not_play)::bigint
      as free_throw_made,
    sum(game_stats.fouls) filter (where not game_stats.did_not_play)::bigint as fouls,
    sum(game_stats.disqualifications) filter (where not game_stats.did_not_play)::bigint
      as disqualifications
  from public.game_scoresheet_player_statistics game_stats
  group by game_stats.competition_id, game_stats.player_id
  having count(*) filter (
    where not game_stats.did_not_play and game_stats.points is not null
  ) > 0
), roster_ranked as (
  select
    roster.competition_id,
    roster.player_id,
    roster.registration_id,
    registration.team_id,
    team.name as team_name,
    team.slug as team_slug,
    team.abbreviation as team_abbreviation,
    roster.jersey_number,
    roster.position as roster_position,
    row_number() over (
      partition by roster.competition_id, roster.player_id
      order by (roster.status = 'active') desc, roster.updated_at desc, roster.id desc
    ) as context_rank
  from public.roster_entries roster
  join public.team_registrations registration
    on registration.id = roster.registration_id
   and registration.competition_id = roster.competition_id
  join public.teams team on team.id = registration.team_id
)
select
  aggregate.competition_id,
  aggregate.player_id,
  player.full_name as player_name,
  player.slug as player_slug,
  roster.registration_id,
  roster.team_id,
  roster.team_name,
  roster.team_slug,
  roster.team_abbreviation,
  roster.jersey_number,
  roster.roster_position,
  aggregate.games_played,
  aggregate.dnp_count,
  aggregate.starter_appearances,
  aggregate.points,
  aggregate.two_point_made,
  aggregate.three_point_made,
  aggregate.free_throw_made,
  aggregate.fouls,
  aggregate.disqualifications
from aggregates aggregate
join public.players player on player.id = aggregate.player_id
join roster_ranked roster
  on roster.competition_id = aggregate.competition_id
 and roster.player_id = aggregate.player_id
 and roster.context_rank = 1;

create view public.game_boxscore_player_statistics
with (security_invoker = true)
as
with stat_totals as (
  select
    stats.game_id,
    stats.game_roster_slot_id,
    sum(stats.seconds_played)::bigint as seconds_played,
    sum(stats.two_point_made)::bigint as two_point_made,
    sum(stats.two_point_attempted)::bigint as two_point_attempted,
    sum(stats.three_point_made)::bigint as three_point_made,
    sum(stats.three_point_attempted)::bigint as three_point_attempted,
    sum(stats.free_throw_made)::bigint as free_throw_made,
    sum(stats.free_throw_attempted)::bigint as free_throw_attempted,
    sum(stats.offensive_rebounds)::bigint as offensive_rebounds,
    sum(stats.defensive_rebounds)::bigint as defensive_rebounds,
    sum(stats.assists)::bigint as assists,
    sum(stats.turnovers)::bigint as turnovers,
    sum(stats.steals)::bigint as steals,
    sum(stats.blocks)::bigint as blocks,
    sum(stats.plus_minus)::bigint as plus_minus,
    sum(stats.points)::bigint as points
  from public.player_period_stats stats
  group by stats.game_id, stats.game_roster_slot_id
), foul_totals as (
  select
    foul.game_id,
    foul.game_roster_slot_id,
    count(*)::bigint as fouls
  from public.foul_events foul
  group by foul.game_id, foul.game_roster_slot_id
)
select
  game.id as game_id,
  game.competition_id,
  game.game_number,
  game.scheduled_at,
  slot.id as game_roster_slot_id,
  slot.registration_id,
  participant.side,
  registration.team_id,
  team.name as team_name,
  team.slug as team_slug,
  team.abbreviation as team_abbreviation,
  roster.player_id,
  player.full_name as player_name,
  player.slug as player_slug,
  slot.jersey_number,
  slot.is_starter,
  slot.did_not_play,
  scoring.source_type as scoring_source_type,
  (advanced.game_id is not null) as has_advanced_coverage,
  case
    when slot.did_not_play or scoring.game_id is null then null
    else coalesce(stats.points, 0)
  end::bigint as official_points,
  case
    when slot.did_not_play or advanced.game_id is null then null
    else coalesce(stats.points, 0)
  end::bigint as advanced_points,
  case when slot.did_not_play or advanced.game_id is null then null else coalesce(stats.seconds_played, 0) end::bigint as seconds_played,
  case when slot.did_not_play or advanced.game_id is null then null else coalesce(stats.two_point_made, 0) end::bigint as two_point_made,
  case when slot.did_not_play or advanced.game_id is null then null else coalesce(stats.two_point_attempted, 0) end::bigint as two_point_attempted,
  case when slot.did_not_play or advanced.game_id is null then null else coalesce(stats.three_point_made, 0) end::bigint as three_point_made,
  case when slot.did_not_play or advanced.game_id is null then null else coalesce(stats.three_point_attempted, 0) end::bigint as three_point_attempted,
  case when slot.did_not_play or advanced.game_id is null then null else coalesce(stats.free_throw_made, 0) end::bigint as free_throw_made,
  case when slot.did_not_play or advanced.game_id is null then null else coalesce(stats.free_throw_attempted, 0) end::bigint as free_throw_attempted,
  case when slot.did_not_play or advanced.game_id is null then null else coalesce(stats.offensive_rebounds, 0) end::bigint as offensive_rebounds,
  case when slot.did_not_play or advanced.game_id is null then null else coalesce(stats.defensive_rebounds, 0) end::bigint as defensive_rebounds,
  case when slot.did_not_play or advanced.game_id is null then null else coalesce(stats.assists, 0) end::bigint as assists,
  case when slot.did_not_play or advanced.game_id is null then null else coalesce(stats.turnovers, 0) end::bigint as turnovers,
  case when slot.did_not_play or advanced.game_id is null then null else coalesce(stats.steals, 0) end::bigint as steals,
  case when slot.did_not_play or advanced.game_id is null then null else coalesce(stats.blocks, 0) end::bigint as blocks,
  case when slot.did_not_play or advanced.game_id is null then null else coalesce(stats.plus_minus, 0) end::bigint as plus_minus,
  case
    when slot.did_not_play or foul_total.game_id is null then null
    else coalesce(fouls.fouls, 0)
  end::bigint as fouls
from public.games game
join public.competitions competition on competition.id = game.competition_id
join public.series_category_data_profiles profile
  on profile.id = competition.data_profile_id
 and profile.primary_source = 'fiba_boxscore'
join public.game_roster_slots slot
  on slot.game_id = game.id
 and slot.is_applicable
join public.roster_entries roster
  on roster.id = slot.roster_entry_id
 and roster.registration_id = slot.registration_id
join public.game_participants participant
  on participant.game_id = slot.game_id
 and participant.registration_id = slot.registration_id
join public.team_registrations registration
  on registration.id = slot.registration_id
 and registration.competition_id = game.competition_id
join public.teams team on team.id = registration.team_id
join public.players player on player.id = roster.player_id
join public.game_active_data_sources participation
  on participation.game_id = game.id
 and participation.domain = 'participation'
left join public.game_active_data_sources scoring
  on scoring.game_id = game.id
 and scoring.domain = 'player_scoring'
left join public.game_active_data_sources advanced
  on advanced.game_id = game.id
 and advanced.domain = 'player_advanced'
 and advanced.source_type = 'fiba_boxscore'
left join public.game_active_data_sources foul_total
  on foul_total.game_id = game.id
 and foul_total.domain = 'player_foul_total'
left join stat_totals stats
  on stats.game_id = slot.game_id
 and stats.game_roster_slot_id = slot.id
left join foul_totals fouls
  on fouls.game_id = slot.game_id
 and fouls.game_roster_slot_id = slot.id
where game.status = 'final'
  and not competition.data_profile_review_required;

create view public.competition_boxscore_player_statistics
with (security_invoker = true)
as
with aggregates as (
  select
    game_stats.competition_id,
    game_stats.player_id,
    count(*) filter (
      where not game_stats.did_not_play and game_stats.official_points is not null
    )::bigint as games_played,
    count(*) filter (
      where not game_stats.did_not_play and game_stats.advanced_points is not null
    )::bigint as advanced_games_played,
    count(*) filter (
      where not game_stats.did_not_play and game_stats.is_starter
    )::bigint as starter_appearances,
    sum(game_stats.official_points) filter (where not game_stats.did_not_play)::bigint
      as official_points,
    sum(game_stats.advanced_points) filter (where not game_stats.did_not_play)::bigint
      as advanced_points,
    sum(game_stats.seconds_played) filter (where not game_stats.did_not_play)::bigint as seconds_played,
    sum(game_stats.two_point_made) filter (where not game_stats.did_not_play)::bigint as two_point_made,
    sum(game_stats.two_point_attempted) filter (where not game_stats.did_not_play)::bigint as two_point_attempted,
    sum(game_stats.three_point_made) filter (where not game_stats.did_not_play)::bigint as three_point_made,
    sum(game_stats.three_point_attempted) filter (where not game_stats.did_not_play)::bigint as three_point_attempted,
    sum(game_stats.free_throw_made) filter (where not game_stats.did_not_play)::bigint as free_throw_made,
    sum(game_stats.free_throw_attempted) filter (where not game_stats.did_not_play)::bigint as free_throw_attempted,
    sum(game_stats.offensive_rebounds) filter (where not game_stats.did_not_play)::bigint as offensive_rebounds,
    sum(game_stats.defensive_rebounds) filter (where not game_stats.did_not_play)::bigint as defensive_rebounds,
    sum(game_stats.assists) filter (where not game_stats.did_not_play)::bigint as assists,
    sum(game_stats.turnovers) filter (where not game_stats.did_not_play)::bigint as turnovers,
    sum(game_stats.steals) filter (where not game_stats.did_not_play)::bigint as steals,
    sum(game_stats.blocks) filter (where not game_stats.did_not_play)::bigint as blocks,
    sum(game_stats.plus_minus) filter (where not game_stats.did_not_play)::bigint as plus_minus,
    sum(game_stats.fouls) filter (where not game_stats.did_not_play)::bigint as fouls
  from public.game_boxscore_player_statistics game_stats
  group by game_stats.competition_id, game_stats.player_id
  having count(*) filter (
    where not game_stats.did_not_play and game_stats.official_points is not null
  ) > 0
), roster_ranked as (
  select
    roster.competition_id,
    roster.player_id,
    roster.registration_id,
    registration.team_id,
    team.name as team_name,
    team.slug as team_slug,
    team.abbreviation as team_abbreviation,
    roster.jersey_number,
    roster.position as roster_position,
    row_number() over (
      partition by roster.competition_id, roster.player_id
      order by (roster.status = 'active') desc, roster.updated_at desc, roster.id desc
    ) as context_rank
  from public.roster_entries roster
  join public.team_registrations registration
    on registration.id = roster.registration_id
   and registration.competition_id = roster.competition_id
  join public.teams team on team.id = registration.team_id
)
select
  aggregate.competition_id,
  aggregate.player_id,
  player.full_name as player_name,
  player.slug as player_slug,
  roster.registration_id,
  roster.team_id,
  roster.team_name,
  roster.team_slug,
  roster.team_abbreviation,
  roster.jersey_number,
  roster.roster_position,
  aggregate.games_played,
  aggregate.advanced_games_played,
  aggregate.starter_appearances,
  aggregate.official_points,
  aggregate.advanced_points,
  aggregate.seconds_played,
  aggregate.two_point_made,
  aggregate.two_point_attempted,
  aggregate.three_point_made,
  aggregate.three_point_attempted,
  aggregate.free_throw_made,
  aggregate.free_throw_attempted,
  aggregate.offensive_rebounds,
  aggregate.defensive_rebounds,
  aggregate.assists,
  aggregate.turnovers,
  aggregate.steals,
  aggregate.blocks,
  aggregate.fouls,
  aggregate.plus_minus
from aggregates aggregate
join public.players player on player.id = aggregate.player_id
join roster_ranked roster
  on roster.competition_id = aggregate.competition_id
 and roster.player_id = aggregate.player_id
 and roster.context_rank = 1;

create view public.competition_data_coverage
with (security_invoker = true)
as
select
  competition.id as competition_id,
  profile.id as data_profile_id,
  profile.primary_source,
  count(game.id) filter (where game.status = 'final')::bigint as final_games,
  count(game.id) filter (
    where game.status = 'final' and exists (
      select 1 from public.game_active_data_sources source
      where source.game_id = game.id and source.domain = 'participation'
    )
  )::bigint as participation_games,
  count(game.id) filter (
    where game.status = 'final' and exists (
      select 1 from public.game_active_data_sources source
      where source.game_id = game.id and source.domain = 'player_scoring'
    )
  )::bigint as scoring_games,
  count(game.id) filter (
    where game.status = 'final' and exists (
      select 1 from public.game_active_data_sources source
      where source.game_id = game.id
        and source.domain = 'player_advanced'
        and source.source_type = 'fiba_boxscore'
    )
  )::bigint as advanced_games,
  count(game.id) filter (
    where game.status = 'final' and exists (
      select 1 from public.game_active_data_sources source
      where source.game_id = game.id and source.domain = 'player_foul_total'
    )
  )::bigint as foul_games
from public.competitions competition
join public.series_category_data_profiles profile on profile.id = competition.data_profile_id
left join public.games game on game.competition_id = competition.id
where competition.status in ('published', 'archived')
  and not competition.data_profile_review_required
group by competition.id, profile.id, profile.primary_source;

revoke all on public.game_active_data_sources,
  public.game_scoresheet_player_statistics,
  public.competition_scoresheet_player_statistics,
  public.game_boxscore_player_statistics,
  public.competition_boxscore_player_statistics,
  public.competition_data_coverage
from public, anon, authenticated;

grant select on public.game_active_data_sources,
  public.game_scoresheet_player_statistics,
  public.competition_scoresheet_player_statistics,
  public.game_boxscore_player_statistics,
  public.competition_boxscore_player_statistics,
  public.competition_data_coverage
to anon, authenticated;

comment on view public.game_active_data_sources is
  'Public-safe active source per published game/domain; administrative authority metadata remains private.';
comment on view public.game_scoresheet_player_statistics is
  'Per-game manual scoresheet projection selected by the edition profile and active domain authority.';
comment on view public.competition_scoresheet_player_statistics is
  'Manual edition aggregate where DNP never increments games and unavailable domains remain null.';
comment on view public.game_boxscore_player_statistics is
  'Per-game FIBA profile projection separating official basic data from advanced coverage.';
comment on view public.competition_boxscore_player_statistics is
  'FIBA edition aggregate with distinct total and advanced denominators.';
comment on view public.competition_data_coverage is
  'Authority-derived public coverage counts for a versioned edition data profile.';
