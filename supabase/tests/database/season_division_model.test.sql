begin;
\ir ../helpers/final_profile_fixtures.inc
create extension if not exists pgtap with schema extensions;
select plan(51);
set constraints all deferred;

select has_table('public', 'competition_seasons', 'season parent exists');
select has_table('public', 'competition_competitive_division_types', 'division type exists');
select has_table('public', 'competition_competitive_division_values', 'ordered division values exist');
select col_not_null('public', 'competitions', 'season_id', 'every dispute has a season');
select col_is_null('public', 'competitions', 'competitive_division_value_id', 'competitive division is optional');
select ok(
  exists(select 1 from public.categories where slug = 'adulto' and name = 'Adulto'),
  'Adulto is available for competitions without an age split'
);
select ok(
  not exists(select 1 from public.competitions where season_id is null),
  'backfill leaves no dispute without a season'
);
select is(
  (select count(*) from public.competition_seasons),
  (
    select count(*)
    from (
      select distinct series_id, year, gender_division
      from public.competitions
    ) contexts
  ),
  'backfill creates one season per championship year and gender'
);
select ok(
  not exists(
    select 1
    from public.competitions competition
    join public.competition_seasons season on season.id = competition.season_id
    where (season.series_id, season.year, season.gender_division)
      is distinct from
      (competition.series_id, competition.year, competition.gender_division)
  ),
  'backfill preserves the historical context on every dispute'
);
select ok(
  not exists(select 1 from public.competitions where competitive_division_value_id is not null),
  'historical disputes are not assigned an inferred competitive division'
);
select ok(
  not exists(
    select 1 from public.games game
    left join public.competitions competition on competition.id = game.competition_id
    where competition.id is null
  ),
  'historical games keep their dispute links'
);
select ok(
  not exists(
    select 1 from public.competition_publications publication
    left join public.competitions competition on competition.id = publication.competition_id
    where competition.id is null
  ),
  'historical publications keep their dispute links'
);
select has_index(
  'public',
  'competitions',
  'competitions_dispute_unique',
  array['season_id', 'category_id', 'competitive_division_value_id'],
  'dispute identity includes the optional division value'
);
select is(
  (
    select index_definition.indnullsnotdistinct
    from pg_index index_definition
    join pg_class index_relation on index_relation.oid = index_definition.indexrelid
    where index_definition.indrelid = 'public.competitions'::regclass
      and index_relation.relname = 'competitions_dispute_unique'
  ),
  true,
  'dispute uniqueness treats a missing division as one value'
);
select has_fk(
  'public',
  'competitions',
  'season and division values are protected by contextual foreign keys'
);
select is(
  (
    select count(*)
    from pg_constraint
    where conrelid = 'public.competitions'::regclass
      and conname in (
        'competitions_season_identity_fkey',
        'competitions_competitive_division_value_season_fkey'
      )
      and contype = 'f'
  ),
  2::bigint,
  'both contextual competition foreign keys exist'
);
select is(
  (
    select count(*)
    from pg_constraint
    where conrelid = 'public.competition_competitive_division_types'::regclass
      and contype = 'u'
      and conkey = array[
        (
          select attnum from pg_attribute
          where attrelid = 'public.competition_competitive_division_types'::regclass
            and attname = 'season_id'
        )::smallint
      ]
  ),
  1::bigint,
  'a season accepts at most one competitive division type'
);
select is(
  (
    select bool_and(relrowsecurity and relforcerowsecurity)
    from pg_class
    where oid in (
      'public.competition_seasons'::regclass,
      'public.competition_competitive_division_types'::regclass,
      'public.competition_competitive_division_values'::regclass
    )
  ),
  true,
  'all exposed dimension tables enable and force RLS'
);
select is(
  has_table_privilege('anon', 'public.competition_seasons', 'insert'),
  false,
  'anon cannot insert seasons'
);
select is(
  has_table_privilege('authenticated', 'public.competition_competitive_division_values', 'update'),
  false,
  'authenticated cannot bypass division RPCs'
);
select is(
  has_function_privilege(
    'anon',
    'public.admin_create_competition_season(uuid,bigint,integer,text,text,text,date,date)',
    'execute'
  ),
  false,
  'anon cannot execute season creation'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.admin_create_competition_season(uuid,bigint,integer,text,text,text,date,date)',
    'execute'
  ),
  true,
  'authenticated reaches the guarded season RPC'
);

