-- POST-03 / 07K: corrections never rewrite a consumed active graph. A new
-- revision carries prior outcomes, changes the selected winner, atomically
-- supersedes the source revision and leaves every old game untouched.
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
    'fiba_candidate_staged','registration_removed','registration_withdrawn','ruleset_cloned',
    'ruleset_draft_edited','competition_group_closed','matchup_administratively_resolved',
    'ruleset_amended'
  ));

alter table public.competition_entry_assignments
  add column carried_from_entry_id bigint
    references public.competition_entries(id) on delete restrict;
create index competition_entry_assignments_carried_from_idx
  on public.competition_entry_assignments(carried_from_entry_id)
  where carried_from_entry_id is not null;

create table public.competition_ruleset_amendments (
  id bigint generated always as identity primary key,
  competition_id bigint not null references public.competitions(id) on delete restrict,
  source_revision_id bigint not null,
  target_revision_id bigint not null unique,
  source_matchup_id bigint not null,
  target_matchup_id bigint not null unique,
  cutoff text not null check (cutoff = 'before_dependent_start'),
  before_snapshot jsonb not null check (jsonb_typeof(before_snapshot) = 'object'),
  after_snapshot jsonb not null check (jsonb_typeof(after_snapshot) = 'object'),
  reason text not null check (
    reason = btrim(reason) and char_length(reason) between 10 and 500
  ),
  amended_by uuid not null references auth.users(id) on delete restrict,
  amended_at timestamptz not null default now(),
  foreign key (source_revision_id, competition_id)
    references public.competition_ruleset_revisions(id, competition_id)
    on delete restrict,
  foreign key (target_revision_id, competition_id)
    references public.competition_ruleset_revisions(id, competition_id)
    on delete restrict,
  foreign key (source_matchup_id, source_revision_id, competition_id)
    references public.matchups(id, ruleset_revision_id, competition_id)
    on delete restrict,
  foreign key (target_matchup_id, target_revision_id, competition_id)
    references public.matchups(id, ruleset_revision_id, competition_id)
    on delete restrict
);
create index competition_ruleset_amendments_source_idx
  on public.competition_ruleset_amendments(source_revision_id, competition_id);
create index competition_ruleset_amendments_matchup_idx
  on public.competition_ruleset_amendments(source_matchup_id, competition_id);
create index competition_ruleset_amendments_actor_idx
  on public.competition_ruleset_amendments(amended_by, amended_at desc);

create table public.matchup_revision_outcomes (
  matchup_id bigint primary key,
  ruleset_revision_id bigint not null,
  competition_id bigint not null,
  source_matchup_id bigint not null,
  source_kind text not null check (
    source_kind in (
      'official_result', 'administrative_decision', 'carried_outcome', 'amendment'
    )
  ),
  winner_registration_id bigint not null,
  loser_registration_id bigint not null,
  amendment_id bigint references public.competition_ruleset_amendments(id)
    on delete restrict,
  reason text check (
    reason is null or (
      reason = btrim(reason) and char_length(reason) between 10 and 500
    )
  ),
  carried_by uuid not null references auth.users(id) on delete restrict,
  carried_at timestamptz not null default now(),
  check (winner_registration_id <> loser_registration_id),
  check (
    (source_kind = 'amendment' and amendment_id is not null and reason is not null)
    or (source_kind <> 'amendment' and amendment_id is null)
  ),
  foreign key (matchup_id, ruleset_revision_id, competition_id)
    references public.matchups(id, ruleset_revision_id, competition_id)
    on delete restrict,
  foreign key (source_matchup_id)
    references public.matchups(id) on delete restrict,
  foreign key (winner_registration_id, competition_id)
    references public.team_registrations(id, competition_id) on delete restrict,
  foreign key (loser_registration_id, competition_id)
    references public.team_registrations(id, competition_id) on delete restrict
);
create index matchup_revision_outcomes_revision_idx
  on public.matchup_revision_outcomes(ruleset_revision_id, competition_id);
create index matchup_revision_outcomes_source_idx
  on public.matchup_revision_outcomes(source_matchup_id);
