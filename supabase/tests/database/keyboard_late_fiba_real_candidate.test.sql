-- Exercise the actual parser persistence and POST01 staging, without a stub.
-- The WP14 fixture supplies reviewed FIBA payload, storage object and players.
begin;
\ir ../helpers/registration_boxscore_fixture.inc
select no_plan();

-- Resolve the registered teams while the game is still scheduled.
update wp14_test_data
set resolution = jsonb_set(resolution,'{teams}',
  public.admin_resolve_boxscore_team_registrations(import_id,
    '{"teams":[
      {"sourceTeamName":"Lobos A","action":"existing_registration","registrationId":9414},
      {"sourceTeamName":"Lobos B","action":"existing_registration","registrationId":9415}
    ]}'::jsonb)->'teams')
where case_key='own';

reset role;
create temp table keyboard_real_document(document jsonb);
grant select on keyboard_real_document to authenticated;
with roster as (
  select jsonb_agg(jsonb_build_object(
    'rosterEntryId',id,
    'registrationId',registration_id,
    'side',case when registration_id=9414 then 'home' else 'away' end,
    'jersey',jersey_number,'played',true
  ) order by id) as players
  from public.roster_entries
  where id between 94141 and 94150
), scores as (
  select jsonb_agg(jsonb_build_object(
    'id','94140000-0000-4000-8000-'||lpad((100+number)::text,12,'0'),
    'side',case when number<=5 then 'home' else 'away' end,
    'period',case when number<=2 then 1 when number<=4 then 2
      when number<=6 then 3 else 4 end,
    'target','1','code','2'
  ) order by number) as events
  from generate_series(1,9) number
)
insert into keyboard_real_document(document)
select jsonb_build_object(
  'rulesVersion','FIBA_2024','periods',4,
  'coachPlayer',jsonb_build_object('home',null,'away',null),
  'roster',roster.players,'events',scores.events
)
from roster,scores;

select set_config('request.jwt.claims',
  jsonb_build_object('sub',(select user_id from private.admin_accounts limit 1),
    'role','authenticated','aal','aal2')::text,true);
set local role authenticated;
select is(public.admin_save_keyboard_scoresheet(
  94141,'94140000-0000-4000-8000-000000000100',0,
  (select document from keyboard_real_document),true,
  'FIBA oficial ainda não recebido e jogo registrado manualmente'
)->>'confirmed','true','real fixture game receives a confirmed keyboard fallback');
select is((select count(*) from public.game_data_domain_authority
  where game_id=94141),6::bigint,'keyboard fallback initially owns six domains');

select is(public.admin_commit_boxscore_import(
  (select import_id from wp14_test_data where case_key='own'),
  (select resolution from wp14_test_data where case_key='own')
),94141::bigint,'real FIBA import is staged against the final fallback game');
select is((select count(*) from public.game_data_submissions
  where game_id=94141 and source_type='fiba_boxscore' and role='primary'),
  1::bigint,'staging preserves an identifiable FIBA candidate');
select is((select count(*) from public.game_data_domain_authority
  where game_id=94141 and submission_id=(select submission_id
    from public.keyboard_scoresheets where game_id=94141)),
  6::bigint,'the existing keyboard receipt keeps all authorities');
select ok((select count(*) from public.game_data_domain_comparisons
  where game_id=94141)>0,'the real candidate creates domain comparison records');
select is((select count(*) from public.admin_mutation_audit
  where action='fiba_candidate_staged' and entity_id=94141),
  1::bigint,'real staging is audited exactly once');
select is((select game_id from public.boxscore_imports
  where id=(select import_id from wp14_test_data where case_key='own')),
  94141::bigint,'the import links to the original game after staging');

select is(public.admin_commit_boxscore_import(
  (select import_id from wp14_test_data where case_key='own'),
  (select resolution from wp14_test_data where case_key='own')
),94141::bigint,'retry reuses the original staged candidate');
select is((select count(*) from public.game_data_submissions
  where game_id=94141 and source_type='fiba_boxscore'),
  1::bigint,'retry does not create a duplicate FIBA submission');
select is((select count(*) from public.admin_mutation_audit
  where action='fiba_candidate_staged' and entity_id=94141),
  1::bigint,'retry does not duplicate staging audit');
select is((select count(*) from public.games
  where competition_id=9414 and game_number like '__post01_%'),
  0::bigint,'temporary staging games are removed');

reset role;
select * from finish();
rollback;
