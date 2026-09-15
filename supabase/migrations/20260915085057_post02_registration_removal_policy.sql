alter table public.admin_mutation_audit
  drop constraint admin_mutation_audit_action_check,
  add constraint admin_mutation_audit_action_check check (action in (
    'registration_created','registration_transitioned','roster_replaced','manual_scoresheet_saved',
    'boxscore_import_confirmed','boxscore_team_stats_refreshed','final_placement_confirmed','player_created',
    'competition_gender_reviewed','data_profile_created','data_profile_activated',
    'competition_data_profile_assigned','player_sex_reviewed','game_data_authority_activated',
    'competition_created_from_preset','competition_entry_assigned','matchup_prepared','matchup_resolved',
    'competition_published','manual_fallback_confirmed','boxscore_supplement_confirmed',
    'manual_fallback_finalized','game_data_comparison_created','game_data_conflict_resolved',
    'fiba_candidate_staged',
    'registration_removed','registration_withdrawn'
  ));

create function private.guard_registration_withdrawal()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'withdrawn'
    and old.status is distinct from new.status
    and current_user <> 'postgres'
  then
    raise exception using errcode = 'BR053', message = 'BDB_REGISTRATION_WITHDRAWAL_POLICY_REQUIRED';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_registration_withdrawal() from public, anon, authenticated;
create trigger team_registrations_withdrawal_policy
before update of status on public.team_registrations
for each row execute function private.guard_registration_withdrawal();

-- Direct status writes cannot depend on a caller-settable custom GUC.
revoke update on public.team_registrations from authenticated;

create or replace function public.admin_transition_team_registration(
  p_registration_id bigint,
  p_status text
)
returns public.team_registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row public.team_registrations;
  result public.team_registrations;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if p_status = 'withdrawn' then
    raise exception using errcode = 'BR053', message = 'BDB_REGISTRATION_WITHDRAWAL_POLICY_REQUIRED';
  end if;
  if p_status not in ('confirmed', 'completed') then
    raise exception using errcode = 'BD102', message = 'BDB_INVALID_REGISTRATION_TRANSITION';
  end if;
  select * into current_row from public.team_registrations
  where id = p_registration_id for update;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_REGISTRATION_NOT_FOUND';
  end if;
  if not (
    current_row.status = p_status
    or (current_row.status = 'draft' and p_status = 'confirmed')
    or (current_row.status = 'confirmed' and p_status = 'completed')
  ) then
    raise exception using errcode = 'BD102', message = 'BDB_INVALID_REGISTRATION_TRANSITION';
  end if;
  if current_row.status = p_status then return current_row; end if;
  update public.team_registrations
  set status = p_status, confirmed_at = coalesce(confirmed_at, now())
  where id = p_registration_id returning * into strict result;
  insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
  values ('registration_transitioned','team_registration',result.id,
    jsonb_build_object('from',current_row.status,'to',result.status));
  return result;
end;
$$;
revoke all on function public.admin_transition_team_registration(bigint, text)
  from public, anon, authenticated;
grant execute on function public.admin_transition_team_registration(bigint, text)
  to authenticated;

