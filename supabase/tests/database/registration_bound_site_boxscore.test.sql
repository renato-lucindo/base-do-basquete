begin;
create extension if not exists pgtap with schema extensions;
select plan(10);
\ir ../helpers/site_registration_boxscore_fixture.inc

select lives_ok($$update site_boxscore_test_data set resolution=jsonb_set(resolution,'{teams}',
  public.admin_resolve_boxscore_team_registrations(import_id,
  '{"teams":[{"sourceTeamName":"Instituto Site Fixture","action":"existing_registration","registrationId":9411},
  {"sourceTeamName":"Saldanha Site Fixture","action":"existing_registration","registrationId":9412}]}')->'teams')$$,
  'Site names without abbreviations resolve explicitly to A/B registrations');
select lives_ok($$select public.admin_commit_boxscore_import_v2(import_id,resolution-'gameId',
  '{"mode":"existing","gameId":94101,"applyReviewedMetadata":false,"scheduledAt":"2026-05-13T23:30:00Z","venue":"Sesport"}')
  from site_boxscore_test_data$$,'Site A/B registration identity reaches final persistence through v2');
select is((select status from public.games where id=94101),'final','the selected Site game is finalized');
select results_eq($$select registration_id from public.game_participants where game_id=94101 order by registration_id$$,
  array[9411::bigint,9412::bigint],'the selected registration IDs remain distinct');
select results_eq($$select score from public.game_scores where game_id=94101 order by registration_id$$,
  array[1,0],'Site scores preserve the correct A/B association');
select is((select count(*) from public.player_period_stats where game_id=94101 and not plus_minus_available),10::bigint,
  'Site does not invent plus/minus for independent registrations');
select is((select count(*) from public.game_team_statistics where game_id=94101),0::bigint,
  'Site does not invent unavailable advanced team metrics');
select is((select count(*) from public.game_period_scores where game_id=94101 and score_scope='game_total'),2::bigint,
  'Site keeps total buckets explicit without inventing periods');
select is((select count(*) from public.game_data_domain_authority where game_id=94101),5::bigint,
  'Site still activates only its five supported domains');
select is((select count(*) from public.game_data_submission_snapshots snapshot
  join public.game_data_submissions submission on submission.id=snapshot.submission_id
  where submission.game_id=94101),5::bigint,'Site snapshots remain limited to its five available domains');
select * from finish();
rollback;
