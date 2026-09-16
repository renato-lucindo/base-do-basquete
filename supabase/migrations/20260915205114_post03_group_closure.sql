-- POST-03 / 07I: an active round-robin group is closed exactly once from
-- canonical official results. The immutable snapshot, not a live standings
-- query, becomes the authority for any later participant progression.
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
    'ruleset_draft_edited','competition_group_closed'
  ));

alter table public.admin_mutation_audit
  drop constraint admin_mutation_audit_entity_type_check,
  add constraint admin_mutation_audit_entity_type_check check (entity_type in (
    'team_registration','game','boxscore_import','final_placement','player','competition',
    'data_profile','competition_entry','matchup','competition_ruleset_revision','competition_group'
  ));

alter table public.competition_groups
  add constraint competition_groups_id_revision_competition_unique
  unique (id, ruleset_revision_id, competition_id);

create table public.competition_group_closures (
  id bigint generated always as identity primary key,
  group_id bigint not null unique,
  ruleset_revision_id bigint not null,
  competition_id bigint not null,
  source_hash text not null check (source_hash ~ '^[0-9a-f]{32}$'),
  source_results jsonb not null check (jsonb_typeof(source_results) = 'array'),
  tie_break_reason text check (
    tie_break_reason is null or (
      tie_break_reason = btrim(tie_break_reason)
      and char_length(tie_break_reason) between 10 and 500
    )
  ),
  closed_by uuid not null references auth.users(id) on delete restrict,
  closed_at timestamptz not null default now(),
  foreign key (group_id, ruleset_revision_id, competition_id)
    references public.competition_groups(id, ruleset_revision_id, competition_id)
    on delete restrict,
  unique (id, group_id, ruleset_revision_id, competition_id)
);
create index competition_group_closures_revision_idx
  on public.competition_group_closures(ruleset_revision_id, competition_id);
create index competition_group_closures_actor_idx
  on public.competition_group_closures(closed_by, closed_at desc);

create table public.competition_group_closure_rows (
  closure_id bigint not null,
  group_id bigint not null,
  ruleset_revision_id bigint not null,
  competition_id bigint not null,
  position integer not null check (position > 0),
  registration_id bigint not null,
  games integer not null check (games >= 0),
  wins integer not null check (wins between 0 and games),
  losses integer not null check (losses between 0 and games),
  points_for integer not null check (points_for >= 0),
  points_against integer not null check (points_against >= 0),
  point_difference integer generated always as (points_for - points_against) stored,
  primary key (closure_id, position),
  unique (closure_id, registration_id),
  unique (closure_id, position, registration_id),
  foreign key (closure_id, group_id, ruleset_revision_id, competition_id)
    references public.competition_group_closures(
      id, group_id, ruleset_revision_id, competition_id
    ) on delete restrict,
  foreign key (registration_id, competition_id)
    references public.team_registrations(id, competition_id) on delete restrict,
  check (wins + losses = games)
);
create index competition_group_closure_rows_registration_idx
  on public.competition_group_closure_rows(registration_id, competition_id);
create index competition_group_closure_rows_context_idx
  on public.competition_group_closure_rows(group_id, ruleset_revision_id, competition_id);

-- An undefined structural slot may be bound at runtime by a group closure.
-- The binding is separate from the immutable graph and is never cloned.
alter table public.competition_slots
  add constraint competition_slots_id_revision_competition_unique
  unique (id, ruleset_revision_id, competition_id);

create table public.competition_group_advancements (
  slot_id bigint primary key,
  closure_id bigint not null,
  group_id bigint not null,
  ruleset_revision_id bigint not null,
  competition_id bigint not null,
  position integer not null check (position > 0),
  registration_id bigint not null,
  foreign key (closure_id, group_id, ruleset_revision_id, competition_id)
    references public.competition_group_closures(
      id, group_id, ruleset_revision_id, competition_id
    ) on delete restrict,
  foreign key (closure_id, position, registration_id)
    references public.competition_group_closure_rows(
      closure_id, position, registration_id
    )
    on delete restrict,
  foreign key (slot_id, ruleset_revision_id, competition_id)
    references public.competition_slots(
      id, ruleset_revision_id, competition_id
    ) on delete restrict,
  foreign key (registration_id, competition_id)
    references public.team_registrations(id, competition_id) on delete restrict,
  unique (closure_id, position),
  unique (closure_id, registration_id)
);
create index competition_group_advancements_context_idx
  on public.competition_group_advancements(group_id, ruleset_revision_id, competition_id);
