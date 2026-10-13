-- EDITION-IDENTITY-NO-GENDER / PR 1
-- Editions are identified by championship + year. Gender remains authoritative
-- only on the administrable dispute (public.competitions).

do $$
begin
  if exists (
    select 1
    from public.competition_seasons season
    group by season.series_id, season.year
    having count(distinct jsonb_build_array(
      season.name,
      season.description,
      season.suggested_starts_on,
      season.suggested_ends_on
    )) > 1
  ) then
    raise exception using
      errcode = 'BD409',
      message = 'BDB_EDITION_SHARED_DATA_CONFLICT';
  end if;

  if exists (
    select 1
    from public.competition_competitive_division_types division_type
    join public.competition_seasons season on season.id = division_type.season_id
    group by season.series_id, season.year
    having count(distinct jsonb_build_array(division_type.name, division_type.slug)) > 1
  ) then
    raise exception using
      errcode = 'BD409',
      message = 'BDB_EDITION_DIVISION_TYPE_CONFLICT';
  end if;

  if exists (
    select 1
    from public.competition_competitive_division_values division_value
    join public.competition_seasons season on season.id = division_value.season_id
    group by season.series_id, season.year, division_value.slug
    having count(distinct jsonb_build_array(division_value.name, division_value.sort_order)) > 1
  ) or exists (
    select 1
    from public.competition_competitive_division_values division_value
    join public.competition_seasons season on season.id = division_value.season_id
    group by season.series_id, season.year, division_value.sort_order
    having count(distinct division_value.slug) > 1
  ) then
    raise exception using
      errcode = 'BD409',
      message = 'BDB_EDITION_DIVISION_VALUE_CONFLICT';
  end if;
end;
$$;

create table private.competition_season_id_aliases (
  legacy_id bigint primary key,
  season_id bigint not null,
  created_at timestamptz not null default now()
);

alter table private.competition_season_id_aliases enable row level security;
alter table private.competition_season_id_aliases force row level security;
revoke all on private.competition_season_id_aliases from public, anon, authenticated;

insert into private.competition_season_id_aliases (legacy_id, season_id)
select
  season.id,
  min(season.id) over (partition by season.series_id, season.year)
from public.competition_seasons season;

create table private.competition_division_type_id_aliases (
  legacy_id bigint primary key,
  competitive_division_type_id bigint not null,
  created_at timestamptz not null default now()
);

alter table private.competition_division_type_id_aliases enable row level security;
alter table private.competition_division_type_id_aliases force row level security;
revoke all on private.competition_division_type_id_aliases from public, anon, authenticated;

insert into private.competition_division_type_id_aliases (
  legacy_id,
  competitive_division_type_id
)
select
  division_type.id,
  min(division_type.id) over (partition by season_alias.season_id)
from public.competition_competitive_division_types division_type
join private.competition_season_id_aliases season_alias
  on season_alias.legacy_id = division_type.season_id;

create table private.competition_division_value_id_aliases (
  legacy_id bigint primary key,
  competitive_division_value_id bigint not null,
  created_at timestamptz not null default now()
);

alter table private.competition_division_value_id_aliases enable row level security;
alter table private.competition_division_value_id_aliases force row level security;
revoke all on private.competition_division_value_id_aliases from public, anon, authenticated;

insert into private.competition_division_value_id_aliases (
  legacy_id,
  competitive_division_value_id
)
select
  division_value.id,
  min(division_value.id) over (
    partition by season_alias.season_id, division_value.slug
  )
from public.competition_competitive_division_values division_value
join private.competition_season_id_aliases season_alias
  on season_alias.legacy_id = division_value.season_id;

drop view public.competition_dispute_contexts;

alter table public.competitions
  drop constraint competitions_dispute_unique,
  drop constraint competitions_season_identity_fkey,
  drop constraint competitions_competitive_division_value_season_fkey;

alter table public.competition_competitive_division_values
  drop constraint competition_competitive_division_values_type_fkey;

update public.competitions competition
set competitive_division_value_id = value_alias.competitive_division_value_id
from private.competition_division_value_id_aliases value_alias
where competition.competitive_division_value_id = value_alias.legacy_id
  and value_alias.legacy_id <> value_alias.competitive_division_value_id;

update private.competition_dimension_requests request
set result_id = value_alias.competitive_division_value_id
from private.competition_division_value_id_aliases value_alias
where request.operation = 'create_division_value'
  and request.result_id = value_alias.legacy_id
  and value_alias.legacy_id <> value_alias.competitive_division_value_id;

delete from public.competition_competitive_division_values division_value
using private.competition_division_value_id_aliases value_alias
where division_value.id = value_alias.legacy_id
  and value_alias.legacy_id <> value_alias.competitive_division_value_id;

update public.competition_competitive_division_values division_value
set
  competitive_division_type_id = type_alias.competitive_division_type_id,
  season_id = season_alias.season_id
from private.competition_division_type_id_aliases type_alias,
  private.competition_season_id_aliases season_alias
where type_alias.legacy_id = division_value.competitive_division_type_id
  and season_alias.legacy_id = division_value.season_id
  and (
    division_value.competitive_division_type_id <> type_alias.competitive_division_type_id
    or division_value.season_id <> season_alias.season_id
  );

delete from public.competition_competitive_division_types division_type
using private.competition_division_type_id_aliases type_alias
where division_type.id = type_alias.legacy_id
  and type_alias.legacy_id <> type_alias.competitive_division_type_id;

update public.competition_competitive_division_types division_type
set season_id = season_alias.season_id
from private.competition_season_id_aliases season_alias
where season_alias.legacy_id = division_type.season_id
  and season_alias.legacy_id <> season_alias.season_id;

update public.competitions competition
set season_id = season_alias.season_id
from private.competition_season_id_aliases season_alias
where competition.season_id = season_alias.legacy_id
  and season_alias.legacy_id <> season_alias.season_id;

update private.edition_creation_requests request
set season_id = season_alias.season_id
from private.competition_season_id_aliases season_alias
where request.season_id = season_alias.legacy_id
  and season_alias.legacy_id <> season_alias.season_id;

update private.competition_dimension_requests request
set result_id = season_alias.season_id
from private.competition_season_id_aliases season_alias
where request.operation = 'create_season'
  and request.result_id = season_alias.legacy_id
  and season_alias.legacy_id <> season_alias.season_id;

