begin;

create extension if not exists pgtap with schema extensions;
select plan(39);
set constraints all deferred;

insert into private.admin_accounts (user_id)
select '11111111-1111-4111-8111-111111111111'
where not exists (select 1 from private.admin_accounts);

insert into public.competition_series (id, name, slug)
overriding system value values (9821, 'Liga Reconciliação', 'liga-reconciliacao');
insert into public.categories (id, name, slug)
overriding system value values (9821, 'Categoria Reconciliação', 'categoria-reconciliacao');
insert into public.competitions (
  id,
  series_id,
  category_id,
  year,
  display_name,
  gender_division,
  gender_division_review_required,
  status
)
overriding system value values
  (9821, 9821, 9821, 2023, 'Reconciliação 2023', null, true, 'draft'),
  (9822, 9821, 9821, 2024, 'Reconciliação Masculina 2024', 'male', false, 'draft'),
  (9823, 9821, 9821, 2025, 'Reconciliação Masculina 2025', 'male', false, 'draft');

insert into public.players (id, full_name, slug)
overriding system value values
  (9821, 'Atleta Reconciliação Um', 'atleta-reconciliacao-um'),
  (9822, 'Atleta Reconciliação Dois', 'atleta-reconciliacao-dois');

insert into public.games (
  id,
  competition_id,
  game_number,
  source,
  manual_idempotency_key,
  manual_payload_hash,
  created_by
)
overriding system value values
  (9821, 9821, 'SEED-9821', 'seed', null, null, null),
  (
    9822,
    9822,
    'MANUAL-9822',
    'manual',
    '98220000-0000-4000-8000-000000000001',
    '98229822982298229822982298229822',
    (select user_id from private.admin_accounts)
  ),
  (9823, 9823, 'BOX-9823', 'boxscore', null, null, null);

create temporary table classification_integrity_baseline
on commit drop
as
select private.build_classification_backfill_report() -> 'historicalIntegrity' as state;

create temporary table classification_audit_baseline
on commit drop
as
select count(*)::bigint as total from public.admin_mutation_audit;

select has_view(
  'private',
  'competition_classification_evidence',
  'classification uses a factual per-edition evidence view'
);
select has_view(
  'private',
  'competition_classification_review_queue',
  'pending editions have a private review queue'
);
select has_view(
  'private',
  'player_eligibility_review_queue',
  'pending players have a value-free private review queue'
);
select has_view(
  'private',
  'competition_data_profile_snapshots',
  'immutable per-edition profile snapshots are queryable privately'
);
select has_function(
  'public',
  'admin_get_classification_backfill_report',
  array[]::text[],
  'the singleton administrator has a reconciliation report RPC'
);
select ok(
  (
    select procedure.prosecdef
    from pg_proc procedure
    where procedure.oid = 'public.admin_get_classification_backfill_report()'::regprocedure
  ),
  'the report wrapper is security definer'
);
select ok(
  (
    select procedure.proconfig @> array['search_path=""']
    from pg_proc procedure
    where procedure.oid = 'public.admin_get_classification_backfill_report()'::regprocedure
  ),
  'the report wrapper fixes an empty search path'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.admin_get_classification_backfill_report()',
    'execute'
  ),
  'anonymous users cannot execute the report RPC'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_get_classification_backfill_report()',
    'execute'
  ),
  'authenticated users have only the grant needed for the AAL2 guard'
);
select ok(
  not has_table_privilege(
    'anon',
    'private.competition_classification_review_queue',
    'select'
  ),
  'anonymous users cannot read the private competition queue'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'private.player_eligibility_review_queue',
    'select'
  ),
  'authenticated users cannot bypass the protected player queue RPC'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'private.build_classification_backfill_report()',
    'execute'
  ),
  'authenticated users cannot execute the private report builder'
);

set local role anon;
select throws_ok(
  $$select public.admin_get_classification_backfill_report()$$,
  '42501',
  'permission denied for function admin_get_classification_backfill_report',
  'the anonymous role is denied before any report data is returned'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.admin_get_classification_backfill_report()$$,
  'BD401',
  'BDB_ADMIN_AAL2_REQUIRED',
  'a non-admin at aal2 cannot read classification data'
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
  $$select public.admin_get_classification_backfill_report()$$,
  'BD401',
  'BDB_ADMIN_AAL2_REQUIRED',
  'the singleton administrator at aal1 cannot read classification data'
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
  $$select public.admin_get_classification_backfill_report()$$,
  'the singleton administrator at aal2 reads the report'
);
select is(
  (public.admin_get_classification_backfill_report() ->> 'reportVersion')::integer,
  1,
  'the report contract is explicitly versioned'
);
select is(
  (
    select item ->> 'sourceEvidence'
    from jsonb_array_elements(
      public.admin_get_classification_backfill_report() -> 'classificationEvidence'
    ) item
    where (item ->> 'competitionId')::bigint = 9822
  ),
  'manual_only'::text,
  'manual-only evidence is factual and deterministic'
);
select is(
  (
    select item ->> 'sourceEvidence'
    from jsonb_array_elements(
      public.admin_get_classification_backfill_report() -> 'classificationEvidence'
    ) item
    where (item ->> 'competitionId')::bigint = 9823
  ),
  'boxscore_only'::text,
  'boxscore-only evidence is factual and deterministic'
);
select is(
  (
    select item ->> 'sourceEvidence'
    from jsonb_array_elements(
      public.admin_get_classification_backfill_report() -> 'classificationEvidence'
    ) item
    where (item ->> 'competitionId')::bigint = 9821
  ),
  'seed_only'::text,
  'seed history remains explicitly unresolved'
);
select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.admin_get_classification_backfill_report() #> '{queues,competitions}'
    ) item
    where (item ->> 'competitionId')::bigint = 9821
  ),
  'an unclassified edition remains in the report queue'
);
select ok(
  not (
    (
      select item
      from jsonb_array_elements(
        public.admin_get_classification_backfill_report() #> '{queues,players}'
      ) item
      where (item ->> 'playerId')::bigint = 9821
    ) ? 'sex'
  ),
  'the protected player queue never returns the private value'
);