create index competition_group_advancements_registration_idx
  on public.competition_group_advancements(registration_id, competition_id);

create table private.competition_group_closure_requests (
  request_id uuid primary key,
  actor_id uuid not null references auth.users(id) on delete restrict,
  group_id bigint not null references public.competition_groups(id) on delete restrict,
  expected_source_hash text not null check (expected_source_hash ~ '^[0-9a-f]{32}$'),
  ordered_registration_ids bigint[] not null,
  tie_break_reason text,
  advancement_targets jsonb not null check (jsonb_typeof(advancement_targets) = 'array'),
  closure_id bigint not null unique
    references public.competition_group_closures(id) on delete restrict,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index competition_group_closure_requests_actor_idx
  on private.competition_group_closure_requests(actor_id);
create index competition_group_closure_requests_group_idx
  on private.competition_group_closure_requests(group_id);

alter table public.competition_group_closures enable row level security;
alter table public.competition_group_closures force row level security;
alter table public.competition_group_closure_rows enable row level security;
alter table public.competition_group_closure_rows force row level security;
alter table public.competition_group_advancements enable row level security;
alter table public.competition_group_advancements force row level security;
alter table private.competition_group_closure_requests enable row level security;
alter table private.competition_group_closure_requests force row level security;

revoke all on public.competition_group_closures,
  public.competition_group_closure_rows,
  public.competition_group_advancements,
  private.competition_group_closure_requests
from public, anon, authenticated;
grant select on public.competition_group_closures,
  public.competition_group_closure_rows,
  public.competition_group_advancements
to authenticated;

create policy competition_group_closures_admin_select
on public.competition_group_closures for select to authenticated
using ((select public.is_current_admin_aal2()));
create policy competition_group_closure_rows_admin_select
on public.competition_group_closure_rows for select to authenticated
using ((select public.is_current_admin_aal2()));
create policy competition_group_advancements_admin_select
on public.competition_group_advancements for select to authenticated
using ((select public.is_current_admin_aal2()));

create function private.guard_group_closure_snapshot()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using errcode = 'BR070', message = 'BDB_GROUP_CLOSURE_IMMUTABLE';
end;
$$;
revoke all on function private.guard_group_closure_snapshot()
  from public, anon, authenticated;

create trigger guard_competition_group_closure
before update or delete on public.competition_group_closures
for each row execute function private.guard_group_closure_snapshot();
create trigger guard_competition_group_closure_row
before update or delete on public.competition_group_closure_rows
for each row execute function private.guard_group_closure_snapshot();
create trigger guard_competition_group_advancement
before update or delete on public.competition_group_advancements
for each row execute function private.guard_group_closure_snapshot();

create function private.group_closure_source(p_group_id bigint)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with group_context as (
  select group_item.id group_id, group_item.ruleset_revision_id,
    group_item.competition_id, group_item.stage_id
  from public.competition_groups group_item
  where group_item.id = p_group_id
), assigned as (
  select assignment.registration_id
  from group_context context
  join public.competition_entry_assignments assignment
    on assignment.ruleset_revision_id = context.ruleset_revision_id
   and assignment.competition_id = context.competition_id
), group_matchups as (
  select matchup.id matchup_id, matchup.home_registration_id,
    matchup.away_registration_id, game.id game_id, game.status,
    authority.submission_id, submission.source_type, submission.status submission_status,
    submission.role submission_role,
    participants.home_registration_id participant_home,
    participants.away_registration_id participant_away,
    scores.home_score, scores.away_score,
    coalesce(scores.home_periods, 0) home_periods,
    coalesce(scores.away_periods, 0) away_periods
  from group_context context
  join public.competition_rounds round_item
    on round_item.group_id = context.group_id
   and round_item.ruleset_revision_id = context.ruleset_revision_id
   and round_item.competition_id = context.competition_id
  join public.matchups matchup
    on matchup.round_id = round_item.id
   and matchup.ruleset_revision_id = context.ruleset_revision_id
   and matchup.competition_id = context.competition_id
  left join public.games game
    on game.matchup_id = matchup.id and game.matchup_game_number = 1
  left join public.game_data_domain_authority authority
    on authority.game_id = game.id and authority.domain = 'official_result'
  left join public.game_data_submissions submission
    on submission.id = authority.submission_id
   and submission.game_id = authority.game_id
   and submission.source_type = authority.source_type
  left join lateral (
    select max(participant.registration_id) filter (where participant.side = 'home') home_registration_id,
      max(participant.registration_id) filter (where participant.side = 'away') away_registration_id
    from public.game_participants participant
    where participant.game_id = game.id
  ) participants on true
  left join lateral (
    select sum(score.points) filter (
        where score.registration_id = matchup.home_registration_id
      )::integer home_score,
      sum(score.points) filter (
        where score.registration_id = matchup.away_registration_id
      )::integer away_score,
      count(*) filter (
        where score.registration_id = matchup.home_registration_id
      )::integer home_periods,
      count(*) filter (
        where score.registration_id = matchup.away_registration_id
      )::integer away_periods
    from public.game_period_scores score
    where score.game_id = game.id
  ) scores on true
), validated as (
  select matchup.*,
    coalesce(matchup.game_id is not null
    and matchup.status = 'final'
    and matchup.submission_id is not null
    and matchup.submission_status = 'active'
    and matchup.submission_role = 'primary'
    and matchup.home_registration_id is not null
    and matchup.away_registration_id is not null
    and matchup.home_registration_id <> matchup.away_registration_id
    and matchup.participant_home = matchup.home_registration_id
    and matchup.participant_away = matchup.away_registration_id
    and matchup.home_periods > 0 and matchup.away_periods > 0
    and matchup.home_score is not null and matchup.away_score is not null
    and matchup.home_score <> matchup.away_score, false) valid
  from group_matchups matchup
), result_sides as (
  select home_registration_id registration_id, away_registration_id opponent_id,
    (home_score > away_score)::integer won, home_score points_for,
    away_score points_against
  from validated where valid
  union all
  select away_registration_id, home_registration_id,
    (away_score > home_score)::integer, away_score, home_score
  from validated where valid
), metrics as (
  select assigned.registration_id,
    count(result_sides.registration_id)::integer games,
    coalesce(sum(result_sides.won), 0)::integer wins,
    (count(result_sides.registration_id) - coalesce(sum(result_sides.won), 0))::integer losses,
    coalesce(sum(result_sides.points_for), 0)::integer points_for,
    coalesce(sum(result_sides.points_against), 0)::integer points_against
  from assigned
  left join result_sides on result_sides.registration_id = assigned.registration_id
  group by assigned.registration_id
), source as (
  select jsonb_build_object(
    'results', coalesce((select jsonb_agg(jsonb_build_object(
      'matchupId', matchup_id, 'gameId', game_id,
      'submissionId', submission_id, 'sourceType', source_type,
      'homeRegistrationId', home_registration_id,
      'awayRegistrationId', away_registration_id,
      'homeScore', home_score, 'awayScore', away_score
    ) order by matchup_id) from validated where valid), '[]'::jsonb),
    'standings', coalesce((select jsonb_agg(jsonb_build_object(
      'registrationId', registration_id, 'games', games, 'wins', wins,
      'losses', losses, 'pointsFor', points_for,
      'pointsAgainst', points_against,
      'pointDifference', points_for - points_against
    ) order by wins desc, points_for - points_against desc,
      points_for desc, registration_id)
    from metrics), '[]'::jsonb)
  ) document
)
select jsonb_build_object(
  'groupId', context.group_id,
  'rulesetRevisionId', context.ruleset_revision_id,
  'competitionId', context.competition_id,
  'eligible',
    (select count(*) from validated) > 0
    and not exists(select 1 from validated where not valid)
    and (select count(*) from assigned) > 1
    and (select count(*) from assigned) = (
      select revision.entry_count
      from public.competition_ruleset_revisions revision
      where revision.id = context.ruleset_revision_id
    ),
  'invalidMatchupIds', coalesce((select jsonb_agg(matchup_id order by matchup_id)
    from validated where not valid), '[]'::jsonb),
  'sourceHash', md5(source.document::text),
  'officialResults', source.document->'results',
  'standings', source.document->'standings'
)
from group_context context cross join source;
$$;
revoke all on function private.group_closure_source(bigint)
  from public, anon, authenticated;

create or replace function private.resolved_slot_registration(p_slot_id bigint)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select case slot.origin_kind
    when 'entry' then assignment.registration_id
    when 'winner' then resolution.winner_registration_id
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
  left join public.competition_group_advancements advancement
    on advancement.slot_id = slot.id
   and advancement.ruleset_revision_id = slot.ruleset_revision_id
   and advancement.competition_id = slot.competition_id
  where slot.id = p_slot_id;
$$;
revoke all on function private.resolved_slot_registration(bigint)
  from public, anon, authenticated;

create function public.admin_get_group_closure_preview(p_group_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  document jsonb;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  document := private.group_closure_source(p_group_id);
  if document is null then
    raise exception using errcode = 'BD404', message = 'BDB_GROUP_NOT_FOUND';
  end if;
  return document || jsonb_build_object('closed', exists(
    select 1 from public.competition_group_closures closure
    where closure.group_id = p_group_id
  ));
end;
$$;

create function public.admin_close_competition_group(
  p_request_id uuid,
  p_group_id bigint,
  p_expected_source_hash text,
  p_ordered_registration_ids bigint[],
  p_tie_break_reason text,
  p_advancement_targets jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing private.competition_group_closure_requests;
  group_item public.competition_groups;
  revision public.competition_ruleset_revisions;
  document jsonb;
  created_closure_id bigint;
  normalized_reason text := nullif(btrim(p_tie_break_reason), '');
  target jsonb;
  target_position integer;
  target_slot_id bigint;
  target_positions integer[] := '{}';
  target_slots bigint[] := '{}';
  source_stage_order integer;
  target_count integer := 0;
  has_win_tie boolean;
  result jsonb;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if p_request_id is null or p_group_id is null
    or p_expected_source_hash is null
    or p_expected_source_hash !~ '^[0-9a-f]{32}$'
    or coalesce(array_length(p_ordered_registration_ids, 1), 0) < 2
    or p_advancement_targets is null
    or jsonb_typeof(p_advancement_targets) <> 'array'
  then
    raise exception using errcode = 'BR071', message = 'BDB_GROUP_CLOSURE_INPUT_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 317));
  select * into existing
  from private.competition_group_closure_requests request
  where request.request_id = p_request_id;
  if found then
    if existing.actor_id <> auth.uid()
      or existing.group_id <> p_group_id
      or existing.expected_source_hash <> p_expected_source_hash
      or existing.ordered_registration_ids is distinct from p_ordered_registration_ids
      or existing.tie_break_reason is distinct from normalized_reason
      or existing.advancement_targets is distinct from p_advancement_targets
    then
      raise exception using errcode = 'BR010', message = 'BDB_IDEMPOTENCY_CONFLICT';
    end if;
    return existing.result || jsonb_build_object('outcome', 'unchanged');
  end if;

  select * into group_item from public.competition_groups where id = p_group_id;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_GROUP_NOT_FOUND';
  end if;
  perform 1 from public.competitions competition
  where competition.id = group_item.competition_id
    and competition.status <> 'archived'
  for update;
  if not found then
    raise exception using errcode = 'BR032', message = 'BDB_ACTIVE_COMPETITION_REQUIRED';
  end if;
  select * into revision from public.competition_ruleset_revisions
  where id = group_item.ruleset_revision_id for update;
  if revision.status <> 'active' or revision.preset_key <> 'single_group' then
    raise exception using errcode = 'BR072', message = 'BDB_ACTIVE_GROUP_REQUIRED';
  end if;
  perform 1 from public.competition_groups where id = group_item.id for update;
  if exists(select 1 from public.competition_group_closures closure
    where closure.group_id = group_item.id)
  then
    raise exception using errcode = 'BR070', message = 'BDB_GROUP_CLOSURE_IMMUTABLE';
  end if;

  document := private.group_closure_source(group_item.id);
  if not coalesce((document->>'eligible')::boolean, false) then
    raise exception using errcode = 'BR073', message = 'BDB_GROUP_RESULTS_INCOMPLETE';
  end if;
  if document->>'sourceHash' <> p_expected_source_hash then
    raise exception using errcode = 'BR074', message = 'BDB_GROUP_RESULTS_CHANGED_RELOAD';
  end if;

  if cardinality(p_ordered_registration_ids) <>
      jsonb_array_length(document->'standings')
    or cardinality(p_ordered_registration_ids) <>
      (select count(distinct registration_id)
       from unnest(p_ordered_registration_ids) registration_id)
    or exists(
      select 1 from jsonb_array_elements(document->'standings') standing
      where not ((standing->>'registrationId')::bigint = any(p_ordered_registration_ids))
    )
  then
    raise exception using errcode = 'BR075', message = 'BDB_GROUP_ORDER_INVALID';
  end if;

  -- The administrator may close a documented FIBA tie, but can never move a
  -- team with fewer victories above a team with more victories.
  if exists(
    select 1
    from unnest(p_ordered_registration_ids) with ordinality left_order(registration_id, position)
    join unnest(p_ordered_registration_ids) with ordinality right_order(registration_id, position)
      on left_order.position < right_order.position
    join jsonb_array_elements(document->'standings') left_row
      on (left_row->>'registrationId')::bigint = left_order.registration_id
    join jsonb_array_elements(document->'standings') right_row
      on (right_row->>'registrationId')::bigint = right_order.registration_id
    where (left_row->>'wins')::integer < (right_row->>'wins')::integer
  ) then
    raise exception using errcode = 'BR075', message = 'BDB_GROUP_ORDER_INVALID';
  end if;

  select exists(
    select 1 from jsonb_array_elements(document->'standings') standing
    group by (standing->>'wins')::integer having count(*) > 1
  ) into has_win_tie;
  if has_win_tie and (
    normalized_reason is null or char_length(normalized_reason) not between 10 and 500
  ) then
    raise exception using errcode = 'BR076', message = 'BDB_GROUP_TIE_BREAK_REASON_REQUIRED';
  end if;
  if not has_win_tie and normalized_reason is not null
    and char_length(normalized_reason) not between 10 and 500
  then
    raise exception using errcode = 'BR071', message = 'BDB_GROUP_CLOSURE_INPUT_INVALID';
  end if;

  select stage.stage_order into source_stage_order
  from public.competition_stages stage where stage.id = group_item.stage_id;
  for target in select value from jsonb_array_elements(p_advancement_targets) value
  loop
    if jsonb_typeof(target) <> 'object'
      or jsonb_typeof(target->'position') is distinct from 'number'
      or jsonb_typeof(target->'slotId') is distinct from 'number'
      or exists(select 1 from jsonb_object_keys(target) key
        where key not in ('position', 'slotId'))
    then
      raise exception using errcode = 'BR077', message = 'BDB_GROUP_ADVANCEMENT_INVALID';
    end if;
    begin
      target_position := (target->>'position')::integer;
      target_slot_id := (target->>'slotId')::bigint;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode = 'BR077', message = 'BDB_GROUP_ADVANCEMENT_INVALID';
    end;
    if target_position < 1
      or target_position > cardinality(p_ordered_registration_ids)
      or target_position = any(target_positions)
      or target_slot_id = any(target_slots)
      or not exists(
        select 1 from public.competition_slots slot
        join public.competition_rounds round_item on round_item.id = slot.round_id
        join public.competition_stages stage on stage.id = round_item.stage_id
        where slot.id = target_slot_id
          and slot.competition_id = group_item.competition_id
          and slot.ruleset_revision_id = group_item.ruleset_revision_id
          and slot.origin_kind = 'undefined'
          and stage.stage_order > source_stage_order
      )
      or exists(
        select 1 from public.matchups matchup
        join public.games game on game.matchup_id = matchup.id
        where target_slot_id in (matchup.home_slot_id, matchup.away_slot_id)
      )
      or exists(
        select 1 from public.matchups matchup
        where target_slot_id in (matchup.home_slot_id, matchup.away_slot_id)
          and ((matchup.home_slot_id = target_slot_id
            and matchup.home_registration_id is not null)
            or (matchup.away_slot_id = target_slot_id
            and matchup.away_registration_id is not null))
      )
    then
      raise exception using errcode = 'BR077', message = 'BDB_GROUP_ADVANCEMENT_INVALID';
    end if;
    target_positions := array_append(target_positions, target_position);
    target_slots := array_append(target_slots, target_slot_id);
  end loop;

  insert into public.competition_group_closures(
    group_id, ruleset_revision_id, competition_id, source_hash,
    source_results, tie_break_reason, closed_by
  ) values (
    group_item.id, group_item.ruleset_revision_id, group_item.competition_id,
    p_expected_source_hash, document->'officialResults', normalized_reason, auth.uid()
  ) returning id into created_closure_id;

  insert into public.competition_group_closure_rows(
    closure_id, group_id, ruleset_revision_id, competition_id, position,
    registration_id, games, wins, losses, points_for, points_against
  )
  select created_closure_id, group_item.id, group_item.ruleset_revision_id,
    group_item.competition_id, ordered.position, ordered.registration_id,
    (standing->>'games')::integer, (standing->>'wins')::integer,
    (standing->>'losses')::integer, (standing->>'pointsFor')::integer,
    (standing->>'pointsAgainst')::integer
  from unnest(p_ordered_registration_ids) with ordinality
    ordered(registration_id, position)
  join jsonb_array_elements(document->'standings') standing
    on (standing->>'registrationId')::bigint = ordered.registration_id;

  insert into public.competition_group_advancements(
    slot_id, closure_id, group_id, ruleset_revision_id, competition_id,
    position, registration_id
  )
  select target.slot_id, created_closure_id, group_item.id,
    group_item.ruleset_revision_id, group_item.competition_id,
    target.position, p_ordered_registration_ids[target.position]
  from unnest(target_positions, target_slots) target(position, slot_id);
  get diagnostics target_count = row_count;

  update public.matchups matchup
  set home_registration_id = private.resolved_slot_registration(matchup.home_slot_id),
      away_registration_id = private.resolved_slot_registration(matchup.away_slot_id)
  where matchup.ruleset_revision_id = group_item.ruleset_revision_id
    and (matchup.home_slot_id = any(target_slots)
      or matchup.away_slot_id = any(target_slots))
    and (
      matchup.home_registration_id is distinct from
        private.resolved_slot_registration(matchup.home_slot_id)
      or matchup.away_registration_id is distinct from
        private.resolved_slot_registration(matchup.away_slot_id)
    );

  result := jsonb_build_object(
    'closureId', created_closure_id,
    'groupId', group_item.id,
    'sourceHash', p_expected_source_hash,
    'standings', (select jsonb_agg(jsonb_build_object(
      'position', row.position, 'registrationId', row.registration_id,
      'games', row.games, 'wins', row.wins, 'losses', row.losses,
      'pointsFor', row.points_for, 'pointsAgainst', row.points_against,
      'pointDifference', row.point_difference
    ) order by row.position)
    from public.competition_group_closure_rows row
    where row.closure_id = created_closure_id),
    'advancedSlots', target_count,
    'outcome', 'closed'
  );

  insert into private.competition_group_closure_requests(
    request_id, actor_id, group_id, expected_source_hash,
    ordered_registration_ids, tie_break_reason, advancement_targets,
    closure_id, result
  ) values (
    p_request_id, auth.uid(), group_item.id, p_expected_source_hash,
    p_ordered_registration_ids, normalized_reason, p_advancement_targets,
    created_closure_id, result
  );

  insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
  values ('competition_group_closed', 'competition_group', group_item.id,
    jsonb_build_object(
      'competitionId', group_item.competition_id,
      'rulesetRevisionId', group_item.ruleset_revision_id,
      'closureId', created_closure_id,
      'sourceHash', p_expected_source_hash,
      'advancedSlots', target_count
    ));
  return result;
end;
$$;

revoke all on function public.admin_get_group_closure_preview(bigint)
  from public, anon, authenticated;
revoke all on function public.admin_close_competition_group(
  uuid, bigint, text, bigint[], text, jsonb
) from public, anon, authenticated;
grant execute on function public.admin_get_group_closure_preview(bigint)
  to authenticated;
grant execute on function public.admin_close_competition_group(
  uuid, bigint, text, bigint[], text, jsonb
) to authenticated;

comment on table public.competition_group_closures is
  'Immutable AAL2 closure over final active official results for one group.';
comment on function public.admin_get_group_closure_preview(bigint) is
  'Returns the server-computed source hash and standings required to close a group.';
comment on function public.admin_close_competition_group(
  uuid, bigint, text, bigint[], text, jsonb
) is
  'Closes one group idempotently, snapshots standings and optionally resolves later undefined slots without creating games.';