insert into auth.users(id)
values ('11111111-1111-4111-8111-111111111111')
on conflict do nothing;
insert into private.admin_accounts(user_id)
select '11111111-1111-4111-8111-111111111111'
where not exists(select 1 from private.admin_accounts);
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', (select user_id from private.admin_accounts limit 1),
  'role', 'authenticated',
  'aal', 'aal2'
)::text, true);

create temporary table season_division_context (
  series_id bigint,
  adult_category_id bigint,
  youth_category_id bigint,
  season_id bigint,
  gold_id bigint,
  silver_id bigint,
  adult_competition_id bigint,
  youth_competition_id bigint
);

with series as (
  insert into public.competition_series(name, slug)
  values ('Temporada multidimensional', 'temporada-multidimensional')
  returning id
), adult as (
  select id from public.categories where slug = 'adulto'
), youth as (
  insert into public.categories(name, slug)
  values ('Sub-15 multidimensional', 'sub-15-multidimensional')
  returning id
)
insert into season_division_context(series_id, adult_category_id, youth_category_id)
select series.id, adult.id, youth.id from series, adult, youth;

grant select, update on season_division_context to authenticated;

set local role authenticated;
select lives_ok(
  $$update season_division_context
    set season_id = public.admin_create_competition_season(
      '11111111-1111-4111-8111-000000000001',
      series_id,
      2031,
      'male',
      'Copa Multidimensional 2031',
      'Descrição compartilhada pela temporada.',
      '2031-03-01',
      '2031-11-30'
    )$$,
  'AAL2 creates a season through the authoritative RPC'
);
select is(
  public.admin_create_competition_season(
    '11111111-1111-4111-8111-000000000001',
    series_id,
    2031,
    'male',
    'Copa Multidimensional 2031',
    'Descrição compartilhada pela temporada.',
    '2031-03-01',
    '2031-11-30'
  ),
  season_id,
  'identical season retry returns the original row'
) from season_division_context;
select throws_ok(
  $$select public.admin_create_competition_season(
    '11111111-1111-4111-8111-000000000001', series_id, 2031, 'male',
    'Outro nome', null, null, null
  ) from season_division_context$$,
  'BD409',
  'BDB_IDEMPOTENCY_CONFLICT',
  'changed season request cannot reuse an idempotency key'
);
select throws_ok(
  $$select public.admin_create_competition_season(
    gen_random_uuid(), series_id, 2031, 'male', 'Temporada duplicada', null, null, null
  ) from season_division_context$$,
  'BD506',
  'BDB_COMPETITION_SEASON_CONFLICT',
  'duplicate championship year and gender is rejected'
);
select is(
  public.admin_update_competition_season(
    season_id,
    1,
    'Copa Multidimensional 2031',
    'Descrição compartilhada revisada.',
    '2031-03-01',
    '2031-12-07'
  ),
  2,
  'season shared information uses revisioned CAS'
) from season_division_context;
select throws_ok(
  $$select public.admin_update_competition_season(
    season_id, 1, 'Nome obsoleto', null, null, null
  ) from season_division_context$$,
  'BD409',
  'BDB_COMPETITION_SEASON_STALE',
  'stale season revision is rejected'
);
select lives_ok(
  $$update season_division_context
    set gold_id = public.admin_add_competitive_division_value(
      '11111111-1111-4111-8111-000000000002',
      season_id,
      'Série',
      'serie',
      'Ouro',
      'ouro',
      1
    )$$,
  'AAL2 creates the first ordered division value'
);
select is(
  public.admin_add_competitive_division_value(
    '11111111-1111-4111-8111-000000000002',
    season_id,
    'Série',
    'serie',
    'Ouro',
    'ouro',
    1
  ),
  gold_id,
  'identical division retry returns the original value'
) from season_division_context;
select lives_ok(
  $$update season_division_context
    set silver_id = public.admin_add_competitive_division_value(
      '11111111-1111-4111-8111-000000000003',
      season_id,
      'Série',
      'serie',
      'Prata',
      'prata',
      2
    )$$,
  'the same season accepts another ordered value of the same type'
);
select throws_ok(
  $$select public.admin_add_competitive_division_value(
    gen_random_uuid(), season_id, 'Conferência', 'conferencia', 'Leste', 'leste', 3
  ) from season_division_context$$,
  'BD409',
  'BDB_COMPETITION_DIVISION_TYPE_CONFLICT',
  'a season cannot switch to a second competitive division type'
);
select results_eq(
  $$select name from public.competition_competitive_division_values
    where season_id = (select season_id from season_division_context)
    order by sort_order$$,
  $$values ('Ouro'::text), ('Prata'::text)$$,
  'division values retain explicit order'
);
reset role;

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
  context.series_id,
  category_id,
  'male',
  1,
  'manual_scoresheet',
  'active',
  (select user_id from private.admin_accounts limit 1),
  (select user_id from private.admin_accounts limit 1),
  clock_timestamp()
