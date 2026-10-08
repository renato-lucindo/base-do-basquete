begin;
\ir ../helpers/final_profile_fixtures.inc

create extension if not exists pgtap with schema extensions;
select plan(39);
set constraints all deferred;
select set_config('bdb.allow_internal_ingestion_game', 'on', true);

insert into auth.users(id)
values ('11111111-1111-4111-8111-111111111111')
on conflict do nothing;
insert into private.admin_accounts(user_id)
values ('11111111-1111-4111-8111-111111111111')
on conflict do nothing;

select ok(
  pg_get_functiondef('public.admin_create_manual_scoresheet_v2(jsonb)'::regprocedure)
    like '%pg_advisory_xact_lock%',
  'idempotent creation is serialized by a transaction-scoped advisory lock'
);

insert into public.competition_series (id, name, slug)
overriding system value values (9831, 'Liga Sumula V2', 'liga-sumula-v2');
insert into public.categories (id, name, slug)
overriding system value values (9831, 'Categoria Sumula V2', 'categoria-sumula-v2');
select pg_temp.create_final_competition(
  9831,9831,9831,2026,'Liga Sumula V2 2026','published',now(),'male','manual_scoresheet'
);
insert into public.teams (id, name, slug)
overriding system value values
  (9831, 'Time Sumula V2 Casa', 'time-sumula-v2-casa'),
  (9832, 'Time Sumula V2 Fora', 'time-sumula-v2-fora'),
  (9833, 'Time Sumula V2 Rascunho', 'time-sumula-v2-rascunho');
insert into public.players (id, full_name, slug)
overriding system value values
  (9831, 'Atleta Sumula V2 Casa', 'atleta-sumula-v2-casa'),
  (9832, 'Atleta Sumula V2 Fora', 'atleta-sumula-v2-fora');
insert into private.player_private(player_id,sex,sex_review_required)
values(9831,'male',false),(9832,'male',false);
insert into public.team_registrations
  (id, competition_id, team_id, status, confirmed_at)
overriding system value values
  (9831, 9831, 9831, 'confirmed', now()),
  (9832, 9831, 9832, 'confirmed', now()),
  (9833, 9831, 9833, 'draft', null);
insert into public.roster_entries
  (id, competition_id, registration_id, player_id, jersey_number, status)
overriding system value values
  (9831, 9831, 9831, 9831, '00', 'active'),
  (9832, 9831, 9832, 9832, '0', 'active');
insert into public.competition_ruleset_revisions
  (id, competition_id, revision_number, structure_kind, status)
overriding system value values
  (9831, 9831, 1, 'regulated', 'active');
insert into public.competition_stages
  (id, competition_id, ruleset_revision_id, code, name, stage_order, structure_kind)
overriding system value values
  (9831, 9831, 9831, 'regular', 'Fase regular', 1, 'regulated');

create temp table manual_v2_payloads(name text primary key, payload jsonb);
grant select on manual_v2_payloads to authenticated;
insert into manual_v2_payloads(name,payload) values (
  'base',
  '{
    "idempotencyKey":"98310000-0000-4000-8000-000000000001",
    "competitionId":9831,
    "game":{"date":"2026-10-07"},
    "teams":[
      {
        "side":"home","registrationId":9831,
        "slots":[{"slotNumber":1,"rosterEntryId":9831,"jerseyNumber":"00","isStarter":true,"isCaptain":true}],
        "staff":[{"role":"coach","name":"Treinador Casa","origin":"manual"}]
      },
      {
        "side":"away","registrationId":9832,
        "slots":[{"slotNumber":1,"rosterEntryId":9832,"jerseyNumber":"0","isStarter":true,"isCaptain":true}],
        "staff":[{"role":"coach","name":"Treinador Fora","origin":"manual"}]
      }
    ],
    "periods":[
      {"periodNumber":1,"stats":[
        {"rosterEntryId":9831,"twoPointMade":1,"threePointMade":0,"freeThrowMade":0},
        {"rosterEntryId":9832,"twoPointMade":0,"threePointMade":0,"freeThrowMade":1}
      ]},
      {"periodNumber":2,"stats":[
        {"rosterEntryId":9831,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0},
        {"rosterEntryId":9832,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0}
      ]},
      {"periodNumber":3,"stats":[
        {"rosterEntryId":9831,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0},
        {"rosterEntryId":9832,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0}
      ]},
      {"periodNumber":4,"stats":[
        {"rosterEntryId":9831,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0},
        {"rosterEntryId":9832,"twoPointMade":0,"threePointMade":0,"freeThrowMade":0}
      ]}
    ],
    "fouls":[
      {"periodNumber":1,"sequenceNumber":1,"target":{"kind":"player","registrationId":9831,"rosterEntryId":9831},"type":"U","penaltyFtCount":2,"originalNotation":"U2","rulesVersion":"FIBA_2024"},
      {"periodNumber":1,"sequenceNumber":1,"target":{"kind":"staff","registrationId":9831,"staffRole":"coach"},"type":"T","penaltyFtCount":1,"originalNotation":"C1","rulesVersion":"FIBA_2024"},
      {"periodNumber":2,"sequenceNumber":1,"target":{"kind":"team","registrationId":9832},"type":"T","penaltyFtCount":0,"originalNotation":"T","rulesVersion":"FIBA_2024"}
    ],
    "officials":[{"role":"Árbitro","name":"Oficial Principal"}]
  }'::jsonb
);

