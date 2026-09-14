-- Additive v1 preset persistence. Legacy rows and columns retain their meaning.
alter table public.competition_ruleset_revisions
  add column preset_key text check (preset_key in ('single_group', 'single_elimination')),
  add column preset_version integer,
  add column entry_count integer,
  add column created_by uuid references auth.users(id) on delete restrict,
  add column activated_at timestamptz,
  add constraint ruleset_preset_metadata_check check (
    (preset_key is null and preset_version is null and entry_count is null)
    or (preset_key is not null and preset_version is not null and preset_version = 1
      and entry_count is not null and entry_count between 2 and 16
      and structure_kind = 'regulated' and created_by is not null)
  );
create index ruleset_created_by_idx on public.competition_ruleset_revisions(created_by);

create table public.competition_tracks (
  id bigint generated always as identity primary key,
  competition_id bigint not null,
  ruleset_revision_id bigint not null,
  code text not null check (code = 'main'),
  foreign key (ruleset_revision_id, competition_id)
    references public.competition_ruleset_revisions(id, competition_id) on delete restrict,
  unique (id, ruleset_revision_id, competition_id),
  unique (ruleset_revision_id, code)
);
alter table public.competition_stages
  add column track_id bigint,
  add column stage_kind text check (stage_kind in ('round_robin', 'knockout')),
  add constraint stage_preset_track_fkey foreign key (track_id, ruleset_revision_id, competition_id)
    references public.competition_tracks(id, ruleset_revision_id, competition_id) on delete restrict,
  add constraint stage_revision_identity_unique unique(id, ruleset_revision_id, competition_id);
create index stage_preset_track_idx on public.competition_stages(track_id, ruleset_revision_id, competition_id);

create table public.competition_groups (
  id bigint generated always as identity primary key,
  competition_id bigint not null,
  ruleset_revision_id bigint not null,
  stage_id bigint not null,
  code text not null check (code = 'single_group'),
  foreign key (stage_id, ruleset_revision_id, competition_id)
    references public.competition_stages(id, ruleset_revision_id, competition_id) on delete restrict,
  unique(id, stage_id, ruleset_revision_id, competition_id),
  unique(stage_id, code)
);
alter table public.competition_rounds
  add column ruleset_revision_id bigint,
  add column group_id bigint,
  add column round_role text,
  add column capacity integer,
  add column max_matchups integer,
  add constraint round_preset_stage_fkey foreign key(stage_id, ruleset_revision_id, competition_id)
    references public.competition_stages(id, ruleset_revision_id, competition_id) on delete restrict,
  add constraint round_preset_group_fkey foreign key(group_id, stage_id, ruleset_revision_id, competition_id)
    references public.competition_groups(id, stage_id, ruleset_revision_id, competition_id) on delete restrict,
  add constraint round_revision_identity_unique unique(id, ruleset_revision_id, competition_id),
  add constraint round_local_contract_check check (
    (ruleset_revision_id is null and round_role is null and capacity is null and max_matchups is null)
    or (ruleset_revision_id is not null and round_role is not null and capacity is not null and max_matchups is not null and (
      (round_role = 'round_robin' and capacity between 2 and 16 and max_matchups = capacity / 2 and group_id is not null)
      or (group_id is null and (round_role, capacity, max_matchups) in (
        ('round_of_16',16,8),('quarterfinal',8,4),('semifinal',4,2),('final',2,1)
      ))
    ))
  );
create index round_preset_stage_idx on public.competition_rounds(stage_id, ruleset_revision_id, competition_id);
create index round_preset_group_idx on public.competition_rounds(group_id, stage_id, ruleset_revision_id, competition_id);

