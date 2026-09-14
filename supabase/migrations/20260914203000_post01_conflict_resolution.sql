alter table public.admin_mutation_audit
  drop constraint admin_mutation_audit_action_check,
  add constraint admin_mutation_audit_action_check check(action in (
    'registration_created','registration_transitioned','roster_replaced','manual_scoresheet_saved',
    'boxscore_import_confirmed','boxscore_team_stats_refreshed','final_placement_confirmed','player_created',
    'competition_gender_reviewed','data_profile_created','data_profile_activated',
    'competition_data_profile_assigned','player_sex_reviewed','game_data_authority_activated',
    'competition_created_from_preset','competition_entry_assigned','matchup_prepared','matchup_resolved',
    'competition_published','manual_fallback_confirmed','boxscore_supplement_confirmed',
    'manual_fallback_finalized','game_data_comparison_created','game_data_conflict_resolved',
    'fiba_candidate_staged'
  ));

create function public.admin_resolve_game_data_conflict(
  p_game_id bigint,
  p_candidate_submission_id bigint,
  p_decision text,
  p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  normalized_decision text := lower(btrim(coalesce(p_decision, '')));
  normalized_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  candidate_submission public.game_data_submissions;
  base_submission public.game_data_submissions;
  participation_payload jsonb;
  scoring_payload jsonb;
  advanced_payload jsonb;
  period_payload jsonb;
  team_payload jsonb;
  game_payload jsonb;
  authority_domain text;
  current_submission_id bigint;
  current_revision integer;
  expected_submission_id bigint;
  expected_revision integer;
  comparison_result text;
  first_period smallint;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if normalized_decision not in ('keep_fallback', 'use_fiba') then
    raise exception using errcode = 'BD720', message = 'BDB_CONFLICT_DECISION_INVALID';
  end if;
  if normalized_reason is null or char_length(normalized_reason) not between 10 and 500 then
    raise exception using errcode = 'BD705', message = 'BDB_AUTHORITY_REASON_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('conflict:' || p_game_id::text, 2006));

  select submission.* into candidate_submission
  from public.game_data_submissions submission
  where submission.id = p_candidate_submission_id
    and submission.game_id = p_game_id
    and submission.source_type = 'fiba_boxscore'
  for update;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_GAME_DATA_SUBMISSION_NOT_FOUND';
  end if;

  if exists (
    select 1 from public.admin_mutation_audit audit
    where audit.action = 'game_data_conflict_resolved'
      and audit.entity_type = 'game'
      and audit.entity_id = p_game_id
      and audit.metadata ->> 'candidateSubmissionId' = p_candidate_submission_id::text
      and audit.metadata ->> 'decision' = normalized_decision
  ) then
    return p_candidate_submission_id;
  end if;
  if candidate_submission.status <> 'active' then
    raise exception using errcode = 'BD703', message = 'BDB_AUTHORITY_SUBMISSION_INACTIVE';
  end if;

  select submission.* into base_submission
  from public.game_data_submissions submission
  join public.game_data_domain_comparisons comparison
    on comparison.base_submission_id = submission.id
  where comparison.candidate_submission_id = candidate_submission.id
  order by comparison.id
  limit 1;
  if not found or base_submission.source_type <> 'manual_scoresheet'
    or base_submission.role <> 'fallback'
  then
    raise exception using errcode = 'BD716', message = 'BDB_SUBMISSION_ROLE_INCOMPATIBLE';
  end if;

  if not exists (
    select 1 from public.game_data_domain_comparisons comparison
    where comparison.candidate_submission_id = candidate_submission.id
  ) then
    raise exception using errcode = 'BD718', message = 'BDB_SUBMISSION_SNAPSHOTS_MISSING';
  end if;

  if exists (
    select 1
    from public.game_data_domain_comparisons comparison
    left join public.game_data_domain_authority authority
      on authority.game_id = comparison.game_id
      and authority.domain = comparison.domain
    where comparison.candidate_submission_id = candidate_submission.id
      and (
        authority.submission_id is distinct from comparison.expected_authority_submission_id
        or authority.revision is distinct from comparison.expected_authority_revision
      )
  ) then
    raise exception using errcode = 'BD704', message = 'BDB_AUTHORITY_CONFLICT';
  end if;

  if normalized_decision = 'keep_fallback' then
    update public.game_data_domain_comparisons comparison
    set
      resolution_status = 'resolved',
      decision = 'base',
      decided_by = auth.uid(),
      decided_at = now(),
      decision_reason = normalized_reason
    where comparison.candidate_submission_id = candidate_submission.id
      and comparison.resolution_status = 'pending';

    update public.game_data_submissions submission
    set status = 'superseded', reason = coalesce(submission.reason, normalized_reason)
    where submission.id = candidate_submission.id;
  else
    select snapshot.payload into participation_payload
    from public.game_data_submission_snapshots snapshot
    where snapshot.submission_id = candidate_submission.id
      and snapshot.domain = 'participation';
    select snapshot.payload into scoring_payload
    from public.game_data_submission_snapshots snapshot
    where snapshot.submission_id = candidate_submission.id
      and snapshot.domain = 'player_scoring';
    select snapshot.payload into advanced_payload
    from public.game_data_submission_snapshots snapshot
    where snapshot.submission_id = candidate_submission.id
      and snapshot.domain = 'player_advanced';
    select snapshot.payload into period_payload
    from public.game_data_submission_snapshots snapshot
    where snapshot.submission_id = candidate_submission.id
      and snapshot.domain = 'period_scores';
    select snapshot.payload into team_payload
    from public.game_data_submission_snapshots snapshot
    where snapshot.submission_id = candidate_submission.id
      and snapshot.domain = 'team_advanced';
    select snapshot.payload into game_payload
    from public.game_data_submission_snapshots snapshot
    where snapshot.submission_id = candidate_submission.id
      and snapshot.domain = 'game_advanced';

    if jsonb_typeof(participation_payload) <> 'array'
      or jsonb_typeof(scoring_payload) <> 'array'
      or jsonb_typeof(advanced_payload) <> 'array'
      or jsonb_typeof(period_payload) <> 'array'
      or jsonb_typeof(team_payload) <> 'array'
      or jsonb_typeof(game_payload) <> 'object'
    then
      raise exception using errcode = 'BD718', message = 'BDB_SUBMISSION_SNAPSHOTS_MISSING';
    end if;

    if (
      select array_agg((item ->> 'rosterEntryId')::bigint order by (item ->> 'rosterEntryId')::bigint)
      from jsonb_array_elements(participation_payload) item
    ) is distinct from (
      select array_agg(slot.roster_entry_id order by slot.roster_entry_id)
      from public.game_roster_slots slot
      where slot.game_id = p_game_id and slot.is_applicable
    ) then
      raise exception using errcode = 'BD719', message = 'BDB_CONFLICT_DOMAINS_INCOMPATIBLE';
    end if;

    update public.game_roster_slots slot
    set
      jersey_number = item ->> 'jerseyNumber',
      is_starter = (item ->> 'starter')::boolean,
      is_captain = (item ->> 'captain')::boolean,
      did_not_play = (item ->> 'didNotPlay')::boolean
    from jsonb_array_elements(participation_payload) item
    where slot.game_id = p_game_id
      and slot.roster_entry_id = (item ->> 'rosterEntryId')::bigint;

    select min(period.period_number) into first_period
    from public.game_periods period where period.game_id = p_game_id;
    if first_period is null then
      raise exception using errcode = 'BD718', message = 'BDB_SUBMISSION_SNAPSHOTS_MISSING';
    end if;

    delete from public.player_period_stats stat where stat.game_id = p_game_id;
    insert into public.player_period_stats(
      game_roster_slot_id, game_id, period_number, seconds_played,
      two_point_made, two_point_attempted, three_point_made, three_point_attempted,
      free_throw_made, free_throw_attempted, offensive_rebounds, defensive_rebounds,
      assists, turnovers, steals, blocks, plus_minus, stat_scope
    )
    select
      slot.id,
      p_game_id,
      first_period,
      (advanced ->> 'secondsPlayed')::integer,
      (scoring ->> 'twoPointMade')::smallint,
      (advanced ->> 'twoPointAttempted')::smallint,
      (scoring ->> 'threePointMade')::smallint,
      (advanced ->> 'threePointAttempted')::smallint,
      (scoring ->> 'freeThrowMade')::smallint,
      (advanced ->> 'freeThrowAttempted')::smallint,
      (advanced ->> 'offensiveRebounds')::smallint,
      (advanced ->> 'defensiveRebounds')::smallint,
      (advanced ->> 'assists')::smallint,
      (advanced ->> 'turnovers')::smallint,
      (advanced ->> 'steals')::smallint,
      (advanced ->> 'blocks')::smallint,
      (advanced ->> 'plusMinus')::smallint,
      'game_total'
    from jsonb_array_elements(scoring_payload) scoring
    join lateral (
      select advanced_item
      from jsonb_array_elements(advanced_payload) advanced_item
      where advanced_item ->> 'rosterEntryId' = scoring ->> 'rosterEntryId'
    ) advanced_row(advanced) on true
    join public.game_roster_slots slot
      on slot.game_id = p_game_id
      and slot.roster_entry_id = (scoring ->> 'rosterEntryId')::bigint;

    delete from public.game_period_scores score where score.game_id = p_game_id;
    insert into public.game_period_scores(game_id, registration_id, period_number, points)
    select
      p_game_id,
      (item ->> 'registrationId')::bigint,
      (item ->> 'periodNumber')::smallint,
      (item ->> 'points')::integer
    from jsonb_array_elements(period_payload) item;

    delete from public.game_team_statistics statistics where statistics.game_id = p_game_id;
    insert into public.game_team_statistics(
      game_id, registration_id, points_from_turnovers, points_in_paint,
      points_in_paint_made, points_in_paint_attempted, second_chance_points,
      fast_break_points, fast_break_points_from_turnovers, bench_points,
      largest_lead, largest_scoring_run, points_per_possession,
      time_leading_seconds, source_parser_version
    )
    select
      p_game_id,
      (item ->> 'registration_id')::bigint,
      (item ->> 'points_from_turnovers')::smallint,
      (item ->> 'points_in_paint')::smallint,
      (item ->> 'points_in_paint_made')::smallint,
      (item ->> 'points_in_paint_attempted')::smallint,
      (item ->> 'second_chance_points')::smallint,
      (item ->> 'fast_break_points')::smallint,
      (item ->> 'fast_break_points_from_turnovers')::smallint,
      (item ->> 'bench_points')::smallint,
      (item ->> 'largest_lead')::smallint,
      (item ->> 'largest_scoring_run')::smallint,
      (item ->> 'points_per_possession')::numeric,
      (item ->> 'time_leading_seconds')::integer,
      item ->> 'source_parser_version'
    from jsonb_array_elements(team_payload) item;

    delete from public.game_statistics statistics where statistics.game_id = p_game_id;
    insert into public.game_statistics(
      game_id, lead_changes, times_tied, source_parser_version
    ) values (
      p_game_id,
      (game_payload ->> 'lead_changes')::smallint,
      (game_payload ->> 'times_tied')::smallint,
      game_payload ->> 'source_parser_version'
    );

    for authority_domain in
      select capability.domain
      from public.game_data_source_capabilities capability
      where capability.source_type = 'fiba_boxscore'
      order by capability.domain
    loop
      select comparison.comparison_result,
        comparison.expected_authority_submission_id,
        comparison.expected_authority_revision
      into comparison_result, expected_submission_id, expected_revision
      from public.game_data_domain_comparisons comparison
      where comparison.candidate_submission_id = candidate_submission.id
        and comparison.domain = authority_domain;

      if authority_domain = 'player_foul_total' and comparison_result = 'conflict' then
        continue;
      end if;

      select authority.submission_id, authority.revision
      into current_submission_id, current_revision
      from public.game_data_domain_authority authority
      where authority.game_id = p_game_id and authority.domain = authority_domain;

      perform private.activate_game_data_domain_authority(
        p_game_id,
        authority_domain,
        candidate_submission.id,
        current_submission_id,
        normalized_reason
      );
    end loop;

    update public.game_data_domain_comparisons comparison
    set
      resolution_status = 'resolved',
      decision = case
        when comparison.domain = 'player_foul_total'
          and comparison.comparison_result = 'conflict' then 'base'
        else 'candidate'
      end,
      decided_by = auth.uid(),
      decided_at = now(),
      decision_reason = normalized_reason
    where comparison.candidate_submission_id = candidate_submission.id
      and comparison.resolution_status = 'pending';

    update public.games game set source = 'boxscore' where game.id = p_game_id;
  end if;

  insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
  values (
    'game_data_conflict_resolved',
    'game',
    p_game_id,
    jsonb_build_object(
      'baseSubmissionId', base_submission.id,
      'candidateSubmissionId', candidate_submission.id,
      'decision', normalized_decision,
      'reasonProvided', true,
      'foulTimelinePreserved', true
    )
  );

  return candidate_submission.id;
end;
$$;

revoke all on function public.admin_resolve_game_data_conflict(bigint, bigint, text, text)
from public, anon, authenticated;
grant execute on function public.admin_resolve_game_data_conflict(bigint, bigint, text, text)
to authenticated;

comment on function public.admin_resolve_game_data_conflict(bigint, bigint, text, text) is
  'Makes one serialized, audited AAL2 decision over immutable evidence; FIBA promotion preserves the manual foul timeline and rejects incompatible player sets.';
