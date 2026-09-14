alter table public.admin_mutation_audit
  drop constraint admin_mutation_audit_action_check,
  add constraint admin_mutation_audit_action_check check(action in (
    'registration_created','registration_transitioned','roster_replaced','manual_scoresheet_saved',
    'boxscore_import_confirmed','boxscore_team_stats_refreshed','final_placement_confirmed','player_created',
    'competition_gender_reviewed','data_profile_created','data_profile_activated',
    'competition_data_profile_assigned','player_sex_reviewed','game_data_authority_activated',
    'competition_created_from_preset','competition_entry_assigned','matchup_prepared','matchup_resolved',
    'competition_published','manual_fallback_confirmed','boxscore_supplement_confirmed',
    'manual_fallback_finalized'
  ));

alter table public.game_data_submissions
  add column fallback_finalized_at timestamptz,
  add column fallback_finalized_by uuid references auth.users(id) on delete restrict
    deferrable initially immediate,
  add column fallback_finalization_reason text,
  add constraint game_data_submissions_fallback_finalization_consistent check (
    (
      role = 'fallback'
      and (
        (fallback_finalized_at is null and fallback_finalized_by is null
          and fallback_finalization_reason is null)
        or (
          fallback_finalized_at is not null
          and fallback_finalized_by is not null
          and fallback_finalization_reason = btrim(fallback_finalization_reason)
          and char_length(fallback_finalization_reason) between 10 and 500
        )
      )
    ) or (
      role <> 'fallback'
      and fallback_finalized_at is null
      and fallback_finalized_by is null
      and fallback_finalization_reason is null
    )
  );

create index game_data_submissions_fallback_finalized_by_idx
  on public.game_data_submissions(fallback_finalized_by)
  where fallback_finalized_by is not null;

create function private.apply_game_data_submission_role_override()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  requested_role text := nullif(
    current_setting('bdb.post01_submission_role', true),
    ''
  );
  requested_reason text := nullif(btrim(coalesce(
    current_setting('bdb.post01_submission_reason', true),
    ''
  )), '');
begin
  if requested_role is null then
    return new;
  end if;

  if requested_role = 'fallback' and new.source_type = 'manual_scoresheet' then
    new.role := 'fallback';
    new.reason := requested_reason;
  elsif requested_role = 'supplemental' and new.source_type = 'fiba_boxscore' then
    new.role := 'supplemental';
  else
    raise exception using errcode = 'BD716', message = 'BDB_SUBMISSION_ROLE_INCOMPATIBLE';
  end if;

  return new;
end;
$$;

revoke all on function private.apply_game_data_submission_role_override()
from public, anon, authenticated;

create trigger game_data_submissions_apply_post01_role
before insert on public.game_data_submissions
for each row execute function private.apply_game_data_submission_role_override();

alter function public.admin_create_manual_scoresheet(jsonb)
  set schema private;
alter function private.admin_create_manual_scoresheet(jsonb)
  rename to admin_create_manual_scoresheet_post01_base;
revoke all on function private.admin_create_manual_scoresheet_post01_base(jsonb)
from public, anon, authenticated;

