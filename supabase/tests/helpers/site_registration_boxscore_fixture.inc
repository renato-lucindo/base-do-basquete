-- Basketball Site contract fixture with A/B registrations and absent source abbreviations.
\ir final_profile_fixtures.inc
set constraints all deferred;
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
  (9411,'Clube Site','instituto-site-fixture','CSI'),
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


update public.team_registrations set team_id=9411,
public_name=case id when 9411 then 'Instituto Site Fixture' else 'Saldanha Site Fixture' end
where id in (9411,9412);
reset role;
select set_config('request.jwt.claims',jsonb_build_object(
  'sub',(select user_id from private.admin_accounts limit 1),'role','authenticated','aal','aal2'
)::text,true);
set local role authenticated;
update site_boxscore_test_data set import_id=(public.admin_begin_boxscore_import(
  9411,repeat('b',64),'9411/'||repeat('b',64)||'.pdf','boxscore-site.pdf',
  104676,'basketball-site-v1',parsed,'{"valid":true,"issues":[]}',matches
)->>'importId')::bigint;
select public.admin_mark_boxscore_import_ready(import_id,repeat('b',64),104676) from site_boxscore_test_data;
