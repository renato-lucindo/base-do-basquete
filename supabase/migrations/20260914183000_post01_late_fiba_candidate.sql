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

create function private.admin_stage_late_fiba_candidate(
  p_import_id bigint,
  p_resolution jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  import_record public.boxscore_imports;
  selected_game public.games;
  selected_game_id bigint;
  temporary_game_id bigint;
  original_parsed jsonb;
  source_home_registration_id bigint;
  source_away_registration_id bigint;
  selected_home_registration_id bigint;
  selected_away_registration_id bigint;
  allow_side_inversion boolean;
  storage_object_id uuid;
  fallback_submission_id bigint;
  candidate_submission_id bigint;
  previous_internal_ingestion_setting text := coalesce(
    current_setting('bdb.allow_internal_ingestion_game', true),
    ''
  );
  previous_skip_snapshot_setting text := coalesce(
    current_setting('bdb.skip_submission_snapshot', true),
    ''
  );
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if jsonb_typeof(p_resolution) <> 'object'
    or coalesce(p_resolution ->> 'gameId', '') !~ '^[1-9][0-9]*$'
  then
    raise exception using errcode = 'BD305', message = 'BDB_PDF_RESOLUTION_INVALID';
  end if;
  selected_game_id := (p_resolution ->> 'gameId')::bigint;

  perform pg_advisory_xact_lock(hashtextextended(
    'late-fiba:' || selected_game_id::text,
    2005
  ));

  select import_item.* into import_record
  from public.boxscore_imports import_item
  where import_item.id = p_import_id
  for update;
  if not found or import_record.created_by <> auth.uid() then
    raise exception using errcode = 'BD404', message = 'BDB_PDF_IMPORT_NOT_FOUND';
  end if;
  if import_record.status = 'confirmed' then
    if import_record.game_id = selected_game_id then return selected_game_id; end if;
    raise exception using errcode = 'BD713', message = 'BDB_GAME_DATA_CONFLICT';
  end if;

  select game.* into selected_game
  from public.games game
  where game.id = selected_game_id
    and game.competition_id = import_record.competition_id
  for update;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_GAME_NOT_FOUND';
  end if;
  if selected_game.status <> 'final' or selected_game.matchup_id is null then
    raise exception using errcode = 'BD711', message = 'BDB_GAME_NOT_CONFIRMABLE';
  end if;

  select submission.id into fallback_submission_id
  from public.game_data_submissions submission
  join public.game_data_domain_authority authority
    on authority.game_id = submission.game_id
    and authority.submission_id = submission.id
    and authority.domain = 'official_result'
  where submission.game_id = selected_game_id
    and submission.source_type = 'manual_scoresheet'
    and submission.role = 'fallback'
    and submission.status = 'active'
  order by submission.submission_version desc
  limit 1;
  if fallback_submission_id is null then
    raise exception using errcode = 'BD714', message = 'BDB_GAME_ALREADY_CONFIRMED';
  end if;

  original_parsed := import_record.parsed_payload;
  begin
    select (team.value ->> 'registrationId')::bigint
    into source_home_registration_id
    from jsonb_array_elements(p_resolution -> 'teams') team(value)
    where team.value ->> 'sourceTeamName' = original_parsed -> 'teams' -> 0 ->> 'name';
    select (team.value ->> 'registrationId')::bigint
    into source_away_registration_id
    from jsonb_array_elements(p_resolution -> 'teams') team(value)
    where team.value ->> 'sourceTeamName' = original_parsed -> 'teams' -> 1 ->> 'name';
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode = 'BD305', message = 'BDB_PDF_TEAM_RESOLUTION_INVALID';
  end;

  select participant.registration_id into selected_home_registration_id
  from public.game_participants participant
  where participant.game_id = selected_game_id and participant.side = 'home';
  select participant.registration_id into selected_away_registration_id
  from public.game_participants participant
  where participant.game_id = selected_game_id and participant.side = 'away';
  select matchup.allow_side_inversion into allow_side_inversion
  from public.matchups matchup where matchup.id = selected_game.matchup_id;

  if source_home_registration_id is null or source_away_registration_id is null
    or not (
      source_home_registration_id = selected_home_registration_id
      and source_away_registration_id = selected_away_registration_id
    ) and not (
      allow_side_inversion
      and source_home_registration_id = selected_away_registration_id
      and source_away_registration_id = selected_home_registration_id
    )
  then
    raise exception using errcode = 'BD712', message = 'BDB_GAME_PARTICIPANTS_MISMATCH';
  end if;
  if selected_game.game_number is not null
    and original_parsed ->> 'gameNumber' is not null
    and selected_game.game_number <> original_parsed ->> 'gameNumber'
  then
    raise exception using errcode = 'BD713', message = 'BDB_GAME_DATA_CONFLICT';
  end if;

  update public.boxscore_imports
  set parsed_payload = jsonb_set(
    original_parsed,
    '{gameNumber}',
    to_jsonb('__post01_' || p_import_id::text || '_' || selected_game_id::text)
  )
  where id = p_import_id;

  begin
    perform set_config('bdb.allow_internal_ingestion_game', 'on', true);
    temporary_game_id := private.admin_commit_boxscore_import_with_eligibility_legacy_game(
      p_import_id,
      p_resolution - 'gameId'
    );
    perform set_config(
      'bdb.allow_internal_ingestion_game',
      previous_internal_ingestion_setting,
      true
    );
  exception when others then
    perform set_config(
      'bdb.allow_internal_ingestion_game',
      previous_internal_ingestion_setting,
      true
    );
    raise;
  end;
  if temporary_game_id = selected_game_id then
    raise exception using errcode = 'BD713', message = 'BDB_GAME_DATA_CONFLICT';
  end if;

  select object.id into storage_object_id
  from storage.objects object
  where object.bucket_id = 'boxscore-pdfs'
    and object.name = import_record.storage_path
  order by object.created_at desc
  limit 1;
  if storage_object_id is null then
    raise exception using errcode = 'BD404', message = 'BDB_PDF_STORAGE_OBJECT_NOT_FOUND';
  end if;

  perform set_config('bdb.skip_submission_snapshot', 'on', true);
  begin
    insert into public.game_data_submissions(
      game_id, submission_version, source_type, role, status,
      parser_version, payload_hash, storage_object_id, idempotency_key,
      submitted_by, submitted_at, validated_by, validated_at
    ) values (
      selected_game_id,
      coalesce((select max(submission.submission_version) + 1
        from public.game_data_submissions submission
        where submission.game_id = selected_game_id
          and submission.source_type = 'fiba_boxscore'), 1),
      'fiba_boxscore', 'primary', 'active', import_record.parser_version,
      import_record.sha256, storage_object_id, 'boxscore-import:' || p_import_id::text,
      auth.uid(), now(), auth.uid(), now()
    ) returning id into candidate_submission_id;
  exception when others then
    perform set_config(
      'bdb.skip_submission_snapshot',
      previous_skip_snapshot_setting,
      true
    );
    raise;
  end;
  perform set_config(
    'bdb.skip_submission_snapshot',
    previous_skip_snapshot_setting,
    true
  );

  perform private.capture_game_data_submission_snapshots(
    fallback_submission_id,
    selected_game_id
  );
  perform private.capture_game_data_submission_snapshots(
    candidate_submission_id,
    temporary_game_id
  );
  perform private.compare_game_data_submissions(
    fallback_submission_id,
    candidate_submission_id
  );

  update public.boxscore_imports
  set game_id = selected_game_id, parsed_payload = original_parsed
  where id = p_import_id;
  update public.admin_mutation_audit audit
  set metadata = jsonb_set(audit.metadata, '{gameId}', to_jsonb(selected_game_id))
  where audit.action = 'boxscore_import_confirmed'
    and audit.entity_type = 'boxscore_import'
    and audit.entity_id = p_import_id
    and audit.metadata ->> 'gameId' = temporary_game_id::text;

  delete from public.foul_events where game_id = temporary_game_id;
  delete from public.player_period_stats where game_id = temporary_game_id;
  delete from public.game_team_statistics where game_id = temporary_game_id;
  delete from public.game_statistics where game_id = temporary_game_id;
  delete from public.game_period_scores where game_id = temporary_game_id;
  delete from public.game_roster_slots where game_id = temporary_game_id;
  delete from public.game_periods where game_id = temporary_game_id;
  delete from public.game_participants where game_id = temporary_game_id;
  delete from public.games where id = temporary_game_id;

  insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
  values (
    'fiba_candidate_staged',
    'game',
    selected_game_id,
    jsonb_build_object(
      'importId', p_import_id,
      'fallbackSubmissionId', fallback_submission_id,
      'candidateSubmissionId', candidate_submission_id,
      'pendingConflictCount', (
        select count(*)
        from public.game_data_domain_comparisons comparison
        where comparison.candidate_submission_id = candidate_submission_id
          and comparison.resolution_status = 'pending'
      )
    )
  );

  return selected_game_id;
exception
  when sqlstate 'BD401' or sqlstate 'BD404' or sqlstate 'BD710'
    or sqlstate 'BD711' or sqlstate 'BD712' or sqlstate 'BD713'
    or sqlstate 'BD714' or sqlstate 'BD305' or sqlstate 'BD306'
    or sqlstate 'BD307' or sqlstate 'BD308' or sqlstate 'BD310'
    or sqlstate 'BD505' or sqlstate 'BD601' or sqlstate 'BD602'
    or sqlstate 'BD703' or sqlstate 'BD718'
  then raise;
  when unique_violation then
    raise exception using errcode = 'BD306', message = 'BDB_PDF_GAME_CONFLICT';
end;
$$;

revoke all on function private.admin_stage_late_fiba_candidate(bigint, jsonb)
from public, anon, authenticated;

create or replace function private.admin_commit_boxscore_import_impl(
  p_import_id bigint,
  p_resolution jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_primary_source text;
  selected_game_id bigint;
  selected_game_status text;
  previous_role_setting text := coalesce(
    current_setting('bdb.post01_submission_role', true),
    ''
  );
  saved_game_id bigint;
  saved_submission_id bigint;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if jsonb_typeof(p_resolution) = 'object'
    and coalesce(p_resolution ->> 'gameId', '') ~ '^[1-9][0-9]*$'
  then
    selected_game_id := (p_resolution ->> 'gameId')::bigint;
  end if;

  select profile.primary_source, game.status
  into expected_primary_source, selected_game_status
  from public.boxscore_imports import_item
  join public.competitions competition on competition.id = import_item.competition_id
  left join public.series_category_data_profiles profile
    on profile.id = competition.data_profile_id
  left join public.games game
    on game.id = selected_game_id and game.competition_id = import_item.competition_id
  where import_item.id = p_import_id;

  if expected_primary_source = 'fiba_boxscore'
    and selected_game_status = 'final'
    and exists (
      select 1
      from public.game_data_submissions submission
      where submission.game_id = selected_game_id
        and submission.source_type = 'manual_scoresheet'
        and submission.role = 'fallback'
        and submission.status = 'active'
    )
  then
    return private.admin_stage_late_fiba_candidate(p_import_id, p_resolution);
  end if;

  perform set_config(
    'bdb.post01_submission_role',
    case when expected_primary_source = 'manual_scoresheet' then 'supplemental' else '' end,
    true
  );
  begin
    saved_game_id := private.admin_commit_boxscore_import_post01_base(
      p_import_id,
      p_resolution
    );
  exception when others then
    perform set_config('bdb.post01_submission_role', previous_role_setting, true);
    raise;
  end;
  perform set_config('bdb.post01_submission_role', previous_role_setting, true);

  if expected_primary_source = 'manual_scoresheet' then
    select submission.id into saved_submission_id
    from public.game_data_submissions submission
    where submission.game_id = saved_game_id
      and submission.source_type = 'fiba_boxscore'
      and submission.idempotency_key = 'boxscore-import:' || p_import_id::text;

    insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
    select
      'boxscore_supplement_confirmed',
      'game',
      saved_game_id,
      jsonb_build_object('submissionId', saved_submission_id, 'importId', p_import_id)
    where not exists (
      select 1 from public.admin_mutation_audit audit
      where audit.action = 'boxscore_supplement_confirmed'
        and audit.entity_type = 'game'
        and audit.entity_id = saved_game_id
        and audit.metadata ->> 'submissionId' = saved_submission_id::text
    );
  end if;

  return saved_game_id;
end;
$$;

revoke all on function private.admin_commit_boxscore_import_impl(bigint, jsonb)
from public, anon, authenticated;
grant execute on function private.admin_commit_boxscore_import_impl(bigint, jsonb)
to authenticated;

comment on function private.admin_stage_late_fiba_candidate(bigint, jsonb) is
  'Parses a late FIBA PDF in a transaction-local game, captures immutable evidence, compares it with the manual fallback, and removes staging facts before commit.';
