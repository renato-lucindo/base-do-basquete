-- ADM-REF-01G / classification and backfill reconciliation.
--
-- This migration deliberately does not fill gender division or private player
-- eligibility. Existing AAL2 RPCs remain the only write path for explicit
-- administrative choices. The new contracts expose factual source evidence,
-- immutable per-edition profile snapshots and a value-free reconciliation
-- report so that enforcement is measurable instead of inferred.

create view private.competition_classification_evidence
with (security_invoker = true)
as
select
  competition.id as competition_id,
  competition.series_id,
  competition.category_id,
  competition.year,
  competition.display_name,
  competition.gender_division,
  competition.gender_division_review_required,
  competition.data_profile_id,
  competition.data_profile_review_required,
  count(game.id)::bigint as game_count,
  count(game.id) filter (where game.source = 'manual')::bigint as manual_game_count,
  count(game.id) filter (where game.source = 'boxscore')::bigint as boxscore_game_count,
  count(game.id) filter (where game.source = 'seed')::bigint as seed_game_count,
  case
    when count(game.id) = 0 then 'empty'
    when count(game.id) filter (where game.source = 'boxscore') > 0
      and count(game.id) filter (where game.source <> 'boxscore') = 0
      then 'boxscore_only'
    when count(game.id) filter (where game.source = 'manual') > 0
      and count(game.id) filter (where game.source <> 'manual') = 0
      then 'manual_only'
    when count(game.id) filter (where game.source = 'seed') = count(game.id)
      then 'seed_only'
    else 'mixed'
  end as source_evidence
from public.competitions competition
left join public.games game on game.competition_id = competition.id
group by
  competition.id,
  competition.series_id,
  competition.category_id,
  competition.year,
  competition.display_name,
  competition.gender_division,
  competition.gender_division_review_required,
  competition.data_profile_id,
  competition.data_profile_review_required;

create view private.competition_classification_review_queue
with (security_invoker = true)
as
select evidence.*
from private.competition_classification_evidence evidence
where evidence.gender_division_review_required
   or evidence.data_profile_review_required;

create view private.player_eligibility_review_queue
with (security_invoker = true)
as
select
  player.id as player_id,
  player.full_name,
  player.is_active,
  count(roster.id)::bigint as roster_entry_count,
  count(roster.id) filter (where roster.status = 'active')::bigint
    as active_roster_entry_count,
  count(distinct roster.competition_id)::bigint as competition_count
from public.players player
join private.player_private private_data on private_data.player_id = player.id
left join public.roster_entries roster on roster.player_id = player.id
where private_data.sex_review_required
group by player.id, player.full_name, player.is_active;

create view private.competition_data_profile_snapshots
with (security_invoker = true)
as
select
  competition.id as competition_id,
  competition.series_id,
  competition.category_id,
  competition.gender_division,
  competition.year,
  profile.id as data_profile_id,
  profile.version as data_profile_version,
  profile.primary_source,
  profile.status as data_profile_status,
  (
    select count(distinct related_profile.primary_source)::integer
    from public.competitions related_competition
    join public.series_category_data_profiles related_profile
      on related_profile.id = related_competition.data_profile_id
    where related_competition.series_id = competition.series_id
      and related_competition.category_id = competition.category_id
      and related_competition.gender_division = competition.gender_division
  ) as context_source_variants
from public.competitions competition
join public.series_category_data_profiles profile
  on profile.id = competition.data_profile_id;

revoke all on
  private.competition_classification_evidence,
  private.competition_classification_review_queue,
  private.player_eligibility_review_queue,
  private.competition_data_profile_snapshots
from public, anon, authenticated;

