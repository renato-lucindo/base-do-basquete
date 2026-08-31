begin;

create extension if not exists pgtap with schema extensions;
select plan(55);
set constraints all deferred;

insert into private.admin_accounts (user_id)
select '11111111-1111-4111-8111-111111111111'
where not exists (select 1 from private.admin_accounts);

insert into public.competition_series (id, name, slug)
overriding system value values (9601, 'Liga Perfis', 'liga-perfis');
insert into public.categories (id, name, slug)
overriding system value values (9601, 'Categoria Perfis', 'categoria-perfis');
insert into public.competitions (
  id,
  series_id,
  category_id,
  year,
  display_name,
  gender_division,
  gender_division_review_required,
  status,
  published_at
)
overriding system value values
  (9601, 9601, 9601, 2024, 'Liga Perfis 2024', null, true, 'draft', null),
  (9602, 9601, 9601, 2025, 'Liga Perfis Masculino 2025', 'male', false, 'published', now()),
  (9603, 9601, 9601, 2025, 'Liga Perfis Feminino 2025', 'female', false, 'published', now()),
  (9604, 9601, 9601, 2026, 'Liga Perfis 2026', null, true, 'draft', null);
insert into public.players (id, full_name, slug)
overriding system value values (9601, 'Atleta Elegibilidade', 'atleta-elegibilidade');

select has_column(
  'public',
  'competitions',
  'gender_division',
  'competitions store the public gender division'
);
select has_column(
  'public',
  'competitions',
  'gender_division_review_required',
  'competitions expose an explicit review state'
);
select has_column(
  'public',
  'competitions',
  'data_profile_id',
  'competitions retain an immutable profile reference'
);
select has_column(
  'private',
  'player_private',
  'sex',
  'player sex exists only in private storage'
);
select has_column(
  'private',
  'player_private',
  'sex_review_required',
  'player eligibility review is explicit'
);
select has_table(
  'public',
  'series_category_data_profiles',
  'versioned source profiles exist'
);
select has_view(
  'public',
  'active_series_category_data_profiles',
  'a safe active-profile facade exists'
);
select has_view(
  'private',
  'competition_gender_review_queue',
  'the competition review queue is private'
);
select has_view(
  'private',
  'player_sex_review_queue',
  'the player review queue is private'
);
select has_column(
  'public',
  'team_achievements',
  'gender_division',
  'team achievement links carry the public gender division'
);
select has_column(
  'public',
  'player_achievements',
  'gender_division',
  'player achievement links carry the public gender division'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'series_category_data_profiles_category_id_idx'
  ),
  'the profile category foreign key is indexed'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'competitions_data_profile_validated_by_idx'
  ),
  'the competition validator foreign key is indexed'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'competitions_data_profile_identity_idx'
  ),
  'the complete competition data-profile foreign key is indexed'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'competitions_gender_review_queue_idx'
  ),
  'the competition review queue uses a partial index'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'private'
      and indexname = 'player_private_sex_review_queue_idx'
  ),
  'the private eligibility queue uses a partial index'
);
select has_function(
  'public',
  'admin_review_competition_gender',
  array['bigint', 'text'],
  'competition gender review is an AAL2 RPC'
);
select has_function(
  'public',
  'admin_create_series_category_data_profile',
  array['bigint', 'bigint', 'text', 'text', 'text'],
  'profile creation is an AAL2 RPC'
);
select has_function(
  'public',
  'admin_activate_series_category_data_profile',
  array['bigint'],
  'profile activation is an AAL2 RPC'
);
select has_function(
  'public',
  'admin_assign_competition_data_profile',
  array['bigint', 'bigint'],
  'competition profile assignment is an AAL2 RPC'
);
select has_function(
  'public',
  'admin_set_player_sex',
  array['bigint', 'text', 'text'],
  'private player eligibility review is an AAL2 RPC'
);
select ok(
  (
    select 'security_invoker=true' = any(reloptions)
    from pg_class
    where oid = 'public.active_series_category_data_profiles'::regclass
  ),
  'the public active-profile facade executes as security invoker'
);