from season_division_context context
cross join lateral (
  values (context.adult_category_id), (context.youth_category_id)
) categories(category_id);

with adult_profile as (
  select profile.id
  from public.series_category_data_profiles profile
  join season_division_context context
    on context.series_id = profile.series_id
    and context.adult_category_id = profile.category_id
  where profile.gender_division = 'male' and profile.status = 'active'
), inserted as (
  insert into public.competitions (
    series_id,
    category_id,
    year,
    display_name,
    status,
    gender_division,
    gender_division_review_required,
    data_profile_id,
    data_profile_review_required,
    data_profile_validated_at,
    data_profile_validated_by,
    season_id
  )
  select
    context.series_id,
    context.adult_category_id,
    2031,
    'Adulto simples',
    'draft',
    'male',
    false,
    adult_profile.id,
    false,
    clock_timestamp(),
    (select user_id from private.admin_accounts limit 1),
    context.season_id
  from season_division_context context, adult_profile
  returning id
)
update season_division_context
set adult_competition_id = inserted.id
from inserted;

set local role authenticated;
select lives_ok(
  $$update season_division_context context
    set youth_competition_id = public.admin_create_competition_from_preset(
      '11111111-1111-4111-8111-000000000004',
      jsonb_build_object(
        'seriesId', context.series_id,
        'categoryId', context.youth_category_id,
        'year', 2031,
        'name', 'Sub-15 Série Ouro',
        'gender', 'male',
        'source', 'manual_scoresheet',
        'preset', 'single_elimination',
        'entryCount', 2,
        'startsOn', null,
        'endsOn', null,
        'expectedProfileId', (
          select profile.id
          from public.series_category_data_profiles profile
          where profile.series_id = context.series_id
            and profile.category_id = context.youth_category_id
            and profile.gender_division = 'male'
            and profile.status = 'active'
        ),
        'reason', null,
        'reviewed', true,
        'seasonId', context.season_id,
        'competitiveDivisionValueId', context.gold_id
      )
    )$$,
  'authoritative creation RPC creates a dispute with its competitive division atomically'
);
reset role;

