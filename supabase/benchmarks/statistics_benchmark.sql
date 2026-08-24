-- WP-11 controlled benchmark. It creates only session-local objects and rolls back.
-- Representative first-season volume: 250 games, 240 players, 6,000 slots,
-- and 24,000 player-period rows. Target: advanced execution <= 250 ms.

begin;
set local statement_timeout = '30s';

create temporary table bench_games (
  id bigint primary key,
  competition_id bigint not null,
  status text not null
) on commit drop;
create index bench_games_competition_idx on bench_games (competition_id, id)
where status = 'final';

create temporary table bench_players (
  id bigint primary key,
  full_name text not null,
  slug text not null
) on commit drop;

create temporary table bench_roster (
  id bigint primary key,
  player_id bigint not null
) on commit drop;

create temporary table bench_slots (
  id bigint primary key,
  game_id bigint not null,
  roster_entry_id bigint not null,
  is_applicable boolean not null,
  did_not_play boolean not null
) on commit drop;
create index bench_slots_game_idx on bench_slots (game_id);
create index bench_slots_roster_idx on bench_slots (roster_entry_id);

create temporary table bench_stats (
  game_roster_slot_id bigint not null,
  game_id bigint not null,
  period_number smallint not null,
  seconds_played integer not null,
  two_point_made smallint not null,
  two_point_attempted smallint not null,
  three_point_made smallint not null,
  three_point_attempted smallint not null,
  free_throw_made smallint not null,
  free_throw_attempted smallint not null,
  offensive_rebounds smallint not null,
  defensive_rebounds smallint not null,
  assists smallint not null,
  turnovers smallint not null,
  steals smallint not null,
  blocks smallint not null,
  plus_minus smallint not null,
  points smallint not null,
  primary key (game_roster_slot_id, period_number)
) on commit drop;
create index bench_stats_slot_game_idx
on bench_stats (game_roster_slot_id, game_id);

insert into bench_games
select game_id, 1, 'final'
from generate_series(1, 250) game_id;

insert into bench_players
select
  player_id,
  'Atleta ' || lpad(player_id::text, 3, '0'),
  'atleta-' || lpad(player_id::text, 3, '0')
from generate_series(1, 240) player_id;

insert into bench_roster
select player_id, player_id
from generate_series(1, 240) player_id;

insert into bench_slots
select
  ((game_id - 1) * 24 + slot_number)::bigint,
  game_id::bigint,
  (((game_id - 1) * 24 + slot_number - 1) % 240 + 1)::bigint,
  true,
  false
from generate_series(1, 250) game_id
cross join generate_series(1, 24) slot_number;

insert into bench_stats
select
  slot.id,
  slot.game_id,
  period_number::smallint,
  600,
  1,
  2,
  1,
  3,
  1,
  2,
  1,
  2,
  3,
  2,
  1,
  1,
  case when slot.id % 2 = 0 then 2 else -2 end,
  6
from bench_slots slot
cross join generate_series(1, 4) period_number;

analyze bench_games;
analyze bench_players;
analyze bench_roster;
analyze bench_slots;
analyze bench_stats;

create function pg_temp.bench_plan(query_text text)
returns jsonb
language plpgsql
as $$
declare
  result jsonb;
begin
  execute 'explain (analyze, buffers, format json) ' || query_text into result;
  return result;
end;
$$;

with plans as (
  select
    pg_temp.bench_plan($query$
      select
        game.competition_id,
        roster.player_id,
        player.full_name,
        player.slug,
        count(distinct slot.game_id)::bigint as games_played,
        sum(stat.points)::bigint as points
      from bench_games game
      join bench_slots slot on slot.game_id = game.id
      join bench_roster roster on roster.id = slot.roster_entry_id
      join bench_players player on player.id = roster.player_id
      join bench_stats stat
        on stat.game_id = slot.game_id
       and stat.game_roster_slot_id = slot.id
      where game.status = 'final'
        and slot.is_applicable
        and not slot.did_not_play
        and game.competition_id = 1
      group by game.competition_id, roster.player_id, player.full_name, player.slug
      order by points desc, player.full_name
    $query$) as simple_plan,
    pg_temp.bench_plan($query$
      select
        game.competition_id,
        roster.player_id,
        player.full_name,
        player.slug,
        count(distinct slot.game_id)::bigint as games_played,
        sum(stat.seconds_played)::bigint as seconds_played,
        sum(stat.two_point_made)::bigint as two_point_made,
        sum(stat.two_point_attempted)::bigint as two_point_attempted,
        sum(stat.three_point_made)::bigint as three_point_made,
        sum(stat.three_point_attempted)::bigint as three_point_attempted,
        sum(stat.free_throw_made)::bigint as free_throw_made,
        sum(stat.free_throw_attempted)::bigint as free_throw_attempted,
        sum(stat.offensive_rebounds)::bigint as offensive_rebounds,
        sum(stat.defensive_rebounds)::bigint as defensive_rebounds,
        sum(stat.assists)::bigint as assists,
        sum(stat.turnovers)::bigint as turnovers,
        sum(stat.steals)::bigint as steals,
        sum(stat.blocks)::bigint as blocks,
        sum(stat.plus_minus)::bigint as plus_minus,
        sum(stat.points)::bigint as points
      from bench_games game
      join bench_slots slot on slot.game_id = game.id
      join bench_roster roster on roster.id = slot.roster_entry_id
      join bench_players player on player.id = roster.player_id
      join bench_stats stat
        on stat.game_id = slot.game_id
       and stat.game_roster_slot_id = slot.id
      where game.status = 'final'
        and slot.is_applicable
        and not slot.did_not_play
        and game.competition_id = 1
      group by game.competition_id, roster.player_id, player.full_name, player.slug
      order by points desc, player.full_name
    $query$) as advanced_plan
)
select
  250 as games,
  240 as players,
  6000 as roster_slots,
  24000 as period_stat_rows,
  (simple_plan #>> '{0,Planning Time}')::numeric as simple_planning_ms,
  (simple_plan #>> '{0,Execution Time}')::numeric as simple_execution_ms,
  (simple_plan #>> '{0,Plan,Actual Rows}')::bigint as simple_rows,
  (advanced_plan #>> '{0,Planning Time}')::numeric as advanced_planning_ms,
  (advanced_plan #>> '{0,Execution Time}')::numeric as advanced_execution_ms,
  (advanced_plan #>> '{0,Plan,Actual Rows}')::bigint as advanced_rows
from plans;

rollback;
