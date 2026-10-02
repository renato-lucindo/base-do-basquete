-- Recoverable PDF upload and atomic game creation for the two supported
-- boxscore contracts. Existing RPCs remain available for compatibility.

create function public.admin_begin_boxscore_import(
  p_competition_id bigint,
  p_sha256 text,
  p_storage_path text,
  p_source_filename text,
  p_file_size_bytes integer,
  p_parser_version text,
  p_parsed_payload jsonb,
  p_validation_payload jsonb,
  p_matches jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_import public.boxscore_imports;
  created_import_id bigint;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_sha256, 902));
  select import_item.* into existing_import
  from public.boxscore_imports import_item
  where import_item.sha256 = p_sha256
  for update;

  if found then
    if existing_import.created_by <> auth.uid()
      or existing_import.competition_id <> p_competition_id
      or existing_import.storage_path <> p_storage_path
      or existing_import.source_filename <> p_source_filename
      or existing_import.file_size_bytes <> p_file_size_bytes
      or existing_import.parser_version <> p_parser_version
      or existing_import.parsed_payload <> p_parsed_payload
      or existing_import.validation_payload <> p_validation_payload
      or existing_import.status not in ('uploaded', 'review', 'confirmed')
    then
      raise exception using errcode = 'BD309', message = 'BDB_PDF_DUPLICATE';
    end if;
    return jsonb_build_object(
      'importId', existing_import.id,
      'status', existing_import.status,
      'storagePath', existing_import.storage_path,
      'gameId', existing_import.game_id
    );
  end if;

  -- Only a genuinely new import consumes one upload-rate slot. Resuming an
  -- existing hash remains possible after a transient Storage failure.
  perform public.admin_claim_boxscore_upload();

  if p_parser_version = 'basketball-site-v1' then
    created_import_id := private.admin_create_basketball_site_import_draft_impl(
      p_competition_id, p_sha256, p_storage_path, p_source_filename,
      p_file_size_bytes, p_parser_version, p_parsed_payload,
      p_validation_payload, p_matches
    );
  elsif p_parser_version in ('fiba-genius-v1', 'fiba-genius-v2') then
    created_import_id := private.admin_create_boxscore_import_draft_impl(
      p_competition_id, p_sha256, p_storage_path, p_source_filename,
      p_file_size_bytes, p_parser_version, p_parsed_payload,
      p_validation_payload, p_matches
    );
  else
    raise exception using errcode = 'BD302', message = 'BDB_PDF_DRAFT_INVALID';
  end if;

  update public.boxscore_imports
  set status = 'uploaded', updated_at = clock_timestamp()
  where id = created_import_id;

  return jsonb_build_object(
    'importId', created_import_id,
    'status', 'uploaded',
    'storagePath', p_storage_path,
    'gameId', null
  );
end;
$$;