delete from public.competition_seasons season
using private.competition_season_id_aliases season_alias
where season.id = season_alias.legacy_id
  and season_alias.legacy_id <> season_alias.season_id;

alter table public.competition_seasons
  drop constraint competition_seasons_context_unique,
  drop constraint competition_seasons_identity_unique,
  drop column gender_division,
  add constraint competition_seasons_context_unique unique (series_id, year),
  add constraint competition_seasons_identity_unique unique (id, series_id, year);

alter table public.competition_competitive_division_values
  add constraint competition_competitive_division_values_type_fkey
    foreign key (competitive_division_type_id, season_id)
    references public.competition_competitive_division_types(id, season_id)
    on delete restrict;

alter table public.competitions
  add constraint competitions_season_identity_fkey
    foreign key (season_id, series_id, year)
    references public.competition_seasons(id, series_id, year)
    on delete restrict,
  add constraint competitions_competitive_division_value_season_fkey
    foreign key (competitive_division_value_id, season_id)
    references public.competition_competitive_division_values(id, season_id)
    on delete restrict,
  add constraint competitions_dispute_unique
    unique nulls not distinct (
      season_id,
      category_id,
      gender_division,
      competitive_division_value_id
    );

alter table private.competition_season_id_aliases
  add constraint competition_season_id_aliases_season_fkey
    foreign key (season_id) references public.competition_seasons(id) on delete restrict;

alter table private.competition_division_type_id_aliases
  add constraint competition_division_type_id_aliases_type_fkey
    foreign key (competitive_division_type_id)
    references public.competition_competitive_division_types(id)
    on delete restrict;

alter table private.competition_division_value_id_aliases
  add constraint competition_division_value_id_aliases_value_fkey
    foreign key (competitive_division_value_id)
    references public.competition_competitive_division_values(id)
    on delete restrict;

create or replace function private.resolve_competition_season_id(p_season_id bigint)
returns bigint
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(
    (select season.id from public.competition_seasons season where season.id = p_season_id),
    (
      select alias.season_id
      from private.competition_season_id_aliases alias
      where alias.legacy_id = p_season_id
    )
  );
$$;

revoke all on function private.resolve_competition_season_id(bigint)
  from public, anon, authenticated;

create or replace function private.resolve_competitive_division_value_id(
  p_competitive_division_value_id bigint
)
returns bigint
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(
    (
      select division_value.id
      from public.competition_competitive_division_values division_value
      where division_value.id = p_competitive_division_value_id
    ),
    (
      select alias.competitive_division_value_id
      from private.competition_division_value_id_aliases alias
      where alias.legacy_id = p_competitive_division_value_id
    )
  );
$$;

revoke all on function private.resolve_competitive_division_value_id(bigint)
  from public, anon, authenticated;

create function public.admin_resolve_competition_season_id(p_season_id bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  resolved_id bigint;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  resolved_id := private.resolve_competition_season_id(p_season_id);
  if resolved_id is null then
    raise exception using errcode = 'BD404', message = 'BDB_COMPETITION_SEASON_NOT_FOUND';
  end if;

  return resolved_id;
end;
$$;

revoke all on function public.admin_resolve_competition_season_id(bigint)
  from public, anon, authenticated;
grant execute on function public.admin_resolve_competition_season_id(bigint)
  to authenticated;

create or replace function private.ensure_competition_season()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_season_id bigint;
  season_name text;
begin
  if new.season_id is not null then
    target_season_id := private.resolve_competition_season_id(new.season_id);
    if target_season_id is null then
      raise exception using
        errcode = 'BD501',
        message = 'BDB_COMPETITION_SEASON_CONTEXT_INVALID';
    end if;
    new.season_id := target_season_id;
    return new;
  end if;

  if new.gender_division is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(new.series_id::text || ':' || new.year::text, 417)
  );

  select series.name into season_name
  from public.competition_series series
  where series.id = new.series_id and series.is_active
  for share;

  if season_name is null then
    raise exception using
      errcode = 'BD404',
      message = 'BDB_COMPETITION_SERIES_NOT_FOUND';
  end if;

  insert into public.competition_seasons (
    series_id,
    year,
    name,
    suggested_starts_on,
    suggested_ends_on
  )
  values (
    new.series_id,
    new.year,
    season_name,
    new.starts_on,
    new.ends_on
  )
  on conflict (series_id, year) do nothing;

  select season.id into target_season_id
  from public.competition_seasons season
  where season.series_id = new.series_id
    and season.year = new.year;

  new.season_id := target_season_id;
  return new;
end;
$$;

revoke all on function private.ensure_competition_season()
  from public, anon, authenticated;

create or replace function public.admin_review_competition_gender(
  p_competition_id bigint,
  p_gender_division text
)
returns public.competitions
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row public.competitions;
  result public.competitions;
  target_profile_id bigint;
  conflict_constraint text;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if p_gender_division is null or p_gender_division not in ('male', 'female') then
    raise exception using errcode = 'BD501', message = 'BDB_GENDER_DIVISION_INVALID';
  end if;

  select competition.* into current_row
  from public.competitions competition
  where competition.id = p_competition_id
  for update;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_COMPETITION_NOT_FOUND';
  end if;

  if current_row.gender_division = p_gender_division
    and not current_row.gender_division_review_required
  then
    return current_row;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    current_row.series_id::text || ':' || current_row.category_id::text || ':' || p_gender_division,
    271
  ));

  select destination.id into target_profile_id
  from public.series_category_data_profiles destination
  join public.series_category_data_profiles source on source.id = current_row.data_profile_id
  where destination.series_id = current_row.series_id
    and destination.category_id = current_row.category_id
    and destination.gender_division = p_gender_division
    and destination.primary_source = source.primary_source
    and destination.status = 'active'
  for share of destination;
  if not found then
    raise exception using
      errcode = 'BD409',
      message = 'BDB_COMPETITION_PROFILE_MAPPING_NOT_FOUND';
  end if;

  begin
    update public.competitions
    set
      gender_division = p_gender_division,
      gender_division_review_required = false,
      data_profile_id = target_profile_id,
      data_profile_review_required = false,
      data_profile_validated_at = now(),
      data_profile_validated_by = auth.uid()
    where id = p_competition_id
    returning * into strict result;
  exception when unique_violation then
    get stacked diagnostics conflict_constraint = constraint_name;
    if conflict_constraint <> 'competitions_dispute_unique' then
      raise;
    end if;
    raise exception using
      errcode = 'BD506',
      message = 'BDB_COMPETITION_CONTEXT_ALREADY_EXISTS';
  end;

  insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
  values (
    'competition_gender_reviewed',
    'competition',
    result.id,
    jsonb_build_object(
      'previousGenderDivision', current_row.gender_division,
      'genderDivision', result.gender_division,
      'seasonId', result.season_id,
      'competitiveDivisionValueId', result.competitive_division_value_id,
      'previousDataProfileId', current_row.data_profile_id,
      'dataProfileId', result.data_profile_id
    )
  );

  return result;