select ok(
  not has_table_privilege('anon', 'private.player_private', 'select'),
  'anonymous users cannot read private player data'
);
select ok(
  not has_table_privilege('anon', 'private.competition_gender_review_queue', 'select'),
  'anonymous users cannot read the competition review queue'
);
select ok(
  not has_table_privilege('anon', 'private.player_sex_review_queue', 'select'),
  'anonymous users cannot read the player review queue'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.admin_create_series_category_data_profile(bigint,bigint,text,text,text)',
    'execute'
  ),
  'anonymous users cannot create source profiles'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.admin_set_player_sex(bigint,text,text)',
    'execute'
  ),
  'anonymous users cannot review private player eligibility'
);

select is(
  (select count(*) from private.player_private where player_id = 9601),
  1::bigint,
  'new players automatically receive one private companion row'
);
select is(
  (select sex_review_required from private.player_private where player_id = 9601),
  true,
  'new private companion rows start in the eligibility review queue'
);
select is(
  (select count(*) from private.competition_gender_review_queue where competition_id = 9601),
  1::bigint,
  'unclassified historical competitions remain in the review queue'
);
select is(
  (
    select count(*)
    from public.competitions
    where series_id = 9601 and category_id = 9601 and year = 2025
  ),
  2::bigint,
  'male and female editions coexist in the same series, category and year'
);
select throws_ok(
  $$insert into public.competitions (
      series_id,
      category_id,
      year,
      display_name,
      gender_division,
      gender_division_review_required
    )
    values (9601, 9601, 2025, 'Duplicada Masculino', 'male', false)$$,
  '23505',
  'duplicate key value violates unique constraint "competitions_classified_context_uidx"',
  'the same classified edition identity cannot be duplicated'
);
select throws_ok(
  $$insert into public.competitions (
      series_id,
      category_id,
      year,
      display_name
    )
    values (9601, 9601, 2024, 'Duplicada sem revisão')$$,
  '23505',
  'duplicate key value violates unique constraint "competitions_unclassified_context_uidx"',
  'legacy unclassified identities remain unique during compatibility'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.admin_review_competition_gender(9604, 'male')$$,
  'BD401',
  'BDB_ADMIN_AAL2_REQUIRED',
  'a non-admin at aal2 cannot review edition gender'
);

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub',
    (select user_id from private.admin_accounts),
    'role',
    'authenticated',
    'aal',
    'aal1'
  )::text,
  true
);
set local role authenticated;
select throws_ok(
  $$select public.admin_create_series_category_data_profile(
      9601,
      9601,
      'male',
      'manual_scoresheet',
      null
    )$$,
  'BD401',
  'BDB_ADMIN_AAL2_REQUIRED',
  'the administrator at aal1 cannot create a profile'
);

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub',
    (select user_id from private.admin_accounts),
    'role',
    'authenticated',
    'aal',
    'aal2'
  )::text,
  true
);
set local role authenticated;