revoke all on function public.admin_begin_boxscore_import(
  bigint, text, text, text, integer, text, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.admin_begin_boxscore_import(
  bigint, text, text, text, integer, text, jsonb, jsonb, jsonb
) to authenticated;

create function public.admin_mark_boxscore_import_ready(p_import_id bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  import_record public.boxscore_imports;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  select import_item.* into import_record
  from public.boxscore_imports import_item
  where import_item.id = p_import_id
  for update;
  if not found or import_record.created_by <> auth.uid() then
    raise exception using errcode = 'BD404', message = 'BDB_PDF_IMPORT_NOT_FOUND';
  end if;
  if import_record.status = 'confirmed' or import_record.status = 'review' then
    return import_record.id;
  end if;
  if import_record.status <> 'uploaded' then
    raise exception using errcode = 'BD302', message = 'BDB_PDF_IMPORT_STATE_INVALID';
  end if;
  if not exists (
    select 1
    from storage.objects object
    where object.bucket_id = 'boxscore-pdfs'
      and object.name = import_record.storage_path
  ) then
    raise exception using errcode = 'BD404', message = 'BDB_PDF_STORAGE_OBJECT_NOT_FOUND';
  end if;

  update public.boxscore_imports
  set status = 'review', error_code = null, updated_at = clock_timestamp()
  where id = import_record.id;
  return import_record.id;
end;
$$;

revoke all on function public.admin_mark_boxscore_import_ready(bigint)
from public, anon, authenticated;
grant execute on function public.admin_mark_boxscore_import_ready(bigint) to authenticated;

create function public.admin_commit_boxscore_import_v2(
  p_import_id bigint,
  p_resolution jsonb,
  p_target jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  import_record public.boxscore_imports;
  request_record private.manual_matchup_requests;
  target_mode text;
  target_game_id bigint;
  target_request_id uuid;
  home_registration_id bigint;
  away_registration_id bigint;
  resolved_registration_ids bigint[];
  reviewed_scheduled_at timestamptz;
  reviewed_venue text;
  apply_reviewed_metadata boolean := false;
  created_payload jsonb;
  parsed_game_number text;
  duration_seconds integer;
  saved_game_id bigint;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if jsonb_typeof(p_resolution) <> 'object' or jsonb_typeof(p_target) <> 'object' then
    raise exception using errcode = 'BD305', message = 'BDB_PDF_RESOLUTION_INVALID';
  end if;

  select import_item.* into import_record
  from public.boxscore_imports import_item
  where import_item.id = p_import_id
  for update;
  if not found or import_record.created_by <> auth.uid() then
    raise exception using errcode = 'BD404', message = 'BDB_PDF_IMPORT_NOT_FOUND';
  end if;
  if import_record.status not in ('review', 'confirmed') then
    raise exception using errcode = 'BD305', message = 'BDB_PDF_RESOLUTION_INVALID';
  end if;

  target_mode := p_target ->> 'mode';
  reviewed_venue := nullif(btrim(coalesce(p_target ->> 'venue', '')), '');
  begin
    reviewed_scheduled_at := nullif(p_target ->> 'scheduledAt', '')::timestamptz;
    if p_target ? 'applyReviewedMetadata' then
      apply_reviewed_metadata := (p_target ->> 'applyReviewedMetadata')::boolean;
    end if;
  exception when invalid_text_representation or datetime_field_overflow then
    raise exception using errcode = 'BR025', message = 'BDB_SCHEDULE_INPUT_INVALID';
  end;
  if reviewed_scheduled_at is null or not isfinite(reviewed_scheduled_at)
    or reviewed_venue is null or char_length(reviewed_venue) > 160
  then
    raise exception using errcode = 'BR025', message = 'BDB_SCHEDULE_INPUT_INVALID';
  end if;

  if jsonb_typeof(p_resolution -> 'teams') <> 'array'
    or jsonb_array_length(p_resolution -> 'teams') <> 2
  then
    raise exception using errcode = 'BD305', message = 'BDB_PDF_TEAM_RESOLUTION_INVALID';
  end if;
  select array_agg(distinct (team.value ->> 'registrationId')::bigint)
  into resolved_registration_ids
  from jsonb_array_elements(p_resolution -> 'teams') team(value);
  if coalesce(array_length(resolved_registration_ids, 1), 0) <> 2 then
    raise exception using errcode = 'BD305', message = 'BDB_PDF_TEAM_RESOLUTION_INVALID';
  end if;

  if target_mode = 'existing' then
    begin
      target_game_id := (p_target ->> 'gameId')::bigint;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode = 'BD305', message = 'BDB_PDF_RESOLUTION_INVALID';
    end;
    if target_game_id is null or target_game_id <= 0 then
      raise exception using errcode = 'BD305', message = 'BDB_PDF_RESOLUTION_INVALID';
    end if;
  elsif target_mode = 'create' then
    begin
      target_request_id := (p_target ->> 'requestId')::uuid;
      home_registration_id := (p_target ->> 'homeRegistrationId')::bigint;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode = 'BD305', message = 'BDB_PDF_RESOLUTION_INVALID';
    end;
    if target_request_id is null
      or not home_registration_id = any(resolved_registration_ids)
    then
      raise exception using errcode = 'BD305', message = 'BDB_PDF_TEAM_RESOLUTION_INVALID';
    end if;
    select registration_id into away_registration_id
    from unnest(resolved_registration_ids) registration_id
    where registration_id <> home_registration_id;
    if away_registration_id is null then
      raise exception using errcode = 'BD305', message = 'BDB_PDF_TEAM_RESOLUTION_INVALID';
    end if;

    if import_record.status = 'confirmed' then
      select request_item.* into request_record
      from private.manual_matchup_requests request_item
      where request_item.request_id = target_request_id;
      if not found
        or request_record.actor_id <> auth.uid()
        or request_record.competition_id <> import_record.competition_id
        or request_record.round_id is not null
        or request_record.home_registration_id <> home_registration_id
        or request_record.away_registration_id <> away_registration_id
        or request_record.scheduled_at is distinct from reviewed_scheduled_at
        or request_record.venue is distinct from reviewed_venue
        or request_record.game_id is null
      then
        raise exception using errcode = 'BR098', message = 'BDB_MANUAL_MATCHUP_REQUEST_CONFLICT';
      end if;
      target_game_id := request_record.game_id;
    else
      created_payload := public.admin_create_manual_matchup(
        target_request_id,
        import_record.competition_id,
        null,
        home_registration_id,
        away_registration_id,
        reviewed_scheduled_at,
        reviewed_venue
      );
      target_game_id := (created_payload ->> 'gameId')::bigint;
    end if;
    apply_reviewed_metadata := true;
  else
    raise exception using errcode = 'BD305', message = 'BDB_PDF_RESOLUTION_INVALID';
  end if;

  if import_record.status = 'confirmed' then
    if target_game_id is distinct from import_record.game_id then
      raise exception using errcode = 'BD713', message = 'BDB_GAME_DATA_CONFLICT';
    end if;
    if apply_reviewed_metadata and not exists (
      select 1 from public.games game
      where game.id = target_game_id
        and game.scheduled_at is not distinct from reviewed_scheduled_at
        and game.venue is not distinct from reviewed_venue
    ) then
      raise exception using errcode = 'BR098', message = 'BDB_MANUAL_MATCHUP_REQUEST_CONFLICT';
    end if;
    return target_game_id;
  end if;

  parsed_game_number := nullif(btrim(import_record.parsed_payload ->> 'gameNumber'), '');
  if parsed_game_number is not null then
    begin
      update public.games
      set game_number = parsed_game_number
      where id = target_game_id
        and competition_id = import_record.competition_id
        and game_number is null;
    exception when unique_violation then
      raise exception using errcode = 'BD306', message = 'BDB_DUPLICATE_GAME_NUMBER';
    end;
  end if;

  if apply_reviewed_metadata then
    update public.games
    set scheduled_at = reviewed_scheduled_at,
        venue = reviewed_venue
    where id = target_game_id and competition_id = import_record.competition_id;
  else
    update public.games
    set scheduled_at = coalesce(scheduled_at, reviewed_scheduled_at),
        venue = coalesce(venue, reviewed_venue)
    where id = target_game_id and competition_id = import_record.competition_id;
  end if;

  saved_game_id := private.admin_commit_supported_boxscore_import_impl(
    p_import_id,
    jsonb_set(p_resolution, '{gameId}', to_jsonb(target_game_id), true)
  );

  if apply_reviewed_metadata then
    begin
      duration_seconds := nullif(import_record.parsed_payload ->> 'durationSeconds', '')::integer;
    exception when invalid_text_representation or numeric_value_out_of_range then
      duration_seconds := null;
    end;
    update public.games
    set started_at = reviewed_scheduled_at,
        ended_at = case
          when duration_seconds is null then ended_at
          else reviewed_scheduled_at + make_interval(secs => duration_seconds)
        end,
        scheduled_at = reviewed_scheduled_at,
        venue = reviewed_venue
    where id = saved_game_id;
  end if;

  return saved_game_id;
exception
  when invalid_parameter_value or invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode = 'BD305', message = 'BDB_PDF_RESOLUTION_INVALID';
end;
$$;

revoke all on function public.admin_commit_boxscore_import_v2(bigint, jsonb, jsonb)
from public, anon, authenticated;
grant execute on function public.admin_commit_boxscore_import_v2(bigint, jsonb, jsonb)
to authenticated;

comment on function public.admin_begin_boxscore_import(
  bigint, text, text, text, integer, text, jsonb, jsonb, jsonb
) is 'Reserves one recoverable PDF import before the private Storage upload.';
comment on function public.admin_mark_boxscore_import_ready(bigint)
is 'Moves a recoverable import to review after its exact private object exists.';
comment on function public.admin_commit_boxscore_import_v2(bigint, jsonb, jsonb)
is 'Confirms a reviewed PDF into an existing or transactionally created game.';
