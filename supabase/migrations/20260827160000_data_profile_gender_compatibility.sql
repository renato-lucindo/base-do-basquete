-- ADM-REF-01 / compatibility: gender division, private player sex and versioned data profiles.
-- Historical values remain intentionally unclassified until an AAL2 administrator reviews them.

alter table public.competitions
  drop constraint competitions_context_unique,
  add column gender_division text,
  add column gender_division_review_required boolean not null default true,
  add constraint competitions_gender_division_check check (
    gender_division is null or gender_division in ('male', 'female')
  ),
  add constraint competitions_gender_review_consistent check (
    gender_division is not null or gender_division_review_required
  );

create unique index competitions_classified_context_uidx
  on public.competitions (series_id, category_id, gender_division, year)
  where gender_division is not null;

create unique index competitions_unclassified_context_uidx
  on public.competitions (series_id, category_id, year)
  where gender_division is null;

alter table private.player_private
  add column sex text,
  add column sex_review_required boolean not null default true,
  add constraint player_private_sex_check check (
    sex is null or sex in ('male', 'female')
  ),
  add constraint player_private_sex_review_consistent check (
    sex is not null or sex_review_required
  );

insert into private.player_private (player_id)
select player.id
from public.players player
on conflict (player_id) do nothing;

create function private.ensure_player_private_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.player_private (player_id)
  values (new.id)
  on conflict (player_id) do nothing;
  return new;
end;
$$;

revoke all on function private.ensure_player_private_row() from public, anon, authenticated;

create trigger players_ensure_private_row
after insert on public.players
for each row execute function private.ensure_player_private_row();

create table public.series_category_data_profiles (
  id bigint generated always as identity primary key,
  series_id bigint not null references public.competition_series(id) on delete restrict,
  category_id bigint not null references public.categories(id) on delete restrict,
  gender_division text not null check (gender_division in ('male', 'female')),
  version integer not null check (version > 0),
  primary_source text not null check (
    primary_source in ('manual_scoresheet', 'fiba_boxscore')
  ),
  status text not null default 'draft' check (
    status in ('draft', 'active', 'superseded')
  ),
  change_reason text check (
    change_reason is null or
    (change_reason = btrim(change_reason) and char_length(change_reason) between 10 and 500)
  ),
  created_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict deferrable initially immediate,
  created_at timestamptz not null default now(),
  activated_by uuid
    references auth.users(id) on delete restrict deferrable initially immediate,
  activated_at timestamptz,
  constraint series_category_data_profiles_version_unique
    unique (series_id, category_id, gender_division, version),
  constraint series_category_data_profiles_identity_unique
    unique (id, series_id, category_id, gender_division),
  constraint series_category_data_profiles_status_consistent check (
    (status = 'draft' and activated_by is null and activated_at is null) or
    (status in ('active', 'superseded') and activated_by is not null and activated_at is not null)
  )
);

create unique index series_category_data_profiles_active_uidx
  on public.series_category_data_profiles (series_id, category_id, gender_division)
  where status = 'active';

create index series_category_data_profiles_created_by_idx
  on public.series_category_data_profiles (created_by, created_at desc);

create index series_category_data_profiles_activated_by_idx
  on public.series_category_data_profiles (activated_by, activated_at desc)
  where activated_by is not null;

alter table public.competitions
  add column data_profile_id bigint,
  add column data_profile_review_required boolean not null default true,
  add column data_profile_validated_at timestamptz,
  add column data_profile_validated_by uuid
    references auth.users(id) on delete restrict deferrable initially immediate,
  add constraint competitions_profile_requires_gender check (
    data_profile_id is null or gender_division is not null
  ),
  add constraint competitions_profile_validation_consistent check (
    (data_profile_validated_at is null and data_profile_validated_by is null) or
    (
      data_profile_id is not null and
      data_profile_validated_at is not null and
      data_profile_validated_by is not null
    )
  ),
  add constraint competitions_data_profile_identity_fkey
    foreign key (data_profile_id, series_id, category_id, gender_division)
    references public.series_category_data_profiles (
      id,
      series_id,
      category_id,
      gender_division
    )
    on delete restrict;

create index competitions_data_profile_idx
  on public.competitions (data_profile_id)
  where data_profile_id is not null;

