begin;
\ir ../helpers/final_profile_fixtures.inc

create extension if not exists pgtap with schema extensions;
select plan(36);
set constraints all deferred;
select set_config('bdb.allow_internal_ingestion_game', 'on', true);

insert into private.admin_accounts (user_id)
select '11111111-1111-4111-8111-111111111111'
where not exists (select 1 from private.admin_accounts);

insert into public.competition_series (id, name, slug)
overriding system value values (9701, 'Liga Sumula V2', 'liga-sumula-v2');
insert into public.categories (id, name, slug)
overriding system value values (9701, 'Categoria Sumula V2', 'categoria-sumula-v2');
select pg_temp.create_final_competition(
  9701,9701,9701,2026,'Liga Sumula V2 2026','published',now(),'male','manual_scoresheet'
);

insert into public.teams (id, name, slug)
overriding system value values
  (9701, 'Time Sumula V2 Casa', 'time-sumula-v2-casa'),
  (9702, 'Time Sumula V2 Fora', 'time-sumula-v2-fora');

insert into public.players (id, full_name, slug)
overriding system value values
  (9701, 'Capitao Sumula V2', 'capitao-sumula-v2'),
  (9702, 'Visitante Sumula V2', 'visitante-sumula-v2');
insert into private.player_private(player_id,sex,sex_review_required)
values (9701,'male',false),(9702,'male',false);

insert into public.team_registrations
  (id, competition_id, team_id, status, confirmed_at)
overriding system value values
  (9701, 9701, 9701, 'confirmed', now()),
  (9702, 9701, 9702, 'confirmed', now());

insert into public.roster_entries
  (id, competition_id, registration_id, player_id, jersey_number, status)
overriding system value values
  (9701, 9701, 9701, 9701, '00', 'active'),
  (9702, 9701, 9702, 9702, '7', 'active');

insert into public.games (id, competition_id, game_number, status, source)
overriding system value values (9701, 9701, 'SUM-V2-01', 'scheduled', 'seed');
insert into public.game_participants (game_id, competition_id, registration_id, side)
values
  (9701, 9701, 9701, 'home'),
  (9701, 9701, 9702, 'away');
insert into public.game_periods (game_id, period_number)
values (9701, 1);
insert into public.game_roster_slots
  (id, game_id, registration_id, slot_number, roster_entry_id, jersey_number, is_starter, is_captain)
overriding system value values
  (9701, 9701, 9701, 1, 9701, '00', true, true),
  (9702, 9701, 9702, 1, 9702, '7', true, false);

select has_column('public', 'foul_events', 'registration_id', 'semantic foul target registration is persisted');
select has_column('public', 'foul_events', 'target_kind', 'semantic foul target kind is persisted');
select has_column('public', 'foul_events', 'foul_type', 'semantic foul type is persisted');
select has_column('public', 'foul_events', 'penalty_ft_count', 'foul penalty free throws are persisted separately');
select has_column('public', 'foul_events', 'original_notation', 'original foul notation is persisted');
select has_column('public', 'foul_events', 'foul_rules_version', 'foul rules version is persisted');

select lives_ok(
  $$insert into public.foul_events
      (game_roster_slot_id, game_id, period_number, sequence_number, foul_code)
    values (9701, 9701, 1, 1, 'U2')$$,
  'legacy foul insert shape remains accepted'
);
select results_eq(
  $$select registration_id, target_kind, foul_type, penalty_ft_count,
      original_notation, foul_rules_version
    from public.foul_events
    where game_roster_slot_id = 9701 and period_number = 1 and sequence_number = 1$$,
  $$values (9701::bigint, 'player'::text, 'U'::text, 2::smallint, 'U2'::text, 'FIBA_2024'::text)$$,
  'legacy U2 is normalized without losing its notation'
);