create index matchup_revision_outcomes_winner_idx
  on public.matchup_revision_outcomes(winner_registration_id, competition_id);
create index matchup_revision_outcomes_loser_idx
  on public.matchup_revision_outcomes(loser_registration_id, competition_id);
create index matchup_revision_outcomes_amendment_idx
  on public.matchup_revision_outcomes(amendment_id)
  where amendment_id is not null;
create index matchup_revision_outcomes_actor_idx
  on public.matchup_revision_outcomes(carried_by);

create table private.ruleset_amendment_requests (
  request_id uuid primary key,
  actor_id uuid not null references auth.users(id) on delete restrict,
  source_matchup_id bigint not null references public.matchups(id) on delete restrict,
  expected_winner_registration_id bigint not null,
  corrected_winner_registration_id bigint not null,
  reason text not null,
  amendment_id bigint not null unique
    references public.competition_ruleset_amendments(id) on delete restrict,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index ruleset_amendment_requests_actor_idx
  on private.ruleset_amendment_requests(actor_id);
create index ruleset_amendment_requests_matchup_idx
  on private.ruleset_amendment_requests(source_matchup_id);

alter table public.competition_ruleset_amendments enable row level security;
alter table public.competition_ruleset_amendments force row level security;
alter table public.matchup_revision_outcomes enable row level security;
alter table public.matchup_revision_outcomes force row level security;
alter table private.ruleset_amendment_requests enable row level security;
alter table private.ruleset_amendment_requests force row level security;
revoke all on public.competition_ruleset_amendments,
  public.matchup_revision_outcomes,
  private.ruleset_amendment_requests
from public, anon, authenticated;
grant select on public.competition_ruleset_amendments,
  public.matchup_revision_outcomes
to authenticated;
create policy competition_ruleset_amendments_admin_select
on public.competition_ruleset_amendments for select to authenticated
using ((select public.is_current_admin_aal2()));
create policy matchup_revision_outcomes_admin_select
on public.matchup_revision_outcomes for select to authenticated
using ((select public.is_current_admin_aal2()));

create function private.guard_ruleset_amendment_snapshot()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception using errcode = 'BR090', message = 'BDB_RULESET_AMENDMENT_IMMUTABLE';
end;
$$;
revoke all on function private.guard_ruleset_amendment_snapshot()
  from public, anon, authenticated;
create trigger guard_competition_ruleset_amendment
before update or delete on public.competition_ruleset_amendments
for each row execute function private.guard_ruleset_amendment_snapshot();
create trigger guard_matchup_revision_outcome
before update or delete on public.matchup_revision_outcomes
for each row execute function private.guard_ruleset_amendment_snapshot();

-- A preset revision remains immutable. Its only allowed transition is the
-- one-way active -> superseded status change used by the atomic amendment.
create or replace function private.guard_preset_revision()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op <> 'INSERT' and old.preset_key is not null and old.status <> 'draft' then
    if not (
      tg_op = 'UPDATE'
      and old.status = 'active'
      and new.status = 'superseded'
      and (to_jsonb(new) - array['status', 'updated_at'])
        = (to_jsonb(old) - array['status', 'updated_at'])
    ) then
      raise exception using errcode = 'BR004', message = 'BDB_ACTIVE_RULESET_IMMUTABLE';
    end if;
  end if;
  if tg_op <> 'DELETE' and new.preset_key is not null and new.status <> 'draft' then
    if new.status not in ('active', 'superseded')
      or new.activated_at is null
      or private.preset_blueprint(new.id) is distinct from
        private.compile_competition_preset_v1(new.preset_key, new.entry_count)
      or (select count(*) from public.competition_entries
        where ruleset_revision_id = new.id) <> new.entry_count
      or (select count(*) from public.competition_slots
        where ruleset_revision_id = new.id) <>
        2 * (select count(*) from public.matchups
          where ruleset_revision_id = new.id)
    then
      raise exception using errcode = 'BR005', message = 'BDB_RULESET_VALIDATION_FAILED';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.guard_preset_revision()
  from public, anon, authenticated;

-- Carried assignments preserve the exact old seed/team relation even when a
-- registration was later withdrawn. Normal new assignments still require a
-- confirmed registration.
create or replace function private.guard_entry_assignment()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op <> 'INSERT' then
    raise exception using errcode = 'BR021', message = 'BDB_ENTRY_ASSIGNMENT_IMMUTABLE';
  end if;
  perform 1 from public.competitions
  where id = new.competition_id and status = 'draft' and published_at is null
  for update;
  if not found then
    raise exception using errcode = 'BR020', message = 'BDB_PRIVATE_EDITION_REQUIRED';
  end if;
  perform 1 from public.competition_ruleset_revisions revision
  where revision.id = new.ruleset_revision_id
    and revision.competition_id = new.competition_id
    and revision.status = 'active' and revision.preset_key is not null
  for update;
  if not found then
    raise exception using errcode = 'BR022', message = 'BDB_ACTIVE_PRESET_REQUIRED';
  end if;
  if new.carried_from_entry_id is null then
    perform 1 from public.team_registrations
    where id = new.registration_id and competition_id = new.competition_id
      and status = 'confirmed' for update;
    if not found then
      raise exception using errcode = 'BR023',
        message = 'BDB_CONFIRMED_REGISTRATION_REQUIRED';
    end if;
  elsif not exists(
    select 1
    from public.competition_entry_assignments source_assignment
    join public.competition_entries source_entry
      on source_entry.id = source_assignment.entry_id
    join public.competition_ruleset_revisions target_revision
      on target_revision.id = new.ruleset_revision_id
    where source_assignment.entry_id = new.carried_from_entry_id
      and source_assignment.registration_id = new.registration_id
      and source_assignment.competition_id = new.competition_id
      and source_entry.ruleset_revision_id = target_revision.cloned_from_revision_id
  ) then
    raise exception using errcode = 'BR091', message = 'BDB_AMENDMENT_CARRY_INVALID';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_entry_assignment()
  from public, anon, authenticated;

create or replace function private.guard_single_matchup_resolution()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_table_name <> 'matchup_resolutions' and exists(
    select 1 from public.matchup_resolutions resolution
    where resolution.matchup_id = new.matchup_id
  ) then
    raise exception using errcode = 'BR081', message = 'BDB_MATCHUP_ALREADY_RESOLVED';
  end if;
  if tg_table_name <> 'matchup_administrative_resolutions' and exists(
    select 1 from public.matchup_administrative_resolutions resolution
    where resolution.matchup_id = new.matchup_id
  ) then
    raise exception using errcode = 'BR081', message = 'BDB_MATCHUP_ALREADY_RESOLVED';
  end if;
  if tg_table_name <> 'matchup_revision_outcomes' and exists(
    select 1 from public.matchup_revision_outcomes outcome
    where outcome.matchup_id = new.matchup_id
  ) then
    raise exception using errcode = 'BR081', message = 'BDB_MATCHUP_ALREADY_RESOLVED';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_single_matchup_resolution()
  from public, anon, authenticated;
create trigger ensure_revision_outcome_is_single
before insert on public.matchup_revision_outcomes
for each row execute function private.guard_single_matchup_resolution();

create or replace function private.resolved_slot_registration(p_slot_id bigint)
returns bigint language sql stable security invoker set search_path = '' as $$
  select case slot.origin_kind
    when 'entry' then assignment.registration_id
    when 'winner' then coalesce(
      resolution.winner_registration_id,
      administrative.winner_registration_id,
      carried.winner_registration_id
    )
    when 'undefined' then advancement.registration_id
  end
  from public.competition_slots slot
  left join public.competition_entry_assignments assignment
    on assignment.entry_id = slot.entry_id
   and assignment.ruleset_revision_id = slot.ruleset_revision_id
   and assignment.competition_id = slot.competition_id
  left join public.matchup_resolutions resolution
    on resolution.matchup_id = slot.source_matchup_id
   and resolution.ruleset_revision_id = slot.ruleset_revision_id
   and resolution.competition_id = slot.competition_id
  left join public.matchup_administrative_resolutions administrative
    on administrative.matchup_id = slot.source_matchup_id
   and administrative.ruleset_revision_id = slot.ruleset_revision_id
   and administrative.competition_id = slot.competition_id
  left join public.matchup_revision_outcomes carried
    on carried.matchup_id = slot.source_matchup_id
   and carried.ruleset_revision_id = slot.ruleset_revision_id
   and carried.competition_id = slot.competition_id
  left join public.competition_group_advancements advancement
    on advancement.slot_id = slot.id
   and advancement.ruleset_revision_id = slot.ruleset_revision_id
   and advancement.competition_id = slot.competition_id
  where slot.id = p_slot_id;
$$;
revoke all on function private.resolved_slot_registration(bigint)
  from public, anon, authenticated;

create function private.matchup_outcome_document(p_matchup_id bigint)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object(
      'kind', 'official_result',
      'winnerRegistrationId', resolution.winner_registration_id,
      'loserRegistrationId', resolution.loser_registration_id,
      'gameId', resolution.game_id,
      'submissionId', resolution.submission_id
    ) from public.matchup_resolutions resolution
      where resolution.matchup_id = p_matchup_id),
    (select jsonb_build_object(
      'kind', 'administrative_decision',
      'winnerRegistrationId', resolution.winner_registration_id,
      'loserRegistrationId', resolution.loser_registration_id,
      'decisionType', resolution.decision_type,
      'reason', resolution.reason
    ) from public.matchup_administrative_resolutions resolution
      where resolution.matchup_id = p_matchup_id),
    (select jsonb_build_object(
      'kind', outcome.source_kind,
      'winnerRegistrationId', outcome.winner_registration_id,
      'loserRegistrationId', outcome.loser_registration_id,
      'amendmentId', outcome.amendment_id,
      'reason', outcome.reason
    ) from public.matchup_revision_outcomes outcome
      where outcome.matchup_id = p_matchup_id)
  );
