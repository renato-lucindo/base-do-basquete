begin;
\ir ../helpers/final_profile_fixtures.inc

create extension if not exists pgtap with schema extensions;
select plan(37);
set constraints all deferred;

insert into private.admin_accounts (user_id)
select '11111111-1111-4111-8111-111111111111'
where not exists (select 1 from private.admin_accounts);

insert into public.competition_series (id, name, slug)
overriding system value values (9201, 'Liga RPC', 'liga-rpc');
insert into public.categories (id, name, slug)
overriding system value values (9201, 'Categoria RPC', 'categoria-rpc');
select pg_temp.create_final_competition(
  9201,9201,9201,2026,'Liga RPC 2026','published',now(),'male','manual_scoresheet'
);
select pg_temp.create_final_competition(
  9202,9201,9201,2027,'Liga RPC 2027','published',now(),'male','manual_scoresheet'
);
insert into public.teams (id, name, slug)
overriding system value values
  (9201, 'Time RPC Um', 'time-rpc-um'),
  (9202, 'Time RPC Dois', 'time-rpc-dois'),
  (9203, 'Time RPC Tres', 'time-rpc-tres');
insert into public.players (id, full_name, slug)
overriding system value values
  (9201, 'Jogador RPC Um', 'jogador-rpc-um'),
  (9202, 'Jogador RPC Dois', 'jogador-rpc-dois'),
  (9203, 'Jogador RPC Tres', 'jogador-rpc-tres');
insert into private.player_private(player_id,sex,sex_review_required)
values(9201,'male',false),(9202,'male',false),(9203,'male',false);

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.admin_create_team_registration(9201, 9201)$$,
  'BD401', 'BDB_ADMIN_AAL2_REQUIRED',
  'a non-admin at aal2 cannot create registrations'
);
select throws_ok(
  $$select public.admin_create_team('Equipe não autorizada', 'ENA')$$,
  'BD401', 'BDB_ADMIN_AAL2_REQUIRED',
  'a non-admin at aal2 cannot create teams'
);
select throws_ok(
  $$select public.admin_create_and_register_team(9201, 'Equipe não autorizada', 'ENA')$$,
  'BD401', 'BDB_ADMIN_AAL2_REQUIRED',
  'a non-admin at aal2 cannot create and register teams'
);
select throws_ok(
  $$select private.admin_resolve_team('Equipe não autorizada', 'ENA')$$,
  'BD401', 'BDB_ADMIN_AAL2_REQUIRED',
  'the private team resolver also rejects a non-admin at aal2'
);

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', (select user_id from private.admin_accounts), 'role', 'authenticated', 'aal', 'aal1')::text,
  true
);
set local role authenticated;
select throws_ok(
  $$select public.admin_create_team_registration(9201, 9201)$$,
  'BD401', 'BDB_ADMIN_AAL2_REQUIRED',
  'the administrator at aal1 cannot create registrations'
);
select throws_ok(
  $$select public.admin_create_and_register_team(9201, 'Equipe sem MFA', 'ESM')$$,
  'BD401', 'BDB_ADMIN_AAL2_REQUIRED',
  'the administrator at aal1 cannot create and register teams'
);
select throws_ok(
  $$select private.admin_resolve_team('Equipe sem MFA', 'ESM')$$,
  'BD401', 'BDB_ADMIN_AAL2_REQUIRED',
  'the private team resolver also requires administrator aal2'
);

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', (select user_id from private.admin_accounts), 'role', 'authenticated', 'aal', 'aal2')::text,
  true
);
set local role authenticated;

select lives_ok(
  $$select public.admin_create_team_registration(9201, 9201)$$,
  'aal2 creates one registration'
);
select lives_ok(
  $$select public.admin_create_team_registration(9201, 9201)$$,
  'registration creation is idempotent'
);
select is(
  (select count(*) from public.team_registrations where competition_id = 9201 and team_id = 9201),
  1::bigint,
  'idempotency leaves one row'
);
select is(
  (select status from public.admin_transition_team_registration(
    (select id from public.team_registrations where competition_id = 9201 and team_id = 9201),
    'confirmed'
  )),
  'confirmed'::text,
  'draft registration transitions to confirmed'
);
select throws_ok(
  $$select public.admin_transition_team_registration(
      (select id from public.team_registrations where competition_id = 9201 and team_id = 9201),
      'draft'
    )$$,
  'BD102', 'BDB_INVALID_REGISTRATION_TRANSITION',
  'invalid reverse transition is rejected'
);
select lives_ok(
  $$select * from public.admin_replace_roster(
      (select id from public.team_registrations where competition_id = 9201 and team_id = 9201),
      '[{"playerId":9201,"jerseyNumber":"00"},{"playerId":9202,"jerseyNumber":"0"}]'::jsonb
    )$$,
  'the complete roster is saved atomically'
);
select is(
  (select count(*) from public.roster_entries where competition_id = 9201 and status = 'active'),
  2::bigint,
  'the complete active roster is authoritative'
);
select results_eq(
  $$select jersey_number from public.roster_entries
    where competition_id = 9201 and status = 'active' order by jersey_number$$,
  $$values ('0'::text), ('00'::text)$$,
  'jerseys 0 and 00 remain distinct text values'
);
select throws_ok(
  $$select * from public.admin_replace_roster(
      (select id from public.team_registrations where competition_id = 9201 and team_id = 9201),
      '[{"playerId":9201,"jerseyNumber":"8"},{"playerId":9201,"jerseyNumber":"9"}]'::jsonb
    )$$,
  'BD103', 'BDB_DUPLICATE_ROSTER_PLAYER',
  'duplicate players in one payload are rejected'
);