create function private.protect_data_profile_revision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = 'BD502', message = 'BDB_DATA_PROFILE_IMMUTABLE';
  end if;

  if
    new.series_id is distinct from old.series_id or
    new.category_id is distinct from old.category_id or
    new.gender_division is distinct from old.gender_division or
    new.version is distinct from old.version or
    new.primary_source is distinct from old.primary_source or
    new.change_reason is distinct from old.change_reason or
    new.created_by is distinct from old.created_by or
    new.created_at is distinct from old.created_at
  then
    raise exception using errcode = 'BD502', message = 'BDB_DATA_PROFILE_IMMUTABLE';
  end if;

  if old.status = 'superseded' then
    raise exception using errcode = 'BD502', message = 'BDB_DATA_PROFILE_IMMUTABLE';
  end if;

  if old.status = 'active' and (
    new.status <> 'superseded' or
    new.activated_by is distinct from old.activated_by or
    new.activated_at is distinct from old.activated_at
  ) then
    raise exception using errcode = 'BD502', message = 'BDB_DATA_PROFILE_IMMUTABLE';
  end if;

  if old.status = 'draft' and new.status not in ('draft', 'active') then
    raise exception using errcode = 'BD503', message = 'BDB_DATA_PROFILE_TRANSITION_INVALID';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_data_profile_revision()
  from public, anon, authenticated;

create trigger series_category_data_profiles_protect_revision
before update or delete on public.series_category_data_profiles
for each row execute function private.protect_data_profile_revision();

alter table public.series_category_data_profiles enable row level security;
alter table public.series_category_data_profiles force row level security;

create policy series_category_data_profiles_active_select
on public.series_category_data_profiles for select to anon, authenticated
using (status = 'active');

revoke all on public.series_category_data_profiles from public, anon, authenticated;
revoke all on sequence public.series_category_data_profiles_id_seq
  from public, anon, authenticated;
grant select (
  id,
  series_id,
  category_id,
  gender_division,
  version,
  primary_source,
  status,
  activated_at
) on public.series_category_data_profiles to anon, authenticated;

create view public.active_series_category_data_profiles
with (security_invoker = true)
as
select
  profile.id,
  profile.series_id,
  profile.category_id,
  profile.gender_division,
  profile.version,
  profile.primary_source,
  profile.activated_at
from public.series_category_data_profiles profile
where profile.status = 'active';

revoke all on public.active_series_category_data_profiles
  from public, anon, authenticated;
grant select on public.active_series_category_data_profiles to anon, authenticated;

create view private.competition_gender_review_queue
with (security_invoker = true)
as
select
  competition.id as competition_id,
  competition.series_id,
  competition.category_id,
  competition.year,
  competition.display_name
from public.competitions competition
where competition.gender_division_review_required;

create view private.player_sex_review_queue
with (security_invoker = true)
as
select
  player.id as player_id,
  player.full_name,
  player.is_active
from public.players player
join private.player_private private_data on private_data.player_id = player.id
where private_data.sex_review_required;

revoke all on private.competition_gender_review_queue, private.player_sex_review_queue
  from public, anon, authenticated;

alter table public.admin_mutation_audit
  drop constraint admin_mutation_audit_action_check,
  add constraint admin_mutation_audit_action_check check (
    action in (
      'registration_created',
      'registration_transitioned',
      'roster_replaced',
      'manual_scoresheet_saved',
      'boxscore_import_confirmed',
      'boxscore_team_stats_refreshed',
      'final_placement_confirmed',
      'player_created',
      'competition_gender_reviewed',
      'data_profile_created',
      'data_profile_activated',
      'competition_data_profile_assigned',
      'player_sex_reviewed'
    )
  ),
  drop constraint admin_mutation_audit_entity_type_check,
  add constraint admin_mutation_audit_entity_type_check check (
    entity_type in (
      'team_registration',
      'game',
      'boxscore_import',
      'final_placement',
      'player',
      'competition',
      'data_profile'
    )
  );

