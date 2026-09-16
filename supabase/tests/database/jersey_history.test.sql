begin;
\ir ../helpers/final_profile_fixtures.sql

create extension if not exists pgtap with schema extensions;
select plan(5);
select set_config('bdb.allow_internal_ingestion_game', 'on', true);

insert into public.competition_series (id, name, slug)
overriding system value values (9301, 'Liga Camisas', 'liga-camisas');
insert into public.categories (id, name, slug)
overriding system value values (9301, 'Categoria Camisas', 'categoria-camisas');
select pg_temp.create_final_competition(
  9301,9301,9301,2026,'Liga Camisas 2026','published',now(),'male','manual_scoresheet'
);
insert into public.teams (id, name, slug, is_public)
overriding system value values
  (9301, 'Time Camisas', 'time-camisas', true),
  (9302, 'Adversário Camisas', 'adversario-camisas', true);
insert into public.players (id, full_name, slug, is_public)
overriding system value values (9301, 'Jogador Camisas', 'jogador-camisas', true);
insert into private.player_private(player_id,sex,sex_review_required)
values(9301,'male',false);
insert into public.team_registrations
  (id, competition_id, team_id, status, confirmed_at)
overriding system value values
  (9301, 9301, 9301, 'confirmed', now()),
  (9302, 9301, 9302, 'confirmed', now());
insert into public.roster_entries
  (id, competition_id, registration_id, player_id, jersey_number)
overriding system value values (9301, 9301, 9301, 9301, '00');
insert into public.games
  (id, competition_id, game_number, status, ended_at, source)
overriding system value values
  (9301, 9301, 'C-1', 'final', '2026-01-01T12:00:00Z', 'seed'),
  (9302, 9301, 'C-2', 'final', '2026-02-01T12:00:00Z', 'seed'),
  (9303, 9301, 'C-3', 'final', '2026-03-01T12:00:00Z', 'seed'),
  (9304, 9301, 'C-4', 'live', null, 'seed');
insert into public.game_participants (game_id, competition_id, registration_id, side)
values
  (9301, 9301, 9301, 'home'),
  (9301, 9301, 9302, 'away'),
  (9302, 9301, 9301, 'home'),
  (9302, 9301, 9302, 'away'),
  (9303, 9301, 9301, 'home'),
  (9303, 9301, 9302, 'away'),
  (9304, 9301, 9301, 'home'),
  (9304, 9301, 9302, 'away');
insert into public.game_roster_slots
  (id, game_id, registration_id, slot_number, roster_entry_id, jersey_number)
overriding system value values
  (9301, 9301, 9301, 1, 9301, '00'),
  (9302, 9302, 9301, 1, 9301, '0'),
  (9304, 9304, 9301, 1, 9301, '9');

select is(
  (select count(*) from public.player_jersey_history where player_id = 9301),
  2::bigint,
  'only final games enter jersey history'
);
select results_eq(
  $$select distinct jersey_number from public.player_jersey_history
    where player_id = 9301 order by jersey_number$$,
  $$values ('0'::text), ('00'::text)$$,
  '0 and 00 remain separate history values'
);
select is(
  (select jersey_number from public.player_primary_jerseys where player_id = 9301),
  '0'::text,
  'most recent use breaks a frequency tie'
);

insert into public.game_roster_slots
  (id, game_id, registration_id, slot_number, roster_entry_id, jersey_number)
overriding system value values (9303, 9303, 9301, 1, 9301, '00');
select is(
  (select jersey_number from public.player_primary_jerseys where player_id = 9301),
  '00'::text,
  'higher distinct-game frequency wins deterministically'
);

do $$begin
  perform private.backfill_legacy_competition_publication(9301,'published');
end$$;
set local role anon;
select is(
  (select game_count from public.player_primary_jerseys where player_id = 9301),
  2::bigint,
  'the public profile reads the precomputed primary jersey through RLS'
);

reset role;
select * from finish();
rollback;