select public.admin_create_team_registration(9201, 9202);
select throws_ok(
  $$select * from public.admin_replace_roster(
      (select id from public.team_registrations where competition_id = 9201 and team_id = 9202),
      '[{"playerId":9201,"jerseyNumber":"8"}]'::jsonb
    )$$,
  'BD104', 'BDB_PLAYER_ALREADY_REGISTERED',
  'a player cannot join two teams in one edition'
);
select throws_ok(
  $$select * from public.admin_replace_roster(
      (select id from public.team_registrations where competition_id = 9201 and team_id = 9201),
      '[{"playerId":9201,"jerseyNumber":"8"},{"playerId":9203,"jerseyNumber":"8"}]'::jsonb
    )$$,
  'BD105', 'BDB_DUPLICATE_ACTIVE_JERSEY',
  'duplicate active jerseys receive a stable domain error'
);
select is(
  (select count(*) from public.roster_entries where competition_id = 9201 and status = 'active'),
  2::bigint,
  'a failed replacement rolls back every roster change'
);

select public.admin_create_team_registration(9202, 9203);
select lives_ok(
  $$select * from public.admin_replace_roster(
      (select id from public.team_registrations where competition_id = 9202 and team_id = 9203),
      '[{"playerId":9201,"jerseyNumber":"10"}]'::jsonb
    )$$,
  'the same player can represent another team in another edition'
);
select is(
  (select count(*) from public.admin_mutation_audit where entity_type = 'team_registration'),
  6::bigint,
  'successful administrative mutations are audited once'
);

select public.admin_create_team_registration(9201, 9203);
select lives_ok(
  $$select public.admin_confirm_team_registrations(
      9201,
      array[
        (select id from public.team_registrations where competition_id = 9201 and team_id = 9202),
        (select id from public.team_registrations where competition_id = 9201 and team_id = 9203)
      ]
    )$$,
  'multiple draft registrations are confirmed in one transaction'
);
select is(
  (select count(*) from public.team_registrations where competition_id = 9201 and status = 'confirmed'),
  3::bigint,
  'bulk confirmation transitions every selected registration'
);
select is(
  (select count(*) from public.admin_mutation_audit where action = 'registration_transitioned' and entity_id in (
    select id from public.team_registrations where competition_id = 9201
  )),
  3::bigint,
  'bulk confirmation preserves one transition audit per registration'
);

insert into public.teams (id, name, slug)
overriding system value values (9204, 'Time RPC Quatro', 'time-rpc-quatro');
select public.admin_create_team_registration(9201, 9204);
select throws_ok(
  $$select public.admin_confirm_team_registrations(
      9201,
      array[
        (select id from public.team_registrations where competition_id = 9201 and team_id = 9204),
        (select id from public.team_registrations where competition_id = 9202 and team_id = 9203)
      ]
    )$$,
  'BD102', 'BDB_INVALID_REGISTRATION_TRANSITION',
  'a registration from another competition rejects the complete batch'
);
select is(
  (select status from public.team_registrations where competition_id = 9201 and team_id = 9204),
  'draft'::text,
  'a rejected batch leaves valid registrations unchanged'
);

select lives_ok(
  $$select public.admin_create_team('Águias do Sul', 'ADS')$$,
  'team creation generates its technical identifier server-side'
);
select is(
  (select slug from public.teams where name = 'Águias do Sul'),
  'aguias-do-sul'::text,
  'team slug is derived from the normalized public name'
);
select lives_ok(
  $$select public.admin_create_team('  Águias   do Sul ', 'ADS')$$,
  'retrying the same normalized team name is idempotent'
);
select is(
  (select count(*) from public.teams where lower(regexp_replace(name, '\s+', ' ', 'g')) = 'águias do sul'),
  1::bigint,
  'normalized retries leave one active team'
);
select lives_ok(
  $$select public.admin_create_and_register_team(9201, 'Leões do Norte', 'LDN')$$,
  'a new team can be created and registered atomically'
);
select lives_ok(
  $$select public.admin_create_and_register_team(9201, 'Leões do Norte', 'LDN')$$,
  'create and register retries are idempotent'
);
select is(
  (
    select count(*)
    from public.team_registrations registration
    join public.teams team on team.id = registration.team_id
    where registration.competition_id = 9201 and team.name = 'Leões do Norte'
  ),
  1::bigint,
  'create and register leaves one registration for the resolved team'
);
select lives_ok(
  $$select public.admin_create_team('Aguia Sul', null)$$,
  'first colliding slug candidate is created'
);
select lives_ok(
  $$select public.admin_create_team('Aguia-Sul', null)$$,
  'a distinct team with the same slug base is still created'
);
select is(
  (select slug from public.teams where name = 'Aguia-Sul'),
  'aguia-sul-2'::text,
  'slug collisions receive a deterministic suffix'
);

reset role;
set local role anon;
select throws_ok(
  $$select private.admin_resolve_team('Equipe anônima', null)$$,
  '42501', null,
  'anon cannot execute the private team resolver'
);
reset role;
select * from finish();
rollback;
