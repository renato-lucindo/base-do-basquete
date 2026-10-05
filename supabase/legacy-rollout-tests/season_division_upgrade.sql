-- Disposable CI-only fixture applied at the migration immediately before
-- season/division support. It must remain valid without the new columns.
insert into auth.users (id)
values ('33333333-3333-4333-8333-333333333333')
on conflict (id) do nothing;

insert into private.admin_accounts (user_id)
values ('33333333-3333-4333-8333-333333333333')
on conflict (user_id) do nothing;

insert into public.competition_series (name, slug)
values ('Liga Upgrade', 'liga-upgrade');

insert into public.categories (name, slug, has_advanced_stats)
values
  ('Sub-15 Upgrade', 'sub-15-upgrade', true),
  ('Sub-17 Upgrade', 'sub-17-upgrade', true);

insert into public.series_category_data_profiles (
  series_id,
  category_id,
  gender_division,
  version,
  primary_source,
  status,
  created_by,
  activated_by,
  activated_at
)
select
  series.id,
  category.id,
  gender.value,
  1,
  'manual_scoresheet',
  'active',
  '33333333-3333-4333-8333-333333333333',
  '33333333-3333-4333-8333-333333333333',
  clock_timestamp()
from public.competition_series series
cross join public.categories category
cross join (values ('male'::text), ('female'::text)) gender(value)
where series.slug = 'liga-upgrade'
  and category.slug in ('sub-15-upgrade', 'sub-17-upgrade');

insert into public.competitions (
  id,
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
  data_profile_validated_by
)
overriding system value
select
  fixture.id,
  series.id,
  category.id,
  2030,
  fixture.display_name,
  'draft',
  fixture.starts_on,
  fixture.ends_on,
  fixture.gender_division,
  false,
  profile.id,
  false,
  clock_timestamp(),
  '33333333-3333-4333-8333-333333333333'
from public.competition_series series
join (
  values
    (91001::bigint, 'sub-15-upgrade'::text, 'male'::text, 'Liga Upgrade Sub-15'::text, '2030-03-01'::date, '2030-09-30'::date),
    (91002::bigint, 'sub-17-upgrade'::text, 'male'::text, 'Liga Upgrade Sub-17'::text, '2030-04-01'::date, '2030-11-30'::date),
    (91003::bigint, 'sub-15-upgrade'::text, 'female'::text, 'Liga Upgrade Sub-15 Feminino'::text, '2030-03-01'::date, '2030-11-30'::date)
) fixture(id, category_slug, gender_division, display_name, starts_on, ends_on) on true
join public.categories category on category.slug = fixture.category_slug
join public.series_category_data_profiles profile
  on profile.series_id = series.id
  and profile.category_id = category.id
  and profile.gender_division = fixture.gender_division
  and profile.status = 'active'
where series.slug = 'liga-upgrade';

select set_config('bdb.allow_internal_ingestion_game', 'on', false);

insert into public.games (id, competition_id, game_number, source)
overriding system value
values (92001, 91001, 'UPGRADE-1', 'structural');

set constraints games_validate_matchup_participants immediate;

select set_config('bdb.allow_internal_ingestion_game', 'off', false);

with publication_snapshot as (
  select private.competition_publication_snapshot(91001) ||
    '{"upgradeMarker":"preserve-me"}'::jsonb as value
)
insert into public.competition_publications (
  id,
  competition_id,
  version,
  snapshot,
  snapshot_hash,
  publication_kind,
  published_at
)
overriding system value
select
  93001,
  91001,
  1,
  value,
  md5(value::text),
  'legacy_backfill',
  '2030-10-01T12:00:00Z'
from publication_snapshot;
