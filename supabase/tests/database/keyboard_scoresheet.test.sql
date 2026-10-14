begin;
\ir ../helpers/final_profile_fixtures.inc

create extension if not exists pgtap with schema extensions;
select no_plan();
set constraints all deferred;
select set_config('bdb.allow_internal_ingestion_game', 'on', true);

insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111') on conflict do nothing;
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
insert into keyboard_docs values('base','{"rulesVersion":"FIBA_2024","periods":4,"coachPlayer":{"home":null,"away":null},"roster":[{"rosterEntryId":9301,"registrationId":9301,"side":"home","jersey":"00","played":true},{"rosterEntryId":9302,"registrationId":9301,"side":"home","jersey":"0","played":true},{"rosterEntryId":9303,"registrationId":9302,"side":"away","jersey":"00","played":true}],"events":[{"id":"10000000-0000-4000-8000-000000000001","side":"home","period":1,"target":"00","code":"2"},{"id":"10000000-0000-4000-8000-000000000002","side":"home","period":1,"target":"0","code":"1"},{"id":"10000000-0000-4000-8000-000000000003","side":"away","period":1,"target":"00","code":"P2"},{"id":"10000000-0000-4000-8000-000000000004","side":"home","period":1,"target":"00","code":"TC"}]}'::jsonb);
select has_table('public','keyboard_scoresheets','keyboard draft table exists');
select has_table('public','keyboard_scoresheet_revisions','immutable keyboard revisions exist');
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
select throws_ok($$select public.admin_save_keyboard_scoresheet(93001,'30000000-0000-4000-8000-000000000001',1,(select doc from keyboard_docs where name='base')-'periods')$$,'BD902','KEYBOARD_INVALID_DOCUMENT','rejects malformed missing periods');
select throws_ok($$select public.admin_save_keyboard_scoresheet(93001,'30000000-0000-4000-8000-000000000002',1,jsonb_set((select doc from keyboard_docs where name='base'),'{periods}','null'))$$,'BD902','KEYBOARD_INVALID_DOCUMENT','rejects malformed null periods');
select throws_ok($$select public.admin_save_keyboard_scoresheet(93001,'30000000-0000-4000-8000-000000000003',1,jsonb_set((select doc from keyboard_docs where name='base'),'{periods}','"4"'))$$,'BD902','KEYBOARD_INVALID_DOCUMENT','rejects malformed string periods');
select throws_ok($$select public.admin_save_keyboard_scoresheet(93001,'30000000-0000-4000-8000-000000000004',1,jsonb_set((select doc from keyboard_docs where name='base'),'{coachPlayer}','{}'))$$,'BD902','KEYBOARD_INVALID_DOCUMENT','rejects malformed missing coach side keys');
select throws_ok($$select public.admin_save_keyboard_scoresheet(93001,'30000000-0000-4000-8000-000000000005',1,jsonb_set((select doc from keyboard_docs where name='base'),'{roster,0,jersey}','12'))$$,'BD902','KEYBOARD_INVALID_ROSTER','rejects malformed numeric jersey');
select throws_ok($$select public.admin_save_keyboard_scoresheet(93001,'30000000-0000-4000-8000-000000000006',1,jsonb_set((select doc from keyboard_docs where name='base'),'{roster,0,rosterEntryId}','"9301"'))$$,'BD902','KEYBOARD_INVALID_ROSTER','rejects malformed string roster ID');
select throws_ok($$select public.admin_save_keyboard_scoresheet(93001,'30000000-0000-4000-8000-000000000007',1,jsonb_set((select doc from keyboard_docs where name='base'),'{events,0,code}','2'))$$,'BD902','KEYBOARD_INVALID_EVENT','rejects malformed numeric event code');
select throws_ok($$select public.admin_save_keyboard_scoresheet(93001,'30000000-0000-4000-8000-000000000008',1,jsonb_set((select doc from keyboard_docs where name='base'),'{events,0,period}','"1"'))$$,'BD902','KEYBOARD_INVALID_EVENT','rejects malformed string event period');
select throws_ok($$select public.admin_save_keyboard_scoresheet(93001,'30000000-0000-4000-8000-000000000020',1,jsonb_set((select doc from keyboard_docs where name='base'),'{events,0,id}','"10000000000040008000000000000001"'))$$,'BD902','KEYBOARD_INVALID_EVENT','rejects noncanonical UUID variant 20');
select throws_ok($$select public.admin_save_keyboard_scoresheet(93001,'30000000-0000-4000-8000-000000000021',1,jsonb_set((select doc from keyboard_docs where name='base'),'{events,0,id}','"10000000-0000-9000-8000-000000000001"'))$$,'BD902','KEYBOARD_INVALID_EVENT','rejects noncanonical UUID variant 21');
select throws_ok($$select public.admin_save_keyboard_scoresheet(93001,'30000000-0000-4000-8000-000000000022',1,jsonb_set((select doc from keyboard_docs where name='base'),'{events,0,id}','"10000000-0000-4000-0000-000000000001"'))$$,'BD902','KEYBOARD_INVALID_EVENT','rejects noncanonical UUID variant 22');
select throws_ok($$select public.admin_save_keyboard_scoresheet(93001,'30000000-0000-4000-8000-000000000024',1,jsonb_set((select doc from keyboard_docs where name='base'),'{events,0,id}','"FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF"'))$$,'BD902','KEYBOARD_INVALID_EVENT','rejects uppercase max UUID exactly as Zod');
select is((select version from public.keyboard_scoresheets where game_id=93001),1::bigint,'malformed attempts do not change draft version');
select is((select document from public.keyboard_scoresheets where game_id=93001),(select doc from keyboard_docs where name='base'),'malformed attempts preserve draft document');
select is((select count(*) from public.keyboard_scoresheet_revisions where game_id=93001),1::bigint,'malformed attempts create no receipts');
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

