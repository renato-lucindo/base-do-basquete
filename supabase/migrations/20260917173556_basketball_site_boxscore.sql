alter table public.game_periods
  add column period_scope text not null default 'period'
  constraint game_periods_scope_check check (period_scope in ('period', 'game_total'));

alter table public.game_period_scores
  add column score_scope text not null default 'period'
  constraint game_period_scores_scope_check check (score_scope in ('period', 'game_total'));

alter table public.player_period_stats
  add column plus_minus_available boolean not null default true;

create function private.mark_basketball_site_period_scope()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if coalesce(current_setting('bdb.boxscore_parser_version', true), '') = 'basketball-site-v1' then new.period_scope := 'game_total'; end if;
  return new;
end;
$$;
create function private.mark_basketball_site_score_scope()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if coalesce(current_setting('bdb.boxscore_parser_version', true), '') = 'basketball-site-v1' then new.score_scope := 'game_total'; end if;
  return new;
end;
$$;
create function private.mark_basketball_site_plus_minus()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if coalesce(current_setting('bdb.boxscore_parser_version', true), '') = 'basketball-site-v1' then new.plus_minus_available := false; end if;
  return new;
end;
$$;
revoke all on function private.mark_basketball_site_period_scope(),
  private.mark_basketball_site_score_scope(), private.mark_basketball_site_plus_minus()
from public, anon, authenticated;
create trigger game_periods_mark_basketball_site_scope before insert on public.game_periods
for each row execute function private.mark_basketball_site_period_scope();
create trigger game_period_scores_mark_basketball_site_scope before insert on public.game_period_scores
for each row execute function private.mark_basketball_site_score_scope();
create trigger player_period_stats_mark_basketball_site_plus_minus before insert on public.player_period_stats
for each row execute function private.mark_basketball_site_plus_minus();

