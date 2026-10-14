begin;
\ir ../helpers/final_profile_fixtures.inc
create extension if not exists pgtap with schema extensions;
select no_plan();
set constraints all deferred;
select set_config('bdb.allow_internal_ingestion_game', 'on', true);

insert into auth.users(id)
values ('93600000-0000-4000-8000-000000000001')
on conflict do nothing;
insert into private.admin_accounts(user_id)
select '93600000-0000-4000-8000-000000000001'
where not exists(select 1 from private.admin_accounts);
insert into public.competition_series(id,name,slug)
overriding system value values (9360,'Liga PDF tardio teclado','liga-pdf-tardio-teclado');
insert into public.categories(id,name,slug)
overriding system value values (9360,'Categoria PDF tardio teclado','categoria-pdf-tardio-teclado');
select pg_temp.create_final_competition(
  9360,9360,9360,2026,'Liga FIBA tardio 2026','published',now(),'male','fiba_boxscore'
);
insert into public.teams(id,name,slug)
overriding system value values
  (9360,'Late PDF Casa','late-pdf-casa'),
  (9361,'Late PDF Fora','late-pdf-fora');
insert into public.players(id,full_name,slug)
overriding system value values
  (9360,'Late PDF Jogador Casa','late-pdf-jogador-casa'),
  (9361,'Late PDF Jogador Fora','late-pdf-jogador-fora');
insert into private.player_private(player_id,sex,sex_review_required)
values (9360,'male',false),(9361,'male',false);
insert into public.team_registrations(id,competition_id,team_id,status,confirmed_at)
overriding system value values
  (9360,9360,9360,'confirmed',now()),(9361,9360,9361,'confirmed',now());
insert into public.roster_entries(id,competition_id,registration_id,player_id,jersey_number,status)
overriding system value values
  (9360,9360,9360,9360,'10','active'),
  (9361,9360,9361,9361,'20','active');
insert into public.competition_ruleset_revisions(id,competition_id,revision_number,structure_kind,status)
overriding system value values (9360,9360,1,'regulated','active');
insert into public.competition_stages(id,competition_id,ruleset_revision_id,code,name,stage_order,structure_kind)
overriding system value values (9360,9360,9360,'regular','Regular',1,'regulated');
insert into public.competition_rounds(id,competition_id,stage_id,code,name,round_order,structure_kind)
overriding system value values (9360,9360,9360,'rodada_1','Rodada 1',1,'regulated');
insert into public.matchups(id,competition_id,round_id,home_registration_id,away_registration_id,matchup_order,structure_kind)
overriding system value values (93601,9360,9360,9360,9361,1,'regulated');
insert into public.games(id,competition_id,game_number,scheduled_at,venue,status,source,matchup_id,matchup_game_number)
overriding system value values
  (93601,9360,'FIBA-LATE-1','2026-08-20 18:00:00-03','Ginásio Tardio','scheduled','seed',93601,1);
insert into public.game_participants(game_id,competition_id,registration_id,side)
values (93601,9360,9360,'home'),(93601,9360,9361,'away');

