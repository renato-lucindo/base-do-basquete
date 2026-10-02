-- COMPETITIONS-MULTIDIMENSIONAL / PR 1
-- Seasons group championship + year + gender division. A competition remains
-- the administrable sporting dispute, distinguished by age category and an
-- optional competitive division value.

insert into public.categories (name, slug, has_advanced_stats, is_active)
values ('Adulto', 'adulto', true, true)
on conflict (slug) do nothing;

do $$
begin
  if not exists (
    select 1
    from public.categories
    where slug = 'adulto' and name = 'Adulto' and is_active
  ) then
    raise exception using
      errcode = 'BD500',
      message = 'BDB_ADULT_CATEGORY_CONFLICT';
  end if;
end;
$$;

create table public.competition_seasons (
  id bigint generated always as identity primary key,
  series_id bigint not null references public.competition_series(id) on delete restrict,
  year smallint not null check (year between 1900 and 2200),
  gender_division text not null check (gender_division in ('male', 'female')),
  name text not null check (
    name = btrim(name) and char_length(name) between 2 and 160
  ),
  description text check (
    description is null or (
      description = btrim(description) and char_length(description) between 1 and 2000
    )
  ),
  suggested_starts_on date,
  suggested_ends_on date,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint competition_seasons_context_unique
    unique (series_id, year, gender_division),
  constraint competition_seasons_identity_unique
    unique (id, series_id, year, gender_division),
  constraint competition_seasons_dates_ordered check (
    suggested_starts_on is null
    or suggested_ends_on is null
    or suggested_starts_on <= suggested_ends_on
  )
);

create index competition_seasons_series_id_idx
  on public.competition_seasons (series_id);

create table public.competition_competitive_division_types (
  id bigint generated always as identity primary key,
  season_id bigint not null unique
    references public.competition_seasons(id) on delete restrict,
  name text not null check (
    name = btrim(name) and char_length(name) between 2 and 80
  ),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint competition_competitive_division_types_identity_unique unique (id, season_id),
  constraint competition_competitive_division_types_slug_unique unique (season_id, slug)
);

create table public.competition_competitive_division_values (
  id bigint generated always as identity primary key,
  competitive_division_type_id bigint not null,
  season_id bigint not null,
  name text not null check (
    name = btrim(name) and char_length(name) between 1 and 80
  ),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  sort_order integer not null check (sort_order between 1 and 999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint competition_competitive_division_values_type_fkey
    foreign key (competitive_division_type_id, season_id)
    references public.competition_competitive_division_types(id, season_id)
    on delete restrict,
  constraint competition_competitive_division_values_identity_unique unique (id, season_id),
  constraint competition_competitive_division_values_slug_unique unique (competitive_division_type_id, slug),
  constraint competition_competitive_division_values_order_unique unique (competitive_division_type_id, sort_order)
);

create index competition_competitive_division_values_season_id_idx
  on public.competition_competitive_division_values (season_id);

alter table public.competitions
  add column season_id bigint,
  add column competitive_division_value_id bigint;

-- Historical disputes are grouped without changing their IDs or any child FK.
-- The championship name is the only existing value shared by every category in
-- the same year/gender context; per-dispute display names remain untouched.
insert into public.competition_seasons (
  series_id,
  year,
  gender_division,
  name,
  description,
  suggested_starts_on,
  suggested_ends_on
)
select
  competition.series_id,
  competition.year,
  competition.gender_division,
  series.name,
  null,
  min(competition.starts_on),
  max(competition.ends_on)
from public.competitions competition
join public.competition_series series on series.id = competition.series_id
group by
  competition.series_id,
  competition.year,
  competition.gender_division,
  series.name;

update public.competitions competition
set season_id = season.id
from public.competition_seasons season
where season.series_id = competition.series_id
  and season.year = competition.year
  and season.gender_division = competition.gender_division;

do $$
begin
  if exists (select 1 from public.competitions where season_id is null) then
    raise exception using
      errcode = 'BD500',
      message = 'BDB_COMPETITION_SEASON_BACKFILL_INCOMPLETE';
  end if;
end;
$$;

alter table public.competitions
  alter column season_id set not null,
  drop constraint competitions_context_unique,
  add constraint competitions_season_identity_fkey
    foreign key (season_id, series_id, year, gender_division)
    references public.competition_seasons(id, series_id, year, gender_division)
    on delete restrict,
  add constraint competitions_competitive_division_value_season_fkey
    foreign key (competitive_division_value_id, season_id)
    references public.competition_competitive_division_values(id, season_id)
    on delete restrict,
  add constraint competitions_dispute_unique
    unique nulls not distinct (season_id, category_id, competitive_division_value_id);

create index competitions_season_id_idx on public.competitions (season_id);
create index competitions_competitive_division_value_id_idx
  on public.competitions (competitive_division_value_id)
  where competitive_division_value_id is not null;

create function private.ensure_competition_season()
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
    return new;
  end if;

  if new.gender_division is null then
    -- Preserve the preexisting NOT NULL contract and SQLSTATE for callers that
    -- omit the legacy competition gender field.
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      new.series_id::text || ':' || new.year::text || ':' || new.gender_division,
      417
    )
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
    gender_division,
    name,
    suggested_starts_on,
    suggested_ends_on
  )
  values (
    new.series_id,
    new.year,
    new.gender_division,
    season_name,
    new.starts_on,
    new.ends_on
  )
  on conflict (series_id, year, gender_division) do nothing;

  select season.id into target_season_id
  from public.competition_seasons season
  where season.series_id = new.series_id
    and season.year = new.year
    and season.gender_division = new.gender_division;

  new.season_id := target_season_id;
  return new;
