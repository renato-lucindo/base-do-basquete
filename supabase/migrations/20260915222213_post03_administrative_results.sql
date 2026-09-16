-- POST-03 / 07J: resolve a matchup by explicit sporting decision without
-- inventing a game or score. The decision is immutable and can feed either a
-- knockout winner slot or the later immutable group-closure snapshot.
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
    'ruleset_draft_edited','competition_group_closed','matchup_administratively_resolved'
  ));

create table public.matchup_administrative_resolutions (
  matchup_id bigint primary key,
  ruleset_revision_id bigint not null,
  competition_id bigint not null,
  decision_type text not null check (
    decision_type in ('walkover', 'withdrawal', 'administrative_decision')
  ),
  winner_registration_id bigint not null,
  loser_registration_id bigint not null,
  reason text not null check (
    reason = btrim(reason) and char_length(reason) between 10 and 500
  ),
  cancelled_game_id bigint,
  resolved_by uuid not null references auth.users(id) on delete restrict,
  resolved_at timestamptz not null default now(),
  check (winner_registration_id <> loser_registration_id),
  foreign key (matchup_id, ruleset_revision_id, competition_id)
    references public.matchups(id, ruleset_revision_id, competition_id)
    on delete restrict,
  foreign key (winner_registration_id, competition_id)
    references public.team_registrations(id, competition_id) on delete restrict,
  foreign key (loser_registration_id, competition_id)
    references public.team_registrations(id, competition_id) on delete restrict,
  foreign key (cancelled_game_id, competition_id)
    references public.games(id, competition_id) on delete restrict
);
create index matchup_administrative_resolutions_context_idx
  on public.matchup_administrative_resolutions(ruleset_revision_id, competition_id);
create index matchup_administrative_resolutions_winner_idx
  on public.matchup_administrative_resolutions(winner_registration_id, competition_id);
create index matchup_administrative_resolutions_loser_idx
  on public.matchup_administrative_resolutions(loser_registration_id, competition_id);
create index matchup_administrative_resolutions_cancelled_game_idx
  on public.matchup_administrative_resolutions(cancelled_game_id, competition_id)
  where cancelled_game_id is not null;
create index matchup_administrative_resolutions_actor_idx
  on public.matchup_administrative_resolutions(resolved_by, resolved_at desc);

