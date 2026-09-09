begin;

create extension if not exists pgtap with schema extensions;
select plan(27);
set constraints all deferred;
select set_config('bdb.allow_internal_ingestion_game', 'on', true);

insert into private.admin_accounts (user_id)
select '11111111-1111-4111-8111-111111111111'
where not exists (select 1 from private.admin_accounts);

insert into public.competition_series (id, name, slug)
overriding system value values (9801, 'Liga Perfil', 'liga-perfil');
insert into public.categories (id, name, slug)
overriding system value values (9801, 'Perfil Sub-17', 'perfil-sub-17');
insert into public.competitions
  (id, series_id, category_id, year, display_name, status, published_at)
overriding system value values
  (9801, 9801, 9801, 2026, 'Liga Perfil 2026 Sub-17', 'published', now());
insert into public.teams (id, name, slug, abbreviation, is_public)
overriding system value values
  (9801, 'Equipe Perfil', 'equipe-perfil', 'PRF', true),
  (9802, 'Equipe Visitante Perfil', 'equipe-visitante-perfil', 'EVP', true);
insert into public.players (id, full_name, slug, nickname, is_public)
overriding system value values
  (9801, 'Atleta Perfil Publico', 'atleta-perfil-publico', 'Perfil', true),
  (9802, 'Atleta Perfil Privado', 'atleta-perfil-privado', 'Reservado', false);
insert into public.player_profiles
  (player_id, birth_year, bio, height_cm, weight_kg, main_position, hand, home_city, home_state)
values
  (9801, 2008, 'Perfil público de teste.', 188, 82.50, 'Ala', 'Direita', 'São Paulo', 'SP'),
  (9802, 2007, 'Perfil privado de teste.', 180, 75.00, 'Armador', 'Esquerda', 'Santos', 'SP');
insert into private.player_private (player_id, birth_date)
values
  (9801, '2008-04-12'),
  (9802, '2007-05-13')
on conflict (player_id) do update
set birth_date = excluded.birth_date;
insert into public.team_registrations
  (id, competition_id, team_id, status, confirmed_at)
overriding system value values
  (9801, 9801, 9801, 'confirmed', now()),
  (9802, 9801, 9802, 'confirmed', now());
insert into public.roster_entries
  (id, competition_id, registration_id, player_id, jersey_number, position)
overriding system value values
  (9801, 9801, 9801, 9801, '9', 'Ala'),
  (9802, 9801, 9802, 9802, '10', 'Armador');
insert into public.games (id, competition_id, game_number, status, source)
overriding system value values (9801, 9801, 'PROFILE-01', 'final', 'seed');
insert into public.game_participants (game_id, competition_id, registration_id, side)
values (9801, 9801, 9801, 'home'), (9801, 9801, 9802, 'away');
insert into public.game_periods (game_id, period_number)
values (9801, 1), (9801, 2);
insert into public.game_roster_slots
  (id, game_id, registration_id, slot_number, roster_entry_id, jersey_number, is_starter)
overriding system value values (9801, 9801, 9801, 1, 9801, '9', true);
insert into public.player_period_stats
  (game_roster_slot_id, game_id, period_number, two_point_made, two_point_attempted,
   offensive_rebounds, assists, stat_scope)
values
  (9801, 9801, 1, 2, 3, 1, 1, 'period'),
  (9801, 9801, 2, 1, 2, 2, 2, 'period');
insert into public.foul_events
  (game_roster_slot_id, game_id, period_number, sequence_number, foul_code)
values
  (9801, 9801, 1, 1, 'P'),
  (9801, 9801, 2, 1, 'T');
insert into public.player_honors
  (id, player_id, competition_id, title, year, status, confirmed_by, confirmed_at)
overriding system value
select 9801, 9801, 9801, 'MVP da edição', 2026, 'confirmed', user_id, now()
from private.admin_accounts;
insert into public.player_honors (id, player_id, title, year)
overriding system value values (9802, 9801, 'Honraria em revisão', 2026);

