create view public.player_jersey_history
with (security_invoker = true)
as
select distinct
  roster.player_id,
  slot.game_id,
  game.competition_id,
  slot.jersey_number,
  coalesce(game.ended_at, game.scheduled_at, game.created_at) as used_at
from public.game_roster_slots slot
join public.roster_entries roster on roster.id = slot.roster_entry_id
join public.games game on game.id = slot.game_id
where game.status = 'final'
  and slot.is_applicable
  and slot.jersey_number is not null;

create view public.player_primary_jerseys
with (security_invoker = true)
as
with frequency as (
  select
    player_id,
    jersey_number,
    count(*)::bigint as game_count,
    max(used_at) as most_recent_use
  from public.player_jersey_history
  group by player_id, jersey_number
), ranked as (
  select
    frequency.*,
    row_number() over (
      partition by player_id
      order by game_count desc, most_recent_use desc, jersey_number asc
    ) as preference_rank
  from frequency
)
select player_id, jersey_number, game_count, most_recent_use
from ranked
where preference_rank = 1;

revoke all on public.player_jersey_history, public.player_primary_jerseys
from public, anon, authenticated;
grant select on public.player_jersey_history, public.player_primary_jerseys
to anon, authenticated;

comment on view public.player_jersey_history is 'One confirmed game use per player and textual jersey number.';
comment on view public.player_primary_jerseys is 'Deterministic primary jersey: frequency, most recent use, then text.';