create table public.competition_entries (
  id bigint generated always as identity primary key,
  competition_id bigint not null,
  ruleset_revision_id bigint not null,
  seed integer not null check (seed between 1 and 16),
  foreign key (ruleset_revision_id, competition_id)
    references public.competition_ruleset_revisions(id, competition_id) on delete restrict,
  unique(id, ruleset_revision_id, competition_id),
  unique(ruleset_revision_id, seed)
);
-- Entries are unassigned positions, not inferred teams. Assignment belongs to MVP-04.
create table public.competition_slots (
  id bigint generated always as identity primary key,
  competition_id bigint not null,
  ruleset_revision_id bigint not null,
  round_id bigint not null,
  origin_kind text not null check (origin_kind in ('entry', 'winner')),
  entry_id bigint,
  source_matchup_id bigint,
  constraint slot_origin_exclusive check (
    (origin_kind = 'entry' and entry_id is not null and source_matchup_id is null)
    or (origin_kind = 'winner' and entry_id is null and source_matchup_id is not null)
  ),
  foreign key(round_id, ruleset_revision_id, competition_id)
    references public.competition_rounds(id, ruleset_revision_id, competition_id) on delete restrict,
  foreign key(entry_id, ruleset_revision_id, competition_id)
    references public.competition_entries(id, ruleset_revision_id, competition_id) on delete restrict,
  unique(id, round_id, ruleset_revision_id, competition_id),
  unique(round_id, entry_id),
  unique(ruleset_revision_id, source_matchup_id)
);
create index slots_entry_context_idx on public.competition_slots(entry_id, ruleset_revision_id, competition_id);
create index slots_round_context_idx on public.competition_slots(round_id, ruleset_revision_id, competition_id);

alter table public.matchups
  alter column home_registration_id drop not null,
  alter column away_registration_id drop not null,
  add column ruleset_revision_id bigint,
  add column code text,
  add column home_slot_id bigint,
  add column away_slot_id bigint,
  add column match_format text,
  add column max_games integer,
  add constraint matchup_revision_identity_unique unique(id, ruleset_revision_id, competition_id),
  add constraint matchup_revision_code_unique unique(ruleset_revision_id, code),
  add constraint matchup_preset_round_fkey foreign key(round_id, ruleset_revision_id, competition_id)
    references public.competition_rounds(id, ruleset_revision_id, competition_id) on delete restrict,
  add constraint matchup_home_slot_fkey foreign key(home_slot_id, round_id, ruleset_revision_id, competition_id)
    references public.competition_slots(id, round_id, ruleset_revision_id, competition_id) on delete restrict,
  add constraint matchup_away_slot_fkey foreign key(away_slot_id, round_id, ruleset_revision_id, competition_id)
    references public.competition_slots(id, round_id, ruleset_revision_id, competition_id) on delete restrict,
  add constraint matchup_preset_or_legacy_check check (
    (ruleset_revision_id is null and home_registration_id is not null and away_registration_id is not null
      and home_slot_id is null and away_slot_id is null and code is null and match_format is null and max_games is null)
    or (ruleset_revision_id is not null and home_slot_id is not null and away_slot_id is not null
      and home_slot_id <> away_slot_id and code is not null and code ~ '^[a-z][a-z0-9_]*$'
      and match_format is not null and match_format = 'single_game' and max_games is not null and max_games = 1
      and structure_kind = 'regulated' and legacy_game_id is null)
  );
create index matchup_preset_round_idx on public.matchups(round_id, ruleset_revision_id, competition_id);
create index matchup_home_slot_idx on public.matchups(home_slot_id, round_id, ruleset_revision_id, competition_id);
create index matchup_away_slot_idx on public.matchups(away_slot_id, round_id, ruleset_revision_id, competition_id);
alter table public.competition_slots add constraint slot_source_matchup_fkey
  foreign key(source_matchup_id, ruleset_revision_id, competition_id)
  references public.matchups(id, ruleset_revision_id, competition_id) on delete restrict;
create index slot_source_matchup_idx on public.competition_slots(source_matchup_id, ruleset_revision_id, competition_id);

