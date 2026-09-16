begin;
\ir ../helpers/final_profile_fixtures.sql

create extension if not exists pgtap with schema extensions;
select plan(16);
set constraints all deferred;

insert into private.admin_accounts (user_id)
select '11111111-1111-4111-8111-111111111111'
where not exists (select 1 from private.admin_accounts);

insert into public.competition_series (id, name, slug)
overriding system value values (9701, 'Liga Busca', 'liga-busca');
insert into public.categories (id, name, slug)
overriding system value values (9701, 'Categoria Busca', 'categoria-busca');
select pg_temp.create_final_competition(
  9701,9701,9701,2026,'Liga Busca 2026','published',now(),'male','manual_scoresheet'
);
insert into public.teams (id, name, slug)
overriding system value values (9701, 'Equipe Busca', 'equipe-busca');
insert into public.players (id, full_name, nickname, slug)
overriding system value values
  (9701, 'João da Silva', 'Joca', 'joao-da-silva'),
  (9702, 'Maria das Dores', null, 'maria-das-dores');
insert into private.player_private(player_id,sex,sex_review_required)
values(9701,'male',false),(9702,'male',false);
insert into public.team_registrations (id, competition_id, team_id, status, confirmed_at)
overriding system value values (9701, 9701, 9701, 'confirmed', now());
insert into public.roster_entries
  (id, competition_id, registration_id, player_id, jersey_number)
overriding system value values (9701, 9701, 9701, 9701, '10');

select has_function(
  'public',
  'admin_search_players',
  array['bigint', 'text', 'bigint', 'integer'],
  'limited administrative search RPC exists'
);
select has_function(
  'public',
  'admin_create_player_with_private_profile',
  array['text', 'text', 'text', 'boolean'],
  'atomic private administrative creation RPC exists'
);
select ok(
  not has_function_privilege('anon', 'public.admin_search_players(bigint,text,bigint,integer)', 'execute'),
  'anonymous role cannot execute administrative search'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.admin_create_player_with_private_profile(text,text,text,boolean)',
    'execute'
  ),
  'anonymous role cannot execute administrative creation'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.admin_create_player(text,text,boolean)',
    'execute'
  ),
  'the former creation RPC cannot create players without private eligibility data'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select * from public.admin_search_players(9701, 'joao', null, 12)$$,
  'BD401', 'BDB_ADMIN_AAL2_REQUIRED',
  'a non-admin at aal2 cannot search players'
);
select throws_ok(
  $$select * from public.admin_create_player_with_private_profile(
      'Atleta sem autorização', 'male', null, false
    )$$,
  'BD401', 'BDB_ADMIN_AAL2_REQUIRED',
  'a non-admin at aal2 cannot create players with private data'
);

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', (select user_id from private.admin_accounts), 'role', 'authenticated', 'aal', 'aal2')::text,
  true
);
set local role authenticated;

select results_eq(
  $$select full_name from public.admin_search_players(9701, 'JOAO DA SILVA', null, 12)$$,
  $$values ('João da Silva'::text)$$,
  'search ignores accents and case'
);
select results_eq(
  $$select full_name from public.admin_search_players(9701, 'oca', 9701, 12)$$,
  $$values ('João da Silva'::text)$$,
  'search supports nickname substrings'
);
select is(
  (select conflict_registration_id from public.admin_search_players(9701, 'joao da silva', null, 12)),
  9701::bigint,
  'search reports an edition roster conflict'
);
select lives_ok(
  $$select public.admin_create_player_with_private_profile(
      'Álvaro Nunes', 'male', 'Alvinho', false
    )$$,
  'aal2 administrator creates a private player'
);
select is(
  (
    select private_profile.sex
    from public.admin_get_player_private_profile(
      (select id from public.players where full_name = 'Álvaro Nunes')
    ) private_profile
  ),
  'male'::text,
  'creation stores the explicit value only in the private companion row'
);
select is(
  (select count(*) from public.admin_mutation_audit where action = 'player_created'),
  1::bigint,
  'successful creation is audited once'
);
select throws_ok(
  $$select public.admin_create_player_with_private_profile(
      'Alvaro Nunes', 'male', null, false
    )$$,
  'BD308', 'BDB_PLAYER_ALREADY_EXISTS',
  'normalized exact duplicates are rejected'
);
select throws_ok(
  $$select public.admin_create_player_with_private_profile(
      'Maria das', 'female', null, false
    )$$,
  'BD311', 'BDB_PLAYER_SIMILAR_REVIEW_REQUIRED',
  'similar names require explicit review'
);
select ok(
  (
    select
      not (metadata ? 'sex') and
      metadata::text not like '%male%' and
      metadata::text not like '%female%'
    from public.admin_mutation_audit
    where action = 'player_sex_reviewed'
      and entity_id = (select id from public.players where full_name = 'Álvaro Nunes')
  ),
  'creation audit contains no private eligibility value'
);

reset role;
select * from finish();
rollback;
