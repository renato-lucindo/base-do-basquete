begin;

create extension if not exists pgtap with schema extensions;
select plan(64);
set constraints all deferred;

insert into private.admin_accounts (user_id)
select '11111111-1111-4111-8111-111111111111'
where not exists (select 1 from private.admin_accounts);

insert into public.competition_series (id, name, slug)
overriding system value values (9921, 'Liga Autoridade', 'liga-autoridade');
insert into public.categories (id, name, slug)
overriding system value values (9921, 'Categoria Autoridade', 'categoria-autoridade');

insert into public.series_category_data_profiles (
  id,
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
overriding system value values
  (
    9921, 9921, 9921, 'male', 1, 'manual_scoresheet', 'active',
    (select user_id from private.admin_accounts),
    (select user_id from private.admin_accounts),
    now()
  ),
  (
    9922, 9921, 9921, 'female', 1, 'fiba_boxscore', 'active',
    (select user_id from private.admin_accounts),
    (select user_id from private.admin_accounts),
    now()
  );

insert into public.competitions (
  id,
  series_id,
  category_id,
  year,
  display_name,
  gender_division,
  gender_division_review_required,
  data_profile_id,
  data_profile_review_required,
  data_profile_validated_at,
  data_profile_validated_by
)
overriding system value values
  (
    9921, 9921, 9921, 2026, 'Liga Autoridade Masculina', 'male', false,
    9921, false, now(), (select user_id from private.admin_accounts)
  ),
  (
    9922, 9921, 9921, 2026, 'Liga Autoridade Feminina', 'female', false,
    9922, false, now(), (select user_id from private.admin_accounts)
  );

insert into public.games (id, competition_id, game_number, source)
overriding system value values
  (9921, 9921, 'AUTH-READY', 'seed'),
  (9922, 9921, 'AUTH-REVIEW', 'seed'),
  (9923, 9921, 'AUTH-RACE', 'seed'),
  (9924, 9922, 'AUTH-AWAIT', 'seed'),
  (9925, 9922, 'AUTH-CONFLICT', 'seed');

insert into storage.objects (id, bucket_id, name)
values (
  '99210000-0000-4000-8000-000000000001',
  'boxscore-pdfs',
  'tests/authority-fixture.pdf'
);

insert into public.game_data_submissions (
  id, game_id, submission_version, source_type, role, status, payload_hash,
  idempotency_key, reason, submitted_by, validated_by, validated_at
)
overriding system value values
  (
    99211, 9921, 1, 'manual_scoresheet', 'primary', 'active', repeat('1', 32),
    'authority-ready-manual', null, (select user_id from private.admin_accounts),
    (select user_id from private.admin_accounts), now()
  ),
  (
    99221, 9922, 1, 'manual_scoresheet', 'primary', 'review', repeat('2', 32),
    'authority-review-manual', null, (select user_id from private.admin_accounts),
    null, null
  ),
  (
    99231, 9923, 1, 'manual_scoresheet', 'primary', 'active', repeat('3', 32),
    'authority-race-manual', null, (select user_id from private.admin_accounts),
    (select user_id from private.admin_accounts), now()
  ),
  (
    99241, 9924, 1, 'manual_scoresheet', 'fallback', 'active', repeat('4', 32),
    'authority-await-manual', 'Aguardando a fonte FIBA primária',
    (select user_id from private.admin_accounts),
    (select user_id from private.admin_accounts), now()
  ),
  (
    99251, 9925, 1, 'manual_scoresheet', 'primary', 'active', repeat('5', 32),
    'authority-conflict-manual', null, (select user_id from private.admin_accounts),
    (select user_id from private.admin_accounts), now()
  );

insert into public.game_data_submissions (
  id, game_id, submission_version, source_type, role, status, parser_version,
  payload_hash, storage_object_id, idempotency_key, submitted_by,
  validated_by, validated_at
)
overriding system value values
  (
    99232, 9923, 1, 'fiba_boxscore', 'supplemental', 'active', 'fiba-genius-v2',
    repeat('6', 64), '99210000-0000-4000-8000-000000000001',
    'authority-race-fiba', (select user_id from private.admin_accounts),
    (select user_id from private.admin_accounts), now()
  ),
  (
    99252, 9925, 1, 'fiba_boxscore', 'primary', 'active', 'fiba-genius-v2',
    repeat('7', 64), '99210000-0000-4000-8000-000000000001',
    'authority-conflict-fiba', (select user_id from private.admin_accounts),
    (select user_id from private.admin_accounts), now()
  );

select has_table(
  'public',
  'game_data_source_capabilities',
  'the closed source capability matrix exists'
);
select has_table(
  'public',
  'game_data_domain_authority',
  'per-domain game authority exists'
);
select has_view(
  'public',
  'game_data_status',
  'administrative game-data state is derived through a view'
);
select has_pk(
  'public',
  'game_data_domain_authority',
  'one composite key enforces one authority per game and domain'
);
select has_fk(
  'public',
  'game_data_domain_authority',
  'authority rows are constrained by their game, submission and capability'
);
select ok(
  (
    select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'public.game_data_source_capabilities'::regclass
  ),
  'capability rows have enabled and forced RLS'
);
select ok(
  (
    select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'public.game_data_domain_authority'::regclass
  ),
  'authority rows have enabled and forced RLS'
);
select ok(
  (
    select 'security_invoker=true' = any(reloptions)
    from pg_class
    where oid = 'public.game_data_status'::regclass
  ),
  'the derived status view executes with invoker rights'
);
select has_function(
  'public',
  'admin_activate_game_data_authority',
  array['bigint', 'text', 'bigint', 'bigint', 'text'],
  'single-domain compare-and-swap activation RPC exists'
);
select has_function(
  'public',
  'admin_activate_game_data_authorities',
  array['bigint', 'bigint', 'text[]', 'bigint', 'text'],
  'atomic multi-domain activation RPC exists'
);
select is(
  (select count(*)::integer from public.game_data_source_capabilities),
  14,
  'the first-season capability matrix contains only documented combinations'
);
select is(
  (
    select count(*)::integer
    from public.game_data_source_capabilities
    where source_type = 'legacy_seed'
  ),
  0,
  'legacy seed remains unclassified until the dedicated migration task'
);
select is(
  (
    select count(*)::integer
    from public.game_data_source_capabilities
    where source_type = 'manual_scoresheet' and domain = 'team_advanced'
  ),
  0,
  'manual scoresheets cannot claim undocumented advanced team data'
);
select is(
  (
    select count(*)::integer
    from public.game_data_source_capabilities
    where source_type = 'fiba_boxscore' and domain = 'player_foul_timeline'
  ),
  0,
  'FIBA imports cannot claim a foul timeline they do not provide'
);
select is(
  (
    select precision
    from public.game_data_source_capabilities
    where source_type = 'fiba_boxscore' and domain = 'player_foul_total'
  ),
  'game_total'::text,
  'FIBA foul authority is explicitly limited to the game total'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.game_data_submissions'::regclass
      and conname = 'game_data_submissions_id_game_source_unique'
      and contype = 'u'
  ),
  'submission identity is unique with its game and source for a contextual FK'
);
select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'game_data_domain_authority_submission_context_idx'
  ),
  'the contextual submission foreign key has a covering index'
);
select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'game_data_domain_authority_capability_idx'
  ),
  'the capability foreign key has a covering index'
);
select ok(
  has_table_privilege('authenticated', 'public.game_data_source_capabilities', 'SELECT')
    and not has_table_privilege('authenticated', 'public.game_data_source_capabilities', 'INSERT')
    and not has_table_privilege('authenticated', 'public.game_data_source_capabilities', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.game_data_source_capabilities', 'DELETE'),
  'authenticated clients receive read-only capability grants'
);
select ok(
  has_table_privilege('authenticated', 'public.game_data_domain_authority', 'SELECT')
    and not has_table_privilege('authenticated', 'public.game_data_domain_authority', 'INSERT')
    and not has_table_privilege('authenticated', 'public.game_data_domain_authority', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.game_data_domain_authority', 'DELETE'),
  'authenticated clients cannot bypass authority RPCs with direct writes'
);
select ok(
  not has_table_privilege('anon', 'public.game_data_status', 'SELECT'),
  'anonymous clients cannot read administrative data status'
);
select ok(
  has_table_privilege('authenticated', 'public.game_data_status', 'SELECT'),
  'authenticated clients can evaluate the protected status view'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.admin_activate_game_data_authority(bigint,text,bigint,bigint,text)',
    'EXECUTE'
  ),
  'anonymous clients cannot execute authority activation'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_activate_game_data_authority(bigint,text,bigint,bigint,text)',
    'EXECUTE'
  ),
  'authenticated clients reach the server-side AAL2 activation gate'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.admin_activate_game_data_authority(
      9923, 'official_result', 99231, null, null
    )$$,
  'BD401',
  'BDB_ADMIN_AAL2_REQUIRED',
  'a non-admin at aal2 cannot activate authority'
);

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (select user_id from private.admin_accounts),
    'role', 'authenticated',
    'aal', 'aal1'
  )::text,
  true
);
set local role authenticated;
select throws_ok(
  $$select public.admin_activate_game_data_authority(
      9923, 'official_result', 99231, null, null
    )$$,
  'BD401',
  'BDB_ADMIN_AAL2_REQUIRED',
  'the singleton administrator at aal1 cannot activate authority'
);

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (select user_id from private.admin_accounts),
    'role', 'authenticated',
    'aal', 'aal2'
  )::text,
  true
);
set local role authenticated;
select throws_ok(
  $$select public.admin_activate_game_data_authority(
      9922, 'official_result', 99221, null, null
    )$$,
  'BD703',
  'BDB_AUTHORITY_SUBMISSION_INACTIVE',
  'inactive submissions cannot become authoritative'
);
select throws_ok(
  $$select public.admin_activate_game_data_authority(
      9923, 'score_guess', 99231, null, null
    )$$,
  'BD701',
  'BDB_AUTHORITY_DOMAIN_INVALID',
  'unknown authority domains are rejected'
);
select throws_ok(
  $$select public.admin_activate_game_data_authority(
      9923, 'team_advanced', 99231, null, null
    )$$,
  'BD702',
  'BDB_SOURCE_DOMAIN_UNSUPPORTED',
  'a source cannot become authoritative for an unsupported domain'
);
select lives_ok(
  $$select public.admin_activate_game_data_authority(
      9923, 'official_result', 99231, null, null
    )$$,
  'the first compatible source wins an unclaimed domain'
);
select results_eq(
  $$select submission_id, source_type, revision
    from public.game_data_domain_authority
    where game_id = 9923 and domain = 'official_result'$$,
  $$values (99231::bigint, 'manual_scoresheet'::text, 1)$$,
  'the first winner is persisted with revision one'
);
select is(
  (
    select count(*)::integer
    from public.admin_mutation_audit
    where action = 'game_data_authority_activated' and entity_id = 9923
  ),
  1,
  'the first activation creates one essential audit event'
);
select lives_ok(
  $$select public.admin_activate_game_data_authority(
      9923, 'official_result', 99231, null, null
    )$$,
  'repeating the winning request is idempotent'
);
select is(
  (
    select revision
    from public.game_data_domain_authority
    where game_id = 9923 and domain = 'official_result'
  ),
  1,
  'idempotency does not create a synthetic revision'
);
select is(
  (
    select count(*)::integer
    from public.admin_mutation_audit
    where action = 'game_data_authority_activated' and entity_id = 9923
  ),
  1,
  'idempotency does not duplicate the audit event'
);
select throws_ok(
  $$select public.admin_activate_game_data_authority(
      9923, 'official_result', 99232, null, 'Revisão concorrente documentada'
    )$$,
  'BD704',
  'BDB_AUTHORITY_CONFLICT',
  'a stale concurrent request cannot overwrite the winner'
);
select is(
  (
    select submission_id
    from public.game_data_domain_authority
    where game_id = 9923 and domain = 'official_result'
  ),
  99231::bigint,
  'the first winner survives the stale concurrent request'
);
select throws_ok(
  $$select public.admin_activate_game_data_authority(
      9923, 'official_result', 99232, 99231, null
    )$$,
  'BD705',
  'BDB_AUTHORITY_REASON_REQUIRED',
  'an intentional authority switch requires a reason'
);
select lives_ok(
  $$select public.admin_activate_game_data_authority(
      9923, 'official_result', 99232, 99231,
      'Fonte FIBA validada substitui a súmula manual'
    )$$,
  'a reviewed compare-and-swap authority switch succeeds'
);
select results_eq(
  $$select submission_id, source_type, revision
    from public.game_data_domain_authority
    where game_id = 9923 and domain = 'official_result'$$,
  $$values (99232::bigint, 'fiba_boxscore'::text, 2)$$,
  'a switch records the new source and increments the revision exactly once'
);
select ok(
  (
    select metadata->>'previousSubmissionId' = '99231'
      and metadata->>'submissionId' = '99232'
      and metadata->>'reasonProvided' = 'true'
      and not (metadata ? 'reason')
    from public.admin_mutation_audit
    where action = 'game_data_authority_activated'
      and entity_id = 9923
    order by id desc
    limit 1
  ),
  'switch audit identifies both versions without storing the reason text'
);