create temp table manual_v2_result(game_id bigint);
grant select, insert on manual_v2_result to authenticated;
create temp table manual_v2_baseline(submission_id bigint, payload_hash text, initial_payload jsonb);
grant select, insert on manual_v2_baseline to authenticated;

create function pg_temp.v2_revision(p_key text, p_note text, p_reason text default 'Correção conferida após o jogo')
returns jsonb language sql stable as $$
  select
    (case when p_note is null then p.payload
      else jsonb_set(p.payload,'{game,notes}',to_jsonb(p_note)) end)
    || jsonb_build_object(
      'gameId',(select game_id from manual_v2_result),
      'baseSubmissionId',(select submission_id from manual_v2_baseline),
      'basePayloadHash',(select payload_hash from manual_v2_baseline),
      'revisionKey',p_key,
      'revisionReason',p_reason
    )
  from manual_v2_payloads p where name='base';
$$;

create function pg_temp.v2_revision_current_penalty(p_key text)
returns jsonb language sql stable as $$
  select jsonb_set(
    jsonb_set(
      snapshot.payload || jsonb_build_object(
        'gameId',submission.game_id,
        'revisionKey',p_key,
        'baseSubmissionId',submission.id,
        'basePayloadHash',submission.payload_hash,
        'revisionReason','Correção de penalidade concedida'
      ),
      '{fouls,0,penaltyFtCount}','3'::jsonb
    ),
    '{fouls,0,originalNotation}','"U3"'::jsonb
  )
  from public.game_data_submissions submission
  join public.manual_scoresheet_submission_payloads snapshot
    on snapshot.submission_id=submission.id
  where submission.game_id=(select game_id from manual_v2_result)
    and submission.source_type='manual_scoresheet' and submission.status='active';
$$;

select ok(
  pg_get_functiondef('public.admin_revise_manual_scoresheet_v2(jsonb)'::regprocedure)
    like '%pg_advisory_xact_lock%',
  'revision uses a transaction-scoped lock'
);
set local role anon;
select throws_ok(
  $$select public.admin_revise_manual_scoresheet_v2('{}'::jsonb)$$,
  '42501',null,'anon has no execute grant on revision RPC'
);
reset role;
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select throws_ok(
  $$select public.admin_revise_manual_scoresheet_v2('{}'::jsonb)$$,
  'BD401','BDB_ADMIN_AAL2_REQUIRED','non-admin cannot revise'
);
reset role;
select set_config('request.jwt.claims',
  json_build_object('sub',(select user_id from private.admin_accounts),'role','authenticated','aal','aal1')::text,true);
set local role authenticated;
select throws_ok(
  $$select public.admin_revise_manual_scoresheet_v2('{}'::jsonb)$$,
  'BD401','BDB_ADMIN_AAL2_REQUIRED','admin AAL1 cannot revise'
);
reset role;
select set_config('request.jwt.claims',
  json_build_object('sub',(select user_id from private.admin_accounts),'role','authenticated','aal','aal2')::text,true);
