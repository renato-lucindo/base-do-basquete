begin;
\ir ../helpers/final_profile_fixtures.inc
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111') on conflict do nothing;
insert into private.admin_accounts(user_id)
select '11111111-1111-4111-8111-111111111111' where not exists(select 1 from private.admin_accounts);
select set_config('request.jwt.claims',jsonb_build_object(
  'sub',(select user_id from private.admin_accounts limit 1),'role','authenticated','aal','aal2'
)::text,true);

create temporary table profile_batch(request_id uuid,input jsonb,result jsonb);
insert into profile_batch values(gen_random_uuid(),'{
  "seriesId":null,"championshipName":"PR73 shared profile","seasonId":null,"year":2026,
  "description":null,"navigationOrder":"category_division","reviewed":true,
  "disputes":[
    {"categoryKind":"adult","categoryAge":null,"gender":"male","startsOn":null,"endsOn":null,
     "divisionMode":"new","divisionValueId":null,"divisionTypeName":"Serie","divisionValueName":"Ouro",
     "source":"manual_scoresheet","preset":"single_group","entryCount":4,"expectedProfileId":null,"reason":null},
    {"categoryKind":"adult","categoryAge":null,"gender":"male","startsOn":null,"endsOn":null,
     "divisionMode":"new","divisionValueId":null,"divisionTypeName":"Serie","divisionValueName":"Prata",
     "source":"manual_scoresheet","preset":"single_group","entryCount":4,"expectedProfileId":null,"reason":null}
  ]
}'::jsonb,null);
grant select,update on profile_batch to authenticated;

set local role authenticated;
select lives_ok(
  $$update profile_batch set result=public.admin_create_competition_edition_batch(request_id,input)$$,
  'same category and gender can share a newly created profile across two divisions'
);
reset role;
select is((select count(*) from public.competitions c join profile_batch b
  on c.season_id=(b.result->>'seasonId')::bigint),2::bigint,'both divisions persist');
select is((select count(distinct c.data_profile_id) from public.competitions c join profile_batch b
  on c.season_id=(b.result->>'seasonId')::bigint),1::bigint,'both disputes reference the same profile');
select is((select count(*) from public.competition_competitive_division_values d join profile_batch b
  on d.season_id=(b.result->>'seasonId')::bigint),2::bigint,'Ouro and Prata remain independent values');
select is((select count(*) from public.series_category_data_profiles p
  join public.competition_seasons s on s.series_id=p.series_id join profile_batch b
  on s.id=(b.result->>'seasonId')::bigint where p.status='active' and p.primary_source='manual_scoresheet'),
  1::bigint,'only one active profile is created');
set local role authenticated;
select is(public.admin_create_competition_edition_batch(request_id,input),result,
  'replay keeps the original result despite the now active profile') from profile_batch;
reset role;
select ok((select r.input->'disputes'->1->'expectedProfileId'='null'::jsonb
  from private.edition_batch_creation_requests r join profile_batch b on r.request_id=b.request_id),
  'outer ledger preserves the original caller expectation');

set local role authenticated;
select throws_ok($$select public.admin_create_competition_edition_batch(gen_random_uuid(),
  jsonb_set(jsonb_set(input,'{championshipName}','"PR73 divergent profile"'),
    '{disputes,1,expectedProfileId}','999999')) from profile_batch$$,
  'BR012','BDB_PROFILE_CHANGED_RELOAD','divergent expectation inside the batch is not overwritten');
reset role;
select is((select count(*) from public.competition_series where name='PR73 divergent profile'),
  0::bigint,'divergent expectation rolls back the whole championship');

create temporary table stale_profile_input(input jsonb);
insert into stale_profile_input select input || jsonb_build_object(
  'seriesId',s.series_id,'championshipName',null,'year',2025)
  from profile_batch b join public.competition_seasons s on s.id=(b.result->>'seasonId')::bigint;
grant select on stale_profile_input to authenticated;
set local role authenticated;
select throws_ok($$select public.admin_create_competition_edition_batch(gen_random_uuid(),input)
  from stale_profile_input$$,'BR012','BDB_PROFILE_CHANGED_RELOAD',
  'an external active profile still requires the reviewed expectation');
reset role;
select is((select count(*) from public.competition_seasons s join profile_batch b
  on s.series_id=(select series_id from public.competition_seasons where id=(b.result->>'seasonId')::bigint)
  where s.year=2025),0::bigint,'stale external expectation leaves no new edition');

update stale_profile_input target set input=jsonb_set(target.input || '{"year":2024}',
  '{disputes,0,expectedProfileId}',to_jsonb(c.data_profile_id))
  from public.competitions c,profile_batch b where c.id=(b.result->>'competitionId')::bigint;
set local role authenticated;
select throws_ok($$select public.admin_create_competition_edition_batch(gen_random_uuid(),input)
  from stale_profile_input$$,'BR012','BDB_PROFILE_CHANGED_RELOAD',
  'a null expectation cannot bypass a non-null initial expectation of this context');
reset role;
select is((select count(*) from public.competition_seasons s join profile_batch b
  on s.series_id=(select series_id from public.competition_seasons where id=(b.result->>'seasonId')::bigint)
  where s.year=2024),0::bigint,'later stale expectation rolls back all disputes');
select is((select count(*) from private.edition_batch_creation_requests r join profile_batch b
  on r.request_id=b.request_id),1::bigint,'one ledger remains after replay and rejected batches');
set local role authenticated;
select throws_ok($$select public.admin_create_competition_edition_batch(gen_random_uuid(),
  jsonb_set(jsonb_set(input,'{championshipName}','"PR73 source review"'),
    '{disputes,1,source}','"fiba_boxscore"')) from profile_batch$$,
  'BR013','BDB_SOURCE_REVIEW_REQUIRED','intra-batch profile reuse does not waive source-change justification');
reset role;
select is((select count(*) from public.competition_series where name='PR73 source review'),
  0::bigint,'unreviewed source change rolls back the whole championship');
select * from finish();
rollback;