reset role;
select throws_ok(
  $$update public.game_data_submissions
    set status = 'superseded', reason = 'Substituída depois da ativação'
    where id = 99232$$,
  'BD707',
  'BDB_SUBMISSION_HAS_ACTIVE_AUTHORITY',
  'an authoritative submission cannot be deactivated'
);

set local role authenticated;
select throws_ok(
  $$update public.game_data_domain_authority
    set submission_id = 99231,
        source_type = 'manual_scoresheet',
        activated_at = now() + interval '1 second'
    where game_id = 9923 and domain = 'official_result'$$,
  '42501',
  'permission denied for table game_data_domain_authority',
  'even the aal2 administrator cannot bypass revision checks by direct write'
);
select throws_ok(
  $$insert into public.game_data_domain_authority (
      game_id, domain, submission_id, source_type, activated_by
    ) values (
      9923, 'official_result', 99231, 'manual_scoresheet',
      (select user_id from private.admin_accounts)
    )$$,
  '42501',
  'permission denied for table game_data_domain_authority',
  'direct duplicate winners are denied before reaching the primary key'
);

select results_eq(
  $$select count(*)::integer
    from public.admin_activate_game_data_authorities(
      9921,
      99211,
      array[
        'official_result', 'period_scores', 'participation', 'player_scoring',
        'player_foul_total', 'player_foul_timeline', ' official_result '
      ],
      null,
      null
    )$$,
  $$values (6)$$,
  'bulk activation normalizes, de-duplicates and activates all manual domains'
);
select is(
  (
    select count(*)::integer
    from public.game_data_domain_authority
    where game_id = 9921
  ),
  6,
  'bulk activation creates exactly one authority per required manual domain'
);
select is(
  (select data_status from public.game_data_status where game_id = 9921),
  'ready'::text,
  'complete authoritative primary coverage derives a ready state'
);
select results_eq(
  $$select required_domain_count::integer, covered_required_domain_count::integer
    from public.game_data_status where game_id = 9921$$,
  $$values (6, 6)$$,
  'ready coverage reports all required domains as covered'
);
select is(
  (select missing_domains from public.game_data_status where game_id = 9921),
  array[]::text[],
  'ready coverage has no missing domains'
);
select throws_ok(
  $$select public.admin_activate_game_data_authorities(
      9924,
      99241,
      array['official_result', 'team_advanced'],
      null,
      null
    )$$,
  'BD702',
  'BDB_SOURCE_DOMAIN_UNSUPPORTED',
  'one unsupported domain aborts a bulk activation'
);
select is(
  (
    select count(*)::integer
    from public.game_data_domain_authority
    where game_id = 9924
  ),
  0,
  'the failed bulk activation rolls back domains processed earlier in the call'
);
select is(
  (select data_status from public.game_data_status where game_id = 9924),
  'awaiting_primary_source'::text,
  'a manual fallback derives awaiting-primary-source for a FIBA profile'
);
select is(
  (select data_status from public.game_data_status where game_id = 9922),
  'review'::text,
  'pending input without authority remains in review'
);
select results_eq(
  $$select covered_required_domain_count::integer, cardinality(missing_domains)
    from public.game_data_status where game_id = 9922$$,
  $$values (0, 6)$$,
  'review state preserves unavailable coverage as six missing domains, not zero data'
);
select is(
  (select data_status from public.game_data_status where game_id = 9925),
  'conflict'::text,
  'two competing active primaries derive a conflict state'
);
select is(
  (select active_submission_count::integer from public.game_data_status where game_id = 9925),
  2,
  'conflict state exposes both active candidates for review'
);
select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'games'
      and column_name = 'data_status'
  ),
  'derived data status is never persisted on games'
);
select is(
  (select count(*)::integer from public.game_data_source_capabilities),
  14,
  'the aal2 administrator can read the protected capability matrix'
);
select is(
  (select count(*)::integer from public.game_data_domain_authority),
  7,
  'the aal2 administrator can read all authorities created by the test'
);
select is(
  (select count(*)::integer from public.game_data_status where game_id between 9921 and 9925),
  5,
  'the aal2 administrator can read each derived fixture state'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select is(
  (select count(*)::integer from public.game_data_source_capabilities),
  0,
  'a non-admin at aal2 cannot read capability metadata'
);
select is(
  (select count(*)::integer from public.game_data_domain_authority),
  0,
  'a non-admin at aal2 cannot read authority metadata'
);
select is(
  (select count(*)::integer from public.game_data_status),
  0,
  'a non-admin at aal2 cannot read derived administrative status'
);

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (select user_id from private.admin_accounts),
    'role', 'authenticated',
    'aal', 'aal1'
  )::text,
  true
);
set local role authenticated;
select is(
  (select count(*)::integer from public.game_data_status),
  0,
  'the singleton administrator at aal1 cannot read derived status'
);

reset role;
select * from finish();
rollback;
