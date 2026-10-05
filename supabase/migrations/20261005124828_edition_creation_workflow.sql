-- Additive extension of PR 66. Historical IDs, names and sporting facts are untouched.
alter table public.categories
  add column age_kind text not null default 'legacy',
  add column age_value smallint;

update public.categories set age_kind='adult' where slug='adulto' and name='Adulto';
update public.categories set age_kind='base', age_value=substring(slug from 5)::smallint
where slug ~ '^sub-(1[2-9]|2[0-3])$' and name='Sub-' || substring(slug from 5);

alter table public.categories add constraint categories_age_classification_check check (
  (age_kind in ('legacy','adult') and age_value is null)
  or (age_kind='base' and age_value is not null and age_value between 12 and 23)
  or (age_kind='master' and age_value is not null and age_value between 30 and 85 and age_value % 5=0)
);
create unique index categories_age_identity_unique on public.categories(age_kind,age_value)
  nulls not distinct where age_kind<>'legacy';

create function private.canonical_age_category()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.age_kind='adult' then new.name:='Adulto'; new.slug:='adulto';
  elsif new.age_kind='base' then new.name:='Sub-' || new.age_value; new.slug:='sub-' || new.age_value;
  elsif new.age_kind='master' then new.name:=new.age_value || '+'; new.slug:='master-' || new.age_value;
  end if;
  return new;
end;
$$;
revoke all on function private.canonical_age_category() from public,anon,authenticated;
create trigger categories_canonical_age before insert or update of age_kind,age_value,name,slug
  on public.categories for each row execute function private.canonical_age_category();