select is(
  (
    select competitive_division_value_id
    from public.competitions
    where id = (select adult_competition_id from season_division_context)
  ),
  null::bigint,
  'Adulto can exist without a competitive division'
);
select is(
  (
    select competitive_division_value_name
    from public.competition_dispute_contexts
    where competition_id = (select youth_competition_id from season_division_context)
  ),
  'Ouro',
  'Sub-15 and Ouro are exposed as separate dispute dimensions'
);
select throws_ok(
  $$insert into public.competitions (
      series_id,category_id,year,display_name,status,gender_division,
      gender_division_review_required,data_profile_id,data_profile_review_required,
      data_profile_validated_at,data_profile_validated_by,season_id
    )
    select
      competition.series_id,competition.category_id,competition.year,'Adulto duplicado',
      'draft',competition.gender_division,false,competition.data_profile_id,false,
      clock_timestamp(),(select user_id from private.admin_accounts limit 1),competition.season_id
    from public.competitions competition
    where competition.id = (select adult_competition_id from season_division_context)$$,
  '23505',
  null,
  'the same season category and missing division cannot be duplicated'
);
select throws_ok(
  $$insert into public.competitions (
      series_id,category_id,year,display_name,status,gender_division,
      gender_division_review_required,data_profile_id,data_profile_review_required,
      data_profile_validated_at,data_profile_validated_by,season_id,competitive_division_value_id
    )
    select
      competition.series_id,competition.category_id,competition.year,'Sub-15 Ouro duplicado',
      'draft',competition.gender_division,false,competition.data_profile_id,false,
      clock_timestamp(),(select user_id from private.admin_accounts limit 1),
      competition.season_id,competition.competitive_division_value_id
    from public.competitions competition
    where competition.id = (select youth_competition_id from season_division_context)$$,
  '23505',
  null,
  'the same season category and division cannot be duplicated'
);

set local role authenticated;
select is(
  public.admin_assign_competition_competitive_division(adult_competition_id, silver_id),
  adult_competition_id,
  'division assignment uses an AAL2 guarded RPC'
) from season_division_context;
select is(
  public.admin_assign_competition_competitive_division(adult_competition_id, silver_id),
  adult_competition_id,
  'identical division assignment is idempotent'
) from season_division_context;
reset role;

select set_config(
  'request.jwt.claims',
  jsonb_set(current_setting('request.jwt.claims')::jsonb, '{aal}', '"aal1"')::text,
  true
);
set local role authenticated;
select throws_ok(
  $$select public.admin_create_competition_season(
    gen_random_uuid(), 1, 2032, 'male', 'Negada AAL1', null, null, null
  )$$,
  'BD401',
  'BDB_ADMIN_AAL2_REQUIRED',
  'AAL1 cannot create a season'
);
select is(
  (select count(*) from public.competition_seasons where id = (select season_id from season_division_context)),
  0::bigint,
  'AAL1 cannot read a private season'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.admin_add_competitive_division_value(
    gen_random_uuid(), 1, 'Série', 'serie', 'Bronze', 'bronze', 3
  )$$,
  'BD401',
  'BDB_ADMIN_AAL2_REQUIRED',
  'non-admin AAL2 cannot create division values'
);
select is(
  (select count(*) from public.competition_competitive_division_values),
  0::bigint,
  'non-admin AAL2 cannot read division values'
);
reset role;

set local role anon;
select throws_ok(
  $$select public.admin_assign_competition_competitive_division(1, null)$$,
  '42501',
  null,
  'anon cannot execute division assignment'
);
select is(
  has_table_privilege('anon', 'public.competition_seasons', 'select'),
  false,
  'public season context remains closed until the public-context PR'
);
select throws_ok(
  $$select count(*) from public.competition_dispute_contexts$$,
  '42501',
  null,
  'anon cannot read the administrative dispute context view'
);
reset role;

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', (select user_id from private.admin_accounts limit 1),
  'role', 'authenticated',
  'aal', 'aal2'
)::text, true);
select is(
  (
    select count(*)
    from public.admin_mutation_audit
    where action = 'competition_season_created'
      and entity_id = (select season_id from season_division_context)
  ),
  1::bigint,
  'idempotent season creation writes one audit event'
);
select is(
  (
    select count(*)
    from public.admin_mutation_audit
    where action = 'competition_competitive_division_value_created'
      and entity_id in (
        select gold_id from season_division_context
        union all
        select silver_id from season_division_context
      )
  ),
  2::bigint,
  'each division value creation is audited once'
);
select is(
  (
    select count(*)
    from public.admin_mutation_audit
    where action = 'competition_competitive_division_assigned'
      and entity_id = (select adult_competition_id from season_division_context)
  ),
  1::bigint,
  'idempotent division assignment writes one audit event'
);
select is(
  (
    select count(*)
    from private.competition_dimension_requests
    where actor_id = (select user_id from private.admin_accounts limit 1)
  ),
  3::bigint,
  'idempotency ledger records only successful creation requests'
);

select * from finish();
rollback;
