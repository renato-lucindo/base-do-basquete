-- Additive corrective migration. Existing published migrations are immutable.
-- A player disqualified for accumulated technical/unsportsmanlike or player-coach
-- penalties has one disqualification, even when the final foul was not D.
-- An athlete changing registrations inside one competition keeps separate
-- per-registration aggregates; no totals are assigned to the newest team.

create or replace view public.game_scoresheet_player_statistics
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
    else case when slot.disqualification_reason is not null then 1 else coalesce(fouls.disqualifications, 0) end
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
 and participation.source_type in ('manual_scoresheet', 'fiba_boxscore')
left join public.game_active_data_sources scoring
  on scoring.game_id = game.id
 and scoring.domain = 'player_scoring'
 and scoring.source_type in ('manual_scoresheet', 'fiba_boxscore')
left join public.game_active_data_sources foul_total
  on foul_total.game_id = game.id
 and foul_total.domain = 'player_foul_total'
 and foul_total.source_type in ('manual_scoresheet', 'fiba_boxscore')
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

create or replace view public.competition_scoresheet_player_statistics
with (security_invoker = true)
as
with aggregates as (
  select
    game_stats.competition_id,
    game_stats.player_id,
    game_stats.registration_id,
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
  group by game_stats.competition_id, game_stats.player_id, game_stats.registration_id
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
 and roster.registration_id = aggregate.registration_id
 and roster.context_rank = 1;
