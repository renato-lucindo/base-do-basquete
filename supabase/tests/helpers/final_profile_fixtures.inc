-- Test-only builders for schemas after POST-04 final enforcement.
-- Every caller must provide the gender and primary source explicitly.
create or replace function pg_temp.ensure_final_profile(
  p_series_id bigint,
  p_category_id bigint,
  p_gender_division text,
  p_primary_source text
)
returns bigint
language plpgsql
as $$
declare
  profile_id bigint;
  next_version integer;
  fixture_actor constant uuid := '11111111-1111-4111-8111-111111111111';
begin
  select profile.id into profile_id
  from public.series_category_data_profiles profile
  where profile.series_id=p_series_id
    and profile.category_id=p_category_id
    and profile.gender_division=p_gender_division
    and profile.primary_source=p_primary_source
    and profile.status='active';

  if found then
    return profile_id;
  end if;

  update public.series_category_data_profiles profile
  set status='superseded'
  where profile.series_id=p_series_id
    and profile.category_id=p_category_id
    and profile.gender_division=p_gender_division
    and profile.status='active';

  select coalesce(max(profile.version),0)+1 into next_version
  from public.series_category_data_profiles profile
  where profile.series_id=p_series_id
    and profile.category_id=p_category_id
    and profile.gender_division=p_gender_division;

  insert into public.series_category_data_profiles(
    series_id,category_id,gender_division,version,primary_source,status,
    change_reason,created_by,activated_by,activated_at
  ) values(
    p_series_id,p_category_id,p_gender_division,next_version,p_primary_source,'active',
    case when next_version>1 then 'Atualização explícita da fixture pós-enforcement' end,
    fixture_actor,fixture_actor,clock_timestamp()
  ) returning id into profile_id;

  return profile_id;
end;
$$;

create or replace function pg_temp.create_final_competition(
  p_id bigint,
  p_series_id bigint,
  p_category_id bigint,
  p_year integer,
  p_display_name text,
  p_status text,
  p_published_at timestamptz,
  p_gender_division text,
  p_primary_source text
)
returns bigint
language plpgsql
as $$
declare
  competition_id bigint;
  profile_id bigint;
  fixture_actor constant uuid := '11111111-1111-4111-8111-111111111111';
begin
  profile_id := pg_temp.ensure_final_profile(
    p_series_id,p_category_id,p_gender_division,p_primary_source
  );

  if p_id is null then
    insert into public.competitions(
      series_id,category_id,year,display_name,status,published_at,
      gender_division,gender_division_review_required,
      data_profile_id,data_profile_review_required,
      data_profile_validated_at,data_profile_validated_by
    ) values(
      p_series_id,p_category_id,p_year,p_display_name,p_status,p_published_at,
      p_gender_division,false,profile_id,false,clock_timestamp(),fixture_actor
    ) returning id into competition_id;
  else
    insert into public.competitions(
      id,series_id,category_id,year,display_name,status,published_at,
      gender_division,gender_division_review_required,
      data_profile_id,data_profile_review_required,
      data_profile_validated_at,data_profile_validated_by
    ) overriding system value values(
      p_id,p_series_id,p_category_id,p_year,p_display_name,p_status,p_published_at,
      p_gender_division,false,profile_id,false,clock_timestamp(),fixture_actor
    ) returning id into competition_id;
  end if;

  return competition_id;
end;
$$;
