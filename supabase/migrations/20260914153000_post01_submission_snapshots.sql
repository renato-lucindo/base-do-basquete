alter table public.game_data_submissions
  add constraint game_data_submissions_id_game_unique unique (id, game_id);

create table public.game_data_submission_snapshots (
  submission_id bigint not null,
  game_id bigint not null references public.games(id) on delete restrict,
  domain text not null,
  payload jsonb not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{32}$'),
  captured_at timestamptz not null default now(),
  primary key (submission_id, domain),
  constraint game_data_submission_snapshots_submission_fkey
    foreign key (submission_id, game_id)
    references public.game_data_submissions(id, game_id) on delete restrict
);

create index game_data_submission_snapshots_game_domain_idx
  on public.game_data_submission_snapshots(game_id, domain);

create function private.enforce_game_data_submission_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  snapshot_source_type text;
begin
  select submission.source_type
  into snapshot_source_type
  from public.game_data_submissions submission
  where submission.id = new.submission_id
    and submission.game_id = new.game_id;

  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_GAME_DATA_SUBMISSION_NOT_FOUND';
  end if;
  if not exists (
    select 1
    from public.game_data_source_capabilities capability
    where capability.source_type = snapshot_source_type
      and capability.domain = new.domain
  ) then
    raise exception using errcode = 'BD702', message = 'BDB_SOURCE_DOMAIN_UNSUPPORTED';
  end if;
  if tg_op = 'UPDATE' and new is distinct from old then
    raise exception using errcode = '23514', message = 'BDB_SUBMISSION_SNAPSHOT_IMMUTABLE';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_game_data_submission_snapshot()
from public, anon, authenticated;

create trigger game_data_submission_snapshots_enforce
before insert or update on public.game_data_submission_snapshots
for each row execute function private.enforce_game_data_submission_snapshot();

alter table public.game_data_submission_snapshots enable row level security;
alter table public.game_data_submission_snapshots force row level security;

create policy game_data_submission_snapshots_admin_select
on public.game_data_submission_snapshots for select to authenticated
using ((select public.is_current_admin_aal2()));

revoke all on public.game_data_submission_snapshots from public, anon, authenticated;
grant select on public.game_data_submission_snapshots to authenticated;