-- DNP must not inflate the public manual-statistics appearance denominator.
select set_config('request.jwt.claims',json_build_object('sub',(select user_id from private.admin_accounts limit 1),'role','authenticated','aal','aal2')::text,true);
insert into keyboard_docs values('participation',jsonb_set((select doc from keyboard_docs where name='base'),'{roster,2,played}','false'));
-- Keep the away roster entry DNP by removing its foul; also remove the made LL requiring that penalty.
update keyboard_docs set doc=jsonb_set(doc,'{events}',jsonb_build_array(doc->'events'->0,doc->'events'->3)) where name='participation';
set local role authenticated;
select is(public.admin_save_keyboard_scoresheet(93002,'20000000-0000-4000-8000-000000000007',0,(select doc from keyboard_docs where name='participation'),true)->>'version','1','DNP game confirmed');
select is((select did_not_play from public.game_roster_slots where game_id=93002 and roster_entry_id=9303),true,'DNP survives canonical projection');
select is((select did_not_play from public.game_roster_slots where game_id=93002 and roster_entry_id=9302),false,'zero-point participant stays eligible for denominator');
select throws_ok($$update public.game_period_scores set game_id=93003 where game_id=93001$$,'BD910','KEYBOARD_USE_EVENT_WRITER','moving projection out of reserved game blocked');
reset role;
select is((select games_played from public.competition_scoresheet_player_statistics where competition_id=9301 and player_id=9302),2::bigint,'zero-point participant counts in public aggregate');
select is((select games_played from public.competition_scoresheet_player_statistics where competition_id=9301 and player_id=9303),1::bigint,'DNP does not inflate public aggregate');
select ok((select bool_and(revision=2) from public.game_data_domain_authority where game_id=93001),'revision increments all six authorities');
select throws_ok($$update public.game_data_submissions set status='superseded' where game_id=93001 and status='active'$$,'BD707','BDB_SUBMISSION_HAS_ACTIVE_AUTHORITY','unscoped privileged supersession remains blocked');
select throws_ok($$delete from public.game_data_submissions where game_id=93001 and status='active'$$,'BD707','BDB_SUBMISSION_HAS_ACTIVE_AUTHORITY','DELETE remains blocked');
select is(coalesce(current_setting('bdb.keyboard_replacing_submission',true),''),'','scoped replacement flag restored');
set constraints keyboard_authority_swap_complete immediate;
set constraints keyboard_authority_swap_complete deferred;

-- Direct D and accumulated technical GD both project a single disqualification.
insert into keyboard_docs(name,doc)
select 'gd',jsonb_set(doc,'{events}','[{"id":"10000000-0000-4000-8000-000000000030","side":"home","period":1,"target":"00","code":"2"},{"id":"10000000-0000-4000-8000-000000000031","side":"home","period":1,"target":"00","code":"T1"},{"id":"10000000-0000-4000-8000-000000000032","side":"home","period":2,"target":"00","code":"T1"}]'::jsonb)
from keyboard_docs where name='base';
insert into keyboard_docs(name,doc)
select 'direct_d',jsonb_set(doc,'{events}','[{"id":"10000000-0000-4000-8000-000000000035","side":"home","period":1,"target":"00","code":"2"},{"id":"10000000-0000-4000-8000-000000000033","side":"home","period":1,"target":"00","code":"D2"}]'::jsonb)
from keyboard_docs where name='base';
select set_config('request.jwt.claims',json_build_object('sub',(select user_id from private.admin_accounts limit 1),'role','authenticated','aal','aal2')::text,true);
set local role authenticated;
select is(public.admin_save_keyboard_scoresheet(93004,'20000000-0000-4000-8000-000000000031',0,(select doc from keyboard_docs where name='gd'),true)->>'confirmed','true','accumulated GD confirmed');
select is(public.admin_save_keyboard_scoresheet(93005,'20000000-0000-4000-8000-000000000032',0,(select doc from keyboard_docs where name='direct_d'),true)->>'confirmed','true','direct D confirmed');
reset role;
select is((select disqualification_reason from public.game_roster_slots where game_id=93004 and roster_entry_id=9301),'2T','two technicals set GD reason');
select is((select disqualifications from public.game_scoresheet_player_statistics where game_id=93004 and player_id=9301),1::bigint,'GD counted in public game');
select is((select disqualifications from public.game_scoresheet_player_statistics where game_id=93005 and player_id=9301),1::bigint,'direct D counted once');
select is((select disqualifications from public.competition_scoresheet_player_statistics where competition_id=9301 and player_id=9301 and registration_id=9301),2::bigint,'GD and direct D counted once each in competition');

