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
    'ruleset_draft_edited'
  ));

alter table public.competition_ruleset_revisions
  add column editor_revision integer not null default 1
    check (editor_revision > 0);

alter table public.competition_slots
  drop constraint competition_slots_origin_kind_check,
  drop constraint slot_origin_exclusive,
  add constraint competition_slots_origin_kind_check
    check (origin_kind in ('undefined','entry','winner')),
  add constraint slot_origin_exclusive check (
    (origin_kind = 'undefined' and entry_id is null and source_matchup_id is null)
    or (origin_kind = 'entry' and entry_id is not null and source_matchup_id is null)
    or (origin_kind = 'winner' and entry_id is null and source_matchup_id is not null)
  );

create table private.ruleset_draft_edit_requests (
  request_id uuid primary key,
  actor_id uuid not null references auth.users(id) on delete restrict,
  ruleset_revision_id bigint not null
    references public.competition_ruleset_revisions(id) on delete restrict,
  expected_editor_revision integer not null,
  operation text not null,
  input jsonb not null check (
    jsonb_typeof(input) = 'object' and octet_length(input::text) <= 4000
  ),
  resulting_editor_revision integer not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index ruleset_draft_edit_actor_idx
  on private.ruleset_draft_edit_requests(actor_id);
create index ruleset_draft_edit_revision_idx
  on private.ruleset_draft_edit_requests(ruleset_revision_id);
alter table private.ruleset_draft_edit_requests enable row level security;
alter table private.ruleset_draft_edit_requests force row level security;
revoke all on private.ruleset_draft_edit_requests from public, anon, authenticated;

create or replace function private.guard_preset_structure()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  revision_id bigint;
  revision_row public.competition_ruleset_revisions;
  round_row public.competition_rounds;
  origin_order integer;
begin
  -- Participant resolution is operational state, not a structural edit.
  if tg_op = 'UPDATE' and tg_table_name = 'matchups' then
    if (to_jsonb(new) - array['home_registration_id','away_registration_id','updated_at'])
        = (to_jsonb(old) - array['home_registration_id','away_registration_id','updated_at'])
      and new.home_registration_id is not distinct from
        private.resolved_slot_registration(new.home_slot_id)
      and new.away_registration_id is not distinct from
        private.resolved_slot_registration(new.away_slot_id)
    then
      return new;
    end if;
  end if;
  for revision_id in select distinct id from unnest(array[
    case when tg_op <> 'INSERT' then (to_jsonb(old)->>'ruleset_revision_id')::bigint end,
    case when tg_op <> 'DELETE' then (to_jsonb(new)->>'ruleset_revision_id')::bigint end
  ]) id where id is not null order by id loop
    select * into strict revision_row
    from public.competition_ruleset_revisions
    where id=revision_id for update;
    if revision_row.status <> 'draft'
      and (revision_row.preset_key is not null
        or revision_row.cloned_from_revision_id is not null)
    then
      raise exception using errcode='BR004', message='BDB_ACTIVE_RULESET_IMMUTABLE';
    end if;
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  if tg_table_name = 'matchups' then
    if new.ruleset_revision_id is not null then
      select * into strict round_row
      from public.competition_rounds where id=new.round_id for update;
      if (select count(*) from public.matchups
        where round_id=new.round_id and id<>new.id) >= round_row.max_matchups
      then
        raise exception using errcode='BR006', message='BDB_ROUND_CAPACITY_EXCEEDED';
      end if;
      if exists(select 1 from public.matchups where id<>new.id and
        (home_slot_id in (new.home_slot_id,new.away_slot_id)
          or away_slot_id in (new.home_slot_id,new.away_slot_id)))
      then
        raise exception using errcode='BR007', message='BDB_SLOT_ALREADY_CONSUMED';
      end if;
    end if;
  elsif tg_table_name = 'competition_slots' then
    if new.origin_kind = 'winner' then
      select r.round_order into origin_order from public.matchups m
      join public.competition_rounds r on r.id=m.round_id
      where m.id=new.source_matchup_id;
      if origin_order is null or origin_order >= (
        select round_order from public.competition_rounds where id=new.round_id
      ) then
        raise exception using errcode='BR003', message='BDB_PRESET_SOURCE_INVALID';
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_preset_structure() from public, anon, authenticated;

create function private.ruleset_draft_editor_document(p_revision_id bigint)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'revision', jsonb_build_object(
      'id', revision.id,
      'competitionId', revision.competition_id,
      'number', revision.revision_number,
      'status', revision.status,
      'editorRevision', revision.editor_revision
    ),
    'tracks', coalesce((
      select jsonb_agg(jsonb_build_object('id',track.id,'code',track.code) order by track.id)
      from public.competition_tracks track
      where track.ruleset_revision_id=revision.id
    ),'[]'::jsonb),
    'stages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',stage.id,'trackId',stage.track_id,'code',stage.code,'name',stage.name,
        'order',stage.stage_order,'kind',stage.stage_kind
      ) order by stage.stage_order,stage.id)
      from public.competition_stages stage
      where stage.ruleset_revision_id=revision.id
    ),'[]'::jsonb),
    'rounds', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',round_item.id,'stageId',round_item.stage_id,'code',round_item.code,
        'name',round_item.name,'order',round_item.round_order,
        'role',round_item.round_role,'capacity',round_item.capacity,
        'maxMatchups',round_item.max_matchups,
        'usedMatchups',(select count(*) from public.matchups matchup
          where matchup.round_id=round_item.id)
      ) order by round_item.round_order,round_item.id)
      from public.competition_rounds round_item
      where round_item.ruleset_revision_id=revision.id
    ),'[]'::jsonb),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object('id',entry.id,'seed',entry.seed) order by entry.seed)
      from public.competition_entries entry
      where entry.ruleset_revision_id=revision.id
    ),'[]'::jsonb),
    'matchups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',matchup.id,'roundId',matchup.round_id,'code',matchup.code,
        'order',matchup.matchup_order,
        'home',jsonb_build_object(
          'slotId',home_slot.id,'kind',home_slot.origin_kind,
          'entrySeed',home_entry.seed,'sourceMatchupId',home_slot.source_matchup_id
        ),
        'away',jsonb_build_object(
          'slotId',away_slot.id,'kind',away_slot.origin_kind,
          'entrySeed',away_entry.seed,'sourceMatchupId',away_slot.source_matchup_id
        )
      ) order by round_item.round_order,matchup.matchup_order,matchup.id)
      from public.matchups matchup
      join public.competition_rounds round_item on round_item.id=matchup.round_id
      join public.competition_slots home_slot on home_slot.id=matchup.home_slot_id
      join public.competition_slots away_slot on away_slot.id=matchup.away_slot_id
      left join public.competition_entries home_entry on home_entry.id=home_slot.entry_id
      left join public.competition_entries away_entry on away_entry.id=away_slot.entry_id
      where matchup.ruleset_revision_id=revision.id
    ),'[]'::jsonb),
    'summary',jsonb_build_object(
      'entries',(select count(*) from public.competition_entries entry
        where entry.ruleset_revision_id=revision.id),
      'matchupCapacity',coalesce((select sum(round_item.max_matchups)
        from public.competition_rounds round_item
        where round_item.ruleset_revision_id=revision.id),0),
      'matchups',(select count(*) from public.matchups matchup
        where matchup.ruleset_revision_id=revision.id),
      'undefinedOrigins',(select count(*) from public.competition_slots slot
        where slot.ruleset_revision_id=revision.id and slot.origin_kind='undefined')
    )
  )
  from public.competition_ruleset_revisions revision
  where revision.id=p_revision_id;