$$;
revoke all on function private.matchup_outcome_document(bigint)
  from public, anon, authenticated;

create function public.admin_get_ruleset_amendment_impact(
  p_matchup_id bigint,
  p_corrected_winner_registration_id bigint
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  matchup public.matchups;
  outcome jsonb;
  descendants jsonb;
  cutoff_reached boolean;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  select * into matchup from public.matchups where id = p_matchup_id;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_MATCHUP_NOT_FOUND';
  end if;
  outcome := private.matchup_outcome_document(matchup.id);
  if outcome is null or p_corrected_winner_registration_id is null
    or p_corrected_winner_registration_id <>
      (outcome->>'loserRegistrationId')::bigint
  then
    raise exception using errcode = 'BR092',
      message = 'BDB_RULESET_AMENDMENT_INPUT_INVALID';
  end if;
  with recursive dependent_matchups as (
    select dependent.id
    from public.competition_slots slot
    join public.matchups dependent
      on slot.id in (dependent.home_slot_id, dependent.away_slot_id)
    where slot.source_matchup_id = matchup.id
    union
    select next_matchup.id
    from dependent_matchups previous
    join public.competition_slots slot
      on slot.source_matchup_id = previous.id
    join public.matchups next_matchup
      on slot.id in (next_matchup.home_slot_id, next_matchup.away_slot_id)
  ), impact as (
    select dependent.id matchup_id, game.id game_id, game.status,
      game.started_at,
      exists(select 1 from public.game_data_submissions submission
        where submission.game_id = game.id) has_submission
    from dependent_matchups dependent
    left join public.games game
      on game.matchup_id = dependent.id and game.matchup_game_number = 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'matchupId', impact.matchup_id, 'gameId', impact.game_id,
      'status', impact.status, 'startedAt', impact.started_at,
      'hasSubmission', impact.has_submission
    ) order by impact.matchup_id), '[]'::jsonb),
    coalesce(bool_or(impact.started_at is not null
      or impact.status in ('live', 'final')
      or impact.has_submission), false)
  into descendants, cutoff_reached
  from impact;
  return jsonb_build_object(
    'matchupId', matchup.id,
    'sourceRevisionId', matchup.ruleset_revision_id,
    'before', outcome,
    'after', jsonb_build_object(
      'kind', 'amendment',
      'winnerRegistrationId', p_corrected_winner_registration_id,
      'loserRegistrationId', (outcome->>'winnerRegistrationId')::bigint
    ),
    'cutoff', case when cutoff_reached then 'dependent_started'
      else 'before_dependent_start' end,
    'canAmend', not cutoff_reached,
    'dependents', descendants
  );