end;
$$;

revoke all on function private.ensure_competition_season()
  from public, anon, authenticated;

create trigger competitions_ensure_season
before insert on public.competitions
for each row execute function private.ensure_competition_season();

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
      and season.gender_division = gender
    for share;
    if not found then
      raise exception using errcode = 'BD501', message = 'BDB_COMPETITION_SEASON_CONTEXT_INVALID';
    end if;
  end if;

  if requested_competitive_division_value_id is not null then
    perform 1
    from public.competition_competitive_division_values division_value
    where division_value.id = requested_competitive_division_value_id
      and division_value.season_id = requested_season_id
    for share;
    if not found then
      raise exception using errcode = 'BD501', message = 'BDB_COMPETITION_DIVISION_CONTEXT_INVALID';
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

  revision_id := private.materialize_competition_preset(competition_id, preset_key, entry_count);
  insert into private.competition_creation_requests (request_id, actor_id, input, competition_id)
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
exception
  when unique_violation then
    raise exception using errcode = 'BD506', message = 'BDB_COMPETITION_CONTEXT_CONFLICT';
end;
$$;

revoke all on function public.admin_create_competition_from_preset(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_create_competition_from_preset(uuid, jsonb)
  to authenticated;

create trigger competition_seasons_set_updated_at
before update on public.competition_seasons
for each row execute function private.set_updated_at();

create trigger competition_competitive_division_types_set_updated_at
before update on public.competition_competitive_division_types
for each row execute function private.set_updated_at();

create trigger competition_competitive_division_values_set_updated_at
before update on public.competition_competitive_division_values
for each row execute function private.set_updated_at();

alter table public.competition_seasons enable row level security;
alter table public.competition_seasons force row level security;
alter table public.competition_competitive_division_types enable row level security;
alter table public.competition_competitive_division_types force row level security;
alter table public.competition_competitive_division_values enable row level security;
alter table public.competition_competitive_division_values force row level security;

create policy competition_seasons_admin_select
on public.competition_seasons for select to authenticated
using ((select public.is_current_admin_aal2()));

create policy competition_competitive_division_types_admin_select
on public.competition_competitive_division_types for select to authenticated
using ((select public.is_current_admin_aal2()));

create policy competition_competitive_division_values_admin_select
on public.competition_competitive_division_values for select to authenticated
using ((select public.is_current_admin_aal2()));

revoke all on public.competition_seasons,
  public.competition_competitive_division_types,
  public.competition_competitive_division_values
  from public, anon, authenticated;

revoke all on sequence public.competition_seasons_id_seq,
  public.competition_competitive_division_types_id_seq,
  public.competition_competitive_division_values_id_seq
  from public, anon, authenticated;

grant select on public.competition_seasons,
  public.competition_competitive_division_types,
  public.competition_competitive_division_values
  to authenticated;

create table private.competition_dimension_requests (
  request_id uuid primary key,
  actor_id uuid not null references auth.users(id) on delete restrict,
  operation text not null check (
    operation in ('create_season', 'create_division_value')
  ),
  input jsonb not null check (jsonb_typeof(input) = 'object'),
  result_id bigint not null,
  created_at timestamptz not null default now()
);

create index competition_dimension_requests_actor_idx
  on private.competition_dimension_requests (actor_id, created_at desc);

alter table private.competition_dimension_requests enable row level security;
alter table private.competition_dimension_requests force row level security;
revoke all on private.competition_dimension_requests from public, anon, authenticated;

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
    'ruleset_amended','manual_matchup_created','manual_matchup_participants_updated',
    'boxscore_team_registrations_resolved','competition_season_created',
    'competition_season_updated','competition_competitive_division_value_created',
    'competition_competitive_division_assigned'
  ));

