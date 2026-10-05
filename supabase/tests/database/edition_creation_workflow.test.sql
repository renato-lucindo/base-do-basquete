begin;
\ir ../helpers/final_profile_fixtures.inc
create extension if not exists pgtap with schema extensions;
select plan(43);
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111') on conflict do nothing;
insert into private.admin_accounts(user_id)
select '11111111-1111-4111-8111-111111111111' where not exists(select 1 from private.admin_accounts);
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from private.admin_accounts limit 1),
  'role','authenticated','aal','aal2')::text,true);
create temporary table workflow_context(request_id uuid,input jsonb,result jsonb);
insert into workflow_context values(gen_random_uuid(),jsonb_build_object(
  'seriesId',null,'championshipName','RED workflow','seasonId',null,'categoryKind','adult','categoryAge',null,
  'year',2026,'gender','male','description',null,'startsOn',null,'endsOn',null,
  'divisionMode','none','divisionValueId',null,'divisionTypeName',null,'divisionValueName',null,
  'source','manual_scoresheet','preset','single_group','entryCount',4,'expectedProfileId',null,'reason',null,'reviewed',true
),null);
grant select,update on workflow_context to authenticated;
set local role authenticated;
select lives_ok($$update workflow_context set result=public.admin_create_competition_edition(request_id,input)$$,'complete edition creation');
select is(public.admin_create_competition_edition(request_id,input),result,'exact retry returns both original IDs') from workflow_context;
select throws_ok($$select public.admin_create_competition_edition(request_id,input || '{"categoryKind":"base","categoryAge":17}') from workflow_context$$,
  'BD409','BDB_IDEMPOTENCY_CONFLICT','divergent retry blocked');
reset role;
select is((select c.display_name from public.competitions c join workflow_context x on c.id=(x.result->>'competitionId')::bigint),'RED workflow','Adulto omitted from name');
select ok((select c.status='draft' and c.published_at is null and c.season_id=(x.result->>'seasonId')::bigint
  and cat.age_kind='adult' and cat.age_value is null and c.data_profile_id is not null
  from workflow_context x join public.competitions c on c.id=(x.result->>'competitionId')::bigint
  join public.categories cat on cat.id=c.category_id),'private complete authoritative context');
select is((select count(*) from public.games g join workflow_context x on g.competition_id=(x.result->>'competitionId')::bigint),0::bigint,'no fake games');
select is((select count(*) from public.competition_entries e join workflow_context x on e.competition_id=(x.result->>'competitionId')::bigint),4::bigint,'four independent slots');
select is((select count(*) from private.edition_creation_requests r join workflow_context x on r.request_id=x.request_id),1::bigint,'one outer ledger');
select is((select count(*) from public.admin_mutation_audit a join workflow_context x on a.entity_id=(x.result->>'seasonId')::bigint
  where a.action='edition_workflow_created'),1::bigint,'one outer audit despite retry');
select ok((select (a.metadata->>'createdChampionship')::boolean from public.admin_mutation_audit a join workflow_context x
  on a.entity_id=(x.result->>'seasonId')::bigint where a.action='edition_workflow_created'),'new championship creation is audited');

create function pg_temp.workflow_add_input() returns jsonb language sql as $$
  select input || jsonb_build_object('seriesId',null,'championshipName',null,'seasonId',(result->>'seasonId')::bigint,
    'categoryKind','base','categoryAge',17) from workflow_context;
$$;
grant execute on function pg_temp.workflow_add_input() to authenticated;
set local role authenticated;
select lives_ok($$select public.admin_add_competition_dispute(gen_random_uuid(),pg_temp.workflow_add_input())$$,'add Sub-17 to same edition');
select throws_ok($$select public.admin_add_competition_dispute(gen_random_uuid(),pg_temp.workflow_add_input())$$,
  'BD506','BDB_COMPETITION_CONTEXT_ALREADY_EXISTS','duplicate dispute blocked');
select throws_ok($$select public.admin_create_competition_edition(gen_random_uuid(),input || jsonb_build_object('championshipName',null,
  'seriesId',(select series_id from public.competition_seasons where id=(result->>'seasonId')::bigint))) from workflow_context$$,
  'BD506','BDB_COMPETITION_SEASON_CONFLICT','duplicate edition is not silently reused');
select lives_ok($$select public.admin_add_competition_dispute(gen_random_uuid(),pg_temp.workflow_add_input() ||
  '{"categoryKind":"master","categoryAge":55,"divisionMode":"new","divisionTypeName":"Série","divisionValueName":"Ouro"}')$$,
  'create Master with competitive division');
reset role;
select is((select count(*) from public.competitions c join workflow_context x on c.season_id=(x.result->>'seasonId')::bigint),3::bigint,'three disputes share one edition');
select ok((select count(*)=2 from public.competitions c join workflow_context x on c.season_id=(x.result->>'seasonId')::bigint
  where c.display_name in ('RED workflow - Sub-17','RED workflow - 55+ · Série Ouro')),'names derive category and division independently');
select is((select count(*) from public.categories where age_kind='base' and age_value=17),1::bigint,'canonical seed category is reused');
select is((select age_kind from public.categories where slug='fixture-fiba'),'legacy','unclassifiable fixture stays legacy');

