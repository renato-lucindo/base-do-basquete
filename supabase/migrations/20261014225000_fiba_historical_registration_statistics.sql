-- Preserve historical registration boundaries in FIBA aggregate player statistics.
create or replace view public.competition_boxscore_player_statistics
with (security_invoker = true)
as
with aggregates as (
  select
    game_stats.competition_id,
    game_stats.player_id,
    game_stats.registration_id,
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
    sum(game_stats.seconds_played) filter (where not game_stats.did_not_play)::bigint
      as seconds_played,
    sum(game_stats.two_point_made) filter (where not game_stats.did_not_play)::bigint
      as two_point_made,
    sum(game_stats.two_point_attempted) filter (where not game_stats.did_not_play)::bigint
      as two_point_attempted,
    sum(game_stats.three_point_made) filter (where not game_stats.did_not_play)::bigint
      as three_point_made,
    sum(game_stats.three_point_attempted) filter (where not game_stats.did_not_play)::bigint
      as three_point_attempted,
    sum(game_stats.free_throw_made) filter (where not game_stats.did_not_play)::bigint
      as free_throw_made,
    sum(game_stats.free_throw_attempted) filter (where not game_stats.did_not_play)::bigint
      as free_throw_attempted,
    sum(game_stats.offensive_rebounds) filter (where not game_stats.did_not_play)::bigint
      as offensive_rebounds,
    sum(game_stats.defensive_rebounds) filter (where not game_stats.did_not_play)::bigint
      as defensive_rebounds,
    sum(game_stats.assists) filter (where not game_stats.did_not_play)::bigint as assists,
    sum(game_stats.turnovers) filter (where not game_stats.did_not_play)::bigint as turnovers,
    sum(game_stats.steals) filter (where not game_stats.did_not_play)::bigint as steals,
    sum(game_stats.blocks) filter (where not game_stats.did_not_play)::bigint as blocks,
    case
      when count(game_stats.plus_minus) filter (
        where not game_stats.did_not_play and game_stats.advanced_points is not null
      ) = count(*) filter (
        where not game_stats.did_not_play and game_stats.advanced_points is not null
      )
      then sum(game_stats.plus_minus) filter (where not game_stats.did_not_play)::bigint
      else null
    end as plus_minus,
    sum(game_stats.fouls) filter (where not game_stats.did_not_play)::bigint as fouls
  from public.game_boxscore_player_statistics game_stats
  group by game_stats.competition_id, game_stats.player_id, game_stats.registration_id
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
      partition by roster.competition_id, roster.player_id, roster.registration_id
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
 and roster.registration_id = aggregate.registration_id
 and roster.context_rank = 1;
