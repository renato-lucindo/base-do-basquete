-- MANUAL-SCORESHEET-V2-FIBA2024 - stage 4 additive corrections.
-- Manual sheets expose awarded/conceded collective free throws only.
-- Imported FIBA/Basketball Site advanced attempts remain authoritative.

create or replace function private.validate_manual_scoresheet_player_stats()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.game_data_submissions submission
    where submission.game_id = new.game_id
      and submission.source_type = 'manual_scoresheet'
      and submission.status in ('active','validated')
  ) then
    if new.free_throw_attempted <> new.free_throw_made
      or new.two_point_attempted <> new.two_point_made
      or new.three_point_attempted <> new.three_point_made
    then
      raise exception using errcode='BD224', message='BDB_MANUAL_STATS_CANNOT_CREATE_ATTEMPTS';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.validate_manual_scoresheet_player_stats() from public, anon, authenticated;

drop trigger if exists manual_scoresheet_player_stats_attempt_guard on public.player_period_stats;
create trigger manual_scoresheet_player_stats_attempt_guard
before insert or update on public.player_period_stats
for each row execute function private.validate_manual_scoresheet_player_stats();

create or replace function private.manual_scoresheet_v2_collective_ft_summary(p_game_id bigint)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with converted as (
    select participant.side, coalesce(sum(stats.free_throw_made),0)::integer total
    from public.game_participants participant
    left join public.game_roster_slots slot on slot.game_id = participant.game_id
      and slot.registration_id = participant.registration_id
    left join public.player_period_stats stats on stats.game_roster_slot_id = slot.id
    where participant.game_id = p_game_id
    group by participant.side
  ), awarded as (
    select participant.side, coalesce(sum(foul.penalty_ft_count),0)::integer total
    from public.game_participants participant
    left join public.foul_events foul on foul.game_id = participant.game_id
      and foul.registration_id = participant.registration_id
    where participant.game_id = p_game_id
    group by participant.side
  )
  select jsonb_build_object(
    'home', jsonb_build_object(
      'conceded', coalesce((select total from awarded where side='home'),0),
      'charged', coalesce((select total from awarded where side='away'),0),
      'converted', coalesce((select total from converted where side='home'),0),
      'wasted', coalesce((select total from awarded where side='away'),0) - coalesce((select total from converted where side='home'),0),
      'percentage', case when coalesce((select total from awarded where side='away'),0)>0 then round(100.0*coalesce((select total from converted where side='home'),0)/(select total from awarded where side='away'),1) else null end
    ),
    'away', jsonb_build_object(
      'conceded', coalesce((select total from awarded where side='away'),0),
      'charged', coalesce((select total from awarded where side='home'),0),
      'converted', coalesce((select total from converted where side='away'),0),
      'wasted', coalesce((select total from awarded where side='home'),0) - coalesce((select total from converted where side='away'),0),
      'percentage', case when coalesce((select total from awarded where side='home'),0)>0 then round(100.0*coalesce((select total from converted where side='away'),0)/(select total from awarded where side='home'),1) else null end
    )
  );
$$;

revoke all on function private.manual_scoresheet_v2_collective_ft_summary(bigint) from public, anon, authenticated;

create table if not exists public.manual_scoresheet_public_statistics_projection (
  game_id bigint primary key references public.games(id) on delete restrict,
  submission_id bigint not null,
  free_throw_summary jsonb not null check (jsonb_typeof(free_throw_summary)='object'),
  source_profile text not null default 'manual_scoresheet_v2',
  published_at timestamptz not null default now()
);

alter table public.manual_scoresheet_public_statistics_projection enable row level security;
alter table public.manual_scoresheet_public_statistics_projection force row level security;
revoke all on public.manual_scoresheet_public_statistics_projection from public, anon, authenticated;
grant select (game_id, free_throw_summary)
on public.manual_scoresheet_public_statistics_projection to anon, authenticated;