set local role authenticated;
select throws_ok($$select public.admin_add_competition_dispute(gen_random_uuid(),pg_temp.workflow_add_input() || '{"categoryKind":"base","categoryAge":11}')$$,'BD501','BDB_EDITION_WORKFLOW_INPUT_INVALID','base lower bound');
select throws_ok($$select public.admin_add_competition_dispute(gen_random_uuid(),pg_temp.workflow_add_input() || '{"categoryAge":24}')$$,'BD501','BDB_EDITION_WORKFLOW_INPUT_INVALID','base upper bound');
select throws_ok($$select public.admin_add_competition_dispute(gen_random_uuid(),pg_temp.workflow_add_input() || '{"categoryAge":17.5}')$$,'BD501','BDB_EDITION_WORKFLOW_INPUT_INVALID','integer age');
select throws_ok($$select public.admin_add_competition_dispute(gen_random_uuid(),pg_temp.workflow_add_input() || '{"categoryKind":"master","categoryAge":38}')$$,'BD501','BDB_EDITION_WORKFLOW_INPUT_INVALID','Master step');
select throws_ok($$select public.admin_add_competition_dispute(gen_random_uuid(),pg_temp.workflow_add_input() || '{"categoryKind":"master","categoryAge":90}')$$,'BD501','BDB_EDITION_WORKFLOW_INPUT_INVALID','Master upper bound');
select throws_ok($$select public.admin_add_competition_dispute(gen_random_uuid(),pg_temp.workflow_add_input() || '{"categoryKind":"adult","categoryAge":30}')$$,'BD501','BDB_EDITION_WORKFLOW_INPUT_INVALID','adult has no age');
select throws_ok($$select public.admin_add_competition_dispute(gen_random_uuid(),pg_temp.workflow_add_input() || '{"gender":"female"}')$$,'BD409','BDB_EDITION_CONTEXT_STALE','inherited gender is authoritative');
select throws_ok($$select public.admin_create_competition_edition(gen_random_uuid(),input || '{"championshipName":"Rollback workflow","entryCount":1}') from workflow_context$$,'BR009','BDB_EDITION_INPUT_INVALID','invalid blueprint rolls back all writes');
reset role;
select is((select count(*) from public.competition_series where slug='rollback-workflow'),0::bigint,'new championship is rolled back');
select is((select count(*) from public.competition_seasons s join public.competition_series c on c.id=s.series_id where c.slug='rollback-workflow'),0::bigint,'new season is rolled back');
set local role authenticated;
select lives_ok($$select public.admin_add_competition_dispute(gen_random_uuid(),pg_temp.workflow_add_input() || '{"categoryAge":12}')$$,'base minimum accepted');
select lives_ok($$select public.admin_add_competition_dispute(gen_random_uuid(),pg_temp.workflow_add_input() || '{"categoryAge":23}')$$,'base maximum accepted');
select lives_ok($$select public.admin_add_competition_dispute(gen_random_uuid(),pg_temp.workflow_add_input() || '{"categoryKind":"master","categoryAge":30}')$$,'Master minimum accepted');
select lives_ok($$select public.admin_add_competition_dispute(gen_random_uuid(),pg_temp.workflow_add_input() || '{"categoryKind":"master","categoryAge":85}')$$,'Master maximum accepted');
select throws_ok($$select public.admin_create_competition_edition(gen_random_uuid(),input || '{"startsOn":"2026-02-30"}') from workflow_context$$,'BD501','BDB_EDITION_WORKFLOW_INPUT_INVALID','impossible dates rejected');
select throws_ok($$select public.admin_create_competition_edition(gen_random_uuid(),input || '{"displayName":"forged"}') from workflow_context$$,'BD501','BDB_EDITION_WORKFLOW_INPUT_INVALID','untrusted composed name rejected');
select throws_ok($$select public.admin_create_competition_edition(gen_random_uuid(),input || '{"reviewed":false}') from workflow_context$$,'BD501','BDB_EDITION_WORKFLOW_INPUT_INVALID','review required');
select throws_ok($$select public.admin_create_competition_edition(gen_random_uuid(),input) from workflow_context$$,'BD506','BDB_CHAMPIONSHIP_ALREADY_EXISTS','new championship collision is explicit');
reset role;
select ok(not has_table_privilege('authenticated','private.edition_creation_requests','SELECT'),'ledger is inaccessible');
select ok(not has_function_privilege('anon','public.admin_create_competition_edition(uuid,jsonb)','EXECUTE'),'anonymous cannot execute');
select ok(not has_function_privilege('authenticated','private.create_edition_workflow(uuid,jsonb,boolean)','EXECUTE'),'private implementation is inaccessible');
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from private.admin_accounts limit 1),'role','authenticated','aal','aal1')::text,true);
set local role authenticated;
select throws_ok($$select public.admin_create_competition_edition(gen_random_uuid(),'{}')$$,'BD401','BDB_ADMIN_AAL2_REQUIRED','AAL1 denied');
reset role;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select throws_ok($$select public.admin_add_competition_dispute(gen_random_uuid(),'{}')$$,'BD401','BDB_ADMIN_AAL2_REQUIRED','non-admin AAL2 denied');
reset role;
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='private.edition_creation_requests'::regclass),'ledger RLS enabled and forced');
select ok((select age_kind='base' and age_value=15 and name='Sub-15' from public.categories where slug='sub-15'),'canonical legacy classification preserves representation');
select * from finish();
rollback;