create table private.matchup_administrative_resolution_requests (
  request_id uuid primary key,
  actor_id uuid not null references auth.users(id) on delete restrict,
  matchup_id bigint not null references public.matchups(id) on delete restrict,
  expected_home_registration_id bigint not null,
  expected_away_registration_id bigint not null,
  winner_registration_id bigint not null,
  decision_type text not null,
  reason text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index matchup_administrative_requests_actor_idx
  on private.matchup_administrative_resolution_requests(actor_id);
create index matchup_administrative_requests_matchup_idx
  on private.matchup_administrative_resolution_requests(matchup_id);

alter table public.matchup_administrative_resolutions enable row level security;
alter table public.matchup_administrative_resolutions force row level security;
alter table private.matchup_administrative_resolution_requests enable row level security;
alter table private.matchup_administrative_resolution_requests force row level security;
revoke all on public.matchup_administrative_resolutions,
  private.matchup_administrative_resolution_requests
from public, anon, authenticated;
grant select on public.matchup_administrative_resolutions to authenticated;
create policy matchup_administrative_resolutions_admin_select
on public.matchup_administrative_resolutions for select to authenticated
using ((select public.is_current_admin_aal2()));

create function private.guard_administrative_resolution_snapshot()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op <> 'INSERT' then
    raise exception using errcode = 'BR080',
      message = 'BDB_ADMINISTRATIVE_RESOLUTION_IMMUTABLE';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_administrative_resolution_snapshot()
  from public, anon, authenticated;
create trigger guard_matchup_administrative_resolution
before update or delete on public.matchup_administrative_resolutions
for each row execute function private.guard_administrative_resolution_snapshot();

create function private.guard_single_matchup_resolution()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_table_name = 'matchup_resolutions' and exists (
    select 1 from public.matchup_administrative_resolutions resolution
    where resolution.matchup_id = new.matchup_id
  ) then
    raise exception using errcode = 'BR081', message = 'BDB_MATCHUP_ALREADY_RESOLVED';
  end if;
  if tg_table_name = 'matchup_administrative_resolutions' and exists (
    select 1 from public.matchup_resolutions resolution
    where resolution.matchup_id = new.matchup_id
  ) then
    raise exception using errcode = 'BR081', message = 'BDB_MATCHUP_ALREADY_RESOLVED';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_single_matchup_resolution()
  from public, anon, authenticated;
create trigger ensure_matchup_resolution_is_single
before insert on public.matchup_resolutions
for each row execute function private.guard_single_matchup_resolution();
create trigger ensure_administrative_resolution_is_single
before insert on public.matchup_administrative_resolutions
for each row execute function private.guard_single_matchup_resolution();

create or replace function private.resolved_slot_registration(p_slot_id bigint)
returns bigint language sql stable security invoker set search_path = '' as $$
  select case slot.origin_kind
    when 'entry' then assignment.registration_id
    when 'winner' then coalesce(
      resolution.winner_registration_id,
      administrative.winner_registration_id
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
  left join public.competition_group_advancements advancement
    on advancement.slot_id = slot.id
   and advancement.ruleset_revision_id = slot.ruleset_revision_id
   and advancement.competition_id = slot.competition_id
  where slot.id = p_slot_id;
$$;
revoke all on function private.resolved_slot_registration(bigint)
  from public, anon, authenticated;

create function public.admin_get_matchup_administrative_impact(
  p_matchup_id bigint,
  p_winner_registration_id bigint
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  matchup public.matchups;
  game public.games;
  dependent_count integer;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  select * into matchup from public.matchups where id = p_matchup_id;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_MATCHUP_NOT_FOUND';
  end if;
  if p_winner_registration_id not in (
    matchup.home_registration_id, matchup.away_registration_id
  ) then
    raise exception using errcode = 'BR082',
      message = 'BDB_ADMINISTRATIVE_DECISION_INPUT_INVALID';
  end if;
  select * into game from public.games
  where matchup_id = matchup.id and matchup_game_number = 1;
  select count(*) into dependent_count
  from public.competition_slots slot
  where slot.source_matchup_id = matchup.id and slot.origin_kind = 'winner';
  return jsonb_build_object(
    'matchupId', matchup.id,
    'homeRegistrationId', matchup.home_registration_id,
    'awayRegistrationId', matchup.away_registration_id,
    'winnerRegistrationId', p_winner_registration_id,
    'loserRegistrationId', case
      when p_winner_registration_id = matchup.home_registration_id
      then matchup.away_registration_id else matchup.home_registration_id end,
    'game', case when game.id is null then null else jsonb_build_object(
      'id', game.id, 'status', game.status, 'startedAt', game.started_at
    ) end,
    'dependentSlots', dependent_count,
    'alreadyResolved', exists(
      select 1 from public.matchup_resolutions resolution
      where resolution.matchup_id = matchup.id
    ) or exists(
      select 1 from public.matchup_administrative_resolutions resolution
      where resolution.matchup_id = matchup.id
    )
  );
end;
$$;

create function public.admin_resolve_matchup_administratively(
  p_request_id uuid,
  p_matchup_id bigint,
  p_expected_home_registration_id bigint,
  p_expected_away_registration_id bigint,
  p_winner_registration_id bigint,
  p_decision_type text,
  p_reason text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  existing private.matchup_administrative_resolution_requests;
  matchup public.matchups;
  game public.games;
  loser_registration_id bigint;
  normalized_reason text := btrim(coalesce(p_reason, ''));
  updated_matchups integer := 0;
  result jsonb;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if p_request_id is null or p_matchup_id is null
    or p_expected_home_registration_id is null
    or p_expected_away_registration_id is null
    or p_winner_registration_id is null
    or p_decision_type not in (
      'walkover', 'withdrawal', 'administrative_decision'
    )
    or char_length(normalized_reason) not between 10 and 500
  then
    raise exception using errcode = 'BR082',
      message = 'BDB_ADMINISTRATIVE_DECISION_INPUT_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 319));
  select * into existing
  from private.matchup_administrative_resolution_requests request
  where request.request_id = p_request_id;
  if found then
    if existing.actor_id <> auth.uid()
      or existing.matchup_id <> p_matchup_id
      or existing.expected_home_registration_id <> p_expected_home_registration_id
      or existing.expected_away_registration_id <> p_expected_away_registration_id
      or existing.winner_registration_id <> p_winner_registration_id
      or existing.decision_type <> p_decision_type
      or existing.reason <> normalized_reason
    then
      raise exception using errcode = 'BR010', message = 'BDB_IDEMPOTENCY_CONFLICT';
    end if;
    return existing.result || jsonb_build_object('outcome', 'unchanged');
  end if;

  select * into matchup from public.matchups where id = p_matchup_id;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_MATCHUP_NOT_FOUND';
  end if;
  perform 1 from public.competitions competition
  where competition.id = matchup.competition_id
    and competition.status <> 'archived' for update;
  if not found then
    raise exception using errcode = 'BR032', message = 'BDB_ACTIVE_COMPETITION_REQUIRED';
  end if;
  perform 1 from public.competition_ruleset_revisions revision
  where revision.id = matchup.ruleset_revision_id
    and revision.status = 'active' for update;
  if not found then
    raise exception using errcode = 'BR022', message = 'BDB_ACTIVE_PRESET_REQUIRED';
  end if;
  select * into matchup from public.matchups where id = p_matchup_id for update;
  if matchup.home_registration_id is distinct from p_expected_home_registration_id
    or matchup.away_registration_id is distinct from p_expected_away_registration_id
    or p_expected_home_registration_id = p_expected_away_registration_id
    or p_winner_registration_id not in (
      p_expected_home_registration_id, p_expected_away_registration_id
    )
  then
    raise exception using errcode = 'BR083',
      message = 'BDB_MATCHUP_PARTICIPANTS_CHANGED_RELOAD';
  end if;
  loser_registration_id := case
    when p_winner_registration_id = matchup.home_registration_id
    then matchup.away_registration_id else matchup.home_registration_id end;

  if exists(select 1 from public.matchup_resolutions resolution
      where resolution.matchup_id = matchup.id)
    or exists(select 1 from public.matchup_administrative_resolutions resolution
      where resolution.matchup_id = matchup.id)
  then
    raise exception using errcode = 'BR081', message = 'BDB_MATCHUP_ALREADY_RESOLVED';
  end if;
  if exists(
    select 1 from public.competition_rounds round_item
    join public.competition_group_closures closure
      on closure.group_id = round_item.group_id
    where round_item.id = matchup.round_id
  ) then
    raise exception using errcode = 'BR070', message = 'BDB_GROUP_CLOSURE_IMMUTABLE';
  end if;

  select * into game from public.games
  where matchup_id = matchup.id and matchup_game_number = 1 for update;
  if found and (
    game.status not in ('draft', 'scheduled')
    or game.started_at is not null
    or exists(select 1 from public.game_data_submissions submission
      where submission.game_id = game.id)
    or exists(select 1 from public.game_period_scores score
      where score.game_id = game.id)
  ) then
    raise exception using errcode = 'BR084',
      message = 'BDB_STARTED_GAME_REQUIRES_AMENDMENT';
  end if;
  if exists(
    select 1 from public.competition_slots slot
    join public.matchups dependent
      on slot.id in (dependent.home_slot_id, dependent.away_slot_id)
    join public.games dependent_game on dependent_game.matchup_id = dependent.id
    where slot.source_matchup_id = matchup.id
      and (dependent_game.started_at is not null
        or dependent_game.status in ('live', 'final'))
  ) then
    raise exception using errcode = 'BR084',
      message = 'BDB_STARTED_GAME_REQUIRES_AMENDMENT';
  end if;

  if game.id is not null then
    update public.games set status = 'cancelled' where id = game.id;
  end if;
  insert into public.matchup_administrative_resolutions(
    matchup_id, ruleset_revision_id, competition_id, decision_type,
    winner_registration_id, loser_registration_id, reason,
    cancelled_game_id, resolved_by
  ) values (
    matchup.id, matchup.ruleset_revision_id, matchup.competition_id,
    p_decision_type, p_winner_registration_id, loser_registration_id,
    normalized_reason, game.id, auth.uid()
  );

  update public.matchups dependent
  set home_registration_id =
        private.resolved_slot_registration(dependent.home_slot_id),
      away_registration_id =
        private.resolved_slot_registration(dependent.away_slot_id)
  where dependent.ruleset_revision_id = matchup.ruleset_revision_id
    and exists(
      select 1 from public.competition_slots slot
      where slot.id in (dependent.home_slot_id, dependent.away_slot_id)
        and slot.origin_kind = 'winner'
        and slot.source_matchup_id = matchup.id
    )
    and (
      dependent.home_registration_id is distinct from
        private.resolved_slot_registration(dependent.home_slot_id)
      or dependent.away_registration_id is distinct from
        private.resolved_slot_registration(dependent.away_slot_id)
    );
  get diagnostics updated_matchups = row_count;

  result := jsonb_build_object(
    'matchupId', matchup.id,
    'decisionType', p_decision_type,
    'winnerRegistrationId', p_winner_registration_id,
    'loserRegistrationId', loser_registration_id,
    'cancelledGameId', game.id,
    'updatedMatchups', updated_matchups,
    'outcome', 'resolved'
  );
  insert into private.matchup_administrative_resolution_requests(
    request_id, actor_id, matchup_id, expected_home_registration_id,
    expected_away_registration_id, winner_registration_id,
    decision_type, reason, result
  ) values (
    p_request_id, auth.uid(), matchup.id, p_expected_home_registration_id,
    p_expected_away_registration_id, p_winner_registration_id,
    p_decision_type, normalized_reason, result
  );
  insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
  values ('matchup_administratively_resolved', 'matchup', matchup.id,
    jsonb_build_object(
      'competitionId', matchup.competition_id,
      'rulesetRevisionId', matchup.ruleset_revision_id,
      'decisionType', p_decision_type,
      'winnerRegistrationId', p_winner_registration_id,
      'loserRegistrationId', loser_registration_id,
      'cancelledGameId', game.id,
      'updatedMatchups', updated_matchups
    ));
  return result;
end;
$$;

revoke all on function public.admin_get_matchup_administrative_impact(bigint, bigint)
  from public, anon, authenticated;
revoke all on function public.admin_resolve_matchup_administratively(
  uuid, bigint, bigint, bigint, bigint, text, text
) from public, anon, authenticated;
grant execute on function public.admin_get_matchup_administrative_impact(bigint, bigint)
  to authenticated;
grant execute on function public.admin_resolve_matchup_administratively(
  uuid, bigint, bigint, bigint, bigint, text, text
) to authenticated;

comment on table public.matchup_administrative_resolutions is
  'Immutable W.O., withdrawal or administrative sporting decision without a fabricated score.';
comment on function public.admin_resolve_matchup_administratively(
  uuid, bigint, bigint, bigint, bigint, text, text
) is
  'Resolves an unstarted matchup from an explicit AAL2 decision and propagates its winner without creating a game.';

-- Preserve the official-result implementation and layer administrative
-- outcomes over it. Points remain unchanged: a sporting decision adds a
-- played/win/loss fact but never a synthetic score.
alter function private.group_closure_source(bigint)
  rename to group_closure_official_source;
revoke all on function private.group_closure_official_source(bigint)
  from public, anon, authenticated;

create function private.group_closure_source(p_group_id bigint)
returns jsonb language sql stable security invoker set search_path = '' as $$
with base as (
  select private.group_closure_official_source(p_group_id) document
), administrative as (
  select resolution.matchup_id, resolution.decision_type,
    resolution.winner_registration_id, resolution.loser_registration_id,
    resolution.reason, resolution.resolved_at
  from public.competition_rounds round_item
  join public.matchups matchup on matchup.round_id = round_item.id
  join public.matchup_administrative_resolutions resolution
    on resolution.matchup_id = matchup.id
   and resolution.ruleset_revision_id = matchup.ruleset_revision_id
   and resolution.competition_id = matchup.competition_id
  where round_item.group_id = p_group_id
), administrative_sides as (
  select winner_registration_id registration_id, 1 games, 1 wins, 0 losses
  from administrative
  union all
  select loser_registration_id, 1, 0, 1 from administrative
), administrative_delta as (
  select registration_id, sum(games)::integer games,
    sum(wins)::integer wins, sum(losses)::integer losses
  from administrative_sides group by registration_id
), base_standings as (
  select (standing->>'registrationId')::bigint registration_id,
    (standing->>'games')::integer games,
    (standing->>'wins')::integer wins,
    (standing->>'losses')::integer losses,
    (standing->>'pointsFor')::integer points_for,
    (standing->>'pointsAgainst')::integer points_against
  from base cross join lateral jsonb_array_elements(
    base.document->'standings'
  ) standing
), merged_standings as (
  select standing.registration_id,
    standing.games + coalesce(delta.games, 0) games,
    standing.wins + coalesce(delta.wins, 0) wins,
    standing.losses + coalesce(delta.losses, 0) losses,
    standing.points_for, standing.points_against
  from base_standings standing
  left join administrative_delta delta
    on delta.registration_id = standing.registration_id
), source_document as (
  select jsonb_build_object(
    'results',
      coalesce(base.document->'officialResults', '[]'::jsonb)
      || coalesce((
        select jsonb_agg(jsonb_build_object(
          'matchupId', decision.matchup_id,
          'sourceKind', 'administrative',
          'decisionType', decision.decision_type,
          'winnerRegistrationId', decision.winner_registration_id,
          'loserRegistrationId', decision.loser_registration_id,
          'reason', decision.reason,
          'resolvedAt', decision.resolved_at
        ) order by decision.matchup_id)
        from administrative decision
      ), '[]'::jsonb),
    'standings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'registrationId', standing.registration_id,
        'games', standing.games, 'wins', standing.wins,
        'losses', standing.losses,
        'pointsFor', standing.points_for,
        'pointsAgainst', standing.points_against,
        'pointDifference', standing.points_for - standing.points_against
      ) order by standing.wins desc,
        standing.points_for - standing.points_against desc,
        standing.points_for desc, standing.registration_id)
      from merged_standings standing
    ), '[]'::jsonb)
  ) document
  from base
), remaining_invalid as (
  select invalid.matchup_id
  from base
  cross join lateral jsonb_array_elements_text(
    base.document->'invalidMatchupIds'
  ) invalid(matchup_id)
  where not exists(
    select 1 from administrative decision
    where decision.matchup_id = invalid.matchup_id::bigint
  )
)
select jsonb_build_object(
  'groupId', (base.document->>'groupId')::bigint,
  'rulesetRevisionId', (base.document->>'rulesetRevisionId')::bigint,
  'competitionId', (base.document->>'competitionId')::bigint,
  'eligible', not exists(select 1 from remaining_invalid)
    and jsonb_array_length(source_document.document->'standings') > 1,
  'invalidMatchupIds', coalesce((
    select jsonb_agg(matchup_id::bigint order by matchup_id::bigint)
    from remaining_invalid
  ), '[]'::jsonb),
  'sourceHash', md5(source_document.document::text),
  'officialResults', source_document.document->'results',
  'standings', source_document.document->'standings'
)
from base cross join source_document;
$$;
revoke all on function private.group_closure_source(bigint)
  from public, anon, authenticated;