-- The same athlete playing for another registration retains separate totals.
insert into public.teams (id,name,slug) overriding system value
values (9303,'Time Sumula Transferencia','time-sumula-transferencia');
insert into public.team_registrations (id,competition_id,team_id,status,confirmed_at)
overriding system value values (9303,9301,9303,'confirmed',now());
-- Transfer ends the prior active roster entry; past game slots keep its history.
update public.roster_entries set status='inactive',left_on='2026-08-21' where id=9301;
insert into public.roster_entries (id,competition_id,registration_id,player_id,jersey_number,status)
overriding system value values (9304,9301,9303,9301,'33','active');
insert into public.matchups
  (id,competition_id,round_id,home_registration_id,away_registration_id,matchup_order,structure_kind)
overriding system value values (93008,9301,9301,9303,9302,8,'regulated');
insert into public.games
  (id,competition_id,game_number,scheduled_at,venue,status,source,matchup_id,matchup_game_number)
overriding system value values
  (93008,9301,'MAN-TRANSFER','2026-08-20 18:00:00-03','Ginasio de teste','scheduled','seed',93008,1);
insert into public.game_participants (game_id,competition_id,registration_id,side)
values (93008,9301,9303,'home'),(93008,9301,9302,'away');
insert into keyboard_docs(name,doc)
select 'transfer',jsonb_set(
  jsonb_set(doc,'{roster}','[
   {"rosterEntryId":9304,"registrationId":9303,"side":"home","jersey":"33","played":true},
   {"rosterEntryId":9303,"registrationId":9302,"side":"away","jersey":"00","played":true}
  ]'::jsonb),
  '{events}','[
   {"id":"10000000-0000-4000-8000-000000000034","side":"home","period":1,"target":"33","code":"2"}
  ]'::jsonb
) from keyboard_docs where name='base';
select set_config('request.jwt.claims',json_build_object('sub',(select user_id from private.admin_accounts limit 1),'role','authenticated','aal','aal2')::text,true);
set local role authenticated;
select is(public.admin_save_keyboard_scoresheet(93008,'20000000-0000-4000-8000-000000000033',0,(select doc from keyboard_docs where name='transfer'),true)->>'confirmed','true','transfer game confirmed');
reset role;
select is((select count(*) from public.competition_scoresheet_player_statistics where competition_id=9301 and player_id=9301),2::bigint,'transfer produces two competition rows');
select is((select games_played from public.competition_scoresheet_player_statistics where competition_id=9301 and player_id=9301 and registration_id=9301),4::bigint,'original registration keeps only its games');
select is((select games_played from public.competition_scoresheet_player_statistics where competition_id=9301 and player_id=9301 and registration_id=9303),1::bigint,'new registration gets only its game');
select is((select team_id from public.competition_scoresheet_player_statistics where competition_id=9301 and player_id=9301 and registration_id=9303),9303::bigint,'transfer retains team identity');


-- Historical corrections use the game slot, not an athlete's present-day roster status.
select set_config('request.jwt.claims',
  json_build_object('sub',(select user_id from private.admin_accounts limit 1),'role','authenticated','aal','aal2')::text,true);
set local role authenticated;
select is(public.admin_save_keyboard_scoresheet(
  93001,'20000000-0000-4000-8000-000000000041',3,
  (select document from public.keyboard_scoresheets where game_id=93001),
  true,'Revisão histórica após transferência de equipe'
)->>'version','4','past confirmed game remains reviewable after original player transfer');
select is((select count(*) from public.keyboard_scoresheet_revisions where game_id=93001),
  4::bigint,'historical correction creates an immutable revision');
select is((select count(*) from public.game_data_submissions where game_id=93001 and status='active'),
  1::bigint,'historical correction keeps one active canonical submission');
select throws_ok($$select public.admin_save_keyboard_scoresheet(
  93001,'20000000-0000-4000-8000-000000000042',4,
  jsonb_set((select document from public.keyboard_scoresheets where game_id=93001),
    '{roster,0,rosterEntryId}','9304'::jsonb),
  true,'Tentativa de alterar participante histórico'
)$$,'BD902','KEYBOARD_INVALID_ROSTER','a transferred athlete cannot replace an original historical roster slot');
reset role;

select * from finish();
rollback;