$$;
revoke all on function private.ruleset_draft_editor_document(bigint)
  from public, anon, authenticated;

create function public.admin_get_ruleset_draft_editor(p_competition_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare revision_id bigint;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode='BD401',message='BDB_ADMIN_AAL2_REQUIRED';
  end if;
  select revision.id into revision_id
  from public.competition_ruleset_revisions revision
  join public.competitions competition on competition.id=revision.competition_id
  where revision.competition_id=p_competition_id
    and revision.status='draft' and competition.status='draft';
  if revision_id is null then
    raise exception using errcode='BD404',message='BDB_RULESET_DRAFT_NOT_FOUND';
  end if;
  return private.ruleset_draft_editor_document(revision_id);
end;
$$;

create function public.admin_apply_ruleset_draft_edit(
  p_request_id uuid,
  p_ruleset_revision_id bigint,
  p_expected_editor_revision integer,
  p_operation text,
  p_input jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing private.ruleset_draft_edit_requests;
  revision public.competition_ruleset_revisions;
  competition public.competitions;
  stage public.competition_stages;
  round_item public.competition_rounds;
  matchup public.matchups;
  slot public.competition_slots;
  name_value text;
  code_value text;
  entity_id bigint;
  home_slot_id bigint;
  away_slot_id bigint;
  target_entry_id bigint;
  target_source_matchup_id bigint;
  next_order integer;
  new_editor_revision integer;
  result jsonb;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode='BD401',message='BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if p_request_id is null or p_ruleset_revision_id is null
    or p_expected_editor_revision is null or p_expected_editor_revision < 1
    or p_operation not in (
      'rename_stage','rename_round','add_matchup','remove_matchup','set_origin'
    )
    or p_input is null or jsonb_typeof(p_input)<>'object'
    or octet_length(p_input::text)>4000
  then
    raise exception using errcode='BR059',message='BDB_RULESET_EDIT_INPUT_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,313));
  select * into existing from private.ruleset_draft_edit_requests
  where request_id=p_request_id;
  if found then
    if existing.actor_id<>auth.uid()
      or existing.ruleset_revision_id<>p_ruleset_revision_id
      or existing.expected_editor_revision<>p_expected_editor_revision
      or existing.operation<>p_operation
      or existing.input is distinct from p_input
    then
      raise exception using errcode='BR010',message='BDB_IDEMPOTENCY_CONFLICT';
    end if;
    return existing.result || jsonb_build_object('outcome','unchanged');
  end if;

  select * into revision from public.competition_ruleset_revisions
  where id=p_ruleset_revision_id;
  if not found then
    raise exception using errcode='BD404',message='BDB_RULESET_DRAFT_NOT_FOUND';
  end if;
  select * into competition from public.competitions
  where id=revision.competition_id for update;
  if competition.status<>'draft' then
    raise exception using errcode='BR054',message='BDB_RULESET_TARGET_NOT_DRAFT';
  end if;
  select * into revision from public.competition_ruleset_revisions
  where id=p_ruleset_revision_id for update;
  if revision.status<>'draft' then
    raise exception using errcode='BR004',message='BDB_ACTIVE_RULESET_IMMUTABLE';
  end if;
  if revision.editor_revision<>p_expected_editor_revision then
    raise exception using errcode='BR060',message='BDB_RULESET_EDIT_CHANGED_RELOAD';
  end if;

  if p_operation='rename_stage' then
    if exists(select 1 from jsonb_object_keys(p_input) key where key not in ('stageId','name')) then
      raise exception using errcode='BR059',message='BDB_RULESET_EDIT_INPUT_INVALID';
    end if;
    begin entity_id:=(p_input->>'stageId')::bigint;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode='BR059',message='BDB_RULESET_EDIT_INPUT_INVALID';
    end;
    name_value:=btrim(coalesce(p_input->>'name',''));
    if char_length(name_value) not between 2 and 120 then
      raise exception using errcode='BR059',message='BDB_RULESET_EDIT_INPUT_INVALID';
    end if;
    update public.competition_stages set name=name_value
    where id=entity_id and ruleset_revision_id=revision.id returning * into stage;
    if not found then raise exception using errcode='BD404',message='BDB_RULESET_NODE_NOT_FOUND'; end if;

  elsif p_operation='rename_round' then
    if exists(select 1 from jsonb_object_keys(p_input) key where key not in ('roundId','name')) then
      raise exception using errcode='BR059',message='BDB_RULESET_EDIT_INPUT_INVALID';
    end if;
    begin entity_id:=(p_input->>'roundId')::bigint;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode='BR059',message='BDB_RULESET_EDIT_INPUT_INVALID';
    end;
    name_value:=btrim(coalesce(p_input->>'name',''));
    if char_length(name_value) not between 2 and 120 then
      raise exception using errcode='BR059',message='BDB_RULESET_EDIT_INPUT_INVALID';
    end if;
    update public.competition_rounds set name=name_value
    where id=entity_id and ruleset_revision_id=revision.id returning * into round_item;
    if not found then raise exception using errcode='BD404',message='BDB_RULESET_NODE_NOT_FOUND'; end if;

  elsif p_operation='add_matchup' then
    if exists(select 1 from jsonb_object_keys(p_input) key where key not in ('roundId','code')) then
      raise exception using errcode='BR059',message='BDB_RULESET_EDIT_INPUT_INVALID';
    end if;
    begin entity_id:=(p_input->>'roundId')::bigint;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode='BR059',message='BDB_RULESET_EDIT_INPUT_INVALID';
    end;
    code_value:=lower(btrim(coalesce(p_input->>'code','')));
    if code_value !~ '^[a-z][a-z0-9_]{1,39}$' then
      raise exception using errcode='BR059',message='BDB_RULESET_EDIT_INPUT_INVALID';
    end if;
    select * into round_item from public.competition_rounds
    where id=entity_id and ruleset_revision_id=revision.id for update;
    if not found then raise exception using errcode='BD404',message='BDB_RULESET_NODE_NOT_FOUND'; end if;
    if (select count(*) from public.matchups where round_id=round_item.id)>=round_item.max_matchups then
      raise exception using errcode='BR006',message='BDB_ROUND_CAPACITY_EXCEEDED';
    end if;
    select coalesce(max(matchup_order),0)+1 into next_order
    from public.matchups where round_id=round_item.id;
    insert into public.competition_slots(
      competition_id,ruleset_revision_id,round_id,origin_kind
    ) values(revision.competition_id,revision.id,round_item.id,'undefined')
    returning id into home_slot_id;
    insert into public.competition_slots(
      competition_id,ruleset_revision_id,round_id,origin_kind
    ) values(revision.competition_id,revision.id,round_item.id,'undefined')
    returning id into away_slot_id;
    insert into public.matchups(
      competition_id,round_id,ruleset_revision_id,code,home_slot_id,away_slot_id,
      matchup_order,structure_kind,match_format,max_games
    ) values(
      revision.competition_id,round_item.id,revision.id,code_value,
      home_slot_id,away_slot_id,next_order,'regulated','single_game',1
    ) returning * into matchup;
    entity_id:=matchup.id;

  elsif p_operation='remove_matchup' then
    if exists(select 1 from jsonb_object_keys(p_input) key where key<>'matchupId') then
      raise exception using errcode='BR059',message='BDB_RULESET_EDIT_INPUT_INVALID';
    end if;
    begin entity_id:=(p_input->>'matchupId')::bigint;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode='BR059',message='BDB_RULESET_EDIT_INPUT_INVALID';
    end;
    select * into matchup from public.matchups
    where id=entity_id and ruleset_revision_id=revision.id for update;
    if not found then raise exception using errcode='BD404',message='BDB_RULESET_NODE_NOT_FOUND'; end if;
    if exists(select 1 from public.competition_slots where source_matchup_id=matchup.id)
      or exists(select 1 from public.games where matchup_id=matchup.id)
      or exists(select 1 from public.matchup_preparations where matchup_id=matchup.id)
      or exists(select 1 from public.matchup_resolutions where matchup_id=matchup.id)
    then
      raise exception using errcode='BR061',message='BDB_RULESET_MATCHUP_DEPENDENCY';
    end if;
    delete from public.matchups where id=matchup.id;
    delete from public.competition_slots where id in (matchup.home_slot_id,matchup.away_slot_id);

  else
    if exists(select 1 from jsonb_object_keys(p_input) key
      where key not in ('slotId','kind','entrySeed','sourceMatchupId'))
    then
      raise exception using errcode='BR059',message='BDB_RULESET_EDIT_INPUT_INVALID';
    end if;
    begin entity_id:=(p_input->>'slotId')::bigint;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode='BR059',message='BDB_RULESET_EDIT_INPUT_INVALID';
    end;
    select * into slot from public.competition_slots
    where id=entity_id and ruleset_revision_id=revision.id for update;
    if not found then raise exception using errcode='BD404',message='BDB_RULESET_NODE_NOT_FOUND'; end if;
    if p_input->>'kind'='undefined' then
      target_entry_id:=null; target_source_matchup_id:=null;
    elsif p_input->>'kind'='entry' then
      begin
        select entry.id into target_entry_id from public.competition_entries entry
        where ruleset_revision_id=revision.id and seed=(p_input->>'entrySeed')::integer;
      exception when invalid_text_representation or numeric_value_out_of_range then
        raise exception using errcode='BR059',message='BDB_RULESET_EDIT_INPUT_INVALID';
      end;
      if target_entry_id is null then raise exception using errcode='BR003',message='BDB_PRESET_SOURCE_INVALID'; end if;
      target_source_matchup_id:=null;
    elsif p_input->>'kind'='winner' then
      begin target_source_matchup_id:=(p_input->>'sourceMatchupId')::bigint;
      exception when invalid_text_representation or numeric_value_out_of_range then
        raise exception using errcode='BR059',message='BDB_RULESET_EDIT_INPUT_INVALID';
      end;
      if not exists(select 1 from public.matchups source
        join public.competition_rounds source_round on source_round.id=source.round_id
        join public.competition_rounds target_round on target_round.id=slot.round_id
        where source.id=target_source_matchup_id
          and source.ruleset_revision_id=revision.id
          and source_round.round_order<target_round.round_order)
      then raise exception using errcode='BR003',message='BDB_PRESET_SOURCE_INVALID'; end if;
      target_entry_id:=null;
    else
      raise exception using errcode='BR059',message='BDB_RULESET_EDIT_INPUT_INVALID';
    end if;
    update public.competition_slots
    set origin_kind=p_input->>'kind',entry_id=target_entry_id,
      source_matchup_id=target_source_matchup_id
    where id=slot.id;
  end if;

  update public.competition_ruleset_revisions
  set editor_revision=editor_revision+1
  where id=revision.id returning editor_revision into new_editor_revision;
  result:=jsonb_build_object(
    'rulesetRevisionId',revision.id,
    'editorRevision',new_editor_revision,
    'operation',p_operation,
    'entityId',entity_id,
    'outcome','updated'
  );
  insert into private.ruleset_draft_edit_requests(
    request_id,actor_id,ruleset_revision_id,expected_editor_revision,
    operation,input,resulting_editor_revision,result
  ) values(
    p_request_id,auth.uid(),revision.id,p_expected_editor_revision,
    p_operation,p_input,new_editor_revision,result
  );
  insert into public.admin_mutation_audit(action,entity_type,entity_id,metadata)
  values('ruleset_draft_edited','competition_ruleset_revision',revision.id,
    jsonb_build_object(
      'competitionId',revision.competition_id,
      'editorRevision',new_editor_revision,
      'operation',p_operation,
      'entityId',entity_id
    ));
  return result;
exception
  when unique_violation then
    raise exception using errcode='BR062',message='BDB_RULESET_NODE_CONFLICT';
end;
$$;

revoke all on function public.admin_get_ruleset_draft_editor(bigint)
  from public, anon, authenticated;
revoke all on function public.admin_apply_ruleset_draft_edit(uuid,bigint,integer,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_get_ruleset_draft_editor(bigint)
  to authenticated;
grant execute on function public.admin_apply_ruleset_draft_edit(uuid,bigint,integer,text,jsonb)
  to authenticated;

comment on function public.admin_get_ruleset_draft_editor(bigint) is
  'Returns the normalized AAL2 editor document for the single private draft revision.';
comment on function public.admin_apply_ruleset_draft_edit(uuid,bigint,integer,text,jsonb) is
  'Applies one idempotent, CAS-protected structural edit to a private draft revision.';