create function public.admin_create_manual_scoresheet(p_payload jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_game_id bigint;
  competition_id bigint;
  expected_primary_source text;
  normalized_reason text := nullif(btrim(coalesce(p_payload ->> 'fallbackReason', '')), '');
  previous_role_setting text := coalesce(
    current_setting('bdb.post01_submission_role', true),
    ''
  );
  previous_reason_setting text := coalesce(
    current_setting('bdb.post01_submission_reason', true),
    ''
  );
  saved_game_id bigint;
  saved_submission_id bigint;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  begin
    selected_game_id := (p_payload ->> 'gameId')::bigint;
    competition_id := (p_payload ->> 'competitionId')::bigint;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode = 'BD203', message = 'BDB_INVALID_GAME_HEADER';
  end;

  select profile.primary_source
  into expected_primary_source
  from public.games game
  join public.competitions competition on competition.id = game.competition_id
  left join public.series_category_data_profiles profile
    on profile.id = competition.data_profile_id
  where game.id = selected_game_id
    and game.competition_id = competition_id;

  if expected_primary_source = 'fiba_boxscore' then
    if normalized_reason is null or char_length(normalized_reason) not between 10 and 500 then
      raise exception using errcode = 'BD715', message = 'BDB_FALLBACK_REASON_REQUIRED';
    end if;
    perform set_config('bdb.post01_submission_role', 'fallback', true);
    perform set_config('bdb.post01_submission_reason', normalized_reason, true);
  else
    perform set_config('bdb.post01_submission_role', '', true);
    perform set_config('bdb.post01_submission_reason', '', true);
  end if;

  begin
    saved_game_id := private.admin_create_manual_scoresheet_post01_base(p_payload);
  exception when others then
    perform set_config('bdb.post01_submission_role', previous_role_setting, true);
    perform set_config('bdb.post01_submission_reason', previous_reason_setting, true);
    raise;
  end;
  perform set_config('bdb.post01_submission_role', previous_role_setting, true);
  perform set_config('bdb.post01_submission_reason', previous_reason_setting, true);

  if expected_primary_source = 'fiba_boxscore' then
    select submission.id
    into saved_submission_id
    from public.game_data_submissions submission
    where submission.game_id = saved_game_id
      and submission.source_type = 'manual_scoresheet'
      and submission.idempotency_key = p_payload ->> 'idempotencyKey';

    insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
    select
      'manual_fallback_confirmed',
      'game',
      saved_game_id,
      jsonb_build_object(
        'competitionId', competition_id,
        'submissionId', saved_submission_id,
        'reasonProvided', true
      )
    where not exists (
      select 1
      from public.admin_mutation_audit audit
      where audit.action = 'manual_fallback_confirmed'
        and audit.entity_type = 'game'
        and audit.entity_id = saved_game_id
        and audit.metadata ->> 'submissionId' = saved_submission_id::text
    );
  end if;

  return saved_game_id;
end;
$$;

revoke all on function public.admin_create_manual_scoresheet(jsonb)
from public, anon, authenticated;
grant execute on function public.admin_create_manual_scoresheet(jsonb) to authenticated;

alter function private.admin_commit_boxscore_import_impl(bigint, jsonb)
  rename to admin_commit_boxscore_import_post01_base;
revoke all on function private.admin_commit_boxscore_import_post01_base(bigint, jsonb)
from public, anon, authenticated;

create function private.admin_commit_boxscore_import_impl(
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

  select profile.primary_source
  into expected_primary_source
  from public.boxscore_imports import
  join public.competitions competition on competition.id = import.competition_id
  left join public.series_category_data_profiles profile
    on profile.id = competition.data_profile_id
  where import.id = p_import_id;

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
    select submission.id
    into saved_submission_id
    from public.game_data_submissions submission
    where submission.game_id = saved_game_id
      and submission.source_type = 'fiba_boxscore'
      and submission.idempotency_key = 'boxscore-import:' || p_import_id::text;

    insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
    select
      'boxscore_supplement_confirmed',
      'game',
      saved_game_id,
      jsonb_build_object(
        'submissionId', saved_submission_id,
        'importId', p_import_id
      )
    where not exists (
      select 1
      from public.admin_mutation_audit audit
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

create function public.admin_finalize_manual_fallback(
  p_game_id bigint,
  p_submission_id bigint,
  p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  selected_submission public.game_data_submissions;
  expected_primary_source text;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if normalized_reason is null or char_length(normalized_reason) not between 10 and 500 then
    raise exception using errcode = 'BD715', message = 'BDB_FALLBACK_REASON_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('fallback-final:' || p_game_id::text, 2003));

  select submission.*
  into selected_submission
  from public.game_data_submissions submission
  where submission.id = p_submission_id
    and submission.game_id = p_game_id
  for update;

  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_GAME_DATA_SUBMISSION_NOT_FOUND';
  end if;

  select profile.primary_source
  into expected_primary_source
  from public.games game
  join public.competitions competition on competition.id = game.competition_id
  left join public.series_category_data_profiles profile
    on profile.id = competition.data_profile_id
  where game.id = p_game_id;

  if selected_submission.source_type <> 'manual_scoresheet'
    or selected_submission.role <> 'fallback'
    or selected_submission.status <> 'active'
    or expected_primary_source <> 'fiba_boxscore'
  then
    raise exception using errcode = 'BD716', message = 'BDB_SUBMISSION_ROLE_INCOMPATIBLE';
  end if;

  if selected_submission.fallback_finalized_at is not null then
    return selected_submission.id;
  end if;

  if not exists (
    select 1
    from public.game_data_domain_authority authority
    where authority.game_id = p_game_id
      and authority.submission_id = p_submission_id
      and authority.domain = 'official_result'
  ) then
    raise exception using errcode = 'BD703', message = 'BDB_AUTHORITY_SUBMISSION_INACTIVE';
  end if;

  update public.game_data_submissions submission
  set
    fallback_finalized_at = now(),
    fallback_finalized_by = auth.uid(),
    fallback_finalization_reason = normalized_reason
  where submission.id = p_submission_id;

  insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
  values (
    'manual_fallback_finalized',
    'game',
    p_game_id,
    jsonb_build_object(
      'submissionId', p_submission_id,
      'reasonProvided', true,
      'advancedCoverageComplete', false
    )
  );

  return p_submission_id;
end;
$$;

revoke all on function public.admin_finalize_manual_fallback(bigint, bigint, text)
from public, anon, authenticated;
grant execute on function public.admin_finalize_manual_fallback(bigint, bigint, text)
to authenticated;

comment on function public.admin_create_manual_scoresheet(jsonb) is
  'Confirms the manual primary source or a reasoned emergency fallback according to the immutable competition data profile.';
comment on function private.admin_commit_boxscore_import_impl(bigint, jsonb) is
  'Confirms FIBA as primary or supplemental according to the immutable competition data profile.';
comment on function public.admin_finalize_manual_fallback(bigint, bigint, text) is
  'Irreversibly records the singleton-AAL2 decision to keep a validated manual fallback when the expected FIBA source will not arrive.';