set local role authenticated;
select lives_ok(
  $$insert into manual_v2_result(game_id)
    select public.admin_create_manual_scoresheet_v2((select payload from manual_v2_payloads where name='base'))$$,
  'admin AAL2 creates base fixture'
);
insert into manual_v2_baseline(submission_id,payload_hash,initial_payload)
select s.id,s.payload_hash,p.payload
from public.game_data_submissions s
join public.manual_scoresheet_submission_payloads p on p.submission_id=s.id
where s.game_id=(select game_id from manual_v2_result) and s.status='active';
select is((select submission_version from public.game_data_submissions
  where id=(select submission_id from manual_v2_baseline)),1,
  'base submission starts at version one');
reset role;
select throws_ok(
  $$update public.game_data_submissions set status='superseded'
    where id=(select submission_id from manual_v2_baseline)$$,
  'BD707','BDB_SUBMISSION_HAS_ACTIVE_AUTHORITY',
  'active authority still blocks status changes without a validated successor'
);
set local role authenticated;
select throws_ok(
  $$select public.admin_revise_manual_scoresheet_v2(
    pg_temp.v2_revision('98310000-0000-4000-8000-000000000011',null))$$,
  'BD223','BDB_REVISION_NO_CHANGES','metadata-only revision is rejected'
);
select throws_ok(
  $$select public.admin_revise_manual_scoresheet_v2(
    pg_temp.v2_revision('98310000-0000-4000-8000-000000000012','Observação','curto'))$$,
  'BD220','BDB_REVISION_REASON_REQUIRED','short reason is rejected'
);
select throws_ok(
  $$select public.admin_revise_manual_scoresheet_v2(
    jsonb_set(pg_temp.v2_revision('98310000-0000-4000-8000-000000000013','Observação'),
      '{teams,0,side}','"away"'::jsonb))$$,
  'BD712','BDB_GAME_PARTICIPANTS_MISMATCH','home/away cannot be switched'
);
select throws_ok(
  $$select public.admin_revise_manual_scoresheet_v2(
    jsonb_set(pg_temp.v2_revision('98310000-0000-4000-8000-000000000014','Observação'),
      '{basePayloadHash}','"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"'::jsonb))$$,
  'BD221','BDB_REVISION_CONFLICT','incorrect expected hash is rejected'
);
select throws_ok(
  $$select public.admin_revise_manual_scoresheet_v2(
    jsonb_set(pg_temp.v2_revision('98310000-0000-4000-8000-000000000015','Observação'),
      '{periods,0,stats,1,freeThrowMade}','2'::jsonb))$$,
  'BD208','BDB_FINAL_GAME_TIED','invalid scoring rolls the revision transaction back'
);
select is((select count(*) from public.game_data_submissions where game_id=(select game_id from manual_v2_result)),
  1::bigint,'failed revisions do not create submissions');
select is((select coalesce(sum(points),0) from public.game_period_scores
  where game_id=(select game_id from manual_v2_result) and registration_id=9832),
  1::bigint,'failed revisions preserve the original live score');
select lives_ok(
  $$select public.admin_revise_manual_scoresheet_v2(
    pg_temp.v2_revision('98310000-0000-4000-8000-000000000016','Observação revisada'))$$,
  'valid revision commits atomically'
);
select results_eq(
  $$select submission_version,status from public.game_data_submissions
    where game_id=(select game_id from manual_v2_result)
    order by submission_version$$,
  $$values(1::integer,'superseded'::text),(2::integer,'active'::text)$$,
  'base version is superseded and version two active'
);
select is((select count(*) from public.manual_scoresheet_submission_payloads
  where game_id=(select game_id from manual_v2_result)),2::bigint,
  'both immutable snapshots persist');
select is((select payload from public.manual_scoresheet_submission_payloads
  where submission_id=(select submission_id from manual_v2_baseline)),
  (select initial_payload from manual_v2_baseline),
  'original payload remains bytewise equivalent as jsonb');
select ok((select reason='Correção conferida após o jogo'
    and jsonb_array_length(diff)=1 and diff->0->>'section'='game'
    and revised_by=(select user_id from private.admin_accounts)
    and revised_at is not null
  from public.manual_scoresheet_revisions where game_id=(select game_id from manual_v2_result)),
  'reason, author, timestamp and section diff are recorded');
select is((select penalty_free_throws from public.manual_scoresheet_revisions
  where game_id=(select game_id from manual_v2_result)),
  '{"homeConceded":3,"homeReceived":0,"awayConceded":0,"awayReceived":3}'::jsonb,
  'penalty free throws derive from player and coach fouls, not converted free throws');