create function public.admin_review_competition_gender(
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
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if p_gender_division not in ('male', 'female') then
    raise exception using errcode = 'BD501', message = 'BDB_GENDER_DIVISION_INVALID';
  end if;

  select * into current_row
  from public.competitions competition
  where competition.id = p_competition_id
  for update;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_COMPETITION_NOT_FOUND';
  end if;

  if
    current_row.gender_division = p_gender_division and
    not current_row.gender_division_review_required
  then
    return current_row;
  end if;

  update public.competitions
  set
    gender_division = p_gender_division,
    gender_division_review_required = false,
    data_profile_id = case
      when gender_division is distinct from p_gender_division then null
      else data_profile_id
    end,
    data_profile_review_required = true,
    data_profile_validated_at = null,
    data_profile_validated_by = null
  where id = p_competition_id
  returning * into strict result;

  insert into public.admin_mutation_audit (action, entity_type, entity_id)
  values ('competition_gender_reviewed', 'competition', result.id);

  return result;
exception when unique_violation then
  raise exception using errcode = 'BD506', message = 'BDB_COMPETITION_CONTEXT_ALREADY_EXISTS';
end;
$$;

create function public.admin_create_series_category_data_profile(
  p_series_id bigint,
  p_category_id bigint,
  p_gender_division text,
  p_primary_source text,
  p_change_reason text default null
)
returns public.series_category_data_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_reason text := nullif(btrim(coalesce(p_change_reason, '')), '');
  next_version integer;
  result public.series_category_data_profiles;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if p_gender_division not in ('male', 'female') then
    raise exception using errcode = 'BD501', message = 'BDB_GENDER_DIVISION_INVALID';
  end if;
  if p_primary_source not in ('manual_scoresheet', 'fiba_boxscore') then
    raise exception using errcode = 'BD501', message = 'BDB_PRIMARY_SOURCE_INVALID';
  end if;
  if not exists (
    select 1 from public.competition_series series
    where series.id = p_series_id and series.is_active
  ) or not exists (
    select 1 from public.categories category
    where category.id = p_category_id and category.is_active
  ) then
    raise exception using errcode = 'BD404', message = 'BDB_DATA_PROFILE_CONTEXT_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_series_id::text || ':' || p_category_id::text || ':' || p_gender_division,
    271
  ));

  select coalesce(max(profile.version), 0) + 1
  into next_version
  from public.series_category_data_profiles profile
  where profile.series_id = p_series_id
    and profile.category_id = p_category_id
    and profile.gender_division = p_gender_division;

  if next_version > 1 and (
    clean_reason is null or char_length(clean_reason) not between 10 and 500
  ) then
    raise exception using errcode = 'BD501', message = 'BDB_DATA_PROFILE_REASON_REQUIRED';
  end if;

  insert into public.series_category_data_profiles (
    series_id,
    category_id,
    gender_division,
    version,
    primary_source,
    change_reason
  )
  values (
    p_series_id,
    p_category_id,
    p_gender_division,
    next_version,
    p_primary_source,
    clean_reason
  )
  returning * into strict result;

  insert into public.admin_mutation_audit (action, entity_type, entity_id)
  values ('data_profile_created', 'data_profile', result.id);

  return result;
end;
$$;

create function public.admin_activate_series_category_data_profile(
  p_profile_id bigint
)
returns public.series_category_data_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.series_category_data_profiles;
  result public.series_category_data_profiles;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  select * into target
  from public.series_category_data_profiles profile
  where profile.id = p_profile_id
  for update;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_DATA_PROFILE_NOT_FOUND';
  end if;
  if target.status = 'active' then
    return target;
  end if;
  if target.status <> 'draft' then
    raise exception using errcode = 'BD503', message = 'BDB_DATA_PROFILE_TRANSITION_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    target.series_id::text || ':' ||
    target.category_id::text || ':' ||
    target.gender_division,
    271
  ));

  update public.series_category_data_profiles
  set status = 'superseded'
  where series_id = target.series_id
    and category_id = target.category_id
    and gender_division = target.gender_division
    and status = 'active';

  update public.series_category_data_profiles
  set
    status = 'active',
    activated_by = auth.uid(),
    activated_at = now()
  where id = target.id
  returning * into strict result;

  insert into public.admin_mutation_audit (action, entity_type, entity_id)
  values ('data_profile_activated', 'data_profile', result.id);

  return result;
end;
$$;