end;
$$;

revoke all on function public.admin_review_competition_gender(bigint, text)
  from public, anon, authenticated;
grant execute on function public.admin_review_competition_gender(bigint, text)
  to authenticated;

create or replace function public.admin_create_competition_from_preset(
  p_request_id uuid,
  p_input jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
<<creation>>
declare
  existing private.competition_creation_requests;
  series_id bigint;
  category_id bigint;
  edition_year integer;
  edition_name text;
  gender text;
  source text;
  preset_key text;
  entry_count integer;
  starts_on date;
  ends_on date;
  expected_profile_id bigint;
  requested_season_id bigint;
  requested_competitive_division_value_id bigint;
  reason text;
  reviewed boolean;
  active_profile public.series_category_data_profiles;
  competition_id bigint;
  revision_id bigint;
  conflict_constraint text;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  if p_request_id is null
    or p_input is null
    or jsonb_typeof(p_input) <> 'object'
    or octet_length(p_input::text) > 5000
  then
    raise exception using errcode = 'BR009', message = 'BDB_EDITION_INPUT_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 310));
  select request.* into existing
  from private.competition_creation_requests request
  where request.request_id = p_request_id;
  if found then
    if existing.actor_id <> auth.uid() or existing.input is distinct from p_input then
      raise exception using errcode = 'BR010', message = 'BDB_IDEMPOTENCY_CONFLICT';
    end if;
    return existing.competition_id;
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_input) key
    where key not in (
      'seriesId', 'categoryId', 'year', 'name', 'gender', 'source', 'preset',
      'entryCount', 'startsOn', 'endsOn', 'expectedProfileId', 'reason', 'reviewed',
      'seasonId', 'competitiveDivisionValueId'
    )
  ) then
    raise exception using errcode = 'BR009', message = 'BDB_EDITION_INPUT_INVALID';
  end if;

  begin
    series_id := (p_input ->> 'seriesId')::bigint;
    category_id := (p_input ->> 'categoryId')::bigint;
    edition_year := (p_input ->> 'year')::integer;
    entry_count := (p_input ->> 'entryCount')::integer;
    expected_profile_id := (p_input ->> 'expectedProfileId')::bigint;
    requested_season_id := (p_input ->> 'seasonId')::bigint;
    requested_competitive_division_value_id :=
      (p_input ->> 'competitiveDivisionValueId')::bigint;

    if nullif(p_input ->> 'startsOn', '') is not null
      and (p_input ->> 'startsOn') !~ '^\d{4}-\d{2}-\d{2}$'
      or nullif(p_input ->> 'endsOn', '') is not null
      and (p_input ->> 'endsOn') !~ '^\d{4}-\d{2}-\d{2}$'
    then
      raise exception using errcode = 'BR009', message = 'BDB_EDITION_INPUT_INVALID';
    end if;

    starts_on := nullif(p_input ->> 'startsOn', '')::date;
    ends_on := nullif(p_input ->> 'endsOn', '')::date;
  exception
    when invalid_text_representation
      or numeric_value_out_of_range
      or datetime_field_overflow
      or invalid_datetime_format
    then
      raise exception using errcode = 'BR009', message = 'BDB_EDITION_INPUT_INVALID';
  end;

  edition_name := btrim(p_input ->> 'name');
  gender := p_input ->> 'gender';
  source := p_input ->> 'source';
  preset_key := p_input ->> 'preset';
  reason := nullif(btrim(p_input ->> 'reason'), '');
  reviewed := p_input -> 'reviewed' = 'true'::jsonb;

  if series_id is null
    or series_id <= 0
    or category_id is null
    or category_id <= 0
    or edition_year is null
    or edition_year < 1900
    or edition_year > extract(year from now() at time zone 'America/Sao_Paulo')::integer + 1
    or edition_name is null
    or char_length(edition_name) not between 2 and 160
    or gender is null
    or gender not in ('male', 'female')
    or source is null
    or source not in ('manual_scoresheet', 'fiba_boxscore')
    or (starts_on is not null and ends_on is not null and starts_on > ends_on)
    or (reason is not null and char_length(reason) not between 10 and 500)
    or (requested_season_id is not null and requested_season_id <= 0)
    or (
      requested_competitive_division_value_id is not null
      and requested_competitive_division_value_id <= 0
    )
    or (
      requested_competitive_division_value_id is not null
      and requested_season_id is null
    )
  then
    raise exception using errcode = 'BR009', message = 'BDB_EDITION_INPUT_INVALID';
  end if;

  if requested_season_id is not null then
    requested_season_id := private.resolve_competition_season_id(requested_season_id);
    if requested_season_id is null then
      raise exception using
        errcode = 'BD501',
        message = 'BDB_COMPETITION_SEASON_CONTEXT_INVALID';
    end if;
  end if;

  if requested_competitive_division_value_id is not null then
    requested_competitive_division_value_id :=
      private.resolve_competitive_division_value_id(requested_competitive_division_value_id);
    if requested_competitive_division_value_id is null then
      raise exception using
        errcode = 'BD501',
        message = 'BDB_COMPETITION_DIVISION_CONTEXT_INVALID';
    end if;
  end if;

  perform private.compile_competition_preset_v1(preset_key, entry_count);
  perform pg_advisory_xact_lock(hashtextextended(edition_year::text, 311));
  if not exists(select 1 from public.competitions where year = edition_year)
    and reviewed is distinct from true
  then
    raise exception using errcode = 'BR011', message = 'BDB_FIRST_YEAR_REVIEW_REQUIRED';
  end if;

  perform 1
  from public.competition_series series
  where series.id = series_id and series.is_active
  for share;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_DATA_PROFILE_CONTEXT_NOT_FOUND';
  end if;

  perform 1
  from public.categories category
  where category.id = category_id and category.is_active
  for share;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_DATA_PROFILE_CONTEXT_NOT_FOUND';
  end if;

  if requested_season_id is not null then
    perform 1
    from public.competition_seasons season
    where season.id = requested_season_id
      and season.series_id = creation.series_id
      and season.year = edition_year
    for share;
    if not found then
      raise exception using
        errcode = 'BD501',
        message = 'BDB_COMPETITION_SEASON_CONTEXT_INVALID';
    end if;
  end if;

  if requested_competitive_division_value_id is not null then
    perform 1
    from public.competition_competitive_division_values division_value
    where division_value.id = requested_competitive_division_value_id
      and division_value.season_id = requested_season_id
    for share;
    if not found then
      raise exception using
        errcode = 'BD501',
        message = 'BDB_COMPETITION_DIVISION_CONTEXT_INVALID';
    end if;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(series_id::text || ':' || category_id::text || ':' || gender, 271)
  );

  select profile.* into active_profile
  from public.series_category_data_profiles profile
  where profile.series_id = creation.series_id
    and profile.category_id = creation.category_id
    and profile.gender_division = gender
    and profile.status = 'active';

  if active_profile.id is distinct from expected_profile_id then
    raise exception using errcode = 'BR012', message = 'BDB_PROFILE_CHANGED_RELOAD';
  end if;

  if active_profile.id is null or active_profile.primary_source <> source then
    if active_profile.id is not null
      and (reviewed is distinct from true or reason is null)
    then
      raise exception using errcode = 'BR013', message = 'BDB_SOURCE_REVIEW_REQUIRED';
    end if;

    select * into active_profile
    from public.admin_create_series_category_data_profile(
      series_id,
      category_id,
      gender,
      source,
      reason
    );

    select * into active_profile
    from public.admin_activate_series_category_data_profile(active_profile.id);
  end if;

  begin
    insert into public.competitions (
      series_id,
      category_id,
      year,
      display_name,
      status,
      starts_on,
      ends_on,
      gender_division,
      gender_division_review_required,
      data_profile_id,
      data_profile_review_required,
      data_profile_validated_at,
      data_profile_validated_by,
      season_id,
      competitive_division_value_id
    )
    values (
      series_id,
      category_id,
      edition_year,
      edition_name,
      'draft',
      starts_on,
      ends_on,
      gender,
      false,
      active_profile.id,
      false,
      now(),
      auth.uid(),
      requested_season_id,
      requested_competitive_division_value_id
    )
    returning id into competition_id;
  exception when unique_violation then
    get stacked diagnostics conflict_constraint = constraint_name;
    if conflict_constraint <> 'competitions_dispute_unique' then
      raise;
    end if;
    raise exception using errcode = 'BD506', message = 'BDB_COMPETITION_CONTEXT_CONFLICT';
  end;

  revision_id := private.materialize_competition_preset(
    competition_id,
    preset_key,
    entry_count
  );

  insert into private.competition_creation_requests (
    request_id,
    actor_id,
    input,
    competition_id
  )
  values (p_request_id, auth.uid(), p_input, competition_id);

  insert into public.admin_mutation_audit (action, entity_type, entity_id, metadata)
  values (
    'competition_created_from_preset',
    'competition',
    competition_id,
    jsonb_build_object(
      'ruleset_revision_id', revision_id,
      'preset', preset_key,
      'version', 1,
      'entry_count', entry_count,
      'seasonId', requested_season_id,
      'competitiveDivisionValueId', requested_competitive_division_value_id
    )
  );

  return competition_id;
