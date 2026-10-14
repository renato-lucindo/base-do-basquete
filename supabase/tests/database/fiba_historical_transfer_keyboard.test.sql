-- Real FIBA stats must stay attached to the game's historical registration.
begin;
\ir ../helpers/registration_boxscore_fixture.inc
select no_plan();

-- The shared WP14 fixture declares ten points for the first home player,
-- but its shot counters are zero. Make this game's persisted source consistent:
-- canonical points are generated from made shots, not from the JSON label.
reset role;
update public.boxscore_imports
set parsed_payload = jsonb_set(
  jsonb_set(parsed_payload, '{teams,0,players,0,twoPoints}',
    '{"made":5,"attempted":5}'::jsonb),
  '{teams,0,players,0,fieldGoals}', '{"made":5,"attempted":5}'::jsonb)
where id = (select import_id from wp14_test_data where case_key='own');
set local role authenticated;

update wp14_test_data
set resolution=jsonb_set(resolution,'{teams}',
  public.admin_resolve_boxscore_team_registrations(import_id,
    '{"teams":[
      {"sourceTeamName":"Lobos A","action":"existing_registration","registrationId":9414},
      {"sourceTeamName":"Lobos B","action":"existing_registration","registrationId":9415}
    ]}'::jsonb)->'teams')
where case_key='own';
select is(public.admin_commit_boxscore_import(
  (select import_id from wp14_test_data where case_key='own'),
  (select resolution from wp14_test_data where case_key='own')),
  94141::bigint,'the valid FIBA fixture is persisted before transfer');
select is((select sum(stat.points)::bigint
  from public.player_period_stats stat
  join public.game_roster_slots slot on slot.id=stat.game_roster_slot_id
  where stat.game_id=94141 and slot.roster_entry_id=94141),
  10::bigint,'FIBA shot conversions persist ten canonical player points');
select is((select official_points from public.competition_boxscore_player_statistics
  where competition_id=9414 and player_id=94141 and registration_id=9414),
  10::bigint,'first registration initially owns the historical points');

reset role;
insert into public.teams(id,name,slug)
overriding system value values(9417,'Equipe Transferida','equipe-wp14-transferida');
insert into public.team_registrations(id,competition_id,team_id,status,confirmed_at)
overriding system value values(9417,9414,9417,'confirmed',now());
update public.roster_entries
set status='inactive',left_on='2026-08-25'
where id=94141;
insert into public.roster_entries(
  id,competition_id,registration_id,player_id,jersey_number,status
) overriding system value
values(94171,9414,9417,94141,'33','active');

select is((select official_points from public.competition_boxscore_player_statistics
  where competition_id=9414 and player_id=94141 and registration_id=9414),
  10::bigint,'transfer cannot reassign points from the old FIBA registration');
select is((select games_played from public.competition_boxscore_player_statistics
  where competition_id=9414 and player_id=94141 and registration_id=9414),
  1::bigint,'old registration keeps the original denominator');
select is((select team_id from public.competition_boxscore_player_statistics
  where competition_id=9414 and player_id=94141 and registration_id=9414),
  9414::bigint,'historic team identity survives transfer');
select is((select count(*) from public.competition_boxscore_player_statistics
  where competition_id=9414 and player_id=94141 and registration_id=9417),
  0::bigint,'new registration cannot inherit an earlier FIBA game');
select is((select registration_id from public.game_boxscore_player_statistics
  where game_id=94141 and player_id=94141),
  9414::bigint,'source game remains bound to its original registration');

select * from finish();
rollback;