reset role;
select is(
  (select sex from private.player_private where player_id = 9821),
  null::text,
  'reading the report never infers or writes player eligibility'
);
select is(
  (select gender_division from public.competitions where id = 9821),
  null::text,
  'reading source evidence never infers or writes gender division'
);
select is(
  (select count(*) from public.admin_mutation_audit),
  (select total from classification_audit_baseline),
  'reading the report does not create audit noise'
);

set local role authenticated;
select lives_ok(
  $$select public.admin_activate_series_category_data_profile(
      (
        public.admin_create_series_category_data_profile(
          9821,
          9821,
          'male',
          'manual_scoresheet',
          null
        )
      ).id
    )$$,
  'the explicit first source choice creates and activates version one'
);
select lives_ok(
  $$select public.admin_assign_competition_data_profile(
      9822,
      (
        select id
        from public.active_series_category_data_profiles
        where series_id = 9821
          and category_id = 9821
          and gender_division = 'male'
      )
    )$$,
  'the first edition links to its explicit immutable profile'
);
select lives_ok(
  $$select public.admin_activate_series_category_data_profile(
      (
        public.admin_create_series_category_data_profile(
          9821,
          9821,
          'male',
          'fiba_boxscore',
          'Fonte explicitamente revisada para a edição'
        )
      ).id
    )$$,
  'a divergent explicit source choice creates and activates version two'
);
select lives_ok(
  $$select public.admin_assign_competition_data_profile(
      9823,
      (
        select id
        from public.active_series_category_data_profiles
        where series_id = 9821
          and category_id = 9821
          and gender_division = 'male'
      )
    )$$,
  'the later edition links to the new immutable profile snapshot'
);

reset role;
select is(
  (
    select count(*)
    from private.competition_data_profile_snapshots
    where competition_id in (9822, 9823)
  ),
  2::bigint,
  'both editions retain independent profile links'
);
select is(
  (
    select primary_source || ':' || data_profile_status
    from private.competition_data_profile_snapshots
    where competition_id = 9822
  ),
  'manual_scoresheet:superseded'::text,
  'the historical edition keeps its superseded manual snapshot'
);
select is(
  (
    select primary_source || ':' || data_profile_status
    from private.competition_data_profile_snapshots
    where competition_id = 9823
  ),
  'fiba_boxscore:active'::text,
  'the later edition keeps the explicitly active boxscore snapshot'
);

set local role authenticated;
select is(
  jsonb_array_length(
    public.admin_get_classification_backfill_report() -> 'profileDivergences'
  ),
  1,
  'the report explains the one divergent source context'
);
select lives_ok(
  $$select * from public.admin_set_player_sex(
      9821,
      'male',
      'Classificação administrativa explicitamente confirmada'
    )$$,
  'an explicit private choice leaves the player queue through the existing RPC'
);
select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.admin_get_classification_backfill_report() #> '{queues,players}'
    ) item
    where (item ->> 'playerId')::bigint = 9821
  ),
  'the reviewed player leaves the queue without exposing the chosen value'
);
select is(
  public.admin_get_classification_backfill_report() ->> 'enforcementReady',
  'false'::text,
  'remaining explicit-review blockers keep enforcement disabled'
);

reset role;
select ok(
  (
    select
      not (metadata ? 'sex')
      and metadata::text not like '%male%'
      and metadata::text not like '%female%'
    from public.admin_mutation_audit
    where action = 'player_sex_reviewed' and entity_id = 9821
  ),
  'the eligibility audit records no private value'
);
select is(
  private.build_classification_backfill_report() -> 'historicalIntegrity',
  (select state from classification_integrity_baseline),
  'explicit classification preserves every reconciled historical checksum and count'
);
select ok(
  (
    private.build_classification_backfill_report()
      #>> '{blockers,competitionGenderPending}'
  )::bigint > 0
  and (
    private.build_classification_backfill_report()
      #>> '{blockers,competitionProfilePending}'
  )::bigint > 0
  and (
    private.build_classification_backfill_report()
      #>> '{blockers,playerEligibilityPending}'
  )::bigint > 0,
  'the report identifies every queue that still blocks enforcement'
);

select * from finish();
rollback;