create function public.admin_assign_competition_data_profile(
  p_competition_id bigint,
  p_profile_id bigint
)
returns public.competitions
language plpgsql
security definer
set search_path = ''
as $$
declare
  competition_record public.competitions;
  profile_record public.series_category_data_profiles;
  result public.competitions;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  select * into competition_record
  from public.competitions competition
  where competition.id = p_competition_id
  for update;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_COMPETITION_NOT_FOUND';
  end if;

  select * into profile_record
  from public.series_category_data_profiles profile
  where profile.id = p_profile_id
  for share;
  if not found or profile_record.status <> 'active' then
    raise exception using errcode = 'BD404', message = 'BDB_ACTIVE_DATA_PROFILE_NOT_FOUND';
  end if;

  if
    competition_record.gender_division_review_required or
    competition_record.gender_division is null
  then
    raise exception using errcode = 'BD505', message = 'BDB_GENDER_REVIEW_REQUIRED';
  end if;
  if
    competition_record.series_id <> profile_record.series_id or
    competition_record.category_id <> profile_record.category_id or
    competition_record.gender_division <> profile_record.gender_division
  then
    raise exception using errcode = 'BD504', message = 'BDB_DATA_PROFILE_CONTEXT_MISMATCH';
  end if;

  update public.competitions
  set
    data_profile_id = profile_record.id,
    data_profile_review_required = false,
    data_profile_validated_at = now(),
    data_profile_validated_by = auth.uid()
  where id = competition_record.id
  returning * into strict result;

  insert into public.admin_mutation_audit (action, entity_type, entity_id)
  values ('competition_data_profile_assigned', 'competition', result.id);

  return result;
end;
$$;

create function public.admin_set_player_sex(
  p_player_id bigint,
  p_sex text,
  p_reason text
)
returns table (
  player_id bigint,
  eligibility_pending boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_reason text := btrim(coalesce(p_reason, ''));
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if p_sex not in ('male', 'female') then
    raise exception using errcode = 'BD501', message = 'BDB_PLAYER_SEX_INVALID';
  end if;
  if char_length(clean_reason) not between 10 and 500 then
    raise exception using errcode = 'BD501', message = 'BDB_PLAYER_SEX_REASON_REQUIRED';
  end if;
  if not exists (
    select 1 from public.players player where player.id = p_player_id
  ) then
    raise exception using errcode = 'BD404', message = 'BDB_PLAYER_NOT_FOUND';
  end if;

  insert into private.player_private (player_id, sex, sex_review_required)
  values (p_player_id, p_sex, false)
  on conflict (player_id) do update
  set
    sex = excluded.sex,
    sex_review_required = false;

  insert into public.admin_mutation_audit (
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    'player_sex_reviewed',
    'player',
    p_player_id,
    jsonb_build_object('reason', clean_reason)
  );

  return query select p_player_id, false;
end;
$$;

revoke all on function public.admin_review_competition_gender(bigint, text)
  from public, anon, authenticated;
revoke all on function public.admin_create_series_category_data_profile(
  bigint,
  bigint,
  text,
  text,
  text
) from public, anon, authenticated;
revoke all on function public.admin_activate_series_category_data_profile(bigint)
  from public, anon, authenticated;
revoke all on function public.admin_assign_competition_data_profile(bigint, bigint)
  from public, anon, authenticated;
revoke all on function public.admin_set_player_sex(bigint, text, text)
  from public, anon, authenticated;

grant execute on function public.admin_review_competition_gender(bigint, text)
  to authenticated;
grant execute on function public.admin_create_series_category_data_profile(
  bigint,
  bigint,
  text,
  text,
  text
) to authenticated;
grant execute on function public.admin_activate_series_category_data_profile(bigint)
  to authenticated;
grant execute on function public.admin_assign_competition_data_profile(bigint, bigint)
  to authenticated;
grant execute on function public.admin_set_player_sex(bigint, text, text)
  to authenticated;

comment on column public.competitions.gender_division is
  'Public edition division. Null exists only during the reviewed compatibility rollout.';
comment on column private.player_private.sex is
  'Private administrative value used only for edition eligibility.';
comment on table public.series_category_data_profiles is
  'Immutable versioned data-source profile for one series, category and gender division.';
comment on view public.active_series_category_data_profiles is
  'Public capability facade without administrative actor identifiers.';
comment on view private.competition_gender_review_queue is
  'AAL2 administrative work queue; values are never inferred.';
comment on view private.player_sex_review_queue is
  'Private AAL2 administrative work queue for missing eligibility data.';