end;
$$;

revoke all on function public.admin_create_competition_from_preset(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_create_competition_from_preset(uuid, jsonb)
  to authenticated;

create or replace function public.admin_create_competition_season(
  p_request_id uuid,
  p_series_id bigint,
  p_year integer,
  p_gender_division text,
  p_name text,
  p_description text,
  p_suggested_starts_on date,
  p_suggested_ends_on date
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_name text := btrim(coalesce(p_name, ''));
  clean_description text := nullif(btrim(coalesce(p_description, '')), '');
  normalized_input jsonb;
  previous private.competition_dimension_requests;
  created_season_id bigint;
  conflict_constraint text;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  if p_request_id is null
    or p_series_id is null
    or p_year is null
    or p_year not between 1900 and extract(year from current_date)::integer + 1
    or p_gender_division is null
    or p_gender_division not in ('male', 'female')
    or char_length(clean_name) not between 2 and 160
    or (clean_description is not null and char_length(clean_description) > 2000)
    or (
      p_suggested_starts_on is not null
      and p_suggested_ends_on is not null
      and p_suggested_starts_on > p_suggested_ends_on
    )
  then
    raise exception using
      errcode = 'BD501',
      message = 'BDB_COMPETITION_SEASON_INPUT_INVALID';
  end if;

  normalized_input := jsonb_build_object(
    'seriesId', p_series_id,
    'year', p_year,
    'genderDivision', p_gender_division,
    'name', clean_name,
    'description', clean_description,
    'suggestedStartsOn', p_suggested_starts_on,
    'suggestedEndsOn', p_suggested_ends_on
  );

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 418));
  select request.* into previous
  from private.competition_dimension_requests request
  where request.request_id = p_request_id;

  if found then
    if previous.actor_id <> auth.uid()
      or previous.operation <> 'create_season'
      or previous.input is distinct from normalized_input
    then
      raise exception using errcode = 'BD409', message = 'BDB_IDEMPOTENCY_CONFLICT';
    end if;
    return previous.result_id;
  end if;

  perform 1
  from public.competition_series series
  where series.id = p_series_id and series.is_active
  for share;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_COMPETITION_SERIES_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_series_id::text || ':' || p_year::text, 417)
  );

  begin
    insert into public.competition_seasons (
      series_id,
      year,
      name,
      description,
      suggested_starts_on,
      suggested_ends_on
    )
    values (
      p_series_id,
      p_year,
      clean_name,
      clean_description,
      p_suggested_starts_on,
      p_suggested_ends_on
    )
    returning id into created_season_id;
  exception when unique_violation then
    get stacked diagnostics conflict_constraint = constraint_name;
    if conflict_constraint <> 'competition_seasons_context_unique' then
      raise;
    end if;
    raise exception using errcode = 'BD506', message = 'BDB_COMPETITION_SEASON_CONFLICT';
  end;

  insert into private.competition_season_id_aliases (legacy_id, season_id)
  values (created_season_id, created_season_id);

  insert into private.competition_dimension_requests (
    request_id,
    actor_id,
    operation,
    input,
    result_id
  )
  values (
    p_request_id,
    auth.uid(),
    'create_season',
    normalized_input,
    created_season_id
  );

  insert into public.admin_mutation_audit (action, entity_type, entity_id, metadata)
  values (
    'competition_season_created',
    'competition_season',
    created_season_id,
    jsonb_build_object(
      'seriesId', p_series_id,
      'year', p_year,
      'legacyRequestedGenderDivision', p_gender_division
    )
  );

  return created_season_id;