end;
$$;

create function public.admin_amend_matchup_outcome(
  p_request_id uuid,
  p_matchup_id bigint,
  p_expected_winner_registration_id bigint,
  p_corrected_winner_registration_id bigint,
  p_reason text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  existing private.ruleset_amendment_requests;
  source_matchup public.matchups;
  source_revision public.competition_ruleset_revisions;
  before_document jsonb;
  after_document jsonb;
  clone_result jsonb;
  target_revision_id bigint;
  target_matchup_id bigint;
  amendment_id bigint;
  normalized_reason text := btrim(coalesce(p_reason, ''));
  cancelled_games integer := 0;
  result jsonb;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if p_request_id is null or p_matchup_id is null
    or p_expected_winner_registration_id is null
    or p_corrected_winner_registration_id is null
    or p_expected_winner_registration_id = p_corrected_winner_registration_id
    or char_length(normalized_reason) not between 10 and 500
  then
    raise exception using errcode = 'BR092',
      message = 'BDB_RULESET_AMENDMENT_INPUT_INVALID';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 323));
  select * into existing from private.ruleset_amendment_requests request
  where request.request_id = p_request_id;
  if found then
    if existing.actor_id <> auth.uid()
      or existing.source_matchup_id <> p_matchup_id
      or existing.expected_winner_registration_id <>
        p_expected_winner_registration_id
      or existing.corrected_winner_registration_id <>
        p_corrected_winner_registration_id
      or existing.reason <> normalized_reason
    then
      raise exception using errcode = 'BR010', message = 'BDB_IDEMPOTENCY_CONFLICT';
    end if;
    return existing.result || jsonb_build_object('outcome', 'unchanged');
  end if;

  select * into source_matchup from public.matchups where id = p_matchup_id;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_MATCHUP_NOT_FOUND';
  end if;
  perform 1 from public.competitions competition
  where competition.id = source_matchup.competition_id
    and competition.status = 'draft' and competition.published_at is null
  for update;
  if not found then
    raise exception using errcode = 'BR020', message = 'BDB_PRIVATE_EDITION_REQUIRED';
  end if;
  select * into source_revision from public.competition_ruleset_revisions
  where id = source_matchup.ruleset_revision_id for update;
  if source_revision.status <> 'active'
    or source_revision.preset_key <> 'single_elimination'
  then
    raise exception using errcode = 'BR093',
      message = 'BDB_ACTIVE_KNOCKOUT_AMENDMENT_REQUIRED';
  end if;
  select * into source_matchup from public.matchups
  where id = p_matchup_id for update;
  before_document := private.matchup_outcome_document(source_matchup.id);
  if before_document is null
    or (before_document->>'winnerRegistrationId')::bigint <>
      p_expected_winner_registration_id
    or (before_document->>'loserRegistrationId')::bigint <>
      p_corrected_winner_registration_id
  then
    raise exception using errcode = 'BR094',
      message = 'BDB_RULESET_AMENDMENT_CHANGED_RELOAD';
  end if;

  -- Lock every downstream game in deterministic order before evaluating the
  -- cutoff. Any started game or submission makes this correction impossible.
  perform 1
  from public.games game
  where game.matchup_id in (
    with recursive dependent_matchups as (
      select dependent.id
      from public.competition_slots slot
      join public.matchups dependent
        on slot.id in (dependent.home_slot_id, dependent.away_slot_id)
      where slot.source_matchup_id = source_matchup.id
      union
      select next_matchup.id
      from dependent_matchups previous
      join public.competition_slots slot
        on slot.source_matchup_id = previous.id
      join public.matchups next_matchup
        on slot.id in (next_matchup.home_slot_id, next_matchup.away_slot_id)
    )
    select id from dependent_matchups
  )
  order by game.id for update;
  if exists(
    select 1 from public.games game
    where game.matchup_id in (
      with recursive dependent_matchups as (
        select dependent.id
        from public.competition_slots slot
        join public.matchups dependent
          on slot.id in (dependent.home_slot_id, dependent.away_slot_id)
        where slot.source_matchup_id = source_matchup.id
        union
        select next_matchup.id
        from dependent_matchups previous
        join public.competition_slots slot
          on slot.source_matchup_id = previous.id
        join public.matchups next_matchup
          on slot.id in (next_matchup.home_slot_id, next_matchup.away_slot_id)
      )
      select id from dependent_matchups
    )
    and (
      game.started_at is not null or game.status in ('live', 'final')
      or exists(select 1 from public.game_data_submissions submission
        where submission.game_id = game.id)
    )
  ) then
    raise exception using errcode = 'BR095',
      message = 'BDB_AMENDMENT_CUTOFF_REACHED';
  end if;

  clone_result := public.admin_clone_competition_ruleset(
    gen_random_uuid(), source_matchup.competition_id, source_revision.id, false
  );
  target_revision_id := (clone_result->>'rulesetRevisionId')::bigint;
  update public.competition_ruleset_revisions
  set preset_key = source_revision.preset_key,
      preset_version = source_revision.preset_version,
      entry_count = source_revision.entry_count
  where id = target_revision_id and status = 'draft';
  select target.id into target_matchup_id
  from public.matchups target
  where target.ruleset_revision_id = target_revision_id
    and target.code = source_matchup.code;
  if target_matchup_id is null then
    raise exception using errcode = 'BR096',
      message = 'BDB_AMENDMENT_CLONE_INVALID';
  end if;

  update public.games game set status = 'cancelled'
  where game.matchup_id in (
    with recursive dependent_matchups as (
      select dependent.id
      from public.competition_slots slot
      join public.matchups dependent
        on slot.id in (dependent.home_slot_id, dependent.away_slot_id)
      where slot.source_matchup_id = source_matchup.id
      union
      select next_matchup.id
      from dependent_matchups previous
      join public.competition_slots slot
        on slot.source_matchup_id = previous.id
      join public.matchups next_matchup
        on slot.id in (next_matchup.home_slot_id, next_matchup.away_slot_id)
    )
    select id from dependent_matchups
  ) and game.status in ('draft', 'scheduled') and game.started_at is null;
  get diagnostics cancelled_games = row_count;

  update public.competition_ruleset_revisions
  set status = 'superseded', updated_at = now()
  where id = source_revision.id;
  update public.competition_ruleset_revisions
  set status = 'active', activated_at = now(), updated_at = now()
  where id = target_revision_id and status = 'draft';

  insert into public.competition_entry_assignments(
    entry_id, ruleset_revision_id, competition_id, registration_id,
    assigned_by, carried_from_entry_id
  )
  select target_entry.id, target_revision_id, source_assignment.competition_id,
    source_assignment.registration_id, auth.uid(), source_entry.id
  from public.competition_entry_assignments source_assignment
  join public.competition_entries source_entry
    on source_entry.id = source_assignment.entry_id
  join public.competition_entries target_entry
    on target_entry.ruleset_revision_id = target_revision_id
   and target_entry.seed = source_entry.seed
  where source_assignment.ruleset_revision_id = source_revision.id;

  after_document := jsonb_build_object(
    'kind', 'amendment',
    'winnerRegistrationId', p_corrected_winner_registration_id,
    'loserRegistrationId', p_expected_winner_registration_id
  );
  insert into public.competition_ruleset_amendments(
    competition_id, source_revision_id, target_revision_id,
    source_matchup_id, target_matchup_id, cutoff,
    before_snapshot, after_snapshot, reason, amended_by
  ) values (
    source_matchup.competition_id, source_revision.id, target_revision_id,
    source_matchup.id, target_matchup_id, 'before_dependent_start',
    before_document, after_document, normalized_reason, auth.uid()
  ) returning id into amendment_id;

  with source_outcomes as (
    select resolution.matchup_id, 'official_result'::text source_kind,
      resolution.winner_registration_id, resolution.loser_registration_id,
      null::text reason
    from public.matchup_resolutions resolution
    where resolution.ruleset_revision_id = source_revision.id
    union all
    select resolution.matchup_id, 'administrative_decision',
      resolution.winner_registration_id, resolution.loser_registration_id,
      resolution.reason
    from public.matchup_administrative_resolutions resolution
    where resolution.ruleset_revision_id = source_revision.id
    union all
    select outcome.matchup_id, 'carried_outcome',
      outcome.winner_registration_id, outcome.loser_registration_id,
      outcome.reason
    from public.matchup_revision_outcomes outcome
    where outcome.ruleset_revision_id = source_revision.id
  )
  insert into public.matchup_revision_outcomes(
    matchup_id, ruleset_revision_id, competition_id, source_matchup_id,
    source_kind, winner_registration_id, loser_registration_id,
    amendment_id, reason, carried_by
  )
  select target.id, target_revision_id, source_matchup.competition_id,
    source.matchup_id,
    case when source.matchup_id = source_matchup.id
      then 'amendment' else source.source_kind end,
    case when source.matchup_id = source_matchup.id
      then p_corrected_winner_registration_id
      else source.winner_registration_id end,
    case when source.matchup_id = source_matchup.id
      then p_expected_winner_registration_id
      else source.loser_registration_id end,
    case when source.matchup_id = source_matchup.id then amendment_id end,
    case when source.matchup_id = source_matchup.id
      then normalized_reason else source.reason end,
    auth.uid()
  from source_outcomes source
  join public.matchups source_node on source_node.id = source.matchup_id
  join public.matchups target
    on target.ruleset_revision_id = target_revision_id
   and target.code = source_node.code;

  update public.matchups target
  set home_registration_id =
        private.resolved_slot_registration(target.home_slot_id),
      away_registration_id =
        private.resolved_slot_registration(target.away_slot_id)
  where target.ruleset_revision_id = target_revision_id
    and (
      target.home_registration_id is distinct from
        private.resolved_slot_registration(target.home_slot_id)
      or target.away_registration_id is distinct from
        private.resolved_slot_registration(target.away_slot_id)
    );

  result := jsonb_build_object(
    'amendmentId', amendment_id,
    'sourceRevisionId', source_revision.id,
    'targetRevisionId', target_revision_id,
    'sourceMatchupId', source_matchup.id,
    'targetMatchupId', target_matchup_id,
    'cutoff', 'before_dependent_start',
    'before', before_document,
    'after', after_document,
    'cancelledGames', cancelled_games,
    'outcome', 'amended'
  );
  insert into private.ruleset_amendment_requests(
    request_id, actor_id, source_matchup_id,
    expected_winner_registration_id, corrected_winner_registration_id,
    reason, amendment_id, result
  ) values (
    p_request_id, auth.uid(), source_matchup.id,
    p_expected_winner_registration_id, p_corrected_winner_registration_id,
    normalized_reason, amendment_id, result
  );
  insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
  values ('ruleset_amended', 'competition_ruleset_revision', target_revision_id,
    jsonb_build_object(
      'competitionId', source_matchup.competition_id,
      'sourceRevisionId', source_revision.id,
      'sourceMatchupId', source_matchup.id,
      'targetMatchupId', target_matchup_id,
      'amendmentId', amendment_id,
      'cutoff', 'before_dependent_start',
      'before', before_document,
      'after', after_document,
      'cancelledGames', cancelled_games
    ));
  return result;
end;
$$;

revoke all on function public.admin_get_ruleset_amendment_impact(bigint, bigint)
  from public, anon, authenticated;
revoke all on function public.admin_amend_matchup_outcome(
  uuid, bigint, bigint, bigint, text
) from public, anon, authenticated;
grant execute on function public.admin_get_ruleset_amendment_impact(bigint, bigint)
  to authenticated;
grant execute on function public.admin_amend_matchup_outcome(
  uuid, bigint, bigint, bigint, text
) to authenticated;

comment on table public.competition_ruleset_amendments is
  'Immutable before/after evidence for a one-way ruleset revision amendment.';
comment on function public.admin_amend_matchup_outcome(
  uuid, bigint, bigint, bigint, text
) is
  'Clones and atomically activates a corrected knockout revision before any dependent game starts.';