create table private.edition_creation_requests (
  request_id uuid primary key,
  actor_id uuid not null references auth.users(id) on delete restrict,
  operation text not null check(operation in ('create','add')),
  input jsonb not null check(jsonb_typeof(input)='object'),
  season_id bigint not null references public.competition_seasons(id) on delete restrict,
  competition_id bigint not null references public.competitions(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index edition_creation_requests_actor_idx on private.edition_creation_requests(actor_id);
create index edition_creation_requests_season_idx on private.edition_creation_requests(season_id);
create index edition_creation_requests_competition_idx on private.edition_creation_requests(competition_id);
alter table private.edition_creation_requests enable row level security;
alter table private.edition_creation_requests force row level security;
revoke all on private.edition_creation_requests from public,anon,authenticated;

do $$
declare previous_expression text;
begin
  select pg_get_expr(conbin,conrelid) into strict previous_expression from pg_constraint
    where conrelid='public.admin_mutation_audit'::regclass and conname='admin_mutation_audit_action_check';
  alter table public.admin_mutation_audit drop constraint admin_mutation_audit_action_check;
  execute format('alter table public.admin_mutation_audit add constraint admin_mutation_audit_action_check check ((%s) or action=%L)',
    previous_expression,'edition_workflow_created');
end;
$$;

create function private.create_edition_workflow(p_request_id uuid,p_input jsonb,p_add boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
<<workflow>>
declare
  prior private.edition_creation_requests;
  championship public.competition_series;
  season public.competition_seasons;
  category public.categories;
  division_type public.competition_competitive_division_types;
  division public.competition_competitive_division_values;
  series_id bigint; season_id bigint; division_id bigint; expected_profile_id bigint;
  kind text; age integer; edition_year integer; gender text; division_mode text;
  championship_name text; type_name text; value_name text; canonical_slug text;
  display_name text; competition_id bigint; starts_on date; ends_on date;
  conflict_constraint text; operation text := case when p_add then 'add' else 'create' end;
  created_championship boolean := false;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode='BD401',message='BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if p_request_id is null or p_input is null or jsonb_typeof(p_input)<>'object'
    or p_input->'reviewed' is distinct from 'true'::jsonb
    or exists(select 1 from jsonb_object_keys(p_input) k where k not in (
      'seriesId','championshipName','seasonId','categoryKind','categoryAge','year','gender',
      'description','startsOn','endsOn','divisionMode','divisionValueId','divisionTypeName',
      'divisionValueName','source','preset','entryCount','expectedProfileId','reason','reviewed'))
  then raise exception using errcode='BD501',message='BDB_EDITION_WORKFLOW_INPUT_INVALID'; end if;

  -- A single outer ledger owns retries, including all nested RPCs and audits.
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,431));
  select * into prior from private.edition_creation_requests r where r.request_id=p_request_id;
  if found then
    if prior.actor_id<>auth.uid() or prior.operation<>operation or prior.input is distinct from p_input then
      raise exception using errcode='BD409',message='BDB_IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object('seasonId',prior.season_id,'competitionId',prior.competition_id);
  end if;

  begin
    foreach canonical_slug in array array['championshipName','categoryKind','gender','description','startsOn','endsOn',
      'divisionMode','divisionTypeName','divisionValueName','source','preset','reason'] loop
      if p_input->>canonical_slug is not null and jsonb_typeof(p_input->canonical_slug)<>'string' then
        raise invalid_text_representation;
      end if;
    end loop;
    foreach canonical_slug in array array['seriesId','seasonId','categoryAge','year','entryCount','divisionValueId','expectedProfileId'] loop
      if p_input->>canonical_slug is not null and
        (jsonb_typeof(p_input->canonical_slug)<>'number' or p_input->>canonical_slug !~ '^[0-9]{1,9}$') then
        raise invalid_text_representation;
      end if;
    end loop;
    series_id:=(p_input->>'seriesId')::bigint;
    season_id:=(p_input->>'seasonId')::bigint;
    age:=(p_input->>'categoryAge')::integer;
    edition_year:=(p_input->>'year')::integer;
    division_id:=(p_input->>'divisionValueId')::bigint;
    expected_profile_id:=(p_input->>'expectedProfileId')::bigint;
    starts_on:=(p_input->>'startsOn')::date; ends_on:=(p_input->>'endsOn')::date;
    if (starts_on is not null and to_char(starts_on,'YYYY-MM-DD')<>p_input->>'startsOn')
      or (ends_on is not null and to_char(ends_on,'YYYY-MM-DD')<>p_input->>'endsOn') then
      raise invalid_datetime_format;
    end if;
  exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow or invalid_datetime_format then
    raise exception using errcode='BD501',message='BDB_EDITION_WORKFLOW_INPUT_INVALID';
  end;
  kind:=p_input->>'categoryKind'; gender:=p_input->>'gender'; division_mode:=p_input->>'divisionMode';
  championship_name:=btrim(coalesce(p_input->>'championshipName',''));
  type_name:=btrim(coalesce(p_input->>'divisionTypeName',''));
  value_name:=btrim(coalesce(p_input->>'divisionValueName',''));
  if kind is null or kind not in ('adult','base','master')
    or (kind='adult' and age is not null)
    or (kind='base' and (age is null or age not between 12 and 23))
    or (kind='master' and (age is null or age not between 30 and 85 or age % 5<>0))
    or edition_year is null or edition_year not between 1900 and extract(year from current_date)::integer+1
    or gender is null or gender not in ('male','female')
    or (starts_on is not null and ends_on is not null and starts_on>ends_on)
    or division_mode is null or division_mode not in ('none','existing','new')
    or (division_mode='existing' and (division_id is null or division_id<=0))
    or (division_mode<>'existing' and division_id is not null)
    or (division_mode='new' and (char_length(type_name) not between 2 and 80 or char_length(value_name) not between 1 and 80))
    or (division_mode<>'new' and (type_name<>'' or value_name<>''))
    or (p_add and (season_id is null or season_id<=0 or series_id is not null or championship_name<>''))
    or (not p_add and (season_id is not null or division_mode='existing'
      or (series_id is null and char_length(championship_name) not between 2 and 120)
      or (series_id is not null and (series_id<=0 or championship_name<>''))))
    or char_length(coalesce(p_input->>'description',''))>2000
    or (expected_profile_id is not null and expected_profile_id<=0)
  then raise exception using errcode='BD501',message='BDB_EDITION_WORKFLOW_INPUT_INVALID'; end if;

  if p_add then
    select * into season from public.competition_seasons s where s.id=season_id;
    if not found then raise exception using errcode='BD404',message='BDB_COMPETITION_SEASON_NOT_FOUND'; end if;
    if season.year<>edition_year or season.gender_division<>gender
      or season.description is distinct from nullif(btrim(coalesce(p_input->>'description','')),'') then
      raise exception using errcode='BD409',message='BDB_EDITION_CONTEXT_STALE';
    end if;
    series_id:=season.series_id;
  elsif series_id is null then
    canonical_slug:=private.slugify_team_name(championship_name);
    if canonical_slug='' then raise exception using errcode='BD501',message='BDB_CHAMPIONSHIP_NAME_INVALID'; end if;
    perform pg_advisory_xact_lock(hashtextextended(canonical_slug,432));
    begin
      insert into public.competition_series(name,slug) values(championship_name,canonical_slug) returning * into championship;
    exception when unique_violation then
      get stacked diagnostics conflict_constraint=constraint_name;
      if conflict_constraint<>'competition_series_slug_key' then raise; end if;
      raise exception using errcode='BD506',message='BDB_CHAMPIONSHIP_ALREADY_EXISTS';
    end;
    series_id:=championship.id;
    created_championship:=true;
  end if;
  select * into championship from public.competition_series s where s.id=series_id and s.is_active for share;
  if not found then raise exception using errcode='BD404',message='BDB_COMPETITION_SERIES_NOT_FOUND'; end if;

  perform pg_advisory_xact_lock(hashtextextended(kind || ':' || coalesce(age::text,''),433));
  select * into category from public.categories c where c.age_kind=kind and c.age_value is not distinct from age;
  if not found then
    canonical_slug:=case kind when 'adult' then 'adulto' when 'base' then 'sub-' || age else 'master-' || age end;
    if exists(select 1 from public.categories c where c.slug=canonical_slug) then
      raise exception using errcode='BD409',message='BDB_CATEGORY_LEGACY_CONFLICT';
    end if;
    insert into public.categories(name,slug,age_kind,age_value) values('Canonical',canonical_slug,kind,age) returning * into category;
  elsif not category.is_active then
    raise exception using errcode='BD404',message='BDB_DATA_PROFILE_CONTEXT_NOT_FOUND';
  end if;

  -- Match the established creation lock order: year, profile, season, row.
  perform pg_advisory_xact_lock(hashtextextended(edition_year::text,311));
  perform pg_advisory_xact_lock(hashtextextended(series_id::text || ':' || category.id::text || ':' || gender,271));
  perform pg_advisory_xact_lock(hashtextextended(series_id::text || ':' || edition_year::text || ':' || gender,417));
  if not p_add then
    season_id:=public.admin_create_competition_season(gen_random_uuid(),series_id,edition_year,gender,
      championship.name,nullif(btrim(coalesce(p_input->>'description','')),''),starts_on,ends_on);
  end if;
  select * into season from public.competition_seasons s where s.id=season_id for update;
  if season.series_id<>series_id or season.year<>edition_year or season.gender_division<>gender
    or season.description is distinct from nullif(btrim(coalesce(p_input->>'description','')),'') then
    raise exception using errcode='BD409',message='BDB_EDITION_CONTEXT_STALE';
  end if;
  if division_mode='existing' then
    select * into division from public.competition_competitive_division_values d where d.id=division_id and d.season_id=workflow.season_id;
    if not found then raise exception using errcode='BD501',message='BDB_COMPETITION_DIVISION_CONTEXT_INVALID'; end if;
    select * into division_type from public.competition_competitive_division_types t where t.id=division.competitive_division_type_id;
  elsif division_mode='new' then
    division_id:=public.admin_add_competitive_division_value(gen_random_uuid(),season_id,type_name,
      private.slugify_team_name(type_name),value_name,private.slugify_team_name(value_name),
      (select coalesce(max(d.sort_order),0)+1 from public.competition_competitive_division_values d where d.season_id=workflow.season_id));
    select * into division from public.competition_competitive_division_values d where d.id=division_id;
    select * into division_type from public.competition_competitive_division_types t where t.id=division.competitive_division_type_id;
  end if;
  if exists(select 1 from public.competitions c where c.season_id=workflow.season_id
    and c.category_id=category.id and c.competitive_division_value_id is not distinct from division_id) then
    raise exception using errcode='BD506',message='BDB_COMPETITION_CONTEXT_ALREADY_EXISTS';
  end if;
  display_name:=season.name || case when kind='adult' then '' else ' - ' || category.name end;
  if division_id is not null then
    display_name:=display_name || case when kind='adult' then ' - ' else ' · ' end || division_type.name || ' ' || division.name;
  end if;
  competition_id:=public.admin_create_competition_from_preset(gen_random_uuid(),jsonb_build_object(
    'seriesId',series_id,'categoryId',category.id,'year',edition_year,'name',display_name,'gender',gender,
    'source',p_input->>'source','preset',p_input->>'preset','entryCount',p_input->'entryCount',
    'startsOn',starts_on,'endsOn',ends_on,'expectedProfileId',expected_profile_id,'reason',p_input->>'reason',
    'reviewed',true,'seasonId',season_id,'competitiveDivisionValueId',division_id
  ));
  insert into private.edition_creation_requests(request_id,actor_id,operation,input,season_id,competition_id)
    values(p_request_id,auth.uid(),operation,p_input,season_id,competition_id);
  insert into public.admin_mutation_audit(action,entity_type,entity_id,metadata)
    values('edition_workflow_created','competition_season',season_id,jsonb_build_object(
      'operation',operation,'competitionId',competition_id,'seriesId',series_id,
      'createdChampionship',created_championship,'categoryId',category.id,'categoryKind',kind,'categoryAge',age,
      'competitiveDivisionValueId',division_id));
  return jsonb_build_object('seasonId',season_id,'competitionId',competition_id);
end;
$$;
revoke all on function private.create_edition_workflow(uuid,jsonb,boolean) from public,anon,authenticated;

create function public.admin_create_competition_edition(p_request_id uuid,p_input jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select private.create_edition_workflow(p_request_id,p_input,false);
$$;
create function public.admin_add_competition_dispute(p_request_id uuid,p_input jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select private.create_edition_workflow(p_request_id,p_input,true);
$$;
-- Wrappers need definer authority to invoke the inaccessible private implementation.
alter function public.admin_create_competition_edition(uuid,jsonb) security definer;
alter function public.admin_add_competition_dispute(uuid,jsonb) security definer;
revoke all on function public.admin_create_competition_edition(uuid,jsonb),
  public.admin_add_competition_dispute(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.admin_create_competition_edition(uuid,jsonb),
  public.admin_add_competition_dispute(uuid,jsonb) to authenticated;