create function private.admin_create_basketball_site_import_draft_impl(
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
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_import_id bigint;
  compatibility_payload jsonb;
begin
  if p_parser_version <> 'basketball-site-v1'
    or p_parsed_payload ->> 'format' <> 'BASKETBALL_SITE'
    or p_parsed_payload ->> 'parserVersion' <> 'basketball-site-v1'
    or jsonb_typeof(p_parsed_payload -> 'teams') <> 'array'
    or jsonb_array_length(p_parsed_payload -> 'teams') <> 2
  then
    raise exception using errcode = 'BD302', message = 'BDB_PDF_DRAFT_INVALID';
  end if;

  compatibility_payload := jsonb_set(
    p_parsed_payload,
    '{format}',
    to_jsonb('FIBA_GENIUS_SPORTS'::text)
  );
  created_import_id := private.admin_create_boxscore_import_draft_impl(
    p_competition_id,
    p_sha256,
    p_storage_path,
    p_source_filename,
    p_file_size_bytes,
    'fiba-genius-v2',
    compatibility_payload,
    p_validation_payload,
    p_matches
  );

  update public.boxscore_imports
  set parser_version = p_parser_version,
      parsed_payload = p_parsed_payload
  where id = created_import_id;

  return created_import_id;
end;
$$;

revoke all on function private.admin_create_basketball_site_import_draft_impl(
  bigint, text, text, text, integer, text, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function private.admin_create_basketball_site_import_draft_impl(
  bigint, text, text, text, integer, text, jsonb, jsonb, jsonb
) to authenticated;

create or replace function public.admin_create_boxscore_import_draft(
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
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_parser_version = 'basketball-site-v1' then
    return private.admin_create_basketball_site_import_draft_impl(
      p_competition_id, p_sha256, p_storage_path, p_source_filename,
      p_file_size_bytes, p_parser_version, p_parsed_payload,
      p_validation_payload, p_matches
    );
  end if;
  return private.admin_create_boxscore_import_draft_impl(
    p_competition_id, p_sha256, p_storage_path, p_source_filename,
    p_file_size_bytes, p_parser_version, p_parsed_payload,
    p_validation_payload, p_matches
  );
end;
$$;

create or replace function private.activate_game_data_domain_authority(
  p_game_id bigint,
  p_domain text,
  p_submission_id bigint,
  p_expected_submission_id bigint default null,
  p_reason text default null
)
returns public.game_data_domain_authority
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_variable
declare
  normalized_domain text := lower(btrim(coalesce(p_domain, '')));
  normalized_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  selected_submission public.game_data_submissions;
  current_authority public.game_data_domain_authority;
  saved_authority public.game_data_domain_authority;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  if normalized_domain not in (
    'official_result',
    'period_scores',
    'participation',
    'player_scoring',
    'player_advanced',
    'player_foul_total',
    'player_foul_timeline',
    'team_advanced',
    'game_advanced'
  ) then
    raise exception using errcode = 'BD701', message = 'BDB_AUTHORITY_DOMAIN_INVALID';
  end if;

  if coalesce(current_setting('bdb.boxscore_parser_version', true), '') = 'basketball-site-v1'
    and normalized_domain in ('period_scores', 'team_advanced', 'game_advanced')
  then
    return null;
  end if;

  if normalized_reason is not null
    and char_length(normalized_reason) not between 10 and 500
  then
    raise exception using errcode = 'BD705', message = 'BDB_AUTHORITY_REASON_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_game_id::text || ':' || normalized_domain, 2002)
  );

  select submission.*
  into selected_submission
  from public.game_data_submissions submission
  where submission.id = p_submission_id
    and submission.game_id = p_game_id
  for update;

  if not found then
    if not exists (select 1 from public.games game where game.id = p_game_id) then
      raise exception using errcode = 'BD404', message = 'BDB_GAME_NOT_FOUND';
    end if;

    raise exception using
      errcode = 'BD404',
      message = 'BDB_GAME_DATA_SUBMISSION_NOT_FOUND';
  end if;

  if selected_submission.status <> 'active' then
    raise exception using
      errcode = 'BD703',
      message = 'BDB_AUTHORITY_SUBMISSION_INACTIVE';
  end if;

  if not exists (
    select 1
    from public.game_data_source_capabilities capability
    where capability.source_type = selected_submission.source_type
      and capability.domain = normalized_domain
  ) then
    raise exception using
      errcode = 'BD702',
      message = 'BDB_SOURCE_DOMAIN_UNSUPPORTED';
  end if;

  select authority.*
  into current_authority
  from public.game_data_domain_authority authority
  where authority.game_id = p_game_id
    and authority.domain = normalized_domain
  for update;

  if found and current_authority.submission_id = p_submission_id then
    return current_authority;
  end if;

  if current_authority.submission_id is distinct from p_expected_submission_id then
    raise exception using errcode = 'BD704', message = 'BDB_AUTHORITY_CONFLICT';
  end if;

  if current_authority.submission_id is not null and normalized_reason is null then
    raise exception using
      errcode = 'BD705',
      message = 'BDB_AUTHORITY_REASON_REQUIRED';
  end if;

  if current_authority.submission_id is null then
    insert into public.game_data_domain_authority (
      game_id,
      domain,
      submission_id,
      source_type,
      revision,
      change_reason,
      activated_by,
      activated_at
    ) values (
      p_game_id,
      normalized_domain,
      selected_submission.id,
      selected_submission.source_type,
      1,
      normalized_reason,
      auth.uid(),
      now()
    )
    returning * into saved_authority;
  else
    update public.game_data_domain_authority authority
    set
      submission_id = selected_submission.id,
      source_type = selected_submission.source_type,
      revision = current_authority.revision + 1,
      change_reason = normalized_reason,
      activated_by = auth.uid(),
      activated_at = greatest(
        clock_timestamp(),
        current_authority.activated_at + interval '1 microsecond'
      )
    where authority.game_id = p_game_id
      and authority.domain = normalized_domain
    returning * into saved_authority;
  end if;

  insert into public.admin_mutation_audit (
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    'game_data_authority_activated',
    'game',
    p_game_id,
    jsonb_build_object(
      'domain', normalized_domain,
      'sourceType', selected_submission.source_type,
      'submissionId', selected_submission.id,
      'previousSubmissionId', current_authority.submission_id,
      'revision', saved_authority.revision,
      'reasonProvided', normalized_reason is not null
    )
  );

  return saved_authority;
end;
$$;

revoke all on function private.activate_game_data_domain_authority(
  bigint,text,bigint,bigint,text
) from public,anon,authenticated;

create function private.capture_basketball_site_submission_snapshots(
  p_submission_id bigint, p_game_id bigint
)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  selected_submission public.game_data_submissions;
  snapshot_payload jsonb;
  inserted_count integer := 0;
  snapshot_domain text;
begin
  select submission.* into selected_submission
  from public.game_data_submissions submission
  where submission.id = p_submission_id and submission.game_id = p_game_id
  for update;
  if not found or selected_submission.status <> 'active'
    or selected_submission.source_type <> 'fiba_boxscore'
    or selected_submission.parser_version <> 'basketball-site-v1'
  then raise exception using errcode = 'BD404', message = 'BDB_GAME_DATA_SUBMISSION_NOT_FOUND';
  end if;

  foreach snapshot_domain in array array[
    'official_result', 'participation', 'player_scoring',
    'player_advanced', 'player_foul_total'
  ]::text[] loop
    if snapshot_domain = 'official_result' then
      select jsonb_build_object('teams', coalesce(jsonb_agg(jsonb_build_object(
        'registrationId', score.registration_id, 'side', score.side, 'score', score.score
      ) order by score.side), '[]'::jsonb))
      into snapshot_payload from public.game_scores score where score.game_id = p_game_id;
    elsif snapshot_domain = 'participation' then
      select coalesce(jsonb_agg(jsonb_build_object(
        'registrationId', slot.registration_id, 'rosterEntryId', slot.roster_entry_id,
        'jerseyNumber', slot.jersey_number, 'starter', slot.is_starter,
        'captain', slot.is_captain, 'didNotPlay', slot.did_not_play
      ) order by slot.registration_id, slot.roster_entry_id), '[]'::jsonb)
      into snapshot_payload from public.game_roster_slots slot
      where slot.game_id = p_game_id and slot.is_applicable;
    elsif snapshot_domain = 'player_scoring' then
      select coalesce(jsonb_agg(jsonb_build_object(
        'rosterEntryId', totals.roster_entry_id, 'twoPointMade', totals.two_point_made,
        'threePointMade', totals.three_point_made, 'freeThrowMade', totals.free_throw_made,
        'points', totals.points
      ) order by totals.roster_entry_id), '[]'::jsonb) into snapshot_payload
      from (select slot.roster_entry_id,
        coalesce(sum(stat.two_point_made),0)::integer two_point_made,
        coalesce(sum(stat.three_point_made),0)::integer three_point_made,
        coalesce(sum(stat.free_throw_made),0)::integer free_throw_made,
        coalesce(sum(stat.points),0)::integer points
        from public.game_roster_slots slot left join public.player_period_stats stat
          on stat.game_roster_slot_id=slot.id and stat.game_id=p_game_id
        where slot.game_id=p_game_id and slot.is_applicable group by slot.roster_entry_id) totals;
    elsif snapshot_domain = 'player_advanced' then
      select coalesce(jsonb_agg(jsonb_build_object(
        'rosterEntryId', totals.roster_entry_id, 'secondsPlayed', totals.seconds_played,
        'twoPointAttempted', totals.two_point_attempted,
        'threePointAttempted', totals.three_point_attempted,
        'freeThrowAttempted', totals.free_throw_attempted,
        'offensiveRebounds', totals.offensive_rebounds,
        'defensiveRebounds', totals.defensive_rebounds, 'assists', totals.assists,
        'turnovers', totals.turnovers, 'steals', totals.steals, 'blocks', totals.blocks,
        'plusMinus', totals.plus_minus
      ) order by totals.roster_entry_id), '[]'::jsonb) into snapshot_payload
      from (select slot.roster_entry_id,
        coalesce(sum(stat.seconds_played),0)::integer seconds_played,
        coalesce(sum(stat.two_point_attempted),0)::integer two_point_attempted,
        coalesce(sum(stat.three_point_attempted),0)::integer three_point_attempted,
        coalesce(sum(stat.free_throw_attempted),0)::integer free_throw_attempted,
        coalesce(sum(stat.offensive_rebounds),0)::integer offensive_rebounds,
        coalesce(sum(stat.defensive_rebounds),0)::integer defensive_rebounds,
        coalesce(sum(stat.assists),0)::integer assists,
        coalesce(sum(stat.turnovers),0)::integer turnovers,
        coalesce(sum(stat.steals),0)::integer steals,
        coalesce(sum(stat.blocks),0)::integer blocks,
        case when bool_and(stat.plus_minus_available)
          then coalesce(sum(stat.plus_minus),0)::integer else null end plus_minus
        from public.game_roster_slots slot left join public.player_period_stats stat
          on stat.game_roster_slot_id=slot.id and stat.game_id=p_game_id
        where slot.game_id=p_game_id and slot.is_applicable group by slot.roster_entry_id) totals;
    else
      select coalesce(jsonb_agg(jsonb_build_object(
        'rosterEntryId', totals.roster_entry_id, 'fouls', totals.fouls
      ) order by totals.roster_entry_id), '[]'::jsonb) into snapshot_payload
      from (select slot.roster_entry_id,count(foul.id)::integer fouls
        from public.game_roster_slots slot left join public.foul_events foul
          on foul.game_roster_slot_id=slot.id and foul.game_id=p_game_id
        where slot.game_id=p_game_id and slot.is_applicable group by slot.roster_entry_id) totals;
    end if;
    insert into public.game_data_submission_snapshots(
      submission_id,game_id,domain,payload,payload_hash
    ) values (selected_submission.id,selected_submission.game_id,snapshot_domain,
      coalesce(snapshot_payload,'null'::jsonb),md5(coalesce(snapshot_payload,'null'::jsonb)::text))
    on conflict (submission_id,domain) do nothing;
    if found then inserted_count := inserted_count + 1; end if;
  end loop;
  return inserted_count;
end;
$$;
revoke all on function private.capture_basketball_site_submission_snapshots(bigint,bigint)
from public,anon,authenticated;

create function private.admin_commit_basketball_site_import_impl(
  p_import_id bigint, p_resolution jsonb
)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  import_record public.boxscore_imports;
  original_parsed jsonb;
  compatibility_parsed jsonb;
  expected_primary_source text;
  selected_game_id bigint;
  previous_ended_at timestamptz;
  previous_parser_setting text := coalesce(current_setting('bdb.boxscore_parser_version',true),'');
  previous_snapshot_setting text := coalesce(current_setting('bdb.skip_submission_snapshot',true),'');
  previous_role_setting text := coalesce(current_setting('bdb.post01_submission_role',true),'');
  saved_game_id bigint;
  saved_submission_id bigint;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode='BD401',message='BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if jsonb_typeof(p_resolution)<>'object'
    or coalesce(p_resolution->>'gameId','') !~ '^[1-9][0-9]*$'
  then raise exception using errcode='BD305',message='BDB_PDF_RESOLUTION_INVALID';
  end if;
  selected_game_id := (p_resolution->>'gameId')::bigint;
  select import_item.* into import_record
  from public.boxscore_imports import_item
  where import_item.id=p_import_id for update of import_item;
  if not found or import_record.created_by<>auth.uid()
    or import_record.parser_version<>'basketball-site-v1'
  then raise exception using errcode='BD404',message='BDB_PDF_IMPORT_NOT_FOUND';
  end if;
  select profile.primary_source into expected_primary_source
  from public.competitions competition
  left join public.series_category_data_profiles profile
    on profile.id=competition.data_profile_id
  where competition.id=import_record.competition_id;
  select game.ended_at into previous_ended_at from public.games game
  where game.id=selected_game_id and game.competition_id=import_record.competition_id for update;
  if not found then raise exception using errcode='BD404',message='BDB_GAME_NOT_FOUND'; end if;

  original_parsed := import_record.parsed_payload;
  select jsonb_set(original_parsed,'{teams}',jsonb_agg(jsonb_set(
    jsonb_set(source_team.team,'{periodScores}',jsonb_build_array(
      (source_team.team->>'score')::integer
    )),'{players}',(select jsonb_agg(
      jsonb_set(source_player.player,'{plusMinus}','0'::jsonb) order by source_player.position
    ) from jsonb_array_elements(source_team.team->'players')
      with ordinality as source_player(player,position))
  ) order by source_team.position)) into compatibility_parsed
  from jsonb_array_elements(original_parsed->'teams')
    with ordinality as source_team(team,position);
  update public.boxscore_imports set parsed_payload=compatibility_parsed where id=p_import_id;

  perform set_config('bdb.boxscore_parser_version','basketball-site-v1',true);
  perform set_config('bdb.skip_submission_snapshot','on',true);
  perform set_config('bdb.post01_submission_role',
    case when expected_primary_source='manual_scoresheet' then 'supplemental' else '' end,true);
  begin
    saved_game_id := private.admin_commit_boxscore_import_post01_base(p_import_id,p_resolution);
  exception when others then
    perform set_config('bdb.boxscore_parser_version',previous_parser_setting,true);
    perform set_config('bdb.skip_submission_snapshot',previous_snapshot_setting,true);
    perform set_config('bdb.post01_submission_role',previous_role_setting,true);
    raise;
  end;
  perform set_config('bdb.boxscore_parser_version',previous_parser_setting,true);
  perform set_config('bdb.skip_submission_snapshot',previous_snapshot_setting,true);
  perform set_config('bdb.post01_submission_role',previous_role_setting,true);

  update public.games set ended_at=previous_ended_at where id=saved_game_id;
  update public.boxscore_imports set parsed_payload=original_parsed where id=p_import_id;
  select submission.id into saved_submission_id from public.game_data_submissions submission
  where submission.game_id=saved_game_id and submission.source_type='fiba_boxscore'
    and submission.parser_version='basketball-site-v1'
    and submission.idempotency_key='boxscore-import:'||p_import_id::text;
  if saved_submission_id is null then
    raise exception using errcode='BD404',message='BDB_GAME_DATA_SUBMISSION_NOT_FOUND';
  end if;
  perform private.capture_basketball_site_submission_snapshots(saved_submission_id,saved_game_id);
  if expected_primary_source='manual_scoresheet' then
    insert into public.admin_mutation_audit(action,entity_type,entity_id,metadata)
    select 'boxscore_supplement_confirmed','game',saved_game_id,
      jsonb_build_object('submissionId',saved_submission_id,'importId',p_import_id)
    where not exists(select 1 from public.admin_mutation_audit audit
      where audit.action='boxscore_supplement_confirmed' and audit.entity_type='game'
        and audit.entity_id=saved_game_id
        and audit.metadata->>'submissionId'=saved_submission_id::text);
  end if;
  return saved_game_id;
end;
$$;
revoke all on function private.admin_commit_basketball_site_import_impl(bigint,jsonb)
from public,anon,authenticated;

create function private.admin_commit_supported_boxscore_import_impl(
  p_import_id bigint, p_resolution jsonb
)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  selected_parser_version text;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode='BD401',message='BDB_ADMIN_AAL2_REQUIRED';
  end if;
  select import_item.parser_version into selected_parser_version
  from public.boxscore_imports import_item
  where import_item.id=p_import_id and import_item.created_by=auth.uid();
  if not found then
    raise exception using errcode='BD404',message='BDB_PDF_IMPORT_NOT_FOUND';
  end if;
  if selected_parser_version='basketball-site-v1' then
    return private.admin_commit_basketball_site_import_impl(p_import_id,p_resolution);
  end if;
  return private.admin_commit_boxscore_import_impl(p_import_id,p_resolution);
end;
$$;
revoke all on function private.admin_commit_supported_boxscore_import_impl(bigint,jsonb)
from public,anon,authenticated;
grant execute on function private.admin_commit_supported_boxscore_import_impl(bigint,jsonb)
to authenticated;
revoke all on function private.admin_commit_boxscore_import_impl(bigint,jsonb)
from public,anon,authenticated;

create or replace function public.admin_commit_boxscore_import(p_import_id bigint,p_resolution jsonb)
returns bigint language plpgsql security invoker set search_path = '' as $$
begin
  return private.admin_commit_supported_boxscore_import_impl(p_import_id,p_resolution);
end;
$$;
revoke all on function public.admin_commit_boxscore_import(bigint,jsonb)
from public,anon,authenticated;
grant execute on function public.admin_commit_boxscore_import(bigint,jsonb) to authenticated;

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
  (advanced.game_id is not null) as has_advanced_coverage,
  case
    when slot.did_not_play or scoring.game_id is null then null
    else coalesce(stats.points, 0)
  end::bigint as official_points,
  case
    when slot.did_not_play or advanced.game_id is null then null
    else coalesce(stats.points, 0)
  end::bigint as advanced_points,
  case when slot.did_not_play or advanced.game_id is null then null else coalesce(stats.seconds_played, 0) end::bigint as seconds_played,
  case when slot.did_not_play or advanced.game_id is null then null else coalesce(stats.two_point_made, 0) end::bigint as two_point_made,
  case when slot.did_not_play or advanced.game_id is null then null else coalesce(stats.two_point_attempted, 0) end::bigint as two_point_attempted,
  case when slot.did_not_play or advanced.game_id is null then null else coalesce(stats.three_point_made, 0) end::bigint as three_point_made,
  case when slot.did_not_play or advanced.game_id is null then null else coalesce(stats.three_point_attempted, 0) end::bigint as three_point_attempted,
  case when slot.did_not_play or advanced.game_id is null then null else coalesce(stats.free_throw_made, 0) end::bigint as free_throw_made,
  case when slot.did_not_play or advanced.game_id is null then null else coalesce(stats.free_throw_attempted, 0) end::bigint as free_throw_attempted,
  case when slot.did_not_play or advanced.game_id is null then null else coalesce(stats.offensive_rebounds, 0) end::bigint as offensive_rebounds,
  case when slot.did_not_play or advanced.game_id is null then null else coalesce(stats.defensive_rebounds, 0) end::bigint as defensive_rebounds,
  case when slot.did_not_play or advanced.game_id is null then null else coalesce(stats.assists, 0) end::bigint as assists,
  case when slot.did_not_play or advanced.game_id is null then null else coalesce(stats.turnovers, 0) end::bigint as turnovers,
  case when slot.did_not_play or advanced.game_id is null then null else coalesce(stats.steals, 0) end::bigint as steals,
  case when slot.did_not_play or advanced.game_id is null then null else coalesce(stats.blocks, 0) end::bigint as blocks,
  case when slot.did_not_play or advanced.game_id is null or not coalesce(stats.plus_minus_available, false) then null else coalesce(stats.plus_minus, 0) end::bigint as plus_minus,
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

create or replace view public.competition_boxscore_player_statistics
with (security_invoker = true)
as
with aggregates as (
  select
    game_stats.competition_id,
    game_stats.player_id,
    count(*) filter (
      where not game_stats.did_not_play and game_stats.official_points is not null
    )::bigint as games_played,
    count(*) filter (
      where not game_stats.did_not_play and game_stats.advanced_points is not null
    )::bigint as advanced_games_played,
    count(*) filter (
      where not game_stats.did_not_play and game_stats.is_starter
    )::bigint as starter_appearances,
    sum(game_stats.official_points) filter (where not game_stats.did_not_play)::bigint
      as official_points,
    sum(game_stats.advanced_points) filter (where not game_stats.did_not_play)::bigint
      as advanced_points,
    sum(game_stats.seconds_played) filter (where not game_stats.did_not_play)::bigint
      as seconds_played,
    sum(game_stats.two_point_made) filter (where not game_stats.did_not_play)::bigint
      as two_point_made,
    sum(game_stats.two_point_attempted) filter (where not game_stats.did_not_play)::bigint
      as two_point_attempted,
    sum(game_stats.three_point_made) filter (where not game_stats.did_not_play)::bigint
      as three_point_made,
    sum(game_stats.three_point_attempted) filter (where not game_stats.did_not_play)::bigint
      as three_point_attempted,
    sum(game_stats.free_throw_made) filter (where not game_stats.did_not_play)::bigint
      as free_throw_made,
    sum(game_stats.free_throw_attempted) filter (where not game_stats.did_not_play)::bigint
      as free_throw_attempted,
    sum(game_stats.offensive_rebounds) filter (where not game_stats.did_not_play)::bigint
      as offensive_rebounds,
    sum(game_stats.defensive_rebounds) filter (where not game_stats.did_not_play)::bigint
      as defensive_rebounds,
    sum(game_stats.assists) filter (where not game_stats.did_not_play)::bigint as assists,
    sum(game_stats.turnovers) filter (where not game_stats.did_not_play)::bigint as turnovers,
    sum(game_stats.steals) filter (where not game_stats.did_not_play)::bigint as steals,
    sum(game_stats.blocks) filter (where not game_stats.did_not_play)::bigint as blocks,
    case
      when count(game_stats.plus_minus) filter (
        where not game_stats.did_not_play and game_stats.advanced_points is not null
      ) = count(*) filter (
        where not game_stats.did_not_play and game_stats.advanced_points is not null
      )
      then sum(game_stats.plus_minus) filter (where not game_stats.did_not_play)::bigint
      else null
    end as plus_minus,
    sum(game_stats.fouls) filter (where not game_stats.did_not_play)::bigint as fouls
  from public.game_boxscore_player_statistics game_stats
  group by game_stats.competition_id, game_stats.player_id
  having count(*) filter (
    where not game_stats.did_not_play and game_stats.official_points is not null
  ) > 0
), roster_ranked as (
  select
    roster.competition_id,
    roster.player_id,
    roster.registration_id,
    registration.team_id,
    team.name as team_name,
    team.slug as team_slug,
    team.abbreviation as team_abbreviation,
    roster.jersey_number,
    roster.position as roster_position,
    row_number() over (
      partition by roster.competition_id, roster.player_id
      order by (roster.status = 'active') desc, roster.updated_at desc, roster.id desc
    ) as context_rank
  from public.roster_entries roster
  join public.team_registrations registration
    on registration.id = roster.registration_id
   and registration.competition_id = roster.competition_id
  join public.teams team on team.id = registration.team_id
)
select
  aggregate.competition_id,
  aggregate.player_id,
  player.full_name as player_name,
  player.slug as player_slug,
  roster.registration_id,
  roster.team_id,
  roster.team_name,
  roster.team_slug,
  roster.team_abbreviation,
  roster.jersey_number,
  roster.roster_position,
  aggregate.games_played,
  aggregate.advanced_games_played,
  aggregate.starter_appearances,
  aggregate.official_points,
  aggregate.advanced_points,
  aggregate.seconds_played,
  aggregate.two_point_made,
  aggregate.two_point_attempted,
  aggregate.three_point_made,
  aggregate.three_point_attempted,
  aggregate.free_throw_made,
  aggregate.free_throw_attempted,
  aggregate.offensive_rebounds,
  aggregate.defensive_rebounds,
  aggregate.assists,
  aggregate.turnovers,
  aggregate.steals,
  aggregate.blocks,
  aggregate.fouls,
  aggregate.plus_minus
from aggregates aggregate
join public.players player on player.id = aggregate.player_id
join roster_ranked roster
  on roster.competition_id = aggregate.competition_id
 and roster.player_id = aggregate.player_id
 and roster.context_rank = 1;

create or replace function private.publication_game_fingerprint(p_game_id bigint)
returns text language sql stable security definer set search_path='' as $$
  select md5((jsonb_build_object(
      'id',game.id,'competitionId',game.competition_id,'number',game.game_number,
      'scheduledAt',game.scheduled_at,'venue',game.venue,'status',game.status,
      'matchupId',game.matchup_id,'matchupGameNumber',game.matchup_game_number,
      'participants',coalesce((select jsonb_agg(jsonb_build_object(
        'registrationId',participant.registration_id,'side',participant.side
      ) order by participant.side) from public.game_participants participant
        where participant.game_id=game.id),'[]'::jsonb),
      'periodScores',coalesce((select jsonb_agg(jsonb_build_object(
        'registrationId',score.registration_id,'period',score.period_number,'points',score.points
      ) order by score.period_number,score.registration_id)
        from public.game_period_scores score
        where score.game_id=game.id and score.score_scope='period'),'[]'::jsonb),
      'officialResultSubmissionId',(select authority.submission_id
        from public.game_data_domain_authority authority
        where authority.game_id=game.id and authority.domain='official_result')
    ) || case when exists(
      select 1 from public.game_period_scores score
      where score.game_id=game.id and score.score_scope='game_total'
    ) then jsonb_build_object(
      'gameTotalScores',(select jsonb_agg(jsonb_build_object(
        'registrationId',score.registration_id,'points',score.points
      ) order by score.registration_id)
        from public.game_period_scores score
        where score.game_id=game.id and score.score_scope='game_total')
    ) else '{}'::jsonb end)::text)
  from public.games game where game.id=p_game_id;
$$;
revoke all on function private.publication_game_fingerprint(bigint)
from public,anon,authenticated;