alter table public.admin_mutation_audit
  drop constraint admin_mutation_audit_entity_type_check,
  add constraint admin_mutation_audit_entity_type_check check (entity_type in (
    'team_registration','game','boxscore_import','final_placement','player','competition',
    'data_profile','competition_entry','matchup','competition_ruleset_revision',
    'competition_group','competition_season','competition_competitive_division_value'
  ));

create function public.admin_create_competition_season(
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
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  if p_request_id is null
    or p_series_id is null
    or p_year is null
    or p_year not between 1900 and 2200
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
    raise exception using errcode = 'BD501', message = 'BDB_COMPETITION_SEASON_INPUT_INVALID';
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
    hashtextextended(
      p_series_id::text || ':' || p_year::text || ':' || p_gender_division,
      417
    )
  );

  insert into public.competition_seasons (
    series_id,
    year,
    gender_division,
    name,
    description,
    suggested_starts_on,
    suggested_ends_on
  )
  values (
    p_series_id,
    p_year,
    p_gender_division,
    clean_name,
    clean_description,
    p_suggested_starts_on,
    p_suggested_ends_on
  )
  returning id into created_season_id;

  insert into private.competition_dimension_requests (
    request_id,
    actor_id,
    operation,
    input,
    result_id
  )
  values (p_request_id, auth.uid(), 'create_season', normalized_input, created_season_id);

  insert into public.admin_mutation_audit (action, entity_type, entity_id, metadata)
  values (
    'competition_season_created',
    'competition_season',
    created_season_id,
    jsonb_build_object('seriesId', p_series_id, 'year', p_year, 'genderDivision', p_gender_division)
  );

  return created_season_id;
exception
  when unique_violation then
    raise exception using errcode = 'BD506', message = 'BDB_COMPETITION_SEASON_CONFLICT';
end;
$$;

revoke all on function public.admin_create_competition_season(
  uuid, bigint, integer, text, text, text, date, date
) from public, anon, authenticated;
grant execute on function public.admin_create_competition_season(
  uuid, bigint, integer, text, text, text, date, date
) to authenticated;