end;
$$;

revoke all on function public.admin_create_competition_season(
  uuid, bigint, integer, text, text, text, date, date
) from public, anon, authenticated;
grant execute on function public.admin_create_competition_season(
  uuid, bigint, integer, text, text, text, date, date
) to authenticated;

create or replace function public.admin_update_competition_season(
  p_season_id bigint,
  p_expected_revision integer,
  p_name text,
  p_description text,
  p_suggested_starts_on date,
  p_suggested_ends_on date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_name text := btrim(coalesce(p_name, ''));
  clean_description text := nullif(btrim(coalesce(p_description, '')), '');
  target public.competition_seasons;
  target_season_id bigint;
  next_revision integer;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  if p_season_id is null
    or p_expected_revision is null
    or char_length(clean_name) not between 2 and 160
    or (clean_description is not null and char_length(clean_description) > 2000)
    or (
      p_suggested_starts_on is not null
      and p_suggested_ends_on is not null
      and p_suggested_starts_on > p_suggested_ends_on
    )
  then
    raise exception using
      errcode = 'BD501',
      message = 'BDB_COMPETITION_SEASON_INPUT_INVALID';
  end if;

  target_season_id := private.resolve_competition_season_id(p_season_id);
  if target_season_id is null then
    raise exception using errcode = 'BD404', message = 'BDB_COMPETITION_SEASON_NOT_FOUND';
  end if;

  select season.* into target
  from public.competition_seasons season
  where season.id = target_season_id
  for update;

  if target.revision <> p_expected_revision then
    raise exception using errcode = 'BD409', message = 'BDB_COMPETITION_SEASON_STALE';
  end if;

  update public.competition_seasons season
  set
    name = clean_name,
    description = clean_description,
    suggested_starts_on = p_suggested_starts_on,
    suggested_ends_on = p_suggested_ends_on,
    revision = season.revision + 1
  where season.id = target_season_id
  returning revision into next_revision;

  insert into public.admin_mutation_audit (action, entity_type, entity_id, metadata)
  values (
    'competition_season_updated',
    'competition_season',
    target_season_id,
    jsonb_build_object(
      'requestedSeasonId', p_season_id,
      'fromRevision', p_expected_revision,
      'toRevision', next_revision
    )
  );

  return next_revision;
end;
$$;

revoke all on function public.admin_update_competition_season(
  bigint, integer, text, text, date, date
) from public, anon, authenticated;
grant execute on function public.admin_update_competition_season(
  bigint, integer, text, text, date, date
) to authenticated;

create or replace function public.admin_add_competitive_division_value(
  p_request_id uuid,
  p_season_id bigint,
  p_type_name text,
  p_type_slug text,
  p_value_name text,
  p_value_slug text,
  p_sort_order integer
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_type_name text := btrim(coalesce(p_type_name, ''));
  clean_type_slug text := btrim(coalesce(p_type_slug, ''));
  clean_value_name text := btrim(coalesce(p_value_name, ''));
  clean_value_slug text := btrim(coalesce(p_value_slug, ''));
  normalized_input jsonb;
  previous private.competition_dimension_requests;
  division_type public.competition_competitive_division_types;
  resolved_season_id bigint;
  created_value_id bigint;
  existing_value_name text;
  existing_sort_order integer;
  conflict_constraint text;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  if p_request_id is null
    or p_season_id is null
    or char_length(clean_type_name) not between 2 and 80
    or clean_type_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or char_length(clean_value_name) not between 1 and 80
    or clean_value_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or p_sort_order is null
    or p_sort_order not between 1 and 999
  then
    raise exception using errcode = 'BD501', message = 'BDB_COMPETITION_DIVISION_INPUT_INVALID';
  end if;

  normalized_input := jsonb_build_object(
    'seasonId', p_season_id,
    'typeName', clean_type_name,
    'typeSlug', clean_type_slug,
    'valueName', clean_value_name,
    'valueSlug', clean_value_slug,
    'sortOrder', p_sort_order
  );

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 419));
  select request.* into previous
  from private.competition_dimension_requests request
  where request.request_id = p_request_id;

  if found then
    if previous.actor_id <> auth.uid()
      or previous.operation <> 'create_division_value'
      or previous.input is distinct from normalized_input
    then
      raise exception using errcode = 'BD409', message = 'BDB_IDEMPOTENCY_CONFLICT';
    end if;
    return previous.result_id;
  end if;

  resolved_season_id := private.resolve_competition_season_id(p_season_id);
  if resolved_season_id is null then
    raise exception using errcode = 'BD404', message = 'BDB_COMPETITION_SEASON_NOT_FOUND';
  end if;

  perform 1
  from public.competition_seasons season
  where season.id = resolved_season_id
  for update;

  perform pg_advisory_xact_lock(hashtextextended(resolved_season_id::text, 420));
  select division.* into division_type
  from public.competition_competitive_division_types division
  where division.season_id = resolved_season_id
  for update;

  if not found then
    insert into public.competition_competitive_division_types (season_id, name, slug)
    values (resolved_season_id, clean_type_name, clean_type_slug)
    returning * into division_type;

    insert into private.competition_division_type_id_aliases (
      legacy_id,
      competitive_division_type_id
    )
    values (division_type.id, division_type.id);
  elsif division_type.name <> clean_type_name or division_type.slug <> clean_type_slug then
    raise exception using
      errcode = 'BD409',
      message = 'BDB_COMPETITION_DIVISION_TYPE_CONFLICT';
  end if;

  select existing.id, existing.name, existing.sort_order
  into created_value_id, existing_value_name, existing_sort_order
  from public.competition_competitive_division_values existing
  where existing.competitive_division_type_id = division_type.id
    and existing.season_id = resolved_season_id
    and existing.slug = clean_value_slug;

  if found then
    if existing_value_name is distinct from clean_value_name
      or existing_sort_order is distinct from p_sort_order
    then
      raise exception using
        errcode = 'BD506',
        message = 'BDB_COMPETITION_DIVISION_VALUE_CONFLICT';
    end if;

    insert into private.competition_dimension_requests (
      request_id,
      actor_id,
      operation,
      input,
      result_id
    )
    values (
      p_request_id,
      auth.uid(),
      'create_division_value',
      normalized_input,
      created_value_id
    );

    return created_value_id;
  end if;

  begin
    insert into public.competition_competitive_division_values (
      competitive_division_type_id,
      season_id,
      name,
      slug,
      sort_order
    )
    values (
      division_type.id,
      resolved_season_id,
      clean_value_name,
      clean_value_slug,
      p_sort_order
    )
    returning id into created_value_id;
  exception when unique_violation then
    get stacked diagnostics conflict_constraint = constraint_name;
    if conflict_constraint not in (
      'competition_competitive_division_values_slug_unique',
      'competition_competitive_division_values_order_unique'
    ) then
      raise;
    end if;
    raise exception using
      errcode = 'BD506',
      message = 'BDB_COMPETITION_DIVISION_VALUE_CONFLICT';
  end;

  insert into private.competition_division_value_id_aliases (
    legacy_id,
    competitive_division_value_id
  )
  values (created_value_id, created_value_id);

  insert into private.competition_dimension_requests (
    request_id,
    actor_id,
    operation,
    input,
    result_id
  )
  values (
    p_request_id,
    auth.uid(),
    'create_division_value',
    normalized_input,
    created_value_id
  );

  insert into public.admin_mutation_audit (action, entity_type, entity_id, metadata)
  values (
    'competition_competitive_division_value_created',
    'competition_competitive_division_value',
    created_value_id,
    jsonb_build_object(
      'seasonId', resolved_season_id,
      'requestedSeasonId', p_season_id,
      'divisionTypeId', division_type.id,
      'sortOrder', p_sort_order
    )
  );

  return created_value_id;