create table public.competition_round_byes (
  competition_id bigint not null,
  ruleset_revision_id bigint not null,
  round_id bigint not null,
  entry_id bigint not null,
  bye_order integer not null check(bye_order > 0),
  primary key(round_id, entry_id),
  unique(round_id, bye_order),
  foreign key(round_id, ruleset_revision_id, competition_id)
    references public.competition_rounds(id, ruleset_revision_id, competition_id) on delete restrict,
  foreign key(entry_id, ruleset_revision_id, competition_id)
    references public.competition_entries(id, ruleset_revision_id, competition_id) on delete restrict
);
create index round_byes_entry_idx on public.competition_round_byes(entry_id, ruleset_revision_id, competition_id);
create index round_byes_round_context_idx on public.competition_round_byes(round_id, ruleset_revision_id, competition_id);
create index tracks_revision_context_idx on public.competition_tracks(ruleset_revision_id, competition_id);
create index groups_stage_context_idx on public.competition_groups(stage_id, ruleset_revision_id, competition_id);
create index entries_revision_context_idx on public.competition_entries(ruleset_revision_id, competition_id);

-- Reconstruct from FKs, never from a stored JSON graph; used as an activation gate.
create function private.preset_blueprint(p_revision_id bigint)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'key', rev.preset_key, 'version', rev.preset_version, 'entryCount', rev.entry_count,
    'track', (select jsonb_build_object('code', t.code) from public.competition_tracks t where t.ruleset_revision_id = rev.id),
    'stage', (select jsonb_build_object('code', s.code, 'kind', s.stage_kind) from public.competition_stages s where s.ruleset_revision_id = rev.id),
    'group', (select jsonb_build_object('code', g.code) from public.competition_groups g where g.ruleset_revision_id = rev.id),
    'rounds', coalesce((select jsonb_agg(jsonb_build_object(
      'code', r.code, 'order', r.round_order, 'role', r.round_role,
      'capacity', r.capacity, 'maxMatchups', r.max_matchups,
      'byes', coalesce((select jsonb_agg(e.seed order by b.bye_order)
        from public.competition_round_byes b join public.competition_entries e on e.id = b.entry_id
        where b.round_id = r.id), '[]'::jsonb),
      'matchups', coalesce((select jsonb_agg(jsonb_build_object(
        'code', m.code, 'format', m.match_format, 'maxGames', m.max_games,
        'home', case hs.origin_kind when 'entry' then jsonb_build_object('kind','entry','seed',he.seed)
          else jsonb_build_object('kind','winner','matchupCode',hm.code) end,
        'away', case aws.origin_kind when 'entry' then jsonb_build_object('kind','entry','seed',ae.seed)
          else jsonb_build_object('kind','winner','matchupCode',am.code) end
      ) order by m.matchup_order)
      from public.matchups m
      join public.competition_slots hs on hs.id=m.home_slot_id
      join public.competition_slots aws on aws.id=m.away_slot_id
      left join public.competition_entries he on he.id=hs.entry_id
      left join public.competition_entries ae on ae.id=aws.entry_id
      left join public.matchups hm on hm.id=hs.source_matchup_id
      left join public.matchups am on am.id=aws.source_matchup_id
      where m.round_id = r.id), '[]'::jsonb)
    ) order by r.round_order) from public.competition_rounds r where r.ruleset_revision_id=rev.id), '[]'::jsonb)
  ) from public.competition_ruleset_revisions rev where rev.id=p_revision_id;
$$;
revoke all on function private.preset_blueprint(bigint) from public, anon, authenticated;

create function private.guard_preset_revision()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op <> 'INSERT' and old.preset_key is not null and old.status <> 'draft' then
    raise exception using errcode='BR004', message='BDB_ACTIVE_RULESET_IMMUTABLE';
  end if;
  if tg_op <> 'DELETE' and new.preset_key is not null and new.status <> 'draft' then
    if new.status <> 'active' or new.activated_at is null or
      private.preset_blueprint(new.id) is distinct from
      private.compile_competition_preset_v1(new.preset_key, new.entry_count) or
      (select count(*) from public.competition_entries where ruleset_revision_id=new.id) <> new.entry_count or
      (select count(*) from public.competition_slots where ruleset_revision_id=new.id) <>
        2*(select count(*) from public.matchups where ruleset_revision_id=new.id)
    then raise exception using errcode='BR005', message='BDB_RULESET_VALIDATION_FAILED'; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.guard_preset_revision() from public, anon, authenticated;