select lives_ok(
  $$insert into public.foul_events
      (game_roster_slot_id, game_id, registration_id, target_kind, period_number,
       sequence_number, foul_code, foul_type, penalty_ft_count, original_notation)
    values (9701, 9701, 9701, 'player', 1, 2, 'P', 'P', 0, 'P')$$,
  'explicit player semantic foul is accepted'
);
select throws_ok(
  $$insert into public.foul_events
      (game_roster_slot_id, game_id, registration_id, target_kind, period_number,
       sequence_number, foul_code, foul_type, penalty_ft_count, original_notation)
    values (9701, 9701, 9702, 'player', 1, 3, 'P', 'P', 0, 'P')$$,
  '23514', 'BDB_FOUL_PLAYER_TARGET_INVALID',
  'player registration must match the applicable roster slot'
);
select throws_ok(
  $$insert into public.foul_events
      (game_roster_slot_id, game_id, registration_id, target_kind, period_number,
       sequence_number, foul_code, foul_type, penalty_ft_count, original_notation)
    values (null, 9701, 9701, 'player', 1, 4, 'P', 'P', 0, 'P')$$,
  '23514', 'BDB_FOUL_PLAYER_TARGET_INVALID',
  'player target requires an applicable roster slot'
);

select lives_ok(
  $$insert into public.foul_events
      (game_roster_slot_id, game_id, registration_id, target_kind, staff_role,
       period_number, sequence_number, foul_code, foul_type, penalty_ft_count, original_notation)
    values (null, 9701, 9701, 'bench', null, 1, 1, 'T', 'T', 1, 'B1')$$,
  'bench foul has its own semantic target without an athlete slot'
);
select lives_ok(
  $$insert into public.foul_events
      (game_roster_slot_id, game_id, registration_id, target_kind, staff_role,
       period_number, sequence_number, foul_code, foul_type, penalty_ft_count, original_notation)
    values (null, 9701, 9701, 'staff', 'coach', 1, 1, 'T', 'T', 1, 'C1')$$,
  'staff foul persists role and official C1 notation'
);
select lives_ok(
  $$insert into public.foul_events
      (game_roster_slot_id, game_id, registration_id, target_kind, staff_role,
       period_number, sequence_number, foul_code, foul_type, penalty_ft_count, original_notation)
    values (null, 9701, 9701, 'team', null, 1, 1, 'T', 'T', 0, 'T')$$,
  'team foul has its own semantic target'
);
select is(
  (select count(*) from public.foul_events
   where game_id = 9701 and registration_id = 9701 and period_number = 1
     and sequence_number = 1 and target_kind in ('bench','team')),
  2::bigint,
  'bench and team sequence spaces are independent'
);

select throws_ok(
  $$insert into public.foul_events
      (game_roster_slot_id, game_id, registration_id, target_kind, period_number,
       sequence_number, foul_code, foul_type, penalty_ft_count, original_notation)
    values (9701, 9701, 9701, 'bench', 1, 2, 'T', 'T', 1, 'B1')$$,
  '23514',
  'new row for relation "foul_events" violates check constraint "foul_events_target_shape_check"',
  'bench target cannot point to an athlete slot'
);
select throws_ok(
  $$insert into public.foul_events
      (game_roster_slot_id, game_id, registration_id, target_kind, staff_role,
       period_number, sequence_number, foul_code, foul_type, penalty_ft_count, original_notation)
    values (null, 9701, 9701, 'staff', null, 1, 2, 'T', 'T', 1, 'C1')$$,
  '23514',
  'new row for relation "foul_events" violates check constraint "foul_events_target_shape_check"',
  'staff target requires a supported staff role'
);
select throws_ok(
  $$insert into public.foul_events
      (game_roster_slot_id, game_id, registration_id, target_kind, staff_role,
       period_number, sequence_number, foul_code, foul_type, penalty_ft_count, original_notation)
    values (null, 9701, 9701, 'team', 'coach', 1, 2, 'T', 'T', 0, 'T')$$,
  '23514',
  'new row for relation "foul_events" violates check constraint "foul_events_target_shape_check"',
  'team target cannot impersonate a staff role'
);

