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
grant select on public.manual_scoresheet_public_statistics_projection to anon, authenticated;

create policy manual_scoresheet_public_statistics_projection_select
on public.manual_scoresheet_public_statistics_projection for select to anon, authenticated
using (
  (select private.game_is_currently_published(game_id))
  or (select public.is_current_admin_aal2())
);

create function private.refresh_manual_scoresheet_public_projection(p_game_id bigint, p_submission_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.manual_scoresheet_public_statistics_projection(game_id, submission_id, free_throw_summary)
  values(p_game_id, p_submission_id, private.manual_scoresheet_v2_collective_ft_summary(p_game_id))
  on conflict(game_id) do update set
    submission_id = excluded.submission_id,
    free_throw_summary = excluded.free_throw_summary,
    published_at = now();
end;
$$;
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
