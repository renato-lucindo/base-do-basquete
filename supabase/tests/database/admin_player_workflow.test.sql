begin;

create extension if not exists pgtap with schema extensions;
select plan(12);
set constraints all deferred;

insert into private.admin_accounts (user_id)
select '11111111-1111-4111-8111-111111111111'
where not exists (select 1 from private.admin_accounts);

insert into public.competition_series (id, name, slug)
overriding system value values (9701, 'Liga Busca', 'liga-busca');
insert into public.categories (id, name, slug)
overriding system value values (9701, 'Categoria Busca', 'categoria-busca');
insert into public.competitions
  (id, series_id, category_id, year, display_name, status, published_at)
overriding system value values
  (9701, 9701, 9701, 2026, 'Liga Busca 2026', 'published', now());
insert into public.teams (id, name, slug)
overriding system value values (9701, 'Equipe Busca', 'equipe-busca');
insert into public.players (id, full_name, nickname, slug)
overriding system value values
  (9701, 'João da Silva', 'Joca', 'joao-da-silva'),
  (9702, 'Maria das Dores', null, 'maria-das-dores');
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
  'admin_create_player',
  array['text', 'text', 'boolean'],
  'audited administrative creation RPC exists'
);
select ok(
  not has_function_privilege('anon', 'public.admin_search_players(bigint,text,bigint,integer)', 'execute'),
  'anonymous role cannot execute administrative search'
);
select ok(
  not has_function_privilege('anon', 'public.admin_create_player(text,text,boolean)', 'execute'),
  'anonymous role cannot execute administrative creation'
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

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', (select user_id from private.admin_accounts), 'role', 'authenticated', 'aal', 'aal2')::text,
  true
);
set local role authenticated;

select results_eq(
  $$select full_name from public.admin_search_players(9701, 'JOAO', null, 12)$$,
  $$values ('João da Silva'::text)$$,
  'search ignores accents and case'
);
select results_eq(
  $$select full_name from public.admin_search_players(9701, 'oca', 9701, 12)$$,
  $$values ('João da Silva'::text)$$,
  'search supports nickname substrings'
);
select is(
  (select conflict_registration_id from public.admin_search_players(9701, 'joao', null, 12)),
  9701::bigint,
  'search reports an edition roster conflict'
);
select lives_ok(
  $$select public.admin_create_player('Álvaro Nunes', 'Alvinho', false)$$,
  'aal2 administrator creates a private player'
);
select is(
  (select count(*) from public.admin_mutation_audit where action = 'player_created'),
  1::bigint,
  'successful creation is audited once'
);
select throws_ok(
  $$select public.admin_create_player('Alvaro Nunes', null, false)$$,
  'BD308', 'BDB_PLAYER_ALREADY_EXISTS',
  'normalized exact duplicates are rejected'
);
select throws_ok(
  $$select public.admin_create_player('Maria das', null, false)$$,
  'BD311', 'BDB_PLAYER_SIMILAR_REVIEW_REQUIRED',
  'similar names require explicit review'
);

reset role;
select * from finish();
rollback;