end;
$$;

revoke all on function public.admin_add_competitive_division_value(
  uuid, bigint, text, text, text, text, integer
) from public, anon, authenticated;
grant execute on function public.admin_add_competitive_division_value(
  uuid, bigint, text, text, text, text, integer
) to authenticated;

create or replace function public.admin_assign_competition_competitive_division(
  p_competition_id bigint,
  p_expected_competitive_division_value_id bigint,
  p_competitive_division_value_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.competitions;
  expected_value_id bigint;
  requested_value_id bigint;
  conflict_constraint text;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  select competition.* into target
  from public.competitions competition
  where competition.id = p_competition_id
  for update;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_COMPETITION_NOT_FOUND';
  end if;

  if target.status <> 'draft' or target.current_publication_id is not null then
    raise exception using errcode = 'BD409', message = 'BDB_COMPETITION_DIMENSIONS_LOCKED';
  end if;

  expected_value_id := case
    when p_expected_competitive_division_value_id is null then null
    else private.resolve_competitive_division_value_id(
      p_expected_competitive_division_value_id
    )
  end;
  requested_value_id := case
    when p_competitive_division_value_id is null then null
    else private.resolve_competitive_division_value_id(p_competitive_division_value_id)
  end;

  if p_competitive_division_value_id is not null and requested_value_id is null then
    raise exception using
      errcode = 'BD501',
      message = 'BDB_COMPETITION_DIVISION_CONTEXT_INVALID';
  end if;

  if requested_value_id is not null and not exists (
    select 1
    from public.competition_competitive_division_values division_value
    where division_value.id = requested_value_id
      and division_value.season_id = target.season_id
  ) then
    raise exception using
      errcode = 'BD501',
      message = 'BDB_COMPETITION_DIVISION_CONTEXT_INVALID';
  end if;

  if target.competitive_division_value_id is not distinct from requested_value_id then
    return target.id;
  end if;

  if target.competitive_division_value_id is distinct from expected_value_id then
    raise exception using errcode = 'BD409', message = 'BDB_COMPETITION_DIVISION_STALE';
  end if;

  begin
    update public.competitions competition
    set competitive_division_value_id = requested_value_id
    where competition.id = target.id;
  exception when unique_violation then
    get stacked diagnostics conflict_constraint = constraint_name;
    if conflict_constraint <> 'competitions_dispute_unique' then
      raise;
    end if;
    raise exception using errcode = 'BD506', message = 'BDB_COMPETITION_DISPUTE_CONFLICT';
  end;

  insert into public.admin_mutation_audit (action, entity_type, entity_id, metadata)
  values (
    'competition_competitive_division_assigned',
    'competition',
    target.id,
    jsonb_build_object(
      'previousCompetitiveDivisionValueId', target.competitive_division_value_id,
      'competitiveDivisionValueId', requested_value_id
    )
  );

  return target.id;
end;
$$;

revoke all on function public.admin_assign_competition_competitive_division(bigint, bigint, bigint)
  from public, anon, authenticated;
grant execute on function public.admin_assign_competition_competitive_division(bigint, bigint, bigint)
  to authenticated;

create or replace function private.create_edition_workflow(
  p_request_id uuid,
  p_input jsonb,
  p_add boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
<<workflow>>
declare
  prior private.edition_creation_requests;
  championship public.competition_series;
  season public.competition_seasons;
  category public.categories;
  division_type public.competition_competitive_division_types;
  division public.competition_competitive_division_values;
  series_id bigint;
  season_id bigint;
  division_id bigint;
  expected_profile_id bigint;
  kind text;
  age integer;
  edition_year integer;
  gender text;
  division_mode text;
  championship_name text;
  type_name text;
  value_name text;
  canonical_slug text;
  display_name text;
  competition_id bigint;
  starts_on date;
  ends_on date;
  conflict_constraint text;
  operation text := case when p_add then 'add' else 'create' end;
  created_championship boolean := false;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode='BD401', message='BDB_ADMIN_AAL2_REQUIRED';
  end if;

  if p_request_id is null
    or p_input is null
    or jsonb_typeof(p_input) <> 'object'
    or p_input -> 'reviewed' is distinct from 'true'::jsonb
    or exists(
      select 1
      from jsonb_object_keys(p_input) key
      where key not in (
        'seriesId','championshipName','seasonId','categoryKind','categoryAge','year','gender',
        'description','startsOn','endsOn','divisionMode','divisionValueId','divisionTypeName',
        'divisionValueName','source','preset','entryCount','expectedProfileId','reason','reviewed'
      )
    )
  then
    raise exception using
      errcode='BD501',
      message='BDB_EDITION_WORKFLOW_INPUT_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 431));
  select * into prior
  from private.edition_creation_requests request
  where request.request_id = p_request_id;
  if found then
    if prior.actor_id <> auth.uid()
      or prior.operation <> operation
      or prior.input is distinct from p_input
    then
      raise exception using errcode='BD409', message='BDB_IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object(
      'seasonId', prior.season_id,
      'competitionId', prior.competition_id
    );
  end if;

  begin
    foreach canonical_slug in array array[
      'championshipName','categoryKind','gender','description','startsOn','endsOn',
      'divisionMode','divisionTypeName','divisionValueName','source','preset','reason'
    ] loop
      if p_input ->> canonical_slug is not null
        and jsonb_typeof(p_input -> canonical_slug) <> 'string'
      then
        raise invalid_text_representation;
      end if;
    end loop;

    foreach canonical_slug in array array[
      'seriesId','seasonId','categoryAge','year','entryCount','divisionValueId','expectedProfileId'
    ] loop
      if p_input ->> canonical_slug is not null
        and (
          jsonb_typeof(p_input -> canonical_slug) <> 'number'
          or p_input ->> canonical_slug !~ '^[0-9]{1,9}$'
        )
      then
        raise invalid_text_representation;
      end if;
    end loop;

    series_id := (p_input ->> 'seriesId')::bigint;
    season_id := (p_input ->> 'seasonId')::bigint;
    age := (p_input ->> 'categoryAge')::integer;
    edition_year := (p_input ->> 'year')::integer;
    division_id := (p_input ->> 'divisionValueId')::bigint;
    expected_profile_id := (p_input ->> 'expectedProfileId')::bigint;
    starts_on := (p_input ->> 'startsOn')::date;
    ends_on := (p_input ->> 'endsOn')::date;

    if (
      starts_on is not null
      and to_char(starts_on, 'YYYY-MM-DD') <> p_input ->> 'startsOn'
    ) or (
      ends_on is not null
      and to_char(ends_on, 'YYYY-MM-DD') <> p_input ->> 'endsOn'
    ) then
      raise invalid_datetime_format;
    end if;
  exception
    when invalid_text_representation
      or numeric_value_out_of_range
      or datetime_field_overflow
      or invalid_datetime_format
    then
      raise exception using
        errcode='BD501',
        message='BDB_EDITION_WORKFLOW_INPUT_INVALID';
  end;

  kind := p_input ->> 'categoryKind';
  gender := p_input ->> 'gender';
  division_mode := p_input ->> 'divisionMode';
  championship_name := btrim(coalesce(p_input ->> 'championshipName', ''));
  type_name := btrim(coalesce(p_input ->> 'divisionTypeName', ''));
  value_name := btrim(coalesce(p_input ->> 'divisionValueName', ''));

  if kind is null
    or kind not in ('adult','base','master')
    or (kind='adult' and age is not null)
    or (kind='base' and (age is null or age not between 12 and 23))
    or (kind='master' and (age is null or age not between 30 and 85 or age % 5 <> 0))
    or edition_year is null
    or edition_year not between 1900 and extract(year from current_date)::integer + 1
    or gender is null
    or gender not in ('male','female')
    or (starts_on is not null and ends_on is not null and starts_on > ends_on)
    or division_mode is null
    or division_mode not in ('none','existing','new')
    or (division_mode='existing' and (division_id is null or division_id <= 0))
    or (division_mode <> 'existing' and division_id is not null)
    or (
      division_mode='new'
      and (
        char_length(type_name) not between 2 and 80
        or char_length(value_name) not between 1 and 80
      )
    )
    or (division_mode <> 'new' and (type_name <> '' or value_name <> ''))
    or (
      p_add
      and (
        season_id is null
        or season_id <= 0
        or series_id is not null
        or championship_name <> ''
      )
    )
    or (
      not p_add
      and (
        season_id is not null
        or division_mode='existing'
        or (
          series_id is null
          and char_length(championship_name) not between 2 and 120
        )
        or (
          series_id is not null
          and (series_id <= 0 or championship_name <> '')
        )
      )
    )
    or char_length(coalesce(p_input ->> 'description', '')) > 2000
    or (expected_profile_id is not null and expected_profile_id <= 0)
  then
    raise exception using
      errcode='BD501',
      message='BDB_EDITION_WORKFLOW_INPUT_INVALID';
  end if;

  if p_add then
    season_id := private.resolve_competition_season_id(season_id);
    if season_id is null then
      raise exception using errcode='BD404', message='BDB_COMPETITION_SEASON_NOT_FOUND';
    end if;

    select * into season
    from public.competition_seasons target
    where target.id = season_id;
    if not found then
      raise exception using errcode='BD404', message='BDB_COMPETITION_SEASON_NOT_FOUND';
    end if;

    if season.year <> edition_year
      or season.description is distinct from nullif(btrim(coalesce(p_input ->> 'description', '')), '')
    then
      raise exception using errcode='BD409', message='BDB_EDITION_CONTEXT_STALE';
    end if;

    series_id := season.series_id;
  elsif series_id is null then
    canonical_slug := private.slugify_team_name(championship_name);
    if canonical_slug = '' then
      raise exception using errcode='BD501', message='BDB_CHAMPIONSHIP_NAME_INVALID';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(canonical_slug, 432));
    begin
      insert into public.competition_series(name, slug)
      values(championship_name, canonical_slug)
      returning * into championship;
    exception when unique_violation then
      get stacked diagnostics conflict_constraint = constraint_name;
      if conflict_constraint <> 'competition_series_slug_key' then
        raise;
      end if;
      raise exception using errcode='BD506', message='BDB_CHAMPIONSHIP_ALREADY_EXISTS';
    end;
    series_id := championship.id;
    created_championship := true;
  end if;

  select * into championship
  from public.competition_series target
  where target.id = series_id and target.is_active
  for share;
  if not found then
    raise exception using errcode='BD404', message='BDB_COMPETITION_SERIES_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(kind || ':' || coalesce(age::text, ''), 433)
  );
  select * into category
  from public.categories target
  where target.age_kind = kind
    and target.age_value is not distinct from age;
  if not found then
    canonical_slug := case kind
      when 'adult' then 'adulto'
      when 'base' then 'sub-' || age
      else 'master-' || age
    end;
    if exists(select 1 from public.categories target where target.slug = canonical_slug) then
      raise exception using errcode='BD409', message='BDB_CATEGORY_LEGACY_CONFLICT';
    end if;
    insert into public.categories(name, slug, age_kind, age_value)
    values('Canonical', canonical_slug, kind, age)
    returning * into category;
  elsif not category.is_active then
    raise exception using errcode='BD404', message='BDB_DATA_PROFILE_CONTEXT_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(edition_year::text, 311));
  perform pg_advisory_xact_lock(hashtextextended(
    series_id::text || ':' || category.id::text || ':' || gender,
    271
  ));
  perform pg_advisory_xact_lock(hashtextextended(
    series_id::text || ':' || edition_year::text,
    417
  ));

  if not p_add then
    season_id := public.admin_create_competition_season(
      gen_random_uuid(),
      series_id,
      edition_year,
      gender,
      championship.name,
      nullif(btrim(coalesce(p_input ->> 'description', '')), ''),
      starts_on,
      ends_on
    );
  end if;

  select * into season
  from public.competition_seasons target
  where target.id = season_id
  for update;
  if season.series_id <> series_id
    or season.year <> edition_year
    or season.description is distinct from nullif(btrim(coalesce(p_input ->> 'description', '')), '')
  then
    raise exception using errcode='BD409', message='BDB_EDITION_CONTEXT_STALE';
  end if;

  if division_mode='existing' then
    division_id := private.resolve_competitive_division_value_id(division_id);
    select * into division
    from public.competition_competitive_division_values target
    where target.id = division_id and target.season_id = workflow.season_id;
    if not found then
      raise exception using
        errcode='BD501',
        message='BDB_COMPETITION_DIVISION_CONTEXT_INVALID';
    end if;
    select * into division_type
    from public.competition_competitive_division_types target
    where target.id = division.competitive_division_type_id;
  elsif division_mode='new' then
    division_id := public.admin_add_competitive_division_value(
      gen_random_uuid(),
      season_id,
      type_name,
      private.slugify_team_name(type_name),
      value_name,
      private.slugify_team_name(value_name),
      (
        select coalesce(max(target.sort_order), 0) + 1
        from public.competition_competitive_division_values target
        where target.season_id = workflow.season_id
      )
    );
    select * into division
    from public.competition_competitive_division_values target
    where target.id = division_id;
    select * into division_type
    from public.competition_competitive_division_types target
    where target.id = division.competitive_division_type_id;
  end if;

  if exists(
    select 1
    from public.competitions target
    where target.season_id = workflow.season_id
      and target.category_id = category.id
      and target.gender_division = gender
      and target.competitive_division_value_id is not distinct from division_id
  ) then
    raise exception using
      errcode='BD506',
      message='BDB_COMPETITION_CONTEXT_ALREADY_EXISTS';
  end if;

  display_name := season.name
    || case when kind='adult' then '' else ' - ' || category.name end;
  if division_id is not null then
    display_name := display_name
      || case when kind='adult' then ' - ' else ' · ' end
      || division_type.name
      || ' '
      || division.name;
  end if;

  competition_id := public.admin_create_competition_from_preset(
    gen_random_uuid(),
    jsonb_build_object(
      'seriesId', series_id,
      'categoryId', category.id,
      'year', edition_year,
      'name', display_name,
      'gender', gender,
      'source', p_input ->> 'source',
      'preset', p_input ->> 'preset',
      'entryCount', p_input -> 'entryCount',
      'startsOn', starts_on,
      'endsOn', ends_on,
      'expectedProfileId', expected_profile_id,
      'reason', p_input ->> 'reason',
      'reviewed', true,
      'seasonId', season_id,
      'competitiveDivisionValueId', division_id
    )
  );

  insert into private.edition_creation_requests (
    request_id,
    actor_id,
    operation,
    input,
    season_id,
    competition_id
  )
  values (
    p_request_id,
    auth.uid(),
    operation,
    p_input,
    season_id,
    competition_id
  );

  insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
  values (
    'edition_workflow_created',
    'competition_season',
    season_id,
    jsonb_build_object(
      'operation', operation,
      'competitionId', competition_id,
      'seriesId', series_id,
      'createdChampionship', created_championship,
      'categoryId', category.id,
      'categoryKind', kind,
      'categoryAge', age,
      'genderDivision', gender,
      'competitiveDivisionValueId', division_id
    )
  );

  return jsonb_build_object(
    'seasonId', season_id,
    'competitionId', competition_id
  );
