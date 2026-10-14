begin;
\ir ../helpers/final_profile_fixtures.inc

create extension if not exists pgtap with schema extensions;
select plan(39);
set constraints all deferred;
select set_config('bdb.allow_internal_ingestion_game', 'on', true);

select ok(
  (select attribute.attnotnull from pg_attribute attribute
   where attribute.attrelid='public.player_period_stats'::regclass
     and attribute.attname='plus_minus'),
  'legacy plus/minus remains non-null'
);
select has_column('public','player_period_stats','plus_minus_available',
  'plus/minus availability is explicit');
select has_column('public','game_periods','period_scope',
  'technical game-total periods are explicitly scoped');
select has_column('public','game_period_scores','score_scope',
  'technical game-total scores are explicitly scoped');
select ok(not has_function_privilege(
  'authenticated','private.capture_basketball_site_submission_snapshots(bigint,bigint)','execute'
), 'snapshot capture cannot be invoked by authenticated clients');
select ok(not has_function_privilege(
  'authenticated','private.admin_commit_basketball_site_import_impl(bigint,jsonb)','execute'
), 'the format-specific commit helper is not directly callable');
select ok(not has_function_privilege(
  'authenticated','private.admin_commit_boxscore_import_impl(bigint,jsonb)','execute'
), 'the legacy FIBA commit implementation cannot bypass the dispatcher');
select ok(
  (select exists(
     select 1 from unnest(procedure.proconfig) config
     where config ~ '^search_path=(|"")$'
   )
   from pg_proc procedure
   where procedure.oid='private.admin_commit_supported_boxscore_import_impl(bigint,jsonb)'::regprocedure),
  'the privileged dispatcher has an empty search_path'
);

