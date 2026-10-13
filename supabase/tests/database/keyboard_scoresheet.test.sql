begin;
\ir ../helpers/final_profile_fixtures.inc

create extension if not exists pgtap with schema extensions;
select no_plan();
set constraints all deferred;
select set_config('bdb.allow_internal_ingestion_game', 'on', true);

insert into private.admin_accounts (user_id)
select '11111111-1111-4111-8111-111111111111'
where not exists (select 1 from private.admin_accounts);

insert into public.competition_series (id, name, slug)
overriding system value values (9301, 'Liga Sumula', 'liga-sumula');
insert into public.categories (id, name, slug)
overriding system value values (9301, 'Categoria Sumula', 'categoria-sumula');
select pg_temp.create_final_competition(
  9301,9301,9301,2026,'Liga Sumula 2026','published',now(),'male','manual_scoresheet'
);
insert into public.teams (id, name, slug)
overriding system value values
  (9301, 'Time Sumula Casa', 'time-sumula-casa'),
  (9302, 'Time Sumula Fora', 'time-sumula-fora');
insert into public.players (id, full_name, slug)
overriding system value values
  (9301, 'Atleta Sumula Um', 'atleta-sumula-um'),
  (9302, 'Atleta Sumula Dois', 'atleta-sumula-dois'),
  (9303, 'Atleta Sumula Tres', 'atleta-sumula-tres');
insert into private.player_private(player_id,sex,sex_review_required)
values(9301,'male',false),(9302,'male',false),(9303,'male',false);
insert into public.team_registrations
  (id, competition_id, team_id, status, confirmed_at)
overriding system value values
  (9301, 9301, 9301, 'confirmed', now()),
  (9302, 9301, 9302, 'confirmed', now());
insert into public.roster_entries
  (id, competition_id, registration_id, player_id, jersey_number, status)
overriding system value values
  (9301, 9301, 9301, 9301, '00', 'active'),
  (9302, 9301, 9301, 9302, '0', 'active'),
  (9303, 9301, 9302, 9303, '00', 'active');

insert into public.competition_ruleset_revisions
  (id, competition_id, revision_number, structure_kind, status)
overriding system value values
  (9301, 9301, 1, 'regulated', 'active');
insert into public.competition_stages
  (id, competition_id, ruleset_revision_id, code, name, stage_order, structure_kind)
overriding system value values
  (9301, 9301, 9301, 'regular', 'Fase regular', 1, 'regulated');
insert into public.competition_rounds
  (id, competition_id, stage_id, code, name, round_order, structure_kind)
overriding system value values
  (9301, 9301, 9301, 'rodada_1', 'Rodada 1', 1, 'regulated');
insert into public.matchups
  (id, competition_id, round_id, home_registration_id, away_registration_id,
   matchup_order, structure_kind)
overriding system value values
  (93001, 9301, 9301, 9301, 9302, 1, 'regulated'),
  (93002, 9301, 9301, 9301, 9302, 2, 'regulated'),
  (93003, 9301, 9301, 9301, 9302, 3, 'regulated'),
  (93004, 9301, 9301, 9301, 9302, 4, 'regulated'),
  (93005, 9301, 9301, 9301, 9302, 5, 'regulated'),
  (93006, 9301, 9301, 9301, 9302, 6, 'regulated'),
  (93007, 9301, 9301, 9301, 9302, 7, 'regulated');
insert into public.games
  (id, competition_id, game_number, scheduled_at, venue, status, source,
   matchup_id, matchup_game_number)
overriding system value values
  (93001, 9301, 'MAN-BASE', '2026-08-20 18:00:00-03', 'Ginasio de teste',
   'scheduled', 'seed', 93001, 1),
  (93002, 9301, 'MAN-TIE', '2026-08-20 18:00:00-03', 'Ginasio de teste',
   'scheduled', 'seed', 93002, 1),
  (93003, 9301, 'MAN-JERSEY', '2026-08-20 18:00:00-03', 'Ginasio de teste',
   'scheduled', 'seed', 93003, 1),
  (93004, 9301, 'MAN-GD', '2026-08-20 18:00:00-03', 'Ginasio de teste',
   'scheduled', 'seed', 93004, 1),
  (93005, 9301, 'MAN-AFTER-GD', '2026-08-20 18:00:00-03', 'Ginasio de teste',
   'scheduled', 'seed', 93005, 1),
  (93006, 9301, 'MAN-MISSING', '2026-08-20 18:00:00-03', 'Ginasio de teste',
   'scheduled', 'seed', 93006, 1),
  (93007, 9301, 'MAN-OT', '2026-08-20 18:00:00-03', 'Ginasio de teste',
   'scheduled', 'seed', 93007, 1);