select lives_ok(
  $$select public.admin_review_competition_gender(9604, 'male')$$,
  'the AAL2 administrator reviews a historical competition without inference'
);
select is(
  (
    select gender_division || ':' || gender_division_review_required::text
    from public.competitions
    where id = 9604
  ),
  'male:false'::text,
  'review persists the selected gender and clears only that review flag'
);
select lives_ok(
  $$select public.admin_activate_series_category_data_profile(
      (
        public.admin_create_series_category_data_profile(
          9601,
          9601,
          'male',
          'manual_scoresheet',
          null
        )
      ).id
    )$$,
  'the first profile is created and activated atomically by AAL2 RPCs'
);
select is(
  (
    select count(*)
    from public.active_series_category_data_profiles
    where series_id = 9601
      and category_id = 9601
      and gender_division = 'male'
  ),
  1::bigint,
  'only one male profile is active for the combination'
);
select is(
  (
    select primary_source
    from public.active_series_category_data_profiles
    where series_id = 9601
      and category_id = 9601
      and gender_division = 'male'
  ),
  'manual_scoresheet'::text,
  'the active facade returns the explicit source selection'
);
select throws_ok(
  $$select public.admin_create_series_category_data_profile(
      9601,
      9601,
      'male',
      'fiba_boxscore',
      null
    )$$,
  'BD501',
  'BDB_DATA_PROFILE_REASON_REQUIRED',
  'a later profile version requires a change reason'
);
select lives_ok(
  $$select public.admin_assign_competition_data_profile(
      9602,
      (
        select id
        from public.active_series_category_data_profiles
        where series_id = 9601
          and category_id = 9601
          and gender_division = 'male'
      )
    )$$,
  'an edition accepts the active profile for the same context'
);
select ok(
  (
    select
      data_profile_id is not null and
      not data_profile_review_required and
      data_profile_validated_at is not null and
      data_profile_validated_by is not null
    from public.competitions
    where id = 9602
  ),
  'profile assignment records immutable validation metadata'
);
select throws_ok(
  $$select public.admin_assign_competition_data_profile(
      9603,
      (
        select id
        from public.active_series_category_data_profiles
        where series_id = 9601
          and category_id = 9601
          and gender_division = 'male'
      )
    )$$,
  'BD504',
  'BDB_DATA_PROFILE_CONTEXT_MISMATCH',
  'a female edition rejects a male data profile'
);
select lives_ok(
  $$select public.admin_activate_series_category_data_profile(
      (
        public.admin_create_series_category_data_profile(
          9601,
          9601,
          'male',
          'fiba_boxscore',
          'Alteração aprovada da fonte primária'
        )
      ).id
    )$$,
  'a justified later version supersedes the previous active profile'
);
select is(
  (
    select count(*)
    from public.active_series_category_data_profiles
    where series_id = 9601
      and category_id = 9601
      and gender_division = 'male'
  ),
  1::bigint,
  'activation preserves a single active version'
);

reset role;
select is(
  (
    select count(*)
    from public.series_category_data_profiles
    where series_id = 9601
      and category_id = 9601
      and gender_division = 'male'
      and status = 'superseded'
  ),
  1::bigint,
  'the former active profile remains as a superseded revision'
);
select throws_ok(
  $$update public.series_category_data_profiles
    set primary_source = 'manual_scoresheet'
    where series_id = 9601
      and category_id = 9601
      and gender_division = 'male'
      and status = 'active'$$,
  'BD502',
  'BDB_DATA_PROFILE_IMMUTABLE',
  'an active profile cannot be rewritten'
);

set local role authenticated;
select lives_ok(
  $$select * from public.admin_set_player_sex(
      9601,
      'male',
      'Revisão administrativa explícita'
    )$$,
  'the AAL2 administrator completes private eligibility data'
);

reset role;
select is(
  (select sex_review_required from private.player_private where player_id = 9601),
  false,
  'private eligibility leaves the review queue after explicit review'
);
select ok(
  (
    select
      not (metadata ? 'sex') and
      metadata::text not like '%male%' and
      metadata::text not like '%female%'
    from public.admin_mutation_audit
    where action = 'player_sex_reviewed' and entity_id = 9601
  ),
  'generic audit metadata never records the stored sex value'
);

set local role anon;
select is(
  (
    select count(*)
    from public.active_series_category_data_profiles
    where series_id = 9601 and category_id = 9601
  ),
  1::bigint,
  'anonymous readers see only the active public capability'
);
select is(
  (
    select primary_source
    from public.series_category_data_profiles
    where id = (select data_profile_id from public.competitions where id = 9602)
  ),
  'manual_scoresheet'::text,
  'a published edition keeps reading its linked superseded profile'
);
select throws_ok(
  $$select created_by from public.series_category_data_profiles limit 1$$,
  '42501',
  'permission denied for table series_category_data_profiles',
  'anonymous readers cannot select administrative actor identifiers'
);
select throws_ok(
  $$select sex from private.player_private where player_id = 9601$$,
  '42501',
  'permission denied for schema private',
  'anonymous readers cannot query the private sex value'
);

reset role;
select * from finish();
rollback;
