begin;
\ir ../helpers/final_profile_fixtures.inc
create extension if not exists pgtap with schema extensions;
select no_plan();
set constraints all deferred;
select set_config('bdb.allow_internal_ingestion_game','on',true);

insert into auth.users(id) values ('91111111-1111-4111-8111-111111111111') on conflict do nothing;
insert into private.admin_accounts(user_id)
select '91111111-1111-4111-8111-111111111111'
where not exists(select 1 from private.admin_accounts);
insert into public.competition_series(id,name,slug)
overriding system value values(9350,'Liga Fallback Keyboard','liga-fallback-keyboard');
insert into public.categories(id,name,slug)
overriding system value values(9350,'Categoria Fallback Keyboard','categoria-fallback-keyboard');
select pg_temp.create_final_competition(
  9350,9350,9350,2026,'Liga Fallback 2026','published',now(),'male','fiba_boxscore'
);
insert into public.teams(id,name,slug)
overriding system value values
  (9350,'Fallback Casa','fallback-casa'),(9351,'Fallback Fora','fallback-fora');
insert into public.players(id,full_name,slug)
overriding system value values
  (9350,'Jogador Fallback Casa','jogador-fallback-casa'),
  (9351,'Jogador Fallback Fora','jogador-fallback-fora');
insert into private.player_private(player_id,sex,sex_review_required)
values(9350,'male',false),(9351,'male',false);
insert into public.team_registrations(id,competition_id,team_id,status,confirmed_at)
overriding system value values
  (9350,9350,9350,'confirmed',now()),(9351,9350,9351,'confirmed',now());
insert into public.roster_entries(id,competition_id,registration_id,player_id,jersey_number,status)
overriding system value values
  (9350,9350,9350,9350,'10','active'),(9351,9350,9351,9351,'20','active');
insert into public.competition_ruleset_revisions(id,competition_id,revision_number,structure_kind,status)
overriding system value values(9350,9350,1,'regulated','active');
insert into public.competition_stages(id,competition_id,ruleset_revision_id,code,name,stage_order,structure_kind)
overriding system value values(9350,9350,9350,'regular','Regular',1,'regulated');
insert into public.competition_rounds(id,competition_id,stage_id,code,name,round_order,structure_kind)
overriding system value values(9350,9350,9350,'rodada_1','Rodada 1',1,'regulated');
insert into public.matchups(id,competition_id,round_id,home_registration_id,away_registration_id,matchup_order,structure_kind)
overriding system value values(93501,9350,9350,9350,9351,1,'regulated');
insert into public.games(id,competition_id,game_number,scheduled_at,venue,status,source,matchup_id,matchup_game_number)
overriding system value values
  (93501,9350,'FALLBACK-1','2026-08-20 18:00:00-03','Ginásio Fallback','scheduled','seed',93501,1);
insert into public.game_participants(game_id,competition_id,registration_id,side)
values(93501,9350,9350,'home'),(93501,9350,9351,'away');

create temp table fallback_keyboard_doc(document jsonb);
grant select on fallback_keyboard_doc to authenticated;
insert into fallback_keyboard_doc values('{
  "rulesVersion":"FIBA_2024","periods":4,
  "coachPlayer":{"home":null,"away":null},
  "roster":[
    {"rosterEntryId":9350,"registrationId":9350,"side":"home","jersey":"10","played":true},
    {"rosterEntryId":9351,"registrationId":9351,"side":"away","jersey":"20","played":true}
  ],
  "events":[{"id":"93500000-0000-4000-8000-000000000001","side":"home","period":1,"target":"10","code":"2"}]
}'::jsonb);
select set_config('request.jwt.claims',
  json_build_object('sub',(select user_id from private.admin_accounts limit 1),'role','authenticated','aal','aal2')::text,true);
set local role authenticated;
select is(public.admin_save_keyboard_scoresheet(
  93501,'93500000-0000-4000-8000-000000000002',0,
  (select document from fallback_keyboard_doc)
)->>'version','1','FIBA-profile keyboard emergency draft allowed without reason');
select throws_ok($$select public.admin_save_keyboard_scoresheet(
  93501,'93500000-0000-4000-8000-000000000003',1,
  (select document from fallback_keyboard_doc),true,''
)$$,'BD715','BDB_FALLBACK_REASON_REQUIRED','unreasoned FIBA fallback confirmation denied');
select is((select count(*) from public.game_data_submissions where game_id=93501),
  0::bigint,'missing justification leaves no authoritative submission');
select is(public.admin_save_keyboard_scoresheet(
  93501,'93500000-0000-4000-8000-000000000004',1,
  (select document from fallback_keyboard_doc),true,
  'Falha na chegada do boxscore FIBA, registro manual emergencial'
)->>'confirmed','true','justified FIBA emergency fallback confirmed');
select is((select role from public.game_data_submissions
  where id=(select submission_id from public.keyboard_scoresheets where game_id=93501)),
  'fallback','keyboard FIBA submission has fallback role, never primary');
select is((select reason from public.game_data_submissions
  where id=(select submission_id from public.keyboard_scoresheets where game_id=93501)),
  'Falha na chegada do boxscore FIBA, registro manual emergencial',
  'audit justification stored on authoritative submission');
select is((select count(*) from public.game_data_domain_authority where game_id=93501),
  6::bigint,'emergency source owns exactly six supported manual domains');
select is((select count(*) from public.admin_mutation_audit
  where action='manual_fallback_confirmed' and entity_id=93501),
  1::bigint,'confirmation creates manual fallback audit event');
select is(coalesce(current_setting('bdb.post01_submission_role',true),''),
  '','transaction-scoped fallback role override restored');
select is((select status from public.games where id=93501),
  'final','fallback game has canonical final status');
select is(public.admin_finalize_manual_fallback(
  93501,(select submission_id from public.keyboard_scoresheets where game_id=93501),
  'Encerramento auditado sem fonte FIBA recebida'
), (select submission_id from public.keyboard_scoresheets where game_id=93501),
  'existing audited finalization flow accepts keyboard fallback');
select ok((select fallback_finalized_at is not null from public.game_data_submissions
  where id=(select submission_id from public.keyboard_scoresheets where game_id=93501)),
  'explicit fallback finalization is recorded');
reset role;
select * from finish();
rollback;