create function public.admin_update_competition_season(
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
    raise exception using errcode = 'BD501', message = 'BDB_COMPETITION_SEASON_INPUT_INVALID';
  end if;

  select season.* into target
  from public.competition_seasons season
  where season.id = p_season_id
  for update;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_COMPETITION_SEASON_NOT_FOUND';
  end if;

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
  where season.id = p_season_id
  returning revision into next_revision;

  insert into public.admin_mutation_audit (action, entity_type, entity_id, metadata)
  values (
    'competition_season_updated',
    'competition_season',
    p_season_id,
    jsonb_build_object('fromRevision', p_expected_revision, 'toRevision', next_revision)
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

create function public.admin_add_competitive_division_value(
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
  created_value_id bigint;
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

  perform 1
  from public.competition_seasons season
  where season.id = p_season_id
  for update;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_COMPETITION_SEASON_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_season_id::text, 420));
  select division.* into division_type
  from public.competition_competitive_division_types division
  where division.season_id = p_season_id
  for update;

  if not found then
    insert into public.competition_competitive_division_types (season_id, name, slug)
    values (p_season_id, clean_type_name, clean_type_slug)
    returning * into division_type;
  elsif division_type.name <> clean_type_name or division_type.slug <> clean_type_slug then
    raise exception using errcode = 'BD409', message = 'BDB_COMPETITION_DIVISION_TYPE_CONFLICT';
  end if;

  insert into public.competition_competitive_division_values (
    competitive_division_type_id,
    season_id,
    name,
    slug,
    sort_order
  )
  values (
    division_type.id,
    p_season_id,
    clean_value_name,
    clean_value_slug,
    p_sort_order
  )
  returning id into created_value_id;

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
      'seasonId', p_season_id,
      'divisionTypeId', division_type.id,
      'sortOrder', p_sort_order
    )
  );

  return created_value_id;
exception
  when unique_violation then
    raise exception using errcode = 'BD506', message = 'BDB_COMPETITION_DIVISION_VALUE_CONFLICT';
end;
$$;

revoke all on function public.admin_add_competitive_division_value(
  uuid, bigint, text, text, text, text, integer
) from public, anon, authenticated;
grant execute on function public.admin_add_competitive_division_value(
  uuid, bigint, text, text, text, text, integer
) to authenticated;

create function public.admin_assign_competition_competitive_division(
  p_competition_id bigint,
  p_competitive_division_value_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.competitions;
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

  if p_competitive_division_value_id is not null and not exists (
    select 1
    from public.competition_competitive_division_values division_value
    where division_value.id = p_competitive_division_value_id
      and division_value.season_id = target.season_id
  ) then
    raise exception using errcode = 'BD501', message = 'BDB_COMPETITION_DIVISION_CONTEXT_INVALID';
  end if;

  if target.competitive_division_value_id is not distinct from p_competitive_division_value_id then
    return target.id;
  end if;

  update public.competitions competition
  set competitive_division_value_id = p_competitive_division_value_id
  where competition.id = target.id;

  insert into public.admin_mutation_audit (action, entity_type, entity_id, metadata)
  values (
    'competition_competitive_division_assigned',
    'competition',
    target.id,
    jsonb_build_object('competitiveDivisionValueId', p_competitive_division_value_id)
  );

  return target.id;
exception
  when unique_violation then
    raise exception using errcode = 'BD506', message = 'BDB_COMPETITION_DISPUTE_CONFLICT';
end;
$$;

revoke all on function public.admin_assign_competition_competitive_division(bigint, bigint)
  from public, anon, authenticated;
grant execute on function public.admin_assign_competition_competitive_division(bigint, bigint)
  to authenticated;

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
  season.gender_division,
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
  'Shared championship season identified by championship, year and gender division.';
comment on table public.categories is
  'Age-category dimension for disputes; Adulto represents competitions without an age split.';
comment on table public.competitions is
  'Administrable sporting dispute identified by season, age category and optional division value.';
comment on table public.competition_competitive_division_types is
  'At most one configurable competitive-division type per season.';
comment on table public.competition_competitive_division_values is
  'Ordered values of the competitive-division type configured for a season.';
comment on column public.competitions.competitive_division_value_id is
  'Optional competitive division; null keeps the canonical route without a division segment.';
comment on view public.competition_dispute_contexts is
  'Admin-only security-invoker context joining season, age category and optional competitive division.';