create trigger guard_preset_revision before insert or update or delete on public.competition_ruleset_revisions
for each row execute function private.guard_preset_revision();

create function private.guard_preset_structure()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  revision_id bigint;
  revision_row public.competition_ruleset_revisions;
  round_row public.competition_rounds;
  origin_order integer;
begin
  -- Lock both old and new owners, including moves between revisions.
  for revision_id in select distinct id from unnest(array[
    case when tg_op <> 'INSERT' then (to_jsonb(old)->>'ruleset_revision_id')::bigint end,
    case when tg_op <> 'DELETE' then (to_jsonb(new)->>'ruleset_revision_id')::bigint end
  ]) id where id is not null order by id loop
    select * into strict revision_row from public.competition_ruleset_revisions where id=revision_id for update;
    if revision_row.preset_key is not null and revision_row.status <> 'draft' then
      raise exception using errcode='BR004', message='BDB_ACTIVE_RULESET_IMMUTABLE';
    end if;
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  if tg_table_name = 'matchups' and new.ruleset_revision_id is not null then
    select * into strict round_row from public.competition_rounds where id=new.round_id for update;
    if (select count(*) from public.matchups where round_id=new.round_id and id<>new.id) >= round_row.max_matchups then
      raise exception using errcode='BR006', message='BDB_ROUND_CAPACITY_EXCEEDED';
    end if;
    if exists(select 1 from public.matchups where id<>new.id and
      (home_slot_id in (new.home_slot_id,new.away_slot_id) or away_slot_id in (new.home_slot_id,new.away_slot_id))) then
      raise exception using errcode='BR007', message='BDB_SLOT_ALREADY_CONSUMED';
    end if;
  elsif tg_table_name = 'competition_slots' then
    if new.origin_kind = 'winner' then
      select r.round_order into origin_order from public.matchups m
      join public.competition_rounds r on r.id=m.round_id where m.id=new.source_matchup_id;
      if origin_order is null or origin_order >= (select round_order from public.competition_rounds where id=new.round_id) then
        raise exception using errcode='BR003', message='BDB_PRESET_SOURCE_INVALID';
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_preset_structure() from public, anon, authenticated;

do $$
declare relation_name text;
begin
  foreach relation_name in array array['competition_tracks','competition_groups','competition_entries','competition_slots','competition_round_byes'] loop
    execute format('alter table public.%I enable row level security',relation_name);
    execute format('alter table public.%I force row level security',relation_name);
    execute format('revoke all on public.%I from public, anon, authenticated',relation_name);
    execute format('grant select on public.%I to authenticated',relation_name);
    execute format('create policy %I on public.%I for select to authenticated using ((select public.is_current_admin_aal2()))',relation_name||'_admin_select',relation_name);
  end loop;
  foreach relation_name in array array['competition_tracks','competition_groups','competition_entries','competition_slots'] loop
    execute format('revoke all on sequence public.%I from public, anon, authenticated',relation_name||'_id_seq');
  end loop;
  foreach relation_name in array array['competition_tracks','competition_stages','competition_groups','competition_rounds','competition_entries','competition_slots','competition_round_byes','matchups'] loop
    execute format('create trigger guard_preset_structure before insert or update or delete on public.%I for each row execute function private.guard_preset_structure()',relation_name);
  end loop;
end;
$$;

create function private.materialize_competition_preset(p_competition_id bigint, p_key text, p_count integer)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare
  blueprint jsonb := private.compile_competition_preset_v1(p_key,p_count);
  revision_id bigint; track_id bigint; stage_id bigint; group_id bigint; round_id bigint;
  slot_id bigint; home_id bigint; away_id bigint; entry_id bigint; source_id bigint;
  round_item jsonb; match_item jsonb; origin jsonb; bye jsonb;
  match_order integer; bye_order integer; side integer;