create function public.admin_get_registration_removal_decision(p_registration_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  registration public.team_registrations;
  competition public.competitions;
  team_name text;
  roster_count bigint;
  assignment_count bigint;
  matchup_count bigint;
  game_count bigint;
  placement_count bigint;
  resolution_count bigint;
  publication_count bigint;
  decision text;
  reason_code text;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  select * into registration
  from public.team_registrations
  where id = p_registration_id;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_REGISTRATION_NOT_FOUND';
  end if;

  select * into strict competition
  from public.competitions
  where id = registration.competition_id;
  select name into strict team_name from public.teams where id = registration.team_id;

  select count(*) into roster_count
  from public.roster_entries where registration_id = registration.id;
  select count(*) into assignment_count
  from public.competition_entry_assignments where registration_id = registration.id;
  select count(*) into matchup_count
  from public.matchups
  where home_registration_id = registration.id or away_registration_id = registration.id;
  select count(*) into game_count
  from public.game_participants where registration_id = registration.id;
  select count(*) into placement_count
  from public.final_placements where registration_id = registration.id;
  select count(*) into resolution_count
  from public.matchup_resolutions
  where winner_registration_id = registration.id or loser_registration_id = registration.id;
  select count(*) into publication_count
  from private.competition_publication_registrations where registration_id = registration.id;

  if registration.status = 'completed' then
    decision := 'blocked';
    reason_code := 'completed_registration_immutable';
  elsif registration.status = 'withdrawn' then
    decision := 'withdraw';
    reason_code := 'already_withdrawn';
  elsif competition.status <> 'draft' or competition.published_at is not null
    or publication_count > 0 or game_count > 0 or placement_count > 0 or resolution_count > 0
  then
    decision := 'withdraw';
    reason_code := 'competitive_history_preserved';
  elsif registration.status = 'draft' and roster_count = 0 and assignment_count = 0
    and matchup_count = 0
  then
    decision := 'remove';
    reason_code := 'strictly_provisional';
  elsif registration.status in ('draft', 'confirmed') then
    decision := 'withdraw';
    reason_code := case
      when assignment_count > 0 then 'structure_dependency_preserved'
      when matchup_count > 0 then 'matchup_dependency_preserved'
      when roster_count > 0 then 'roster_history_preserved'
      else 'confirmed_registration_preserved'
    end;
  else
    decision := 'blocked';
    reason_code := 'unsupported_registration_state';
  end if;

  return jsonb_build_object(
    'registrationId', registration.id,
    'competitionId', registration.competition_id,
    'teamId', registration.team_id,
    'teamName', team_name,
    'currentStatus', registration.status,
    'decision', decision,
    'reasonCode', reason_code,
    'dependencies', jsonb_build_object(
      'rosterEntries', roster_count,
      'structureAssignments', assignment_count,
      'matchups', matchup_count,
      'games', game_count,
      'placements', placement_count,
      'resolutions', resolution_count,
      'publicationSnapshots', publication_count
    )
  );
end;
$$;

create function public.admin_apply_registration_removal(
  p_registration_id bigint,
  p_expected_decision text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  registration public.team_registrations;
  competition public.competitions;
  normalized_reason text := btrim(coalesce(p_reason, ''));
  decision jsonb;
  actual_decision text;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if p_expected_decision not in ('remove', 'withdraw')
    or char_length(normalized_reason) not between 10 and 500
  then
    raise exception using errcode = 'BR050', message = 'BDB_REGISTRATION_REMOVAL_INPUT_INVALID';
  end if;

  select * into registration
  from public.team_registrations
  where id = p_registration_id;
  if not found then
    if p_expected_decision = 'remove' and exists (
      select 1 from public.admin_mutation_audit
      where action = 'registration_removed' and entity_id = p_registration_id
    ) then
      return (
        select jsonb_build_object(
          'registrationId', audit.entity_id,
          'competitionId', (audit.metadata->>'competitionId')::bigint,
          'teamId', (audit.metadata->>'teamId')::bigint,
          'decision', 'remove',
          'reasonCode', audit.metadata->>'reasonCode',
          'outcome', 'unchanged'
        )
        from public.admin_mutation_audit audit
        where audit.action = 'registration_removed' and audit.entity_id = p_registration_id
        order by audit.occurred_at desc, audit.id desc
        limit 1
      );
    end if;
    raise exception using errcode = 'BD404', message = 'BDB_REGISTRATION_NOT_FOUND';
  end if;

  select * into competition
  from public.competitions
  where id = registration.competition_id
  for update;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_COMPETITION_NOT_FOUND';
  end if;

  select * into registration
  from public.team_registrations
  where id = p_registration_id
  for update;
  if not found then
    if p_expected_decision = 'remove' and exists (
      select 1 from public.admin_mutation_audit
      where action = 'registration_removed' and entity_id = p_registration_id
    ) then
      return (
        select jsonb_build_object(
          'registrationId', audit.entity_id,
          'competitionId', (audit.metadata->>'competitionId')::bigint,
          'teamId', (audit.metadata->>'teamId')::bigint,
          'decision', 'remove',
          'reasonCode', audit.metadata->>'reasonCode',
          'outcome', 'unchanged'
        )
        from public.admin_mutation_audit audit
        where audit.action = 'registration_removed' and audit.entity_id = p_registration_id
        order by audit.occurred_at desc, audit.id desc
        limit 1
      );
    end if;
    raise exception using errcode = 'BD404', message = 'BDB_REGISTRATION_NOT_FOUND';
  end if;

  decision := public.admin_get_registration_removal_decision(p_registration_id);
  actual_decision := decision->>'decision';

  if actual_decision = 'blocked' then
    raise exception using errcode = 'BR051', message = 'BDB_REGISTRATION_REMOVAL_BLOCKED';
  end if;
  if actual_decision <> p_expected_decision then
    raise exception using errcode = 'BR052', message = 'BDB_REGISTRATION_REMOVAL_CHANGED_RELOAD';
  end if;

  if actual_decision = 'withdraw' then
    if registration.status = 'withdrawn' then
      return decision || jsonb_build_object('outcome', 'unchanged');
    end if;
    if registration.status = 'completed' then
      raise exception using errcode = 'BR051', message = 'BDB_REGISTRATION_REMOVAL_BLOCKED';
    end if;

    update public.team_registrations
    set status = 'withdrawn',
        confirmed_at = coalesce(confirmed_at, clock_timestamp()),
        updated_at = clock_timestamp()
    where id = registration.id;

    update public.roster_entries
    set status = 'inactive',
        left_on = coalesce(left_on, current_date),
        updated_at = clock_timestamp()
    where registration_id = registration.id and status = 'active';

    insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
    values (
      'registration_withdrawn',
      'team_registration',
      registration.id,
      jsonb_build_object(
        'competitionId', registration.competition_id,
        'reason', normalized_reason,
        'reasonCode', decision->>'reasonCode'
      )
    );

    return public.admin_get_registration_removal_decision(registration.id)
      || jsonb_build_object('outcome', 'withdrawn');
  end if;

  delete from public.team_registrations where id = registration.id;
  insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
  values (
    'registration_removed',
    'team_registration',
    registration.id,
    jsonb_build_object(
      'competitionId', registration.competition_id,
      'teamId', registration.team_id,
      'reason', normalized_reason,
      'reasonCode', decision->>'reasonCode'
    )
  );

  return decision || jsonb_build_object('outcome', 'removed');
end;
$$;

revoke all on function public.admin_get_registration_removal_decision(bigint)
  from public, anon, authenticated;
revoke all on function public.admin_apply_registration_removal(bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_get_registration_removal_decision(bigint) to authenticated;
grant execute on function public.admin_apply_registration_removal(bigint, text, text) to authenticated;

comment on function public.admin_get_registration_removal_decision(bigint) is
  'Returns the authoritative AAL2 remove, withdraw or block decision without mutating the registration.';
comment on function public.admin_apply_registration_removal(bigint, text, text) is
  'Recomputes and applies the registration removal policy under competition and registration locks.';
