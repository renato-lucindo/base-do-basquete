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
  case when advanced.game_id is null or (stat.game_roster_slot_id is null and not slot.did_not_play) then null::bigint else coalesce(stat.two_point_attempted, 0)::bigint end as two_point_attempted,
  coalesce(stat.three_point_made, 0)::bigint as three_point_made,
  case when advanced.game_id is null or (stat.game_roster_slot_id is null and not slot.did_not_play) then null::bigint else coalesce(stat.three_point_attempted, 0)::bigint end as three_point_attempted,
  coalesce(stat.free_throw_made, 0)::bigint as free_throw_made,
  case when advanced.game_id is null or (stat.game_roster_slot_id is null and not slot.did_not_play) then null::bigint else coalesce(stat.free_throw_attempted, 0)::bigint end as free_throw_attempted,
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

-- Preserve FIBA completeness across per-game, competition and player profile readers.
-- A roster entry without a period-stat row is unknown, even with FIBA authority;
-- a recorded zero remains zero. DNP is excluded from advanced coverage.
create or replace view public.game_boxscore_player_statistics
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
    bool_and(stats.plus_minus_available) as plus_minus_available,
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
  (advanced.game_id is not null and not slot.did_not_play and stats.game_roster_slot_id is not null) as has_advanced_coverage,
  case
    when slot.did_not_play or scoring.game_id is null or stats.game_roster_slot_id is null then null
    else coalesce(stats.points, 0)
  end::bigint as official_points,
  case
    when slot.did_not_play or advanced.game_id is null or stats.game_roster_slot_id is null then null
    else coalesce(stats.points, 0)
  end::bigint as advanced_points,
  case when slot.did_not_play or advanced.game_id is null or stats.game_roster_slot_id is null then null else coalesce(stats.seconds_played, 0) end::bigint as seconds_played,
  case when slot.did_not_play or advanced.game_id is null or stats.game_roster_slot_id is null then null else coalesce(stats.two_point_made, 0) end::bigint as two_point_made,
  case when slot.did_not_play or advanced.game_id is null or stats.game_roster_slot_id is null then null else coalesce(stats.two_point_attempted, 0) end::bigint as two_point_attempted,
  case when slot.did_not_play or advanced.game_id is null or stats.game_roster_slot_id is null then null else coalesce(stats.three_point_made, 0) end::bigint as three_point_made,
  case when slot.did_not_play or advanced.game_id is null or stats.game_roster_slot_id is null then null else coalesce(stats.three_point_attempted, 0) end::bigint as three_point_attempted,
  case when slot.did_not_play or advanced.game_id is null or stats.game_roster_slot_id is null then null else coalesce(stats.free_throw_made, 0) end::bigint as free_throw_made,
  case when slot.did_not_play or advanced.game_id is null or stats.game_roster_slot_id is null then null else coalesce(stats.free_throw_attempted, 0) end::bigint as free_throw_attempted,
  case when slot.did_not_play or advanced.game_id is null or stats.game_roster_slot_id is null then null else coalesce(stats.offensive_rebounds, 0) end::bigint as offensive_rebounds,
  case when slot.did_not_play or advanced.game_id is null or stats.game_roster_slot_id is null then null else coalesce(stats.defensive_rebounds, 0) end::bigint as defensive_rebounds,
  case when slot.did_not_play or advanced.game_id is null or stats.game_roster_slot_id is null then null else coalesce(stats.assists, 0) end::bigint as assists,
  case when slot.did_not_play or advanced.game_id is null or stats.game_roster_slot_id is null then null else coalesce(stats.turnovers, 0) end::bigint as turnovers,
  case when slot.did_not_play or advanced.game_id is null or stats.game_roster_slot_id is null then null else coalesce(stats.steals, 0) end::bigint as steals,
  case when slot.did_not_play or advanced.game_id is null or stats.game_roster_slot_id is null then null else coalesce(stats.blocks, 0) end::bigint as blocks,
  case when slot.did_not_play or advanced.game_id is null or stats.game_roster_slot_id is null or not coalesce(stats.plus_minus_available, false) then null else coalesce(stats.plus_minus, 0) end::bigint as plus_minus,
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


-- A manual revision may change only private notes or penalty metadata. Its
-- authority fingerprint still needs an explicit new publication even when the
-- public JSON is unchanged. Preserve the current scheduling review requirements.
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
    'invalidGames', invalid_games,
    'startsOn', competition.starts_on,
    'canPublish', jsonb_array_length(blockers) = 0,
    'blockers', blockers,
    'changed', current_publication.id is null
      or current_publication.snapshot_hash <> snapshot_hash
      or statistics_changed
      or exists (
        select 1 from private.competition_publication_games published
        where published.publication_id = current_publication.id
          and published.fingerprint is distinct from
            private.publication_game_fingerprint(published.game_id)
      )
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
    and not (review ->> 'changed')::boolean
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
