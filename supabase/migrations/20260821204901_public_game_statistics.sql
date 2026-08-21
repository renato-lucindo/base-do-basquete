-- WP-08: contextual public game and player-statistic read models.

create view public.game_player_statistics
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
  slot.game_id,
  game.competition_id,
  slot.registration_id,
  participant.side,
  registration.team_id,
  team.name as team_name,
  team.slug as team_slug,
  slot.id as game_roster_slot_id,
  roster.player_id,
  player.full_name as player_name,
  player.slug as player_slug,
  slot.jersey_number,
  slot.did_not_play,
  coalesce(stat.seconds_played, 0)::bigint as seconds_played,
  coalesce(stat.two_point_made, 0)::bigint as two_point_made,
  coalesce(stat.two_point_attempted, 0)::bigint as two_point_attempted,
  coalesce(stat.three_point_made, 0)::bigint as three_point_made,
  coalesce(stat.three_point_attempted, 0)::bigint as three_point_attempted,
  coalesce(stat.free_throw_made, 0)::bigint as free_throw_made,
  coalesce(stat.free_throw_attempted, 0)::bigint as free_throw_attempted,
  coalesce(stat.offensive_rebounds, 0)::bigint as offensive_rebounds,
  coalesce(stat.defensive_rebounds, 0)::bigint as defensive_rebounds,
  coalesce(stat.assists, 0)::bigint as assists,
  coalesce(stat.turnovers, 0)::bigint as turnovers,
  coalesce(stat.steals, 0)::bigint as steals,
  coalesce(stat.blocks, 0)::bigint as blocks,
  coalesce(stat.plus_minus, 0)::bigint as plus_minus,
  coalesce(stat.points, 0)::bigint as points,
  coalesce(foul.fouls, 0)::bigint as fouls
from public.game_roster_slots slot
join public.games game on game.id = slot.game_id
join public.game_participants participant
  on participant.game_id = slot.game_id
 and participant.registration_id = slot.registration_id
join public.team_registrations registration
  on registration.id = slot.registration_id
 and registration.competition_id = game.competition_id
join public.teams team on team.id = registration.team_id
join public.roster_entries roster
  on roster.id = slot.roster_entry_id
 and roster.registration_id = slot.registration_id
join public.players player on player.id = roster.player_id
left join stat_totals stat
  on stat.game_id = slot.game_id
 and stat.game_roster_slot_id = slot.id
left join foul_totals foul
  on foul.game_id = slot.game_id
 and foul.game_roster_slot_id = slot.id
where slot.is_applicable;

create view public.competition_player_statistics
with (security_invoker = true)
as
select
  game.competition_id,
  roster.player_id,
  player.full_name as player_name,
  player.slug as player_slug,
  count(distinct slot.game_id)::bigint as games_played,
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
from public.games game
join public.game_roster_slots slot on slot.game_id = game.id
join public.roster_entries roster
  on roster.id = slot.roster_entry_id
 and roster.registration_id = slot.registration_id
join public.players player on player.id = roster.player_id
join public.player_period_stats stats
  on stats.game_id = slot.game_id
 and stats.game_roster_slot_id = slot.id
where game.status = 'final'
  and slot.is_applicable
  and not slot.did_not_play
group by game.competition_id, roster.player_id, player.full_name, player.slug;

revoke all on public.game_player_statistics from public, anon, authenticated;
revoke all on public.competition_player_statistics from public, anon, authenticated;
grant select on public.game_player_statistics to anon, authenticated;
grant select on public.competition_player_statistics to anon, authenticated;