select has_column('public', 'players', 'nickname', 'players exposes the public nickname');
select has_column(
  'public', 'players', 'birth_date',
  'legacy birth date column remains for schema compatibility'
);
select has_table('public', 'player_profiles', 'public one-to-one profiles exist');
select has_table('private', 'player_private', 'private player data exists outside public schema');
select has_table('public', 'player_honors', 'manual player honors exist');
select has_view('public', 'public_player_profiles', 'safe public player facade exists');
select has_column('public', 'roster_entries', 'position', 'edition-specific position exists');
select ok(
  (select 'security_invoker=true' = any(reloptions)
   from pg_class where oid = 'public.public_player_profiles'::regclass),
  'public player facade executes as security invoker'
);
select hasnt_column(
  'public', 'public_player_profiles', 'birth_date',
  'public facade does not expose full birth date'
);
select hasnt_column(
  'public', 'public_player_profiles', 'federation_no',
  'public facade does not expose federation number'
);
select is(
  (select birth_year from public.public_player_profiles where id = 9801),
  2008::smallint,
  'public facade exposes only the birth year'
);
select is(
  (select birth_date from private.player_private where player_id = 9801),
  '2008-04-12'::date,
  'private storage preserves the full birth date'
);
select throws_ok(
  $$update public.players set birth_date = '2008-04-12' where id = 9801$$,
  '23514',
  'new row for relation "players" violates check constraint "players_legacy_birth_date_null_check"',
  'legacy public birth date column cannot retain private data'
);
select throws_ok(
  $$insert into private.player_private (player_id, birth_date)
    values (9801, '2000-01-01')$$,
  '23505',
  'duplicate key value violates unique constraint "player_private_pkey"',
  'one private identity row exists per player'
);
select throws_ok(
  $$update public.player_profiles set height_cm = 20 where player_id = 9801$$,
  '23514',
  'new row for relation "player_profiles" violates check constraint "player_profiles_height_cm_check"',
  'invalid profile measurements are rejected'
);
select is(
  (select points from public.competition_player_statistics
   where competition_id = 9801 and player_id = 9801),
  6::bigint,
  'period totals are not multiplied by foul joins'
);
select is(
  (select fouls from public.competition_player_statistics
   where competition_id = 9801 and player_id = 9801),
  2::bigint,
  'fouls are aggregated independently'
);
select is(
  (select starter_appearances from public.competition_player_statistics
   where competition_id = 9801 and player_id = 9801),
  1::bigint,
  'starter appearances count each game once'
);
select is(
  (select team_abbreviation from public.competition_player_statistics
   where competition_id = 9801 and player_id = 9801),
  'PRF'::text,
  'edition aggregate includes the contextual team abbreviation'
);
select is(
  (select jersey_number from public.competition_player_statistics
   where competition_id = 9801 and player_id = 9801),
  '9'::text,
  'edition aggregate includes the contextual jersey'
);
select ok(
  not has_table_privilege('anon', 'private.player_private', 'select'),
  'anonymous users have no direct access to private player data'
);

set local role anon;
select is(
  (select count(*) from public.public_player_profiles where id in (9801, 9802)),
  1::bigint,
  'anonymous facade exposes only public players'
);
select is(
  (select count(*) from public.player_honors where player_id = 9801),
  1::bigint,
  'anonymous users see only confirmed honors'
);
select throws_ok(
  $$insert into public.player_profiles (player_id, bio)
    values (9802, 'Tentativa anônima')$$,
  '42501',
  'permission denied for table player_profiles',
  'anonymous users cannot write player profiles'
);
select throws_ok(
  $$select count(*) from private.player_private$$,
  '42501',
  'permission denied for schema private',
  'anonymous users cannot query the private schema'
);

reset role;
select ok(
  has_table_privilege('authenticated', 'public.player_profiles', 'insert'),
  'authenticated role has the grant required for AAL2-controlled profile writes'
);
select ok(
  not has_table_privilege('authenticated', 'public.player_profiles', 'delete'),
  'destructive profile deletes are not granted'
);

select * from finish();
rollback;