begin
  perform 1 from public.competitions where id=p_competition_id and status='draft' for update;
  if not found or exists(select 1 from public.competition_ruleset_revisions where competition_id=p_competition_id) then
    raise exception using errcode='BR008', message='BDB_RULESET_INITIAL_ONLY';
  end if;
  insert into public.competition_ruleset_revisions(competition_id,revision_number,structure_kind,preset_key,preset_version,entry_count,created_by)
  values(p_competition_id,1,'regulated',p_key,1,p_count,auth.uid()) returning id into revision_id;
  insert into public.competition_tracks(competition_id,ruleset_revision_id,code)
  values(p_competition_id,revision_id,'main') returning id into track_id;
  insert into public.competition_stages(competition_id,ruleset_revision_id,track_id,code,name,stage_order,structure_kind,stage_kind)
  values(p_competition_id,revision_id,track_id,blueprint#>>'{stage,code}',
    case p_key when 'single_group' then 'Grupo único' else 'Eliminatória simples' end,1,'regulated',blueprint#>>'{stage,kind}') returning id into stage_id;
  if p_key='single_group' then
    insert into public.competition_groups(competition_id,ruleset_revision_id,stage_id,code)
    values(p_competition_id,revision_id,stage_id,'single_group') returning id into group_id;
  end if;
  insert into public.competition_entries(competition_id,ruleset_revision_id,seed)
    select p_competition_id,revision_id,n from generate_series(1,p_count) n;
  for round_item in select value from jsonb_array_elements(blueprint->'rounds') loop
    insert into public.competition_rounds(competition_id,stage_id,ruleset_revision_id,group_id,code,name,round_order,structure_kind,round_role,capacity,max_matchups)
    values(p_competition_id,stage_id,revision_id,group_id,round_item->>'code',
      case round_item->>'role' when 'round_robin' then 'Rodada '||(round_item->>'order')
        when 'round_of_16' then 'Oitavas de final' when 'quarterfinal' then 'Quartas de final'
        when 'semifinal' then 'Semifinal' else 'Final' end,
      (round_item->>'order')::smallint,'regulated',round_item->>'role',
      (round_item->>'capacity')::integer,(round_item->>'maxMatchups')::integer) returning id into round_id;
    bye_order:=0;
    for bye in select value from jsonb_array_elements(round_item->'byes') loop
      bye_order:=bye_order+1;
      insert into public.competition_round_byes(competition_id,ruleset_revision_id,round_id,entry_id,bye_order)
      select p_competition_id,revision_id,round_id,e.id,bye_order from public.competition_entries e
      where e.ruleset_revision_id=revision_id and e.seed=bye::integer;
    end loop;
    match_order:=0;
    for match_item in select value from jsonb_array_elements(round_item->'matchups') loop
      match_order:=match_order+1;
      for side in 1..2 loop
        origin:=match_item->(case side when 1 then 'home' else 'away' end);
        entry_id:=null; source_id:=null;
        if origin->>'kind'='entry' then
          select e.id into strict entry_id from public.competition_entries e
            where e.ruleset_revision_id=revision_id and e.seed=(origin->>'seed')::integer;
        else
          select m.id into strict source_id from public.matchups m
            where m.ruleset_revision_id=revision_id and m.code=origin->>'matchupCode';
        end if;
        insert into public.competition_slots(competition_id,ruleset_revision_id,round_id,origin_kind,entry_id,source_matchup_id)
        values(p_competition_id,revision_id,round_id,origin->>'kind',entry_id,source_id) returning id into slot_id;
        if side=1 then home_id:=slot_id; else away_id:=slot_id; end if;
      end loop;
      insert into public.matchups(competition_id,round_id,ruleset_revision_id,code,home_slot_id,away_slot_id,matchup_order,structure_kind,match_format,max_games)
      values(p_competition_id,round_id,revision_id,match_item->>'code',home_id,away_id,match_order,'regulated','single_game',1);
    end loop;
  end loop;
  update public.competition_ruleset_revisions set status='active',activated_at=now() where id=revision_id;
  return revision_id;
end;
$$;
revoke all on function private.materialize_competition_preset(bigint,text,integer) from public,anon,authenticated;

create table private.competition_creation_requests (
  request_id uuid primary key,
  actor_id uuid not null references auth.users(id) on delete restrict,
  input jsonb not null check(jsonb_typeof(input)='object' and octet_length(input::text)<=5000),
  competition_id bigint not null references public.competitions(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index competition_creation_actor_idx on private.competition_creation_requests(actor_id);
create index competition_creation_competition_idx on private.competition_creation_requests(competition_id);
alter table private.competition_creation_requests enable row level security;
alter table private.competition_creation_requests force row level security;
revoke all on private.competition_creation_requests from public,anon,authenticated;

alter table public.admin_mutation_audit drop constraint admin_mutation_audit_action_check,
add constraint admin_mutation_audit_action_check check(action in (
  'registration_created','registration_transitioned','roster_replaced','manual_scoresheet_saved',
  'boxscore_import_confirmed','boxscore_team_stats_refreshed','final_placement_confirmed','player_created',
  'competition_gender_reviewed','data_profile_created','data_profile_activated',
  'competition_data_profile_assigned','player_sex_reviewed','game_data_authority_activated',
  'competition_created_from_preset'
));

create function public.admin_create_competition_from_preset(p_request_id uuid,p_input jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
<<creation>>
declare
  existing private.competition_creation_requests;
  series_id bigint; category_id bigint; edition_year integer; edition_name text;
  gender text; source text; preset_key text; entry_count integer;
  starts_on date; ends_on date; expected_profile_id bigint;
  reason text; reviewed boolean;
  active_profile public.series_category_data_profiles;
  competition_id bigint; revision_id bigint;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode='BD401',message='BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if p_request_id is null or p_input is null or jsonb_typeof(p_input)<>'object'
    or octet_length(p_input::text)>5000 then
    raise exception using errcode='BR009',message='BDB_EDITION_INPUT_INVALID';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,310));
  select * into existing from private.competition_creation_requests where request_id=p_request_id;
  if found then
    if existing.actor_id<>auth.uid() or existing.input is distinct from p_input then
      raise exception using errcode='BR010',message='BDB_IDEMPOTENCY_CONFLICT';
    end if;
    return existing.competition_id;
  end if;
  if exists(select 1 from jsonb_object_keys(p_input) k where k not in (
    'seriesId','categoryId','year','name','gender','source','preset','entryCount',
    'startsOn','endsOn','expectedProfileId','reason','reviewed'
  )) then raise exception using errcode='BR009',message='BDB_EDITION_INPUT_INVALID'; end if;
  begin
    series_id:=(p_input->>'seriesId')::bigint;
    category_id:=(p_input->>'categoryId')::bigint;
    edition_year:=(p_input->>'year')::integer;
    entry_count:=(p_input->>'entryCount')::integer;
    expected_profile_id:=(p_input->>'expectedProfileId')::bigint;
    if nullif(p_input->>'startsOn','') is not null and (p_input->>'startsOn') !~ '^\d{4}-\d{2}-\d{2}$'
      or nullif(p_input->>'endsOn','') is not null and (p_input->>'endsOn') !~ '^\d{4}-\d{2}-\d{2}$'
    then raise exception using errcode='BR009',message='BDB_EDITION_INPUT_INVALID'; end if;
    starts_on:=nullif(p_input->>'startsOn','')::date;
    ends_on:=nullif(p_input->>'endsOn','')::date;
  exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow or invalid_datetime_format then
    raise exception using errcode='BR009',message='BDB_EDITION_INPUT_INVALID';
  end;
  edition_name:=btrim(p_input->>'name'); gender:=p_input->>'gender'; source:=p_input->>'source';
  preset_key:=p_input->>'preset'; reason:=nullif(btrim(p_input->>'reason'),'');
  reviewed:=p_input->'reviewed'='true'::jsonb;
  if series_id is null or series_id<=0 or category_id is null or category_id<=0
    or edition_year is null or edition_year<1900
    or edition_year>extract(year from now() at time zone 'America/Sao_Paulo')::integer+1
    or edition_name is null or char_length(edition_name) not between 2 and 160
    or gender is null or gender not in ('male','female')
    or source is null or source not in ('manual_scoresheet','fiba_boxscore')
    or (starts_on is not null and ends_on is not null and starts_on>ends_on)
    or (reason is not null and char_length(reason) not between 10 and 500)
  then raise exception using errcode='BR009',message='BDB_EDITION_INPUT_INVALID'; end if;
  perform private.compile_competition_preset_v1(preset_key,entry_count);
  perform pg_advisory_xact_lock(hashtextextended(edition_year::text,311));
  if not exists(select 1 from public.competitions where year=edition_year) and reviewed is distinct from true then
    raise exception using errcode='BR011',message='BDB_FIRST_YEAR_REVIEW_REQUIRED';
  end if;
  perform 1 from public.competition_series where id=series_id and is_active for share;
  if not found then raise exception using errcode='BD404',message='BDB_DATA_PROFILE_CONTEXT_NOT_FOUND'; end if;
  perform 1 from public.categories where id=category_id and is_active for share;
  if not found then raise exception using errcode='BD404',message='BDB_DATA_PROFILE_CONTEXT_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtextextended(series_id::text||':'||category_id::text||':'||gender,271));
  select * into active_profile from public.series_category_data_profiles p
    where p.series_id=creation.series_id
      and p.category_id=creation.category_id and p.gender_division=gender and p.status='active';
  if active_profile.id is distinct from expected_profile_id then
    raise exception using errcode='BR012',message='BDB_PROFILE_CHANGED_RELOAD';
  end if;
  if active_profile.id is null or active_profile.primary_source<>source then
    if active_profile.id is not null and (reviewed is distinct from true or reason is null) then
      raise exception using errcode='BR013',message='BDB_SOURCE_REVIEW_REQUIRED';
    end if;
    select * into active_profile from public.admin_create_series_category_data_profile(series_id,category_id,gender,source,reason);
    select * into active_profile from public.admin_activate_series_category_data_profile(active_profile.id);
  end if;
  insert into public.competitions(series_id,category_id,year,display_name,status,starts_on,ends_on,
    gender_division,gender_division_review_required,data_profile_id,data_profile_review_required,
    data_profile_validated_at,data_profile_validated_by)
  values(series_id,category_id,edition_year,edition_name,'draft',starts_on,ends_on,
    gender,false,active_profile.id,false,now(),auth.uid()) returning id into competition_id;
  revision_id:=private.materialize_competition_preset(competition_id,preset_key,entry_count);
  insert into private.competition_creation_requests(request_id,actor_id,input,competition_id)
    values(p_request_id,auth.uid(),p_input,competition_id);
  insert into public.admin_mutation_audit(action,entity_type,entity_id,metadata)
    values('competition_created_from_preset','competition',competition_id,
      jsonb_build_object('ruleset_revision_id',revision_id,'preset',preset_key,'version',1,'entry_count',entry_count));
  return competition_id;
exception when unique_violation then
  raise exception using errcode='BD506',message='BDB_COMPETITION_CONTEXT_CONFLICT';
end;
$$;
revoke all on function public.admin_create_competition_from_preset(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.admin_create_competition_from_preset(uuid,jsonb) to authenticated;
revoke insert on public.competitions from authenticated;

create function private.guard_preset_game()
returns trigger language plpgsql security invoker set search_path='' as $$
declare target public.matchups;
begin
  select * into target from public.matchups where id=new.matchup_id;
  if target.ruleset_revision_id is not null and (
    new.matchup_game_number is distinct from 1 or target.home_registration_id is null or target.away_registration_id is null
  ) then raise exception using errcode='BR014',message='BDB_PRESET_GAME_NOT_READY'; end if;
  return new;
end;
$$;
revoke all on function private.guard_preset_game() from public,anon,authenticated;
create trigger guard_preset_game before insert or update on public.games
for each row execute function private.guard_preset_game();