-- Publish only the projection belonging to the effective scoring submission.
-- The private submission identifier is never exposed to anonymous clients.
create function private.manual_scoresheet_projection_is_current(p_game_id bigint, p_submission_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.game_is_currently_published(p_game_id)
    and exists (
      select 1
      from public.game_data_domain_authority authority
      join public.game_data_submissions submission
        on submission.id = authority.submission_id
       and submission.game_id = authority.game_id
      where authority.game_id = p_game_id
        and authority.domain = 'player_scoring'
        and authority.source_type = 'manual_scoresheet'
        and authority.submission_id = p_submission_id
        and submission.status = 'active'
    );
$$;
revoke all on function private.manual_scoresheet_projection_is_current(bigint,bigint)
from public, anon, authenticated;
grant execute on function private.manual_scoresheet_projection_is_current(bigint,bigint)
to anon, authenticated;

create policy manual_scoresheet_public_statistics_projection_select
on public.manual_scoresheet_public_statistics_projection for select to anon
using (private.manual_scoresheet_projection_is_current(game_id, submission_id));

create policy manual_scoresheet_public_statistics_projection_admin_select
on public.manual_scoresheet_public_statistics_projection for select to authenticated
using (
  private.manual_scoresheet_projection_is_current(game_id, submission_id)
  or (select public.is_current_admin_aal2())
);

create function private.refresh_manual_scoresheet_public_projection(p_game_id bigint, p_submission_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $manualprojection$
declare
  collective_summary jsonb;
begin
  collective_summary := private.manual_scoresheet_v2_collective_ft_summary(p_game_id);
  if (collective_summary #>> '{home,wasted}')::integer < 0
    or (collective_summary #>> '{away,wasted}')::integer < 0
  then
    raise exception using errcode='BD225', message='BDB_MANUAL_FREE_THROWS_EXCEED_CHARGED';
  end if;
  insert into public.manual_scoresheet_public_statistics_projection(game_id, submission_id, free_throw_summary)
  values(p_game_id, p_submission_id, collective_summary)
  on conflict(game_id) do update set
    submission_id = excluded.submission_id,
    free_throw_summary = excluded.free_throw_summary,
    published_at = now();
end;
$manualprojection$;
revoke all on function private.refresh_manual_scoresheet_public_projection(bigint,bigint) from public, anon, authenticated;

comment on table public.manual_scoresheet_public_statistics_projection is 'Public manual scoresheet projection. It contains collective free throws only and never creates individual attempts.';

-- Materialize the first confirmed manual submission as well as all later revisions.
-- Snapshots are inserted only by privileged transactional RPCs; this runs inside
-- the same transaction and therefore never publishes a rolled-back game.
create function private.populate_manual_scoresheet_public_projection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_manual_scoresheet_public_projection(new.game_id, new.submission_id);
  return new;
end;
$$;

revoke all on function private.populate_manual_scoresheet_public_projection() from public, anon, authenticated;

create trigger manual_scoresheet_submission_payload_public_projection
  after insert on public.manual_scoresheet_submission_payloads
  for each row execute function private.populate_manual_scoresheet_public_projection();

-- Guard legacy game read model against fabricated manual shooting attempts.
create or replace view public.game_player_statistics
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
  case when advanced.game_id is null then null::bigint else coalesce(stat.two_point_attempted, 0)::bigint end as two_point_attempted,
  coalesce(stat.three_point_made, 0)::bigint as three_point_made,
  case when advanced.game_id is null then null::bigint else coalesce(stat.three_point_attempted, 0)::bigint end as three_point_attempted,
  coalesce(stat.free_throw_made, 0)::bigint as free_throw_made,
  case when advanced.game_id is null then null::bigint else coalesce(stat.free_throw_attempted, 0)::bigint end as free_throw_attempted,
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
left join public.game_active_data_sources advanced
  on advanced.game_id = game.id
 and advanced.domain = 'player_advanced'
 and advanced.source_type = 'fiba_boxscore'
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