insert into public.game_participants
  (game_id, competition_id, registration_id, side)
select game_id, 9301, registration_id, side
from (values
  (93001::bigint, 9301::bigint, 'home'::text), (93001, 9302, 'away'),
  (93002, 9301, 'home'), (93002, 9302, 'away'),
  (93003, 9301, 'home'), (93003, 9302, 'away'),
  (93004, 9301, 'home'), (93004, 9302, 'away'),
  (93005, 9301, 'home'), (93005, 9302, 'away'),
  (93006, 9301, 'home'), (93006, 9302, 'away'),
  (93007, 9301, 'home'), (93007, 9302, 'away')
) as participant(game_id, registration_id, side);


create temp table keyboard_docs(name text primary key,doc jsonb);
grant select on keyboard_docs to authenticated;
insert into keyboard_docs values('base','{"rulesVersion":"FIBA_2024","periods":4,"coachPlayer":{"home":null,"away":null},"roster":[{"rosterEntryId":9301,"registrationId":9301,"side":"home","jersey":"00"},{"rosterEntryId":9302,"registrationId":9301,"side":"home","jersey":"0"},{"rosterEntryId":9303,"registrationId":9302,"side":"away","jersey":"00"}],"events":[{"id":"10000000-0000-4000-8000-000000000001","side":"home","period":1,"target":"00","code":"2"},{"id":"10000000-0000-4000-8000-000000000002","side":"home","period":1,"target":"0","code":"1"},{"id":"10000000-0000-4000-8000-000000000003","side":"away","period":1,"target":"00","code":"P2"},{"id":"10000000-0000-4000-8000-000000000004","side":"home","period":1,"target":"00","code":"TC"}]}'::jsonb);
select has_table('public','keyboard_scoresheets');
select has_table('public','keyboard_scoresheet_revisions');
select ok(not has_function_privilege('anon','public.admin_save_keyboard_scoresheet(bigint,uuid,bigint,jsonb,boolean,text)','execute'),'anonymous cannot invoke writer');
select ok(not has_table_privilege('authenticated','public.keyboard_scoresheets','update'),'no direct draft writes');
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select throws_ok($$select public.admin_save_keyboard_scoresheet(93001,'20000000-0000-4000-8000-000000000001',0,(select doc from keyboard_docs where name='base'))$$,'BD401','BDB_ADMIN_AAL2_REQUIRED','non-admin cannot write');
reset role;
select set_config('request.jwt.claims',json_build_object('sub',(select user_id from private.admin_accounts limit 1),'role','authenticated','aal','aal1')::text,true);
set local role authenticated;
select throws_ok($$select public.admin_save_keyboard_scoresheet(93001,'20000000-0000-4000-8000-000000000001',0,(select doc from keyboard_docs where name='base'))$$,'BD401','BDB_ADMIN_AAL2_REQUIRED','AAL1 cannot write');
reset role;
select set_config('request.jwt.claims',json_build_object('sub',(select user_id from private.admin_accounts limit 1),'role','authenticated','aal','aal2')::text,true);
set local role authenticated;
select is(public.admin_save_keyboard_scoresheet(93001,'20000000-0000-4000-8000-000000000001',0,(select doc from keyboard_docs where name='base'))->>'version','1','draft saved');
select is(public.admin_save_keyboard_scoresheet(93001,'20000000-0000-4000-8000-000000000001',0,(select doc from keyboard_docs where name='base'))->>'version','1','retry is idempotent');
select throws_ok($$select public.admin_save_keyboard_scoresheet(93001,'20000000-0000-4000-8000-000000000001',0,jsonb_set((select doc from keyboard_docs where name='base'),'{periods}','5'))$$,'BD904','KEYBOARD_IDEMPOTENCY_CONFLICT','divergent retry rejected');
select throws_ok($$select public.admin_save_keyboard_scoresheet(93001,'20000000-0000-4000-8000-000000000002',0,(select doc from keyboard_docs where name='base'))$$,'BD905','KEYBOARD_VERSION_CONFLICT','stale tab rejected');
select is((select count(*) from public.player_period_stats where game_id=93001),0::bigint,'draft creates no canonical stats');
select throws_ok($$select public.admin_create_manual_scoresheet('{"gameId":93001}'::jsonb)$$,'BD906','KEYBOARD_OTHER_SOURCE_ACTIVE','legacy writer cannot consume keyboard draft');
select throws_ok($$select public.admin_save_keyboard_scoresheet(93001,'20000000-0000-4000-8000-000000000003',1,jsonb_set((select doc from keyboard_docs where name='base'),'{events,0,target}','"99"'))$$,'BD902','KEYBOARD_INVALID_EVENT','forged jersey rejected');
select throws_ok($$select public.admin_save_keyboard_scoresheet(93001,'20000000-0000-4000-8000-000000000003',1,jsonb_set((select doc from keyboard_docs where name='base'),'{events,3,code}','"T2"'))$$,'BD902','KEYBOARD_INVALID_EVENT','technical two-free-throw error rejected');
select is(public.admin_save_keyboard_scoresheet(93001,'20000000-0000-4000-8000-000000000004',1,(select doc from keyboard_docs where name='base'),true)->>'confirmed','true','final confirmed atomically');
select is((select sum(points) from public.game_period_scores where game_id=93001),3::bigint,'correct canonical team score');
select is((select count(*) from public.foul_events where game_id=93001),2::bigint,'compensated foul still counts');
select ok((select bool_and(free_throw_attempted is null and two_point_attempted is null and three_point_attempted is null) from public.player_period_stats where game_id=93001),'no fabricated individual attempts');
select throws_ok($$update public.player_period_stats set two_point_made=42 where game_id=93001$$,'BD910','KEYBOARD_USE_EVENT_WRITER','canonical direct write bypass is closed');
reset role;
create temp table keyboard_publication_before as select private.competition_publication_snapshot(9301) as snapshot;
insert into keyboard_docs values('revision',jsonb_set((select doc from keyboard_docs where name='base'),'{events,0,target}','"0"'));
select set_config('request.jwt.claims',json_build_object('sub',(select user_id from private.admin_accounts limit 1),'role','authenticated','aal','aal2')::text,true);
set local role authenticated;
select throws_ok($$select public.admin_save_keyboard_scoresheet(93001,'20000000-0000-4000-8000-000000000005',2,(select doc from keyboard_docs where name='revision'),true,'short')$$,'BD908','KEYBOARD_REVISION_REASON_REQUIRED','reason required');
select is(public.admin_save_keyboard_scoresheet(93001,'20000000-0000-4000-8000-000000000006',2,(select doc from keyboard_docs where name='revision'),true,'Correção de camisa na fonte')->>'version','3','individual correction saved');
select is((select sum(points) from public.game_period_scores where game_id=93001),3::bigint,'revision replaces projection without double counting');
select is((select count(*) from public.keyboard_scoresheet_revisions where game_id=93001),3::bigint,'immutable draft and final history retained');
select is((select document->'events'->0->>'target' from public.keyboard_scoresheet_revisions where game_id=93001 and version=1),'00','original snapshot preserved');
reset role;
select ok((select snapshot<>private.competition_publication_snapshot(9301) from keyboard_publication_before),'same-total player correction changes editorial publication snapshot');
select is((select count(*) from public.game_data_submissions where game_id=93001 and status='active'),1::bigint,'single active submission');
select is((select count(*) from public.game_data_submissions where game_id=93001 and status='superseded'),1::bigint,'superseded confirmation retained');
select throws_ok($$update public.keyboard_scoresheet_revisions set reason='tamper' where game_id=93001$$,'BD901','KEYBOARD_REVISION_IMMUTABLE','even privileged historical mutation rejected');
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select is((select count(*) from public.keyboard_scoresheets),0::bigint,'unauthorized identity cannot read drafts');
reset role;
select * from finish();
rollback;