insert into auth.users (
  id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values (
  '12111111-1111-4111-8111-111111111111','authenticated','authenticated',
  'site-boxscore-fixture@example.invalid','',now(),
  '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()
) on conflict (id) do nothing;

insert into private.admin_accounts(user_id)
select '12111111-1111-4111-8111-111111111111'
where not exists(select 1 from private.admin_accounts);

insert into public.competition_series(id,name,slug)
overriding system value values (9411,'Liga Site','liga-site');
insert into public.categories(id,name,slug)
overriding system value values (9411,'Categoria Site','categoria-site');
select pg_temp.create_final_competition(
  9411,9411,9411,2026,'Liga Site 2026','published',now(),'male','fiba_boxscore'
);
insert into public.teams(id,name,slug,abbreviation)
overriding system value values
  (9411,'Instituto Site Fixture','instituto-site-fixture','ISF'),
  (9412,'Saldanha Site Fixture','saldanha-site-fixture','SSF');
insert into public.players(id,full_name,slug)
overriding system value
select 9410+number,'Atleta Site '||number,'atleta-site-'||number
from generate_series(1,10) number;
insert into private.player_private(player_id,sex,sex_review_required)
select 9410+number,'male',false from generate_series(1,10) number;
insert into public.team_registrations(id,competition_id,team_id,status,confirmed_at)
overriding system value values
  (9411,9411,9411,'confirmed',now()),
  (9412,9411,9412,'confirmed',now());
insert into public.roster_entries(
  id,competition_id,registration_id,player_id,jersey_number,status
) overriding system value
select 9410+number,9411,
  case when number<=5 then 9411 else 9412 end,
  9410+number,
  case when number<=5 then number::text else (number-5)::text end,
  'active'
from generate_series(1,10) number;

insert into public.competition_ruleset_revisions(
  id,competition_id,revision_number,structure_kind,status
) overriding system value values (9411,9411,1,'regulated','active');
insert into public.competition_stages(
  id,competition_id,ruleset_revision_id,code,name,stage_order,structure_kind
) overriding system value values
  (9411,9411,9411,'regular','Fase regular',1,'regulated');
insert into public.competition_rounds(
  id,competition_id,stage_id,code,name,round_order,structure_kind
) overriding system value values
  (9411,9411,9411,'rodada_1','Rodada 1',1,'regulated');
insert into public.matchups(
  id,competition_id,round_id,home_registration_id,away_registration_id,
  matchup_order,structure_kind
) overriding system value values
  (94101,9411,9411,9411,9412,1,'regulated');
insert into public.games(
  id,competition_id,game_number,status,source,matchup_id,matchup_game_number
) overriding system value values
  (94101,9411,'SITE-01','scheduled','seed',94101,1),
  (94102,9411,'LEGACY-01','scheduled','seed',94101,2);
insert into public.game_participants(game_id,competition_id,registration_id,side)
values
  (94101,9411,9411,'home'),(94101,9411,9412,'away'),
  (94102,9411,9411,'home'),(94102,9411,9412,'away');
insert into storage.objects(id,bucket_id,name,metadata) values (
  '94110000-0000-4000-8000-000000000001','boxscore-pdfs',
  '9411/'||repeat('b',64)||'.pdf',
  '{"size":104676,"mimetype":"application/pdf"}'::jsonb
);

create temp table site_boxscore_test_data(
  parsed jsonb,matches jsonb,resolution jsonb,import_id bigint
);
grant select,update on site_boxscore_test_data to authenticated;

with players as (
  select number,
    case when number<=5 then 'Instituto Site Fixture' else 'Saldanha Site Fixture' end team_name,
    case when number<=5 then number else number-5 end jersey,
    jsonb_build_object(
      'jerseyNumber',(case when number<=5 then number else number-5 end)::text,
      'name','A. Site '||number,'starter',true,'captain',number in (1,6),
      'didNotPlay',false,'secondsPlayed',2400,
      'fieldGoals',jsonb_build_object('made',0,'attempted',0),
      'twoPoints',jsonb_build_object('made',0,'attempted',0),
      'threePoints',jsonb_build_object('made',0,'attempted',0),
      'freeThrows',jsonb_build_object(
        'made',case when number=1 then 1 else 0 end,
        'attempted',case when number=1 then 1 else 0 end
      ),
      'offensiveRebounds',0,'defensiveRebounds',0,'rebounds',0,
      'assists',0,'turnovers',0,'steals',0,'blocks',0,
      'foulsCommitted',case when number=1 then 2 else 0 end,
      'foulsReceived',null,'plusMinus',null,'efficiency',0,
      'points',case when number=1 then 1 else 0 end
    ) player
  from generate_series(1,10) number
), teams as (
  select jsonb_build_array(
    jsonb_build_object(
      'name','Instituto Site Fixture','abbreviation',null,'score',1,
      'periodScores',null,
      'players',(select jsonb_agg(player order by number) from players where number<=5)
    ),
    jsonb_build_object(
      'name','Saldanha Site Fixture','abbreviation',null,'score',0,
      'periodScores',null,
      'players',(select jsonb_agg(player order by number) from players where number>5)
    )
  ) value
), matches as (
  select jsonb_agg(jsonb_build_object(
    'sourceTeamName',team_name,'sourcePlayerName','A. Site '||number,
    'sourceJersey',jersey::text,'kind','exact','rosterEntryId',9410+number,
    'score',1
  ) order by number) value from players
), resolution as (
  select jsonb_build_object(
    'gameId',94101,
    'teams',jsonb_build_array(
      jsonb_build_object('sourceTeamName','Instituto Site Fixture','registrationId',9411),
      jsonb_build_object('sourceTeamName','Saldanha Site Fixture','registrationId',9412)
    ),
    'players',jsonb_agg(jsonb_build_object(
      'sourceTeamName',team_name,'sourcePlayerName','A. Site '||number,
      'rosterEntryId',9410+number
    ) order by number)
  ) value from players
)
insert into site_boxscore_test_data(parsed,matches,resolution)
select jsonb_build_object(
  'format','BASKETBALL_SITE','parserVersion','basketball-site-v1',
  'competitionName',null,'gameNumber',null,
  'scheduledLocal','2026-05-13T20:30','durationSeconds',null,
  'venue','Sesport','teams',teams.value,'warnings','[]'::jsonb
),matches.value,resolution.value from teams,matches,resolution;

reset role;
select set_config('request.jwt.claims',jsonb_build_object(
  'sub',(select user_id from private.admin_accounts limit 1),
  'role','authenticated','aal','aal2'
)::text,true);
set local role authenticated;

select lives_ok($$
  update site_boxscore_test_data set import_id=(public.admin_begin_boxscore_import(
    9411,repeat('b',64),'9411/'||repeat('b',64)||'.pdf','boxscore-site.pdf',
    104676,'basketball-site-v1',parsed,
    '{"valid":true,"issues":[]}'::jsonb,matches
  )->>'importId')::bigint
$$,'a site-format import is reserved');
select is((select status from public.boxscore_imports
  where id=(select import_id from site_boxscore_test_data)),
  'uploaded','the site import waits for its private object');
select lives_ok($$
  select public.admin_mark_boxscore_import_ready(import_id,repeat('b',64),104676)
  from site_boxscore_test_data
$$,'the site import advances to review');
select is((select parser_version from public.boxscore_imports
  where id=(select import_id from site_boxscore_test_data)),
  'basketball-site-v1','the draft retains the real parser version');
-- Regression: both PDF commit entrypoints must honor an existing keyboard draft.
reset role;
insert into public.keyboard_scoresheets(game_id, document)
values (
  94101,
  '{"rulesVersion":"FIBA_2024","periods":4,"roster":[],"events":[],"coachPlayer":{"home":null,"away":null}}'::jsonb
);
set local role authenticated;
select throws_ok($
  select public.admin_commit_boxscore_import_v2(
    import_id,
    resolution-'gameId',
    jsonb_build_object(
      'mode','existing','gameId',94101,'applyReviewedMetadata',false,
      'scheduledAt','2026-05-13T23:30:00Z','venue','Sesport'
    )
  ) from site_boxscore_test_data
$, 'BD906', 'KEYBOARD_OTHER_SOURCE_ACTIVE', 'Site v2 cannot overwrite a keyboard draft');
select throws_ok($
  select public.admin_commit_boxscore_import(import_id, resolution)
  from site_boxscore_test_data
$, 'BD906', 'KEYBOARD_OTHER_SOURCE_ACTIVE', 'legacy Site commit cannot overwrite a keyboard draft');
select is((select status from public.boxscore_imports where id=(select import_id from site_boxscore_test_data)),
  'review', 'blocked Site import remains reviewable');
select is((select status from public.games where id=94101),
  'scheduled', 'blocked Site import does not finalize the game');
select is((select count(*) from public.keyboard_scoresheets where game_id=94101),
  1::bigint, 'Site collision retains the existing keyboard draft');
reset role;
delete from public.keyboard_scoresheets where game_id=94101;
set local role authenticated;

select lives_ok($
  select public.admin_commit_boxscore_import_v2(
    import_id,
    resolution-'gameId',
    jsonb_build_object(
      'mode','existing','gameId',94101,'applyReviewedMetadata',false,
      'scheduledAt','2026-05-13T23:30:00Z','venue','Sesport'
    )
  )
  from site_boxscore_test_data
$$,'the site-format import commits atomically through v2');
select is((select status from public.boxscore_imports
  where id=(select import_id from site_boxscore_test_data)),
  'confirmed','the site import is confirmed');
select is((select game_id from public.boxscore_imports
  where id=(select import_id from site_boxscore_test_data)),
  94101::bigint,'the pre-created structural game is reused');
select is((select count(*)::integer from public.game_periods
  where game_id=94101 and period_scope='game_total'),1,
  'one explicitly technical total bucket is stored');
select is((select count(*)::integer from public.game_period_scores
  where game_id=94101 and score_scope='game_total'),2,
  'only explicitly scoped game-total scores are stored');
select is((select count(*)::integer from public.player_period_stats
  where game_id=94101 and not plus_minus_available),10,
  'plus/minus is marked unavailable for every imported player');
select is((select count(*)::integer from public.player_period_stats
  where game_id=94101 and fouls_received is not null),0,
  'Basketball Site keeps received fouls unavailable rather than fabricating zero');
select is((select plus_minus from public.game_boxscore_player_statistics
  where game_id=94101 and player_id=9411),null::bigint,
  'the public projection exposes unavailable plus/minus as null');
select is((select plus_minus from public.competition_boxscore_player_statistics
  where competition_id=9411 and player_id=9411),null::bigint,
  'competition totals stay null when plus/minus coverage is incomplete');
select ok(
  lower(pg_get_viewdef('public.competition_boxscore_player_statistics'::regclass,true))
    like '%count(game_stats.plus_minus)%',
  'competition aggregation verifies complete plus/minus coverage'
);
select is((select count(*)::integer from public.game_team_statistics where game_id=94101),0,
  'team advanced statistics are not fabricated');
select is((select count(*)::integer from public.game_statistics where game_id=94101),0,
  'game advanced statistics are not fabricated');
select is((select count(*)::integer from public.game_data_domain_authority
  where game_id=94101),5,'only supported domains receive authority');
select is((select count(*)::integer from public.game_data_domain_authority
  where game_id=94101 and domain in ('period_scores','team_advanced','game_advanced')),0,
  'unavailable domains receive no authority');
select is((select count(*)::integer from public.game_data_submission_snapshots snapshot
  join public.game_data_submissions submission on submission.id=snapshot.submission_id
  where submission.game_id=94101),5,'only supported immutable snapshots are captured');
select is((select count(*)::integer from public.game_data_submission_snapshots snapshot
  join public.game_data_submissions submission on submission.id=snapshot.submission_id
  where submission.game_id=94101
    and snapshot.domain in ('period_scores','team_advanced','game_advanced')),0,
  'no snapshot claims unavailable data');
select is((select parsed_payload->'teams'->0->'periodScores'
  from public.boxscore_imports where id=(select import_id from site_boxscore_test_data)),
  'null'::jsonb,'the original source payload is restored after compatibility ingestion');
select is(public.admin_commit_boxscore_import_v2(
  (select import_id from site_boxscore_test_data),
  (select resolution-'gameId' from site_boxscore_test_data),
  jsonb_build_object(
    'mode','existing','gameId',94101,'applyReviewedMetadata',false,
    'scheduledAt','2026-05-13T23:30:00Z','venue','Sesport'
  )
),94101::bigint,'commit retry is idempotent');
select is((select count(*)::integer from public.admin_mutation_audit
  where action='boxscore_import_confirmed'
    and entity_id=(select import_id from site_boxscore_test_data)),1,
  'idempotence preserves a single confirmation audit record');

reset role;
select lives_ok(
  $$select private.backfill_legacy_competition_publication(9411,'published')$$,
  'the imported game can be captured in a publication'
);
select is((select count(*)::integer from public.competition_publication_statistics
  where competition_id=9411),1,'publication creates one immutable statistics header');
select is((select count(*)::integer from public.competition_player_statistics_publications
  where competition_id=9411 and scope='all'),10,
  'unclassified imported players are snapshotted only in the all scope');
select ok(private.game_is_currently_published(94101),
  'the unchanged game matches its published fingerprint');
select is(
  private.publication_game_fingerprint(94102),
  (select md5(jsonb_build_object(
      'id',game.id,'competitionId',game.competition_id,'number',game.game_number,
      'scheduledAt',game.scheduled_at,'venue',game.venue,'status',game.status,
      'matchupId',game.matchup_id,'matchupGameNumber',game.matchup_game_number,
      'participants',coalesce((select jsonb_agg(jsonb_build_object(
        'registrationId',participant.registration_id,'side',participant.side
      ) order by participant.side) from public.game_participants participant
        where participant.game_id=game.id),'[]'::jsonb),
      'periodScores',coalesce((select jsonb_agg(jsonb_build_object(
        'registrationId',score.registration_id,'period',score.period_number,'points',score.points
      ) order by score.period_number,score.registration_id)
        from public.game_period_scores score where score.game_id=game.id),'[]'::jsonb),
      'officialResultSubmissionId',(select authority.submission_id
        from public.game_data_domain_authority authority
        where authority.game_id=game.id and authority.domain='official_result')
    )::text) from public.games game where game.id=94102),
  'a game without technical totals preserves the legacy publication hash'
);
select ok(private.game_is_currently_published(94102),
  'a publication created before technical totals remains publicly visible');
create temp table site_fingerprint_before as
select private.publication_game_fingerprint(94101) value;
update public.game_period_scores
set points=points+1
where game_id=94101 and registration_id=9411 and score_scope='game_total';
select isnt(private.publication_game_fingerprint(94101),
  (select value from site_fingerprint_before),
  'changing a technical total changes the publication fingerprint');
select ok(not private.game_is_currently_published(94101),
  'changing a technical total invalidates the published game');

select * from finish();
rollback;