create function private.capture_game_data_submission_snapshots(
  p_submission_id bigint,
  p_source_game_id bigint default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  selected_submission public.game_data_submissions;
  source_game_id bigint;
  snapshot_domain text;
  snapshot_payload jsonb;
  inserted_count integer := 0;
begin
  select submission.*
  into selected_submission
  from public.game_data_submissions submission
  where submission.id = p_submission_id;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_GAME_DATA_SUBMISSION_NOT_FOUND';
  end if;

  source_game_id := coalesce(p_source_game_id, selected_submission.game_id);
  if not exists (select 1 from public.games game where game.id = source_game_id) then
    raise exception using errcode = 'BD404', message = 'BDB_GAME_NOT_FOUND';
  end if;

  for snapshot_domain in
    select capability.domain
    from public.game_data_source_capabilities capability
    where capability.source_type = selected_submission.source_type
    order by capability.domain
  loop
    snapshot_payload := null;

    if snapshot_domain = 'official_result' then
      select jsonb_build_object(
        'teams',
        coalesce(jsonb_agg(jsonb_build_object(
          'registrationId', participant.registration_id,
          'side', participant.side,
          'score', coalesce(score.total_points, 0)
        ) order by participant.side), '[]'::jsonb)
      )
      into snapshot_payload
      from public.game_participants participant
      left join lateral (
        select sum(period_score.points)::integer as total_points
        from public.game_period_scores period_score
        where period_score.game_id = source_game_id
          and period_score.registration_id = participant.registration_id
      ) score on true
      where participant.game_id = source_game_id;
    elsif snapshot_domain = 'period_scores' then
      select coalesce(jsonb_agg(jsonb_build_object(
        'registrationId', score.registration_id,
        'periodNumber', score.period_number,
        'points', score.points
      ) order by score.registration_id, score.period_number), '[]'::jsonb)
      into snapshot_payload
      from public.game_period_scores score
      where score.game_id = source_game_id;
    elsif snapshot_domain = 'participation' then
      select coalesce(jsonb_agg(jsonb_build_object(
        'registrationId', slot.registration_id,
        'rosterEntryId', slot.roster_entry_id,
        'jerseyNumber', slot.jersey_number,
        'starter', slot.is_starter,
        'captain', slot.is_captain,
        'didNotPlay', slot.did_not_play
      ) order by slot.registration_id, slot.roster_entry_id), '[]'::jsonb)
      into snapshot_payload
      from public.game_roster_slots slot
      where slot.game_id = source_game_id and slot.is_applicable;
    elsif snapshot_domain = 'player_scoring' then
      select coalesce(jsonb_agg(jsonb_build_object(
        'rosterEntryId', totals.roster_entry_id,
        'twoPointMade', totals.two_point_made,
        'threePointMade', totals.three_point_made,
        'freeThrowMade', totals.free_throw_made,
        'points', totals.points
      ) order by totals.roster_entry_id), '[]'::jsonb)
      into snapshot_payload
      from (
        select
          slot.roster_entry_id,
          coalesce(sum(stat.two_point_made), 0)::integer as two_point_made,
          coalesce(sum(stat.three_point_made), 0)::integer as three_point_made,
          coalesce(sum(stat.free_throw_made), 0)::integer as free_throw_made,
          coalesce(sum(stat.points), 0)::integer as points
        from public.game_roster_slots slot
        left join public.player_period_stats stat
          on stat.game_roster_slot_id = slot.id and stat.game_id = source_game_id
        where slot.game_id = source_game_id and slot.is_applicable
        group by slot.roster_entry_id
      ) totals;
    elsif snapshot_domain = 'player_advanced' then
      select coalesce(jsonb_agg(jsonb_build_object(
        'rosterEntryId', totals.roster_entry_id,
        'secondsPlayed', totals.seconds_played,
        'twoPointAttempted', totals.two_point_attempted,
        'threePointAttempted', totals.three_point_attempted,
        'freeThrowAttempted', totals.free_throw_attempted,
        'offensiveRebounds', totals.offensive_rebounds,
        'defensiveRebounds', totals.defensive_rebounds,
        'assists', totals.assists,
        'turnovers', totals.turnovers,
        'steals', totals.steals,
        'blocks', totals.blocks,
        'plusMinus', totals.plus_minus
      ) order by totals.roster_entry_id), '[]'::jsonb)
      into snapshot_payload
      from (
        select
          slot.roster_entry_id,
          coalesce(sum(stat.seconds_played), 0)::integer as seconds_played,
          coalesce(sum(stat.two_point_attempted), 0)::integer as two_point_attempted,
          coalesce(sum(stat.three_point_attempted), 0)::integer as three_point_attempted,
          coalesce(sum(stat.free_throw_attempted), 0)::integer as free_throw_attempted,
          coalesce(sum(stat.offensive_rebounds), 0)::integer as offensive_rebounds,
          coalesce(sum(stat.defensive_rebounds), 0)::integer as defensive_rebounds,
          coalesce(sum(stat.assists), 0)::integer as assists,
          coalesce(sum(stat.turnovers), 0)::integer as turnovers,
          coalesce(sum(stat.steals), 0)::integer as steals,
          coalesce(sum(stat.blocks), 0)::integer as blocks,
          coalesce(sum(stat.plus_minus), 0)::integer as plus_minus
        from public.game_roster_slots slot
        left join public.player_period_stats stat
          on stat.game_roster_slot_id = slot.id and stat.game_id = source_game_id
        where slot.game_id = source_game_id and slot.is_applicable
        group by slot.roster_entry_id
      ) totals;
    elsif snapshot_domain = 'player_foul_total' then
      select coalesce(jsonb_agg(jsonb_build_object(
        'rosterEntryId', totals.roster_entry_id,
        'fouls', totals.fouls
      ) order by totals.roster_entry_id), '[]'::jsonb)
      into snapshot_payload
      from (
        select slot.roster_entry_id, count(foul.id)::integer as fouls
        from public.game_roster_slots slot
        left join public.foul_events foul
          on foul.game_roster_slot_id = slot.id and foul.game_id = source_game_id
        where slot.game_id = source_game_id and slot.is_applicable
        group by slot.roster_entry_id
      ) totals;
    elsif snapshot_domain = 'player_foul_timeline' then
      select coalesce(jsonb_agg(jsonb_build_object(
        'rosterEntryId', slot.roster_entry_id,
        'periodNumber', foul.period_number,
        'sequenceNumber', foul.sequence_number,
        'elapsedSeconds', foul.elapsed_seconds,
        'foulCode', foul.foul_code
      ) order by slot.roster_entry_id, foul.period_number, foul.sequence_number), '[]'::jsonb)
      into snapshot_payload
      from public.foul_events foul
      join public.game_roster_slots slot on slot.id = foul.game_roster_slot_id
      where foul.game_id = source_game_id;
    elsif snapshot_domain = 'team_advanced' then
      select coalesce(jsonb_agg(to_jsonb(statistics) - 'game_id' - 'created_at' - 'updated_at'
        order by statistics.registration_id), '[]'::jsonb)
      into snapshot_payload
      from public.game_team_statistics statistics
      where statistics.game_id = source_game_id;
    elsif snapshot_domain = 'game_advanced' then
      select coalesce(to_jsonb(statistics) - 'game_id' - 'created_at' - 'updated_at', '{}'::jsonb)
      into snapshot_payload
      from public.game_statistics statistics
      where statistics.game_id = source_game_id;
      snapshot_payload := coalesce(snapshot_payload, '{}'::jsonb);
    end if;

    insert into public.game_data_submission_snapshots(
      submission_id, game_id, domain, payload, payload_hash
    ) values (
      selected_submission.id,
      selected_submission.game_id,
      snapshot_domain,
      coalesce(snapshot_payload, 'null'::jsonb),
      md5(coalesce(snapshot_payload, 'null'::jsonb)::text)
    )
    on conflict (submission_id, domain) do nothing;
    if found then inserted_count := inserted_count + 1; end if;
  end loop;

  return inserted_count;
end;
$$;

revoke all on function private.capture_game_data_submission_snapshots(bigint, bigint)
from public, anon, authenticated;

create function private.capture_new_game_data_submission_snapshots()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('bdb.skip_submission_snapshot', true), '') <> 'on' then
    perform private.capture_game_data_submission_snapshots(new.id, new.game_id);
  end if;
  return new;
end;
$$;

revoke all on function private.capture_new_game_data_submission_snapshots()
from public, anon, authenticated;

create trigger game_data_submissions_capture_snapshot
after insert on public.game_data_submissions
for each row execute function private.capture_new_game_data_submission_snapshots();

comment on table public.game_data_submission_snapshots is
  'Immutable canonical per-domain facts captured before any authority switch; private to the AAL2 administrator.';
comment on function private.capture_game_data_submission_snapshots(bigint, bigint) is
  'Captures stable domain payloads from the submission game or a transaction-local staging game.';