create function private.build_classification_backfill_report()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'reportVersion', 1,
    'counts', jsonb_build_object(
      'competitionsTotal',
        (select count(*) from public.competitions),
      'competitionGenderPending',
        (select count(*) from public.competitions where gender_division_review_required),
      'competitionProfilePending',
        (select count(*) from public.competitions where data_profile_review_required),
      'playersTotal',
        (select count(*) from private.player_private),
      'playerEligibilityPending',
        (select count(*) from private.player_private where sex_review_required),
      'dataProfilesTotal',
        (select count(*) from public.series_category_data_profiles),
      'activeDataProfiles',
        (select count(*) from public.series_category_data_profiles where status = 'active'),
      'supersededDataProfiles',
        (select count(*) from public.series_category_data_profiles where status = 'superseded')
    ),
    'queues', jsonb_build_object(
      'competitions', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'competitionId', queue.competition_id,
              'seriesId', queue.series_id,
              'categoryId', queue.category_id,
              'year', queue.year,
              'displayName', queue.display_name,
              'genderDivision', queue.gender_division,
              'genderReviewRequired', queue.gender_division_review_required,
              'dataProfileId', queue.data_profile_id,
              'profileReviewRequired', queue.data_profile_review_required,
              'sourceEvidence', queue.source_evidence,
              'gameCount', queue.game_count,
              'manualGameCount', queue.manual_game_count,
              'boxscoreGameCount', queue.boxscore_game_count,
              'seedGameCount', queue.seed_game_count
            ) order by queue.competition_id
          )
          from private.competition_classification_review_queue queue
        ),
        '[]'::jsonb
      ),
      'players', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'playerId', queue.player_id,
              'fullName', queue.full_name,
              'isActive', queue.is_active,
              'rosterEntryCount', queue.roster_entry_count,
              'activeRosterEntryCount', queue.active_roster_entry_count,
              'competitionCount', queue.competition_count
            ) order by queue.player_id
          )
          from private.player_eligibility_review_queue queue
        ),
        '[]'::jsonb
      )
    ),
    'classificationEvidence', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'competitionId', evidence.competition_id,
            'sourceEvidence', evidence.source_evidence,
            'gameCount', evidence.game_count,
            'manualGameCount', evidence.manual_game_count,
            'boxscoreGameCount', evidence.boxscore_game_count,
            'seedGameCount', evidence.seed_game_count
          ) order by evidence.competition_id
        )
        from private.competition_classification_evidence evidence
      ),
      '[]'::jsonb
    ),
    'profileDivergences', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'seriesId', divergence.series_id,
            'categoryId', divergence.category_id,
            'genderDivision', divergence.gender_division,
            'competitionIds', divergence.competition_ids,
            'sourceVariants', divergence.source_variants
          ) order by
            divergence.series_id,
            divergence.category_id,
            divergence.gender_division
        )
        from (
          select
            snapshot.series_id,
            snapshot.category_id,
            snapshot.gender_division,
            jsonb_agg(snapshot.competition_id order by snapshot.competition_id)
              as competition_ids,
            max(snapshot.context_source_variants) as source_variants
          from private.competition_data_profile_snapshots snapshot
          group by
            snapshot.series_id,
            snapshot.category_id,
            snapshot.gender_division
          having max(snapshot.context_source_variants) > 1
        ) divergence
      ),
      '[]'::jsonb
    ),
    'historicalIntegrity', jsonb_build_object(
      'games', (select count(*) from public.games),
      'gameParticipants', (select count(*) from public.game_participants),
      'gamePeriods', (select count(*) from public.game_periods),
      'gamePeriodScores', (select count(*) from public.game_period_scores),
      'gameRosterSlots', (select count(*) from public.game_roster_slots),
      'playerPeriodStats', (select count(*) from public.player_period_stats),
      'foulEvents', (select count(*) from public.foul_events),
      'boxscoreImports', (select count(*) from public.boxscore_imports),
      'gameTeamStatistics', (select count(*) from public.game_team_statistics),
      'gameStatistics', (select count(*) from public.game_statistics),
      'gamesBySourceStatus', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'source', grouped.source,
              'status', grouped.status,
              'count', grouped.game_count
            ) order by grouped.source, grouped.status
          )
          from (
            select game.source, game.status, count(*)::bigint as game_count
            from public.games game
            group by game.source, game.status
          ) grouped
        ),
        '[]'::jsonb
      ),
      'periodScoreChecksum', (
        select md5(coalesce(string_agg(
          score.game_id::text || ':' ||
          score.registration_id::text || ':' ||
          score.period_number::text || ':' ||
          score.points::text,
          '|' order by score.game_id, score.registration_id, score.period_number
        ), ''))
        from public.game_period_scores score
      ),
      'playerPointChecksum', (
        select md5(coalesce(string_agg(
          stat.game_roster_slot_id::text || ':' ||
          stat.period_number::text || ':' ||
          stat.points::text,
          '|' order by stat.game_roster_slot_id, stat.period_number
        ), ''))
        from public.player_period_stats stat
      ),
      'relatedAndDnpChecksum', (
        select md5(coalesce(string_agg(
          slot.id::text || ':' ||
          coalesce(slot.roster_entry_id::text, '-') || ':' ||
          slot.is_applicable::text || ':' ||
          slot.did_not_play::text,
          '|' order by slot.id
        ), ''))
        from public.game_roster_slots slot
      ),
      'foulChecksum', (
        select md5(coalesce(string_agg(
          foul.id::text || ':' ||
          foul.game_roster_slot_id::text || ':' ||
          foul.period_number::text || ':' ||
          foul.sequence_number::text || ':' ||
          foul.foul_code,
          '|' order by foul.id
        ), ''))
        from public.foul_events foul
      ),
      'disqualificationChecksum', (
        select md5(coalesce(string_agg(
          slot.id::text || ':' ||
          coalesce(slot.disqualified_at_period::text, '-') || ':' ||
          coalesce(slot.disqualification_reason, '-'),
          '|' order by slot.id
        ), ''))
        from public.game_roster_slots slot
      ),
      'importHashChecksum', (
        select md5(coalesce(string_agg(
          import.id::text || ':' || import.sha256,
          '|' order by import.id
        ), ''))
        from public.boxscore_imports import
      ),
      'advancedCoverageByCompetition', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'competitionId', coverage.competition_id,
              'teamStatisticRows', coverage.team_statistic_rows,
              'gameStatisticRows', coverage.game_statistic_rows
            ) order by coverage.competition_id
          )
          from (
            select
              competition.id as competition_id,
              count(distinct (team_stats.game_id, team_stats.registration_id))::bigint
                as team_statistic_rows,
              count(distinct game_stats.game_id)::bigint as game_statistic_rows
            from public.competitions competition
            left join public.games game on game.competition_id = competition.id
            left join public.game_team_statistics team_stats on team_stats.game_id = game.id
            left join public.game_statistics game_stats on game_stats.game_id = game.id
            group by competition.id
          ) coverage
        ),
        '[]'::jsonb
      )
    ),
    'blockers', jsonb_build_object(
      'competitionGenderPending',
        (select count(*) from public.competitions where gender_division_review_required),
      'competitionProfilePending',
        (select count(*) from public.competitions where data_profile_review_required),
      'playerEligibilityPending',
        (select count(*) from private.player_private where sex_review_required)
    ),
    'enforcementReady',
      not exists (
        select 1
        from public.competitions competition
        where competition.gender_division_review_required
           or competition.data_profile_review_required
      )
      and not exists (
        select 1
        from private.player_private private_data
        where private_data.sex_review_required
      )
  );
$$;

revoke all on function private.build_classification_backfill_report()
from public, anon, authenticated;

create function public.admin_get_classification_backfill_report()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  return private.build_classification_backfill_report();
end;
$$;

revoke all on function public.admin_get_classification_backfill_report()
from public, anon, authenticated;
grant execute on function public.admin_get_classification_backfill_report()
to authenticated;

comment on view private.competition_classification_evidence is
  'Factual game-source counts for administrative classification; never a gender or source choice.';
comment on view private.competition_classification_review_queue is
  'Edition classification queue containing only public context and factual source evidence.';
comment on view private.player_eligibility_review_queue is
  'Value-free private player eligibility queue for the singleton AAL2 administrator.';
comment on view private.competition_data_profile_snapshots is
  'Immutable per-edition profile links, including divergent historical source versions.';
comment on function public.admin_get_classification_backfill_report() is
  'AAL2-only value-free reconciliation report used before classification enforcement.';
