-- Operational assignments are separate from the immutable preset blueprint.
alter table public.games drop constraint games_source_check,
add constraint games_source_check check(source in ('manual','boxscore','seed','structural'));
alter table public.games drop constraint games_manual_submission_consistent,
add constraint games_manual_submission_consistent check(
  (source='manual' and manual_idempotency_key is not null and manual_payload_hash is not null and created_by is not null)
  or (source in ('boxscore','seed','structural') and manual_idempotency_key is null and manual_payload_hash is null)
);
alter table public.admin_mutation_audit drop constraint admin_mutation_audit_action_check,
add constraint admin_mutation_audit_action_check check(action in (
  'registration_created','registration_transitioned','roster_replaced','manual_scoresheet_saved',
  'boxscore_import_confirmed','boxscore_team_stats_refreshed','final_placement_confirmed','player_created',
  'competition_gender_reviewed','data_profile_created','data_profile_activated',
  'competition_data_profile_assigned','player_sex_reviewed','game_data_authority_activated',
  'competition_created_from_preset','competition_entry_assigned','matchup_prepared'
));
alter table public.admin_mutation_audit drop constraint admin_mutation_audit_entity_type_check,
add constraint admin_mutation_audit_entity_type_check check(entity_type in (
  'team_registration','game','boxscore_import','final_placement','player','competition','data_profile',
  'competition_entry','matchup'
));
create table public.competition_entry_assignments (
  entry_id bigint primary key,
  ruleset_revision_id bigint not null,
  competition_id bigint not null,
  registration_id bigint not null,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  foreign key(entry_id,ruleset_revision_id,competition_id)
    references public.competition_entries(id,ruleset_revision_id,competition_id) on delete restrict,
  foreign key(registration_id,competition_id)
    references public.team_registrations(id,competition_id) on delete restrict,
  unique(ruleset_revision_id,registration_id)
);
create index entry_assignments_registration_idx on public.competition_entry_assignments(registration_id,competition_id);
create index entry_assignments_context_idx on public.competition_entry_assignments(competition_id,ruleset_revision_id);
create index entry_assignments_actor_idx on public.competition_entry_assignments(assigned_by);

create table public.matchup_preparations (
  matchup_id bigint primary key,
  competition_id bigint not null,
  scheduled_at timestamptz,
  venue text check(venue is null or (venue=btrim(venue) and char_length(venue) between 1 and 160)),
  revision integer not null default 1 check(revision>0),
  game_id bigint unique,
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  foreign key(matchup_id,competition_id) references public.matchups(id,competition_id) on delete restrict,
  foreign key(game_id,competition_id) references public.games(id,competition_id) on delete restrict,
  check(scheduled_at is null or isfinite(scheduled_at))
);
create index matchup_preparations_context_idx on public.matchup_preparations(competition_id);
create index matchup_preparations_actor_idx on public.matchup_preparations(updated_by);

alter table public.competition_entry_assignments enable row level security;
alter table public.competition_entry_assignments force row level security;
alter table public.matchup_preparations enable row level security;
alter table public.matchup_preparations force row level security;
revoke all on public.competition_entry_assignments,public.matchup_preparations from public,anon,authenticated;
grant select on public.competition_entry_assignments,public.matchup_preparations to authenticated;
create policy entry_assignments_admin_select on public.competition_entry_assignments for select to authenticated
  using((select public.is_current_admin_aal2()));
create policy matchup_preparations_admin_select on public.matchup_preparations for select to authenticated
  using((select public.is_current_admin_aal2()));

create function private.guard_entry_assignment()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op<>'INSERT' then
    raise exception using errcode='BR021',message='BDB_ENTRY_ASSIGNMENT_IMMUTABLE';
  end if;
  perform 1 from public.competitions where id=new.competition_id and status='draft' and published_at is null for update;
  if not found then raise exception using errcode='BR020',message='BDB_PRIVATE_EDITION_REQUIRED'; end if;
  perform 1 from public.competition_ruleset_revisions where id=new.ruleset_revision_id
    and competition_id=new.competition_id and status='active' and preset_key is not null for update;
  if not found then raise exception using errcode='BR022',message='BDB_ACTIVE_PRESET_REQUIRED'; end if;
  perform 1 from public.team_registrations where id=new.registration_id and competition_id=new.competition_id
    and status='confirmed' for update;
  if not found then raise exception using errcode='BR023',message='BDB_CONFIRMED_REGISTRATION_REQUIRED'; end if;
  return new;
end;
$$;
revoke all on function private.guard_entry_assignment() from public,anon,authenticated;
create trigger guard_entry_assignment before insert or update or delete on public.competition_entry_assignments
  for each row execute function private.guard_entry_assignment();

-- Winner slots remain unresolved until the explicit result-resolution operation exists.
create function private.resolved_slot_registration(p_slot_id bigint)
returns bigint language sql stable security invoker set search_path='' as $$
  select a.registration_id from public.competition_slots s
  join public.competition_entry_assignments a on a.entry_id=s.entry_id
    and a.ruleset_revision_id=s.ruleset_revision_id and a.competition_id=s.competition_id
  where s.id=p_slot_id and s.origin_kind='entry';
