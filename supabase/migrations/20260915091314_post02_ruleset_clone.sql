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
    'fiba_candidate_staged','registration_removed','registration_withdrawn','ruleset_cloned'
  ));

alter table public.competition_ruleset_revisions
  add column cloned_from_revision_id bigint,
  add column cloned_from_gender_division text,
  add column gender_recompiled boolean not null default false,
  add constraint ruleset_clone_source_fkey foreign key (cloned_from_revision_id)
    references public.competition_ruleset_revisions(id) on delete restrict,
  add constraint ruleset_clone_gender_check check (
    cloned_from_gender_division is null
    or cloned_from_gender_division in ('male', 'female')
  ),
  add constraint ruleset_clone_metadata_check check (
    (cloned_from_revision_id is null and cloned_from_gender_division is null
      and gender_recompiled is false)
    or (cloned_from_revision_id is not null and cloned_from_gender_division is not null)
  );

create index ruleset_clone_source_idx
  on public.competition_ruleset_revisions(cloned_from_revision_id)
  where cloned_from_revision_id is not null;

create unique index ruleset_one_draft_uidx
  on public.competition_ruleset_revisions(competition_id)
  where status = 'draft';

create table private.ruleset_clone_requests (
  request_id uuid primary key,
  actor_id uuid not null references auth.users(id) on delete restrict,
  target_competition_id bigint not null references public.competitions(id) on delete restrict,
  source_revision_id bigint not null references public.competition_ruleset_revisions(id) on delete restrict,
  allow_gender_recompile boolean not null,
  ruleset_revision_id bigint not null references public.competition_ruleset_revisions(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(ruleset_revision_id)
);

create index ruleset_clone_requests_actor_idx on private.ruleset_clone_requests(actor_id);
create index ruleset_clone_requests_target_idx
  on private.ruleset_clone_requests(target_competition_id);
create index ruleset_clone_requests_source_idx
  on private.ruleset_clone_requests(source_revision_id);
alter table private.ruleset_clone_requests enable row level security;
alter table private.ruleset_clone_requests force row level security;
revoke all on private.ruleset_clone_requests from public, anon, authenticated;

create function public.admin_list_ruleset_clone_sources(
  p_target_competition_id bigint,
  p_include_other_gender boolean default false
)
returns table (
  source_revision_id bigint,
  source_competition_id bigint,
  display_name text,
  edition_year integer,
  gender_division text,
  revision_number integer,
  source_kind text,
  preset_key text,
  entry_count integer,
  gender_mismatch boolean,
  structure_summary jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target public.competitions;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  select * into target from public.competitions where id = p_target_competition_id;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_COMPETITION_NOT_FOUND';
  end if;
  if target.status <> 'draft' then
    raise exception using errcode = 'BR054', message = 'BDB_RULESET_TARGET_NOT_DRAFT';
  end if;

  return query
  select
    revision.id,
    source.id,
    source.display_name,
    source.year,
    source.gender_division,
    revision.revision_number,
    case when revision.preset_key is null then 'edition' else 'template_snapshot' end,
    revision.preset_key,
    coalesce(revision.entry_count, (
      select count(*)::integer from public.competition_entries entry
      where entry.ruleset_revision_id = revision.id
    )),
    source.gender_division is distinct from target.gender_division,
    jsonb_build_object(
      'tracks', (select count(*) from public.competition_tracks track where track.ruleset_revision_id = revision.id),
      'stages', (select count(*) from public.competition_stages stage where stage.ruleset_revision_id = revision.id),
      'rounds', (select count(*) from public.competition_rounds round_item where round_item.ruleset_revision_id = revision.id),
      'entries', (select count(*) from public.competition_entries entry where entry.ruleset_revision_id = revision.id),
      'matchups', (select count(*) from public.matchups matchup where matchup.ruleset_revision_id = revision.id)
    )
  from public.competition_ruleset_revisions revision
  join public.competitions source on source.id = revision.competition_id
  where source.series_id = target.series_id
    and source.category_id = target.category_id
    and source.gender_division is not null
    and revision.status = 'active'
    and revision.structure_kind = 'regulated'
    and exists (
      select 1 from public.competition_rounds round_item
      where round_item.ruleset_revision_id = revision.id
    )
    and (
      source.gender_division = target.gender_division
      or coalesce(p_include_other_gender, false)
    )
  order by
    (source.id = target.id) desc,
    source.year desc,
    source.display_name,
    revision.revision_number desc;
end;
$$;

create function public.admin_clone_competition_ruleset(
  p_request_id uuid,
  p_target_competition_id bigint,
  p_source_revision_id bigint,
  p_allow_gender_recompile boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing private.ruleset_clone_requests;
  target public.competitions;
  source_competition public.competitions;
  source_revision public.competition_ruleset_revisions;
  source_track public.competition_tracks;
  source_stage public.competition_stages;
  source_group public.competition_groups;
  source_entry public.competition_entries;
  source_round public.competition_rounds;
  source_matchup public.matchups;
  source_slot public.competition_slots;
  source_bye public.competition_round_byes;
  target_revision_id bigint;
  target_revision_number integer;
  target_track_id bigint;
  target_stage_id bigint;
  target_group_id bigint;
  target_entry_id bigint;
  target_round_id bigint;
  target_matchup_id bigint;
  target_slot_id bigint;
  target_home_slot_id bigint;
  target_away_slot_id bigint;
  target_source_matchup_id bigint;
  lock_competition_id bigint;
  track_map jsonb := '{}'::jsonb;
  stage_map jsonb := '{}'::jsonb;
  group_map jsonb := '{}'::jsonb;
  entry_map jsonb := '{}'::jsonb;
  round_map jsonb := '{}'::jsonb;
  matchup_map jsonb := '{}'::jsonb;
  source_counts jsonb;
  target_counts jsonb;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if p_request_id is null or p_target_competition_id is null or p_target_competition_id <= 0
    or p_source_revision_id is null or p_source_revision_id <= 0
  then
    raise exception using errcode = 'BR055', message = 'BDB_RULESET_CLONE_INPUT_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 312));
  select * into existing from private.ruleset_clone_requests where request_id = p_request_id;
  if found then
    if existing.actor_id <> auth.uid()
      or existing.target_competition_id <> p_target_competition_id
      or existing.source_revision_id <> p_source_revision_id
      or existing.allow_gender_recompile <> coalesce(p_allow_gender_recompile, false)
    then
      raise exception using errcode = 'BR010', message = 'BDB_IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object(
      'rulesetRevisionId', existing.ruleset_revision_id,
      'outcome', 'unchanged'
    );
  end if;

  select * into source_revision
  from public.competition_ruleset_revisions
  where id = p_source_revision_id;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_RULESET_SOURCE_NOT_FOUND';
  end if;

  for lock_competition_id in
    select distinct id from unnest(array[p_target_competition_id, source_revision.competition_id]) id
    order by id
  loop
    perform 1 from public.competitions where id = lock_competition_id for update;
    if not found then
      raise exception using errcode = 'BD404', message = 'BDB_COMPETITION_NOT_FOUND';
    end if;
  end loop;

  select * into target from public.competitions where id = p_target_competition_id;
  select * into source_competition
  from public.competitions where id = source_revision.competition_id;
  select * into source_revision
  from public.competition_ruleset_revisions
  where id = p_source_revision_id
  for share;

  if target.status <> 'draft' then
    raise exception using errcode = 'BR054', message = 'BDB_RULESET_TARGET_NOT_DRAFT';
  end if;
  if source_revision.status <> 'active' or source_revision.structure_kind <> 'regulated'
    or source_competition.series_id <> target.series_id
    or source_competition.category_id <> target.category_id
    or source_competition.gender_division is null
    or target.gender_division is null
  then
    raise exception using errcode = 'BR056', message = 'BDB_RULESET_SOURCE_INCOMPATIBLE';
  end if;
  if source_competition.gender_division <> target.gender_division
    and coalesce(p_allow_gender_recompile, false) is not true
  then
    raise exception using errcode = 'BR057', message = 'BDB_RULESET_GENDER_RECOMPILE_REQUIRED';
  end if;
  if exists (
    select 1 from public.competition_ruleset_revisions
    where competition_id = target.id and status = 'draft'
  ) then
    raise exception using errcode = 'BR058', message = 'BDB_RULESET_DRAFT_EXISTS';
  end if;

  select coalesce(max(revision_number), 0) + 1 into target_revision_number
  from public.competition_ruleset_revisions where competition_id = target.id;
  insert into public.competition_ruleset_revisions(
    competition_id, revision_number, structure_kind, status, created_by,
    cloned_from_revision_id, cloned_from_gender_division, gender_recompiled
  ) values (
    target.id, target_revision_number, 'regulated', 'draft', auth.uid(),
    source_revision.id, source_competition.gender_division,
    source_competition.gender_division <> target.gender_division
  ) returning id into target_revision_id;

  for source_track in
    select * from public.competition_tracks
    where ruleset_revision_id = source_revision.id order by id
  loop
    insert into public.competition_tracks(competition_id, ruleset_revision_id, code)
    values(target.id, target_revision_id, source_track.code)
    returning id into target_track_id;
    track_map := jsonb_set(track_map, array[source_track.id::text], to_jsonb(target_track_id), true);
  end loop;

  for source_stage in
    select * from public.competition_stages
    where ruleset_revision_id = source_revision.id order by stage_order, id
  loop
    target_track_id := (track_map ->> source_stage.track_id::text)::bigint;
    insert into public.competition_stages(
      competition_id, ruleset_revision_id, track_id, code, name, stage_order,
      structure_kind, stage_kind
    ) values (
      target.id, target_revision_id, target_track_id, source_stage.code,
      source_stage.name, source_stage.stage_order, source_stage.structure_kind,
      source_stage.stage_kind
    ) returning id into target_stage_id;
    stage_map := jsonb_set(stage_map, array[source_stage.id::text], to_jsonb(target_stage_id), true);
  end loop;

  for source_group in
    select * from public.competition_groups
    where ruleset_revision_id = source_revision.id order by id
  loop
    target_stage_id := (stage_map ->> source_group.stage_id::text)::bigint;
    insert into public.competition_groups(
      competition_id, ruleset_revision_id, stage_id, code
    ) values (target.id, target_revision_id, target_stage_id, source_group.code)
    returning id into target_group_id;
    group_map := jsonb_set(group_map, array[source_group.id::text], to_jsonb(target_group_id), true);
  end loop;

  for source_entry in
    select * from public.competition_entries
    where ruleset_revision_id = source_revision.id order by seed, id
  loop
    insert into public.competition_entries(competition_id, ruleset_revision_id, seed)
    values(target.id, target_revision_id, source_entry.seed)
    returning id into target_entry_id;
    entry_map := jsonb_set(entry_map, array[source_entry.id::text], to_jsonb(target_entry_id), true);
  end loop;

  for source_round in
    select * from public.competition_rounds
    where ruleset_revision_id = source_revision.id order by round_order, id
  loop
    target_stage_id := (stage_map ->> source_round.stage_id::text)::bigint;
    target_group_id := case when source_round.group_id is null then null
      else (group_map ->> source_round.group_id::text)::bigint end;
    insert into public.competition_rounds(
      competition_id, stage_id, ruleset_revision_id, group_id, code, name,
      round_order, structure_kind, round_role, capacity, max_matchups
    ) values (
      target.id, target_stage_id, target_revision_id, target_group_id,
      source_round.code, source_round.name, source_round.round_order,
      source_round.structure_kind, source_round.round_role, source_round.capacity,
      source_round.max_matchups
    ) returning id into target_round_id;
    round_map := jsonb_set(round_map, array[source_round.id::text], to_jsonb(target_round_id), true);
  end loop;

  for source_matchup in
    select matchup.* from public.matchups matchup
    join public.competition_rounds round_item on round_item.id = matchup.round_id
    where matchup.ruleset_revision_id = source_revision.id
    order by round_item.round_order, matchup.matchup_order, matchup.id
  loop
    target_round_id := (round_map ->> source_matchup.round_id::text)::bigint;
    target_home_slot_id := null;
    target_away_slot_id := null;

    for source_slot in
      select * from public.competition_slots
      where id in (source_matchup.home_slot_id, source_matchup.away_slot_id)
      order by case when id = source_matchup.home_slot_id then 1 else 2 end
    loop
      target_entry_id := case when source_slot.entry_id is null then null
        else (entry_map ->> source_slot.entry_id::text)::bigint end;
      target_source_matchup_id := case when source_slot.source_matchup_id is null then null
        else (matchup_map ->> source_slot.source_matchup_id::text)::bigint end;
      insert into public.competition_slots(
        competition_id, ruleset_revision_id, round_id, origin_kind,
        entry_id, source_matchup_id
      ) values (
        target.id, target_revision_id, target_round_id, source_slot.origin_kind,
        target_entry_id, target_source_matchup_id
      ) returning id into target_slot_id;
      if source_slot.id = source_matchup.home_slot_id then
        target_home_slot_id := target_slot_id;
      else
        target_away_slot_id := target_slot_id;
      end if;
    end loop;

    if target_home_slot_id is null or target_away_slot_id is null then
      raise exception using errcode = 'BR056', message = 'BDB_RULESET_SOURCE_INCOMPATIBLE';
    end if;
    insert into public.matchups(
      competition_id, round_id, ruleset_revision_id, code, home_slot_id,
      away_slot_id, matchup_order, structure_kind, allow_side_inversion,
      match_format, max_games
    ) values (
      target.id, target_round_id, target_revision_id, source_matchup.code,
      target_home_slot_id, target_away_slot_id, source_matchup.matchup_order,
      source_matchup.structure_kind, source_matchup.allow_side_inversion,
      source_matchup.match_format, source_matchup.max_games
    ) returning id into target_matchup_id;
    matchup_map := jsonb_set(
      matchup_map, array[source_matchup.id::text], to_jsonb(target_matchup_id), true
    );
  end loop;

  for source_bye in
    select bye.* from public.competition_round_byes bye
    join public.competition_rounds round_item on round_item.id = bye.round_id
    where bye.ruleset_revision_id = source_revision.id
    order by round_item.round_order, bye.bye_order
  loop
    insert into public.competition_round_byes(
      competition_id, ruleset_revision_id, round_id, entry_id, bye_order
    ) values (
      target.id,
      target_revision_id,
      (round_map ->> source_bye.round_id::text)::bigint,
      (entry_map ->> source_bye.entry_id::text)::bigint,
      source_bye.bye_order
    );
  end loop;

  source_counts := jsonb_build_object(
    'tracks', (select count(*) from public.competition_tracks where ruleset_revision_id = source_revision.id),
    'stages', (select count(*) from public.competition_stages where ruleset_revision_id = source_revision.id),
    'groups', (select count(*) from public.competition_groups where ruleset_revision_id = source_revision.id),
    'rounds', (select count(*) from public.competition_rounds where ruleset_revision_id = source_revision.id),
    'entries', (select count(*) from public.competition_entries where ruleset_revision_id = source_revision.id),
    'slots', (select count(*) from public.competition_slots where ruleset_revision_id = source_revision.id),
    'matchups', (select count(*) from public.matchups where ruleset_revision_id = source_revision.id),
    'byes', (select count(*) from public.competition_round_byes where ruleset_revision_id = source_revision.id)
  );
  target_counts := jsonb_build_object(
    'tracks', (select count(*) from public.competition_tracks where ruleset_revision_id = target_revision_id),
    'stages', (select count(*) from public.competition_stages where ruleset_revision_id = target_revision_id),
    'groups', (select count(*) from public.competition_groups where ruleset_revision_id = target_revision_id),
    'rounds', (select count(*) from public.competition_rounds where ruleset_revision_id = target_revision_id),
    'entries', (select count(*) from public.competition_entries where ruleset_revision_id = target_revision_id),
    'slots', (select count(*) from public.competition_slots where ruleset_revision_id = target_revision_id),
    'matchups', (select count(*) from public.matchups where ruleset_revision_id = target_revision_id),
    'byes', (select count(*) from public.competition_round_byes where ruleset_revision_id = target_revision_id)
  );
  if source_counts is distinct from target_counts then
    raise exception using errcode = 'BR056', message = 'BDB_RULESET_SOURCE_INCOMPATIBLE';
  end if;

  insert into private.ruleset_clone_requests(
    request_id, actor_id, target_competition_id, source_revision_id,
    allow_gender_recompile, ruleset_revision_id
  ) values (
    p_request_id, auth.uid(), target.id, source_revision.id,
    coalesce(p_allow_gender_recompile, false), target_revision_id
  );
  insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
  values (
    'ruleset_cloned',
    'competition_ruleset_revision',
    target_revision_id,
    jsonb_build_object(
      'competitionId', target.id,
      'sourceRevisionId', source_revision.id,
      'sourceCompetitionId', source_competition.id,
      'genderRecompiled', source_competition.gender_division <> target.gender_division,
      'structure', target_counts
    )
  );

  return jsonb_build_object(
    'rulesetRevisionId', target_revision_id,
    'revisionNumber', target_revision_number,
    'genderRecompiled', source_competition.gender_division <> target.gender_division,
    'structure', target_counts,
    'outcome', 'created'
  );
exception
  when unique_violation then
    raise exception using errcode = 'BR058', message = 'BDB_RULESET_DRAFT_EXISTS';
end;
$$;

revoke all on function public.admin_list_ruleset_clone_sources(bigint, boolean)
  from public, anon, authenticated;
revoke all on function public.admin_clone_competition_ruleset(uuid, bigint, bigint, boolean)
  from public, anon, authenticated;
grant execute on function public.admin_list_ruleset_clone_sources(bigint, boolean)
  to authenticated;
grant execute on function public.admin_clone_competition_ruleset(uuid, bigint, bigint, boolean)
  to authenticated;

comment on function public.admin_list_ruleset_clone_sources(bigint, boolean) is
  'Lists AAL2 clone sources compatible with the target series/category and, by default, gender.';
comment on function public.admin_clone_competition_ruleset(uuid, bigint, bigint, boolean) is
  'Creates one independent draft graph from an active compatible ruleset, with explicit cross-gender acknowledgement.';