select is((select count(*) from public.game_data_domain_authority a
  join public.game_data_submissions s on s.id=a.submission_id
  where a.game_id=(select game_id from manual_v2_result)
    and s.submission_version=2),6::bigint,
  'all six domains switch to revision two');
select is((select count(*) from public.game_data_domain_authority a
  where a.game_id=(select game_id from manual_v2_result) and a.revision=2),6::bigint,
  'all six authority revision counters advance');
select is((select count(*) from public.admin_mutation_audit a
  where a.entity_id=(select game_id from manual_v2_result) and action='manual_scoresheet_revised'),
  1::bigint,'revision has one audit entry');
select results_eq(
  $$select side,registration_id from public.game_participants
    where game_id=(select game_id from manual_v2_result) order by side$$,
  $$values ('away'::text,9832::bigint),('home'::text,9831::bigint)$$,
  'team participants are immutable');
select is((select notes from public.manual_scoresheet_game_details
  where game_id=(select game_id from manual_v2_result)),
  'Observação revisada'::text,'latest game notes are persisted');
select is((select public.admin_revise_manual_scoresheet_v2(
  pg_temp.v2_revision('98310000-0000-4000-8000-000000000016','Observação revisada'))),
  (select game_id from manual_v2_result),'same revision key and content safely retry');
select is((select count(*) from public.game_data_submissions
  where game_id=(select game_id from manual_v2_result)),2::bigint,
  'idempotent retry adds no submission');
select throws_ok(
  $$select public.admin_revise_manual_scoresheet_v2(
    pg_temp.v2_revision('98310000-0000-4000-8000-000000000016','Observação diferente'))$$,
  'BD209','BDB_IDEMPOTENCY_CONFLICT','divergent retry with same key is rejected'
);
select throws_ok(
  $$select public.admin_revise_manual_scoresheet_v2(
    pg_temp.v2_revision('98310000-0000-4000-8000-000000000017','Observação obsoleta'))$$,
  'BD221','BDB_REVISION_CONFLICT','stale base submission cannot overwrite later revision'
);

reset role;
select throws_ok(
  $$update public.manual_scoresheet_submission_payloads set payload='{}'::jsonb
    where submission_id=(select submission_id from manual_v2_baseline)$$,
  'BD222','BDB_SCORESHEET_HISTORY_IMMUTABLE','even table owner cannot edit snapshots'
);
select throws_ok(
  $$delete from public.manual_scoresheet_submission_payloads
    where submission_id=(select submission_id from manual_v2_baseline)$$,
  'BD222','BDB_SCORESHEET_HISTORY_IMMUTABLE','even table owner cannot delete snapshots'
);
select throws_ok(
  $$update public.manual_scoresheet_revisions set reason='Não deveria ser permitido'
    where game_id=(select game_id from manual_v2_result)$$,
  'BD222','BDB_SCORESHEET_HISTORY_IMMUTABLE','revision audit rows are append-only'
);

select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select is((select count(*) from public.manual_scoresheet_revisions),0::bigint,
  'non-admin AAL2 cannot select revision metadata');
reset role;
set local role anon;
select throws_ok(
  $$select count(*) from public.manual_scoresheet_revisions$$,
  '42501',null,'anon cannot select revision metadata'
);
reset role;
select set_config('request.jwt.claims',
  json_build_object('sub',(select user_id from private.admin_accounts),'role','authenticated','aal','aal2')::text,true);
set local role authenticated;
select lives_ok(
  $$select public.admin_revise_manual_scoresheet_v2(
    pg_temp.v2_revision_current_penalty('98310000-0000-4000-8000-000000000018'))$$,
  'second revision changes penalty with current CAS'
);
select is((select penalty_free_throws from public.manual_scoresheet_revisions r
  join public.game_data_submissions s on s.id=r.submission_id
  where s.game_id=(select game_id from manual_v2_result) and s.submission_version=3),
  '{"homeConceded":4,"homeReceived":0,"awayConceded":0,"awayReceived":4}'::jsonb,
  'revised semantic foul changes conceded/received FT totals');
select is((select count(*) from public.game_data_submissions s
  where s.game_id=(select game_id from manual_v2_result)),3::bigint,
  'successive revision creates version three without losing history');
select is((select count(*) from public.game_data_domain_authority
  where game_id=(select game_id from manual_v2_result) and revision=3),6::bigint,
  'successive revisions increment six domain counters');

select * from finish();
rollback;