create temp table late_keyboard_docs(name text primary key, document jsonb);
grant select on late_keyboard_docs to authenticated;
insert into late_keyboard_docs values('base','{
  "rulesVersion":"FIBA_2024","periods":4,
  "coachPlayer":{"home":null,"away":null},
  "roster":[
    {"rosterEntryId":9360,"registrationId":9360,"side":"home","jersey":"10","played":true},
    {"rosterEntryId":9361,"registrationId":9361,"side":"away","jersey":"20","played":true}
  ],
  "events":[{"id":"93600000-0000-4000-8000-000000000002","side":"home","period":1,"target":"10","code":"2"}]
}'::jsonb);
insert into late_keyboard_docs(name,document)
select cases.name, jsonb_set(base.document,'{events}',cases.events)
from late_keyboard_docs base
cross join (values
  ('after_five','[
    {"id":"93600000-0000-4000-8000-000000000011","side":"home","period":1,"target":"10","code":"P1"},
    {"id":"93600000-0000-4000-8000-000000000012","side":"home","period":1,"target":"10","code":"P1"},
    {"id":"93600000-0000-4000-8000-000000000013","side":"home","period":1,"target":"10","code":"P1"},
    {"id":"93600000-0000-4000-8000-000000000014","side":"home","period":1,"target":"10","code":"P1"},
    {"id":"93600000-0000-4000-8000-000000000015","side":"home","period":1,"target":"10","code":"P1"},
    {"id":"93600000-0000-4000-8000-000000000016","side":"home","period":2,"target":"10","code":"2"}
  ]'::jsonb),
  ('after_d','[
    {"id":"93600000-0000-4000-8000-000000000021","side":"home","period":1,"target":"10","code":"D2"},
    {"id":"93600000-0000-4000-8000-000000000022","side":"home","period":1,"target":"10","code":"1"}
  ]'::jsonb),
  ('after_gd','[
    {"id":"93600000-0000-4000-8000-000000000031","side":"home","period":1,"target":"10","code":"T1"},
    {"id":"93600000-0000-4000-8000-000000000032","side":"home","period":1,"target":"10","code":"T1"},
    {"id":"93600000-0000-4000-8000-000000000033","side":"home","period":2,"target":"10","code":"3"}
  ]'::jsonb),
  ('before_d','[
    {"id":"93600000-0000-4000-8000-000000000041","side":"home","period":1,"target":"10","code":"2"},
    {"id":"93600000-0000-4000-8000-000000000042","side":"home","period":1,"target":"10","code":"D2"}
  ]'::jsonb)
) as cases(name,events)
where base.name='base';
create temp table late_import_ids(name text primary key, id bigint);
grant select on late_import_ids to authenticated;
with inserted as (
  insert into public.boxscore_imports(
    competition_id,sha256,storage_path,parser_version,status,created_by
  )
  values (9360,repeat('f',64),'9360/'||repeat('f',64)||'.pdf',
          'fiba-genius-v1','review',
          (select user_id from private.admin_accounts limit 1))
  returning id
)
insert into late_import_ids(name,id)
select 'fiba', id from inserted;
with inserted as (
  insert into public.boxscore_imports(
    competition_id,sha256,storage_path,parser_version,status,created_by
  )
  values (9360,repeat('e',64),'9360/'||repeat('e',64)||'.pdf',
          'basketball-site-v1','review',
          (select user_id from private.admin_accounts limit 1))
  returning id
)
insert into late_import_ids(name,id)
select 'other', id from inserted;

select ok(
  not has_function_privilege('anon',
    'private.admin_commit_supported_boxscore_import_impl(bigint,jsonb)','execute'),
  'anonymous cannot invoke the protected PDF dispatcher'
);
select ok(
  not has_function_privilege('authenticated',
    'private.admin_stage_late_fiba_candidate(bigint,jsonb)','execute'),
  'client cannot bypass the dispatcher by invoking late FIBA staging directly'
);
select set_config('request.jwt.claims',
  json_build_object('sub',(select user_id from private.admin_accounts limit 1),
    'role','authenticated','aal','aal1')::text,true);
set local role authenticated;
select throws_ok(
  $$select private.admin_commit_supported_boxscore_import_impl(
    (select id from late_import_ids where name='fiba'), '{"gameId":93601}'::jsonb)$$,
  'BD401','BDB_ADMIN_AAL2_REQUIRED','AAL1 cannot stage late PDF or acquire authority'
);
reset role;
select set_config('request.jwt.claims',
  json_build_object('sub',(select user_id from private.admin_accounts limit 1),
    'role','authenticated','aal','aal2')::text,true);
set local role authenticated;
select is(public.admin_save_keyboard_scoresheet(
  93601,'93600000-0000-4000-8000-000000000003',0,
  (select document from late_keyboard_docs where name='base')
)->>'version','1','emergency keyboard draft is reserved');
select throws_ok(
  $$select public.admin_save_keyboard_scoresheet(
    93601,'93600000-0000-4000-8000-000000000011',1,
    (select document from late_keyboard_docs where name='after_five'))$$,
  'BD902','KEYBOARD_SCORE_AFTER_EXCLUSION','fifth foul forbids later scoring even during draft edit'
);
select throws_ok(
  $$select public.admin_save_keyboard_scoresheet(
    93601,'93600000-0000-4000-8000-000000000021',1,
    (select document from late_keyboard_docs where name='after_d'))$$,
  'BD902','KEYBOARD_SCORE_AFTER_EXCLUSION','direct D forbids subsequent free throw'
);
select throws_ok(
  $$select public.admin_save_keyboard_scoresheet(
    93601,'93600000-0000-4000-8000-000000000031',1,
    (select document from late_keyboard_docs where name='after_gd'))$$,
  'BD902','KEYBOARD_SCORE_AFTER_EXCLUSION','accumulated GD forbids subsequent three-point basket'
);
select is((select count(*) from public.keyboard_scoresheet_revisions where game_id=93601),
  1::bigint,'invalid scoring creates no revision or partial projection');