$$;
revoke all on function private.resolved_slot_registration(bigint) from public,anon,authenticated;

-- Narrow exception: materialize evidenced participants, never mutate the active graph.
create or replace function private.guard_preset_structure()
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
      if tg_table_name='matchups' and tg_op='UPDATE' then
  if old.ruleset_revision_id is not null
    and (to_jsonb(new)-array['home_registration_id','away_registration_id','updated_at'])
      = (to_jsonb(old)-array['home_registration_id','away_registration_id','updated_at'])
    and new.home_registration_id is not distinct from private.resolved_slot_registration(new.home_slot_id)
    and new.away_registration_id is not distinct from private.resolved_slot_registration(new.away_slot_id)
    and (old.home_registration_id is null or old.home_registration_id is not distinct from new.home_registration_id)
    and (old.away_registration_id is null or old.away_registration_id is not distinct from new.away_registration_id)
  then return new; end if;
      end if;
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

create function public.admin_assign_competition_entry(p_entry_id bigint,p_registration_id bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare e public.competition_entries; existing bigint;
begin
  if not private.is_admin_aal2() then raise exception using errcode='BD401',message='BDB_ADMIN_AAL2_REQUIRED'; end if;
  select * into e from public.competition_entries where id=p_entry_id;
  if not found then raise exception using errcode='BD404',message='BDB_ENTRY_NOT_FOUND'; end if;
  perform 1 from public.competitions where id=e.competition_id for update;
  select registration_id into existing from public.competition_entry_assignments where entry_id=p_entry_id;
  if found then
    if existing=p_registration_id then return p_entry_id; end if;
    raise exception using errcode='BR021',message='BDB_ENTRY_ASSIGNMENT_IMMUTABLE';
  end if;
  if exists(select 1 from public.competition_entry_assignments where ruleset_revision_id=e.ruleset_revision_id and registration_id=p_registration_id) then
    raise exception using errcode='BR024',message='BDB_REGISTRATION_ALREADY_ASSIGNED';
  end if;
  insert into public.competition_entry_assignments(entry_id,ruleset_revision_id,competition_id,registration_id,assigned_by)
  values(e.id,e.ruleset_revision_id,e.competition_id,p_registration_id,auth.uid());
  update public.matchups m set home_registration_id=private.resolved_slot_registration(m.home_slot_id),
    away_registration_id=private.resolved_slot_registration(m.away_slot_id)
  where m.ruleset_revision_id=e.ruleset_revision_id and (
    m.home_registration_id is distinct from private.resolved_slot_registration(m.home_slot_id)
    or m.away_registration_id is distinct from private.resolved_slot_registration(m.away_slot_id));
  insert into public.admin_mutation_audit(action,entity_type,entity_id,metadata)
    values('competition_entry_assigned','competition_entry',e.id,jsonb_build_object('competitionId',e.competition_id,'registrationId',p_registration_id));
  return e.id;
end;
$$;
revoke all on function public.admin_assign_competition_entry(bigint,bigint) from public,anon,authenticated;
grant execute on function public.admin_assign_competition_entry(bigint,bigint) to authenticated;

create function public.admin_prepare_matchup(p_matchup_id bigint,p_expected_revision integer,p_scheduled_at timestamptz,p_venue text)
returns bigint language plpgsql security definer set search_path='' as $$
declare m public.matchups; c public.competitions; prep public.matchup_preparations;
  normalized_venue text:=nullif(btrim(p_venue),''); target_game bigint; participants_ready boolean;
begin
  if not private.is_admin_aal2() then raise exception using errcode='BD401',message='BDB_ADMIN_AAL2_REQUIRED'; end if;
  if p_expected_revision is null or p_expected_revision<0 or char_length(normalized_venue)>160
    or (p_scheduled_at is not null and not isfinite(p_scheduled_at)) then
    raise exception using errcode='BR025',message='BDB_SCHEDULE_INPUT_INVALID';
  end if;
  select * into m from public.matchups where id=p_matchup_id;
  if not found then raise exception using errcode='BD404',message='BDB_MATCHUP_NOT_FOUND'; end if;
  select * into c from public.competitions where id=m.competition_id for update;
  if c.status<>'draft' or c.published_at is not null then
    raise exception using errcode='BR020',message='BDB_PRIVATE_EDITION_REQUIRED';
  end if;
  perform 1 from public.competition_ruleset_revisions where id=m.ruleset_revision_id
    and status='active' and preset_key is not null for update;
  if not found then raise exception using errcode='BR022',message='BDB_ACTIVE_PRESET_REQUIRED'; end if;
  select * into m from public.matchups where id=p_matchup_id for update;
  if p_scheduled_at is not null and (
    (p_scheduled_at at time zone 'America/Sao_Paulo')::date<c.starts_on
    or (p_scheduled_at at time zone 'America/Sao_Paulo')::date>c.ends_on
  ) then raise exception using errcode='BR025',message='BDB_SCHEDULE_INPUT_INVALID'; end if;
  select * into prep from public.matchup_preparations where matchup_id=m.id for update;
  participants_ready:=m.home_registration_id is not null and m.away_registration_id is not null;
  if participants_ready and exists(select 1 from public.team_registrations where id in(m.home_registration_id,m.away_registration_id) and status<>'confirmed') then
    raise exception using errcode='BR023',message='BDB_CONFIRMED_REGISTRATION_REQUIRED';
  end if;
  -- A retry of exactly the current content is a no-op; newly resolved slots require explicit preparation again.
  if prep.matchup_id is not null and prep.scheduled_at is not distinct from p_scheduled_at
    and prep.venue is not distinct from normalized_venue and (prep.game_id is not null or not participants_ready)
  then return prep.game_id; end if;
  if coalesce(prep.revision,0)<>p_expected_revision then
    raise exception using errcode='BR026',message='BDB_SCHEDULE_CHANGED_RELOAD';
  end if;
  target_game:=prep.game_id;
  if target_game is not null then
    perform 1 from public.games where id=target_game and status in('draft','scheduled') and started_at is null for update;
    if not found or exists(select 1 from public.game_data_submissions where game_id=target_game) then
      raise exception using errcode='BR027',message='BDB_STARTED_GAME_SCHEDULE_IMMUTABLE';
    end if;
    update public.games set scheduled_at=p_scheduled_at,venue=normalized_venue,
      status=case when p_scheduled_at is null then 'draft' else 'scheduled' end where id=target_game;
  elsif participants_ready then
    insert into public.games(competition_id,matchup_id,matchup_game_number,scheduled_at,venue,status,created_by,source)
    values(m.competition_id,m.id,1,p_scheduled_at,normalized_venue,case when p_scheduled_at is null then 'draft' else 'scheduled' end,auth.uid(),'structural')
    returning id into target_game;
    insert into public.game_participants(game_id,competition_id,registration_id,side)
    values(target_game,m.competition_id,m.home_registration_id,'home'),(target_game,m.competition_id,m.away_registration_id,'away');
  end if;
  insert into public.matchup_preparations(matchup_id,competition_id,scheduled_at,venue,game_id,updated_by)
  values(m.id,m.competition_id,p_scheduled_at,normalized_venue,target_game,auth.uid())
  on conflict(matchup_id) do update set scheduled_at=excluded.scheduled_at,venue=excluded.venue,
    game_id=excluded.game_id,revision=public.matchup_preparations.revision+1,updated_by=auth.uid(),updated_at=clock_timestamp();
  insert into public.admin_mutation_audit(action,entity_type,entity_id,metadata)
  values('matchup_prepared','matchup',m.id,jsonb_build_object('competitionId',m.competition_id,'gameId',target_game,'revision',coalesce(prep.revision,0)+1));
  return target_game;
end;
$$;
revoke all on function public.admin_prepare_matchup(bigint,integer,timestamptz,text) from public,anon,authenticated;
grant execute on function public.admin_prepare_matchup(bigint,integer,timestamptz,text) to authenticated;
-- All application game writes already occur through the existing audited RPCs.
revoke insert,update,delete on public.games,public.game_participants from authenticated;

create function public.admin_get_competition_schedule(p_competition_id bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_admin_aal2() then raise exception using errcode='BD401',message='BDB_ADMIN_AAL2_REQUIRED'; end if;
  if not exists(select 1 from public.competitions where id=p_competition_id) then
    raise exception using errcode='BD404',message='BDB_COMPETITION_NOT_FOUND';
  end if;
  return jsonb_build_object(
    'entries',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'seed',e.seed,'registrationId',a.registration_id) order by e.seed)
      from public.competition_entries e left join public.competition_entry_assignments a on a.entry_id=e.id
      where e.competition_id=p_competition_id),'[]'::jsonb),
    'matchups',coalesce((select jsonb_agg(jsonb_build_object(
      'id',m.id,'code',m.code,'round',r.name,'order',m.matchup_order,
      'homeRegistrationId',m.home_registration_id,'awayRegistrationId',m.away_registration_id,
      'revision',coalesce(p.revision,0),'scheduledAt',p.scheduled_at,'venue',p.venue,'gameId',p.game_id
    ) order by r.round_order,m.matchup_order)
    from public.matchups m join public.competition_rounds r on r.id=m.round_id
    left join public.matchup_preparations p on p.matchup_id=m.id
    where m.competition_id=p_competition_id and m.ruleset_revision_id is not null),'[]'::jsonb)
  );
end;
$$;
revoke all on function public.admin_get_competition_schedule(bigint) from public,anon,authenticated;
grant execute on function public.admin_get_competition_schedule(bigint) to authenticated;