select lives_ok(
  $$insert into public.game_team_staff
      (game_id, registration_id, role, display_name, origin)
    values (9701, 9701, 'assistant_1', 'Assistente Manual', 'manual')$$,
  'manual team staff is persisted'
);
select lives_ok(
  $$insert into public.game_team_staff
      (game_id, registration_id, role, display_name, origin, linked_captain_roster_entry_id)
    values (9701, 9701, 'coach', 'Capitao Sumula V2', 'captain_placeholder', 9701)$$,
  'captain placeholder preserves its roster-entry link'
);
select throws_ok(
  $$insert into public.game_team_staff
      (game_id, registration_id, role, display_name, origin, linked_captain_roster_entry_id)
    values (9701, 9702, 'assistant_1', 'Placeholder Invalido', 'captain_placeholder', 9702)$$,
  '23514',
  'new row for relation "game_team_staff" violates check constraint "game_team_staff_placeholder_check"',
  'captain placeholder is limited to the coach role'
);
select throws_ok(
  $$insert into public.game_team_staff
      (game_id, registration_id, role, display_name, origin, linked_captain_roster_entry_id)
    values (9701, 9702, 'coach', 'Manual Invalido', 'manual', 9702)$$,
  '23514',
  'new row for relation "game_team_staff" violates check constraint "game_team_staff_placeholder_check"',
  'manual coach cannot retain a captain placeholder link'
);

select lives_ok(
  $$insert into public.game_officials (game_id, role, display_name)
    values (9701, 'Árbitro', 'Arbitro Principal')$$,
  'supported game official role is persisted'
);
select throws_ok(
  $$insert into public.game_officials (game_id, role, display_name)
    values (9701, 'Video', 'Oficial Invalido')$$,
  '23514',
  'new row for relation "game_officials" violates check constraint "game_officials_role_check"',
  'unsupported game official role is rejected'
);

select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.game_team_staff'::regclass),
  'team staff forces row level security'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.game_officials'::regclass),
  'game officials force row level security'
);
select ok(
  not has_table_privilege('anon', 'public.game_team_staff', 'select'),
  'anonymous role has no team staff select grant'
);
select ok(
  not has_table_privilege('anon', 'public.game_officials', 'select'),
  'anonymous role has no game officials select grant'
);
select ok(
  has_table_privilege('authenticated', 'public.game_team_staff', 'select'),
  'authenticated role receives the guarded team staff select grant'
);
select ok(
  has_table_privilege('authenticated', 'public.game_officials', 'select'),
  'authenticated role receives the guarded game officials select grant'
);
select ok(
  has_table_privilege('anon', 'public.foul_events', 'select'),
  'existing public foul event select contract is preserved'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.game_team_staff$$,
  '42501', 'permission denied for table game_team_staff',
  'anonymous users cannot inspect team staff'
);
select throws_ok(
  $$select count(*) from public.game_officials$$,
  '42501', 'permission denied for table game_officials',
  'anonymous users cannot inspect game officials'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select results_eq(
  $$select
      (select count(*) from public.game_team_staff),
      (select count(*) from public.game_officials)$$,
  $$values (0::bigint, 0::bigint)$$,
  'non-admin authenticated users cannot see guarded staff or officials'
);

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (select user_id from private.admin_accounts),
    'role', 'authenticated',
    'aal', 'aal1'
  )::text,
  true
);
set local role authenticated;
select results_eq(
  $$select
      (select count(*) from public.game_team_staff),
      (select count(*) from public.game_officials)$$,
  $$values (0::bigint, 0::bigint)$$,
  'singleton administrator at aal1 cannot see guarded staff or officials'
);

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (select user_id from private.admin_accounts),
    'role', 'authenticated',
    'aal', 'aal2'
  )::text,
  true
);
set local role authenticated;
select results_eq(
  $$select
      (select count(*) from public.game_team_staff),
      (select count(*) from public.game_officials)$$,
  $$values (2::bigint, 1::bigint)$$,
  'singleton administrator at aal2 can inspect team staff and officials'
);

reset role;
select * from finish();
rollback;