select is(public.admin_save_keyboard_scoresheet(
  93601,'93600000-0000-4000-8000-000000000041',1,
  (select document from late_keyboard_docs where name='before_d')
)->>'version','2','score before disqualification remains valid after event reordering');
select throws_ok(
  $$select private.admin_commit_supported_boxscore_import_impl(
    (select id from late_import_ids where name='fiba'), '{"gameId":93601}'::jsonb)$$,
  'BD906','KEYBOARD_OTHER_SOURCE_ACTIVE','FIBA cannot bypass an unconfirmed draft'
);
select is(public.admin_save_keyboard_scoresheet(
  93601,'93600000-0000-4000-8000-000000000004',2,
  (select document from late_keyboard_docs where name='base'),true,
  'Recebimento oficial FIBA indisponível, lançamento emergencial por teclado'
)->>'confirmed','true','fallback confirmed with an auditable reason');
select is((select count(*) from public.game_data_domain_authority where game_id=93601),
  6::bigint,'confirmed manual fallback owns all six domains');
select throws_ok(
  $$select private.admin_commit_supported_boxscore_import_impl(
    (select id from late_import_ids where name='other'), '{"gameId":93601}'::jsonb)$$,
  'BD906','KEYBOARD_OTHER_SOURCE_ACTIVE','Basketball Site cannot impersonate an official FIBA late PDF'
);

-- Scope of this test: dispatch authorization, not the actual FIBA parser.
-- Stub the inner delegate transaction-locally; rollback restores the original.
reset role;
create or replace function private.admin_commit_boxscore_import_impl(
  p_import_id bigint, p_resolution jsonb
) returns bigint language sql security definer set search_path='' as $stub$
  select (p_resolution->>'gameId')::bigint
$stub$;
set local role authenticated;
select is(private.admin_commit_supported_boxscore_import_impl(
  (select id from late_import_ids where name='fiba'),
  '{"gameId":93601}'::jsonb),93601::bigint,
  'confirmed matching FIBA PDF dispatches to preexisting comparison path');
select is(private.admin_commit_supported_boxscore_import_impl(
  (select id from late_import_ids where name='fiba'),
  '{"gameId":93601}'::jsonb),93601::bigint,
  'dispatcher retries remain eligible without replacing authority');
select is((select count(*) from public.game_data_domain_authority where game_id=93601),
  6::bigint,'dispatch does not promote the candidate over the six keyboard authorities');
select is((select count(*) from public.keyboard_scoresheet_revisions where game_id=93601),
  3::bigint,'both drafts and confirmed keyboard receipts remain intact');

-- A corrected fallback must be able to supersede its own confirmed receipt
-- while keeping immutable history and six active authorities.
select throws_ok(
  $$update public.game_data_submissions set status='superseded'
    where id=(select submission_id from public.keyboard_scoresheets where game_id=93601)$$,
  'BD707','BDB_SUBMISSION_HAS_ACTIVE_AUTHORITY',
  'unscoped manual authority deactivation remains forbidden'
);
select is(public.admin_save_keyboard_scoresheet(
  93601,'93600000-0000-4000-8000-000000000051',3,
  (select document from late_keyboard_docs where name='base'),true,
  'Revisão da súmula confirmada após reconferência das cestas'
)->>'version','4','authorized fallback revision succeeds');
select is((select count(*) from public.game_data_submissions
  where game_id=93601 and status='superseded' and role='fallback'),
  1::bigint,'original fallback evidence remains superseded rather than deleted');
select is((select count(*) from public.game_data_domain_authority
  where game_id=93601 and submission_id=(select submission_id
    from public.keyboard_scoresheets where game_id=93601)),
  6::bigint,'revised fallback owns exactly the six authoritative domains');
select is((select count(*) from public.keyboard_scoresheet_revisions where game_id=93601),
  4::bigint,'all draft and confirmed revisions remain immutable');
select is(public.admin_save_keyboard_scoresheet(
  93601,'93600000-0000-4000-8000-000000000051',3,
  (select document from late_keyboard_docs where name='base'),true,
  'Revisão da súmula confirmada após reconferência das cestas'
)->>'version','4','idempotent retry never makes a second revision');

reset role;
select * from finish();
rollback;
