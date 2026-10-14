begin;
create extension if not exists pgtap with schema extensions;
select plan(22);
\ir ../helpers/registration_boxscore_fixture.inc

select throws_ok($$select public.admin_resolve_boxscore_team_registrations(
  (select import_id from wp14_test_data where case_key='shared'),
  '{"teams":[{"sourceTeamName":"Lobos A","action":"existing_registration","registrationId":9414},
  {"sourceTeamName":"Lobos B","action":"register_existing_team","teamId":9416}]}'
)$$,'BD317','BDB_PDF_TEAM_MISMATCH','team registration cannot bypass the exact public name through a shared abbreviation');
select is((select count(*) from public.boxscore_team_resolutions where import_id in (select import_id from wp14_test_data)),0::bigint,
  'rejected team selection leaves no resolution behind');
select is((select status from public.team_registrations where id=9416),'draft',
  'rejected selection rolls back its draft transition');
select lives_ok($$update wp14_test_data set resolution=jsonb_set(resolution,'{teams}',
  public.admin_resolve_boxscore_team_registrations(import_id,
  '{"teams":[{"sourceTeamName":"Lobos A","action":"existing_registration","registrationId":9414},
  {"sourceTeamName":"Lobos B","action":"existing_registration","registrationId":9415}]}')->'teams')$$,
  'own and shared PDF abbreviations resolve to the independent registrations');
select is((select count(*) from public.boxscore_team_resolutions where import_id in (select import_id from wp14_test_data)),2::bigint,
  'both explicit reviews persist exactly once');
select throws_ok($$select public.admin_commit_boxscore_import(import_id,
  jsonb_set(resolution,'{teams,1,registrationId}','9414')) from wp14_test_data where case_key='own'$$,
  'BD712','BDB_GAME_PARTICIPANTS_MISMATCH','duplicate registration cannot replace the reviewed opponent');
select is((select count(*) from public.game_periods where game_id in (94141,94142)),0::bigint,
  'invalid confirmation leaves both structural games empty');
select lives_ok($$update wp14_test_data set game_id=public.admin_commit_boxscore_import(import_id,resolution)$$,
  'resolution reaches confirmation and collective persistence with own and shared abbreviations');
select results_eq($$select game_id from wp14_test_data order by game_id$$,array[94141::bigint,94142::bigint],
  'confirmation preserves the selected structural game IDs');
select is((select count(*) from public.games where id in (94141,94142) and status='final'),2::bigint,
  'both confirmations finalize only their selected games');
select results_eq($$select score from public.game_scores where game_id in (94141,94142) and registration_id=9414 order by game_id$$,
  array[10,10],'A scores remain bound to A in both cases');
select results_eq($$select score from public.game_scores where game_id in (94141,94142) and registration_id=9415 order by game_id$$,
  array[8,8],'B scores remain bound to B in both cases');
select results_eq($$select points_in_paint from public.game_team_statistics where game_id in (94141,94142) and registration_id=9414 order by game_id$$,
  array[6::smallint,6::smallint],'A collective facts remain isolated by registration');
select results_eq($$select points_in_paint from public.game_team_statistics where game_id in (94141,94142) and registration_id=9415 order by game_id$$,
  array[4::smallint,4::smallint],'B collective facts remain isolated by registration');
select is((select count(*) from public.game_roster_slots where game_id in (94141,94142)),20::bigint,
  'all selected roster links persist across the two games');
select is((select count(*) from public.games where game_number like '__mvp01_%'),0::bigint,
  'temporary ingestion games never remain after confirmation');
select is((select count(*) from public.game_data_submissions where game_id in (94141,94142)
  and source_type='fiba_boxscore' and status='active' and role='primary'),2::bigint,
  'both confirmations retain their active primary source submission');
select is((select count(*) from public.game_data_domain_authority authority
  join public.game_data_submissions submission on submission.id=authority.submission_id
  where authority.game_id in (94141,94142) and authority.domain='official_result'
  and submission.game_id=authority.game_id),2::bigint,'official result authority stays bound to the correct games');
select lives_ok($$select public.admin_refresh_boxscore_team_statistics(import_id,parsed,'{"valid":true,"issues":[]}')
  from wp14_test_data$$,'refresh reuses the reviewed mapping for both abbreviation cases');
select lives_ok($$select public.admin_commit_boxscore_import(import_id,resolution) from wp14_test_data$$,
  'confirmed retries remain idempotent after refresh');
select is((select count(*) from public.admin_mutation_audit where action='boxscore_import_confirmed'
  and entity_id in (select import_id from wp14_test_data)),2::bigint,'retries create no duplicate confirmation audit');
select ok(not has_function_privilege('authenticated',
  'private.upsert_boxscore_statistics_by_registration(bigint,text,jsonb,jsonb)','execute')
  and not has_function_privilege('anon',
  'private.match_boxscore_registration(bigint,text,text,bigint,bigint[])','execute'),
  'the registration matching and persistence helpers are not public API endpoints');

select * from finish();
rollback;
