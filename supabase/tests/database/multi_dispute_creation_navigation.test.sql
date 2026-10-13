begin;
\ir ../helpers/final_profile_fixtures.inc
create extension if not exists pgtap with schema extensions;
select plan(28);

select ok(
  pg_get_constraintdef(
    (
      select constraint_item.oid
      from pg_constraint constraint_item
      where constraint_item.conname = 'admin_mutation_audit_action_check'
        and constraint_item.conrelid = 'public.admin_mutation_audit'::regclass
    )
  ) like '%competition_season_navigation_configured%',
  'closed audit vocabulary accepts the edition navigation action'
);

insert into auth.users(id)
values ('11111111-1111-4111-8111-111111111111')
on conflict do nothing;
insert into private.admin_accounts(user_id)
select '11111111-1111-4111-8111-111111111111'
where not exists(select 1 from private.admin_accounts);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',(select user_id from private.admin_accounts limit 1),
    'role','authenticated',
    'aal','aal2'
  )::text,
  true
);

create temporary table batch_context(request_id uuid,input jsonb,result jsonb);
insert into batch_context values(
  gen_random_uuid(),
  jsonb_build_object(
    'seriesId',null,
    'championshipName','PR3 batch workflow',
    'seasonId',null,
    'year',2026,
    'description','Duas disputas independentes',
    'navigationOrder','division_category',
    'disputes',jsonb_build_array(
      jsonb_build_object(
        'categoryKind','adult','categoryAge',null,'gender','male',
        'startsOn','2026-03-01','endsOn','2026-05-31',
        'divisionMode','none','divisionValueId',null,
        'divisionTypeName',null,'divisionValueName',null,
        'source','manual_scoresheet','preset','single_group','entryCount',4,
        'expectedProfileId',null,'reason',null
      ),
      jsonb_build_object(
        'categoryKind','base','categoryAge',17,'gender','female',
        'startsOn','2026-04-01','endsOn','2026-06-30',
        'divisionMode','new','divisionValueId',null,
        'divisionTypeName','Série','divisionValueName','Ouro Norte',
        'source','manual_scoresheet','preset','single_elimination','entryCount',8,
        'expectedProfileId',null,'reason',null
      )
    ),
    'reviewed',true
  ),
  null
);
grant select,update on batch_context to authenticated;

set local role authenticated;
select lives_ok(
  $$update batch_context set result=public.admin_create_competition_edition_batch(request_id,input)$$,
  'creates the initial multi-dispute batch atomically'
);
select is(
  public.admin_create_competition_edition_batch(request_id,input),
  result,
  'exact retry returns the original batch result'
) from batch_context;
select throws_ok(
  $$select public.admin_create_competition_edition_batch(request_id,input || '{"navigationOrder":"category_division"}') from batch_context$$,
  'BD409','BDB_IDEMPOTENCY_CONFLICT','divergent retry is rejected'
);
reset role;

select is(
  (select jsonb_array_length(result->'competitionIds') from batch_context),
  2,
  'result exposes both competition ids'
);
select is(
  (select count(*) from public.competitions c join batch_context x on c.season_id=(x.result->>'seasonId')::bigint),
  2::bigint,
  'two disputes share the new edition'
);
select is(
  (select dispute_navigation_order from public.competition_seasons s join batch_context x on s.id=(x.result->>'seasonId')::bigint),
  'division_category',
  'edition stores the configured navigation hierarchy'
);
select is(
  (
    select count(*)
    from public.admin_mutation_audit audit
    join batch_context batch on audit.entity_id=(batch.result->>'seasonId')::bigint
    where audit.action='competition_season_navigation_configured'
      and audit.entity_type='competition_season'
      and audit.metadata->>'disputeNavigationOrder'='division_category'
  ),
  1::bigint,
  'navigation preference is recorded in the admin audit trail'
);
select is(
  (select count(*) from public.competitions c join batch_context x on c.season_id=(x.result->>'seasonId')::bigint where c.gender_division='male'),
  1::bigint,
  'male dispute is independent'
);
select is(
  (select count(*) from public.competitions c join batch_context x on c.season_id=(x.result->>'seasonId')::bigint where c.gender_division='female'),
  1::bigint,
  'female dispute is independent'
);
select ok(
  (select count(*)=1 from public.competitions c join batch_context x on c.season_id=(x.result->>'seasonId')::bigint where c.display_name='PR3 batch workflow'),
  'Adulto stays visually redundant in the dispute name'
);
select ok(
  (select count(*)=1 from public.competitions c join batch_context x on c.season_id=(x.result->>'seasonId')::bigint where c.display_name='PR3 batch workflow - Sub-17 · Série Ouro Norte'),
  'category and division remain explicit on the second dispute'
);
select is(
  (select count(*) from public.competition_entries e join batch_context x on e.competition_id=(x.result->'competitionIds'->>0)::bigint),
  4::bigint,
  'first dispute keeps its own capacity'
);
select is(
  (select count(*) from public.competition_entries e join batch_context x on e.competition_id=(x.result->'competitionIds'->>1)::bigint),
  8::bigint,
  'second dispute keeps its own capacity'
);
select is(
  (select count(*) from private.edition_batch_creation_requests r join batch_context x on r.request_id=x.request_id),
  1::bigint,
  'outer batch ledger records one idempotent request'
);