end;
$$;

revoke all on function private.create_edition_workflow(uuid, jsonb, boolean)
  from public, anon, authenticated;

create view public.competition_dispute_contexts
with (security_invoker = true)
as
select
  competition.id as competition_id,
  competition.season_id,
  season.series_id,
  series.name as series_name,
  series.slug as series_slug,
  season.year,
  competition.gender_division,
  season.name as season_name,
  season.description as season_description,
  season.suggested_starts_on,
  season.suggested_ends_on,
  competition.category_id,
  category.name as category_name,
  category.slug as category_slug,
  division_type.id as competitive_division_type_id,
  division_type.name as competitive_division_type_name,
  division_type.slug as competitive_division_type_slug,
  division_value.id as competitive_division_value_id,
  division_value.name as competitive_division_value_name,
  division_value.slug as competitive_division_value_slug,
  division_value.sort_order as competitive_division_sort_order,
  competition.display_name as competition_display_name,
  competition.status,
  competition.starts_on,
  competition.ends_on
from public.competitions competition
join public.competition_seasons season on season.id = competition.season_id
join public.competition_series series on series.id = season.series_id
join public.categories category on category.id = competition.category_id
left join public.competition_competitive_division_values division_value
  on division_value.id = competition.competitive_division_value_id
left join public.competition_competitive_division_types division_type
  on division_type.id = division_value.competitive_division_type_id;

revoke all on public.competition_dispute_contexts from public, anon, authenticated;
grant select on public.competition_dispute_contexts to authenticated;

comment on table public.competition_seasons is
  'Shared championship edition identified by championship and year; gender belongs to each dispute.';
comment on table public.competitions is
  'Administrable sporting dispute identified by edition, age category, gender and optional division value.';
comment on view public.competition_dispute_contexts is
  'Admin-only security-invoker context joining edition, dispute gender, age category and optional division.';