create temporary table shared_division_batch(request_id uuid,input jsonb,result jsonb);
insert into shared_division_batch values(
  gen_random_uuid(),
  jsonb_build_object(
    'seriesId',null,
    'championshipName','PR3 shared division batch',
    'seasonId',null,
    'year',2026,
    'description',null,
    'navigationOrder','category_division',
    'disputes',jsonb_build_array(
      jsonb_build_object(
        'categoryKind','base','categoryAge',15,'gender','male',
        'startsOn',null,'endsOn',null,
        'divisionMode','new','divisionValueId',null,
        'divisionTypeName','Série','divisionValueName','Ouro',
        'source','manual_scoresheet','preset','single_group','entryCount',4,
        'expectedProfileId',null,'reason',null
      ),
      jsonb_build_object(
        'categoryKind','base','categoryAge',17,'gender','female',
        'startsOn',null,'endsOn',null,
        'divisionMode','new','divisionValueId',null,
        'divisionTypeName','Serie','divisionValueName','ouro',
        'source','manual_scoresheet','preset','single_group','entryCount',4,
        'expectedProfileId',null,'reason',null
      )
    ),
    'reviewed',true
  ),
  null
);
grant select,update on shared_division_batch to authenticated;

set local role authenticated;
select lives_ok(
  $$update shared_division_batch set result=public.admin_create_competition_edition_batch(request_id,input)$$,
  'reuses a newly created division across disputes in the same batch'
);
reset role;
select is(
  (
    select count(distinct competition.competitive_division_value_id)
    from public.competitions competition
    join shared_division_batch batch
      on competition.season_id=(batch.result->>'seasonId')::bigint
  ),
  1::bigint,
  'shared division disputes point to the same division value'
);
select is(
  (
    select count(*)
    from public.competition_competitive_division_values division_value
    join shared_division_batch batch
      on division_value.season_id=(batch.result->>'seasonId')::bigint
  ),
  1::bigint,
  'shared division is created only once'
);

set local role authenticated;
select throws_ok(
  $$select public.admin_create_competition_edition_batch(
    gen_random_uuid(),
    jsonb_build_object(
      'seriesId',null,'championshipName','PR3 rollback batch','seasonId',null,'year',2026,
      'description',null,'navigationOrder','category_division',
      'disputes',jsonb_build_array(
        jsonb_build_object(
          'categoryKind','adult','categoryAge',null,'gender','male','startsOn',null,'endsOn',null,
          'divisionMode','none','divisionValueId',null,'divisionTypeName',null,'divisionValueName',null,
          'source','manual_scoresheet','preset','single_group','entryCount',4,'expectedProfileId',null,'reason',null
        ),
        jsonb_build_object(
          'categoryKind','base','categoryAge',15,'gender','female','startsOn',null,'endsOn',null,
          'divisionMode','none','divisionValueId',null,'divisionTypeName',null,'divisionValueName',null,
          'source','manual_scoresheet','preset','single_group','entryCount',1,'expectedProfileId',null,'reason',null
        )
      ),
      'reviewed',true
    )
  )$$,
  'BR002','BDB_PRESET_CAPACITY_INVALID','invalid second dispute rejects the whole batch'
);
reset role;
select is(
  (select count(*) from public.competition_series where slug='pr3-rollback-batch'),
  0::bigint,
  'failed batch rolls back the new championship'
);
select is(
  (select count(*) from public.competition_seasons s join public.competition_series series on series.id=s.series_id where series.slug='pr3-rollback-batch'),
  0::bigint,
  'failed batch rolls back the new edition'
);
select is(
  (select count(*) from public.competitions c join public.competition_series series on series.id=c.series_id where series.slug='pr3-rollback-batch'),
  0::bigint,
  'failed batch leaves no partial dispute'
);

select ok(
  not has_table_privilege('authenticated','private.edition_batch_creation_requests','SELECT'),
  'batch ledger is private'
);
select ok(
  not has_function_privilege('anon','public.admin_create_competition_edition_batch(uuid,jsonb)','EXECUTE'),
  'anonymous cannot execute the batch RPC'
);
select ok(
  not has_function_privilege('authenticated','private.create_edition_workflow_batch(uuid,jsonb)','EXECUTE'),
  'private batch implementation is inaccessible'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',(select user_id from private.admin_accounts limit 1),
    'role','authenticated','aal','aal1'
  )::text,
  true
);
set local role authenticated;
select throws_ok(
  $$select public.admin_create_competition_edition_batch(gen_random_uuid(),'{}')$$,
  'BD401','BDB_ADMIN_AAL2_REQUIRED','AAL1 is denied'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.admin_create_competition_edition_batch(gen_random_uuid(),'{}')$$,
  'BD401','BDB_ADMIN_AAL2_REQUIRED','non-admin AAL2 is denied'
);
reset role;

select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid='private.edition_batch_creation_requests'::regclass),
  'batch ledger RLS is enabled and forced'
);

select * from finish();
rollback;