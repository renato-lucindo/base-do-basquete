begin;
\ir ../helpers/final_profile_fixtures.inc

create extension if not exists pgtap with schema extensions;
select plan(31);
set constraints all deferred;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '11111111-1111-4111-8111-111111111111',
  'authenticated', 'authenticated', 'fixture-actor@example.invalid', '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
)
on conflict (id) do nothing;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '94700000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'team-resolution-admin@example.invalid', '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
)
on conflict (id) do nothing;

insert into private.admin_accounts(user_id)
select '94700000-0000-4000-8000-000000000001'
where not exists (select 1 from private.admin_accounts);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '94700000-0000-4000-8000-000000000002',
  'authenticated', 'authenticated', 'team-resolution-other@example.invalid', '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
)
on conflict (id) do nothing;

insert into public.competition_series(id, name, slug)
overriding system value values (9470, 'Liga Team Resolution', 'liga-team-resolution');
insert into public.categories(id, name, slug)
overriding system value values (9470, 'Categoria Team Resolution', 'categoria-team-resolution');
select pg_temp.create_final_competition(
  9470, 9470, 9470, 2026, 'Liga Team Resolution 2026', 'published', now(), 'male', 'fiba_boxscore'
);

insert into public.teams(id, name, slug, abbreviation, is_active, is_public)
overriding system value values
  (9471, 'Equipe Confirmada', 'equipe-confirmada-tr', 'ECF', true, false),
  (9472, 'Equipe Rascunho', 'equipe-rascunho-tr', 'ERA', true, false),
  (9473, 'Equipe Retirada', 'equipe-retirada-tr', 'ERT', true, false),
  (9474, 'Equipe Atômica Existente', 'equipe-atomica-existente-tr', 'EAE', true, false);

insert into public.team_registrations(
  id, competition_id, team_id, status, confirmed_at
)
overriding system value values
  (9471, 9470, 9471, 'confirmed', now()),
  (9472, 9470, 9472, 'draft', null),
  (9473, 9470, 9473, 'withdrawn', now());

insert into public.boxscore_imports(
  id, competition_id, sha256, storage_path, source_filename, file_size_bytes,
  parser_version, status, parsed_payload, validation_payload, created_by
)
overriding system value values
  (
    94701, 9470, repeat('1', 64), '9470/' || repeat('1', 64) || '.pdf', 'existing-and-draft.pdf', 100,
    'fiba-genius-v2', 'review',
    jsonb_build_object('teams', jsonb_build_array(
      jsonb_build_object('name', 'Equipe Confirmada', 'abbreviation', 'ECF'),
      jsonb_build_object('name', 'Equipe Rascunho', 'abbreviation', 'ERA')
    )),
    '{"valid":true}'::jsonb, (select user_id from private.admin_accounts limit 1)
  ),
  (
    94702, 9470, repeat('2', 64), '9470/' || repeat('2', 64) || '.pdf', 'create-team.pdf', 100,
    'fiba-genius-v2', 'review',
    jsonb_build_object('teams', jsonb_build_array(
      jsonb_build_object('name', 'Equipe Confirmada', 'abbreviation', 'ECF'),
      jsonb_build_object('name', 'Equipe Nova', 'abbreviation', 'ENV')
    )),
    '{"valid":true}'::jsonb, (select user_id from private.admin_accounts limit 1)
  ),
  (
    94703, 9470, repeat('3', 64), '9470/' || repeat('3', 64) || '.pdf', 'withdrawn.pdf', 100,
    'fiba-genius-v2', 'review',
    jsonb_build_object('teams', jsonb_build_array(
      jsonb_build_object('name', 'Equipe Confirmada', 'abbreviation', 'ECF'),
      jsonb_build_object('name', 'Equipe Retirada', 'abbreviation', 'ERT')
    )),
    '{"valid":true}'::jsonb, (select user_id from private.admin_accounts limit 1)
  ),
  (
    94704, 9470, repeat('4', 64), '9470/' || repeat('4', 64) || '.pdf', 'duplicate.pdf', 100,
    'fiba-genius-v2', 'review',
    jsonb_build_object('teams', jsonb_build_array(
      jsonb_build_object('name', 'Equipe Confirmada', 'abbreviation', 'ECF'),
      jsonb_build_object('name', 'Equipe Rascunho', 'abbreviation', 'ERA')
    )),
    '{"valid":true}'::jsonb, (select user_id from private.admin_accounts limit 1)
  ),
  (
    94705, 9470, repeat('5', 64), '9470/' || repeat('5', 64) || '.pdf', 'atomic.pdf', 100,
    'fiba-genius-v2', 'review',
    jsonb_build_object('teams', jsonb_build_array(
      jsonb_build_object('name', 'Equipe Atômica Existente', 'abbreviation', 'EAE'),
      jsonb_build_object('name', 'Equipe Atômica Nova', 'abbreviation', 'EAN')
    )),
    '{"valid":true}'::jsonb, (select user_id from private.admin_accounts limit 1)
  ),
  (
    94706, 9470, repeat('6', 64), '9470/' || repeat('6', 64) || '.pdf', 'mismatch.pdf', 100,
    'fiba-genius-v2', 'review',
    jsonb_build_object('teams', jsonb_build_array(
      jsonb_build_object('name', 'Equipe Confirmada', 'abbreviation', 'ECF'),
      jsonb_build_object('name', 'Equipe Diferente', 'abbreviation', 'EDI')
    )),
    '{"valid":true}'::jsonb, (select user_id from private.admin_accounts limit 1)
  ),
  (
    94707, 9470, repeat('7', 64), '9470/' || repeat('7', 64) || '.pdf', 'other-owner.pdf', 100,
    'fiba-genius-v2', 'review',
    jsonb_build_object('teams', jsonb_build_array(
      jsonb_build_object('name', 'Equipe Confirmada', 'abbreviation', 'ECF'),
      jsonb_build_object('name', 'Equipe Rascunho', 'abbreviation', 'ERA')
    )),
    '{"valid":true}'::jsonb, '94700000-0000-4000-8000-000000000002'
  );

select has_function(
  'public', 'admin_resolve_boxscore_team_registrations', array['bigint','jsonb'],
  'team resolution RPC exists'
);

reset role;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select user_id from private.admin_accounts limit 1),
    'role', 'authenticated', 'aal', 'aal1'
  )::text,
  true
);
set local role authenticated;
select throws_ok(
  $$select public.admin_resolve_boxscore_team_registrations(
    94701,
    '{"teams":[{"sourceTeamName":"Equipe Confirmada","action":"existing_registration","registrationId":9471},{"sourceTeamName":"Equipe Rascunho","action":"register_existing_team","teamId":9472}]}'::jsonb
  )$$,
  'BD401', 'BDB_ADMIN_AAL2_REQUIRED', 'aal1 cannot resolve boxscore teams'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"94700000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.admin_resolve_boxscore_team_registrations(
    94701,
    '{"teams":[{"sourceTeamName":"Equipe Confirmada","action":"existing_registration","registrationId":9471},{"sourceTeamName":"Equipe Rascunho","action":"register_existing_team","teamId":9472}]}'::jsonb
  )$$,
  'BD401', 'BDB_ADMIN_AAL2_REQUIRED', 'non-admin aal2 cannot resolve boxscore teams'
);

reset role;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select user_id from private.admin_accounts limit 1),
    'role', 'authenticated', 'aal', 'aal2'
  )::text,
  true
);
set local role authenticated;

select ok(
  not has_table_privilege('authenticated', 'public.boxscore_team_resolutions', 'INSERT'),
  'authenticated cannot write the authoritative team-resolution state directly'
);
select throws_ok(
  $$insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
    values (
      'boxscore_team_registrations_resolved', 'boxscore_import', 94701,
      '{"results":[{"sourceTeamName":"forged","registrationId":1},{"sourceTeamName":"forged-2","registrationId":2}]}'::jsonb
    )$$,
  '42501',
  'new row violates row-level security policy for table "admin_mutation_audit"',
  'aal2 admin cannot forge a completed team resolution through the audit table'
);

select throws_ok(
  $$select public.admin_resolve_boxscore_team_registrations(
    94707,
    '{"teams":[{"sourceTeamName":"Equipe Confirmada","action":"existing_registration","registrationId":9471},{"sourceTeamName":"Equipe Rascunho","action":"register_existing_team","teamId":9472}]}'::jsonb
  )$$,
  'BD404', 'BDB_PDF_IMPORT_NOT_FOUND', 'another user import is not addressable by the admin RPC'
);

select lives_ok(
  $$select public.admin_resolve_boxscore_team_registrations(
    94701,
    '{"teams":[{"sourceTeamName":"Equipe Confirmada","action":"existing_registration","registrationId":9471},{"sourceTeamName":"Equipe Rascunho","action":"register_existing_team","teamId":9472}]}'::jsonb
  )$$,
  'confirmed registration can be reused while a draft registration is confirmed'
);
select is(
  (select status from public.team_registrations where id = 9472),
  'confirmed', 'draft registration becomes confirmed'
);
select is(
  (select count(*)::integer from public.team_registrations where id = 9471),
  1, 'existing confirmed registration is reused without duplication'
);
select is(
  (select count(*)::integer from public.admin_mutation_audit
   where action = 'registration_transitioned' and entity_id = 9472),
  1, 'draft confirmation is audited once'
);

select lives_ok(
  $$select public.admin_resolve_boxscore_team_registrations(
    94702,
    '{"teams":[{"sourceTeamName":"Equipe Confirmada","action":"existing_registration","registrationId":9471},{"sourceTeamName":"Equipe Nova","action":"create_team"}]}'::jsonb
  )$$,
  'missing source team can be created with a confirmed registration'
);
select is(
  (select count(*)::integer from public.teams where name = 'Equipe Nova' and abbreviation = 'ENV'),
  1, 'create-team action inserts exactly one team'
);
select ok(
  (select is_active and not is_public from public.teams where name = 'Equipe Nova' and abbreviation = 'ENV'),
  'created team is active and private by default'
);
select is(
  (select count(*)::integer
   from public.team_registrations registration
   join public.teams team on team.id = registration.team_id
   where registration.competition_id = 9470 and team.name = 'Equipe Nova'),
  1, 'created team receives exactly one competition registration'
);
select is(
  (select registration.status
   from public.team_registrations registration
   join public.teams team on team.id = registration.team_id
   where registration.competition_id = 9470 and team.name = 'Equipe Nova'),
  'confirmed', 'created team registration is confirmed'
);
select lives_ok(
  $$select public.admin_resolve_boxscore_team_registrations(
    94702,
    '{"teams":[{"sourceTeamName":"Equipe Confirmada","action":"existing_registration","registrationId":9471},{"sourceTeamName":"Equipe Nova","action":"create_team"}]}'::jsonb
  )$$,
  'retry of the same resolved import is idempotent'
);
select is(
  (select count(*)::integer from public.boxscore_team_resolutions where import_id = 94702),
  1, 'resolved import has exactly one authoritative resolution row'
);
select throws_ok(
  $$select public.admin_resolve_boxscore_team_registrations(
    94702,
    '{"teams":[{"sourceTeamName":"Equipe Confirmada","action":"existing_registration","registrationId":9471},{"sourceTeamName":"Equipe Nova","action":"register_existing_team","teamId":9472}]}'::jsonb
  )$$,
  'BD318', 'BDB_PDF_TEAM_RESOLUTION_CONFLICT',
  'retry with a different canonical decision is rejected as a conflict'
);
select is(
  (select count(*)::integer from public.teams where name = 'Equipe Nova' and abbreviation = 'ENV'),
  1, 'retry does not duplicate the created team'
);
select is(
  (select count(*)::integer from public.admin_mutation_audit
   where action = 'boxscore_team_registrations_resolved' and entity_id = 94702),
  1, 'retry does not duplicate the resolution audit'
);

select throws_ok(
  $$select public.admin_resolve_boxscore_team_registrations(
    94704,
    '{"teams":[{"sourceTeamName":"Equipe Confirmada","action":"existing_registration","registrationId":9471},{"sourceTeamName":"Equipe Rascunho","action":"create_team"}]}'::jsonb
  )$$,
  'BD315', 'BDB_PDF_TEAM_ALREADY_EXISTS', 'create-team rejects a matching existing team'
);
select is(
  (select count(*)::integer from public.teams where name = 'Equipe Rascunho'),
  1, 'duplicate-team rejection preserves the existing team only'
);

select throws_ok(
  $$select public.admin_resolve_boxscore_team_registrations(
    94703,
    '{"teams":[{"sourceTeamName":"Equipe Confirmada","action":"existing_registration","registrationId":9471},{"sourceTeamName":"Equipe Retirada","action":"register_existing_team","teamId":9473}]}'::jsonb
  )$$,
  'BD316', 'BDB_PDF_TEAM_REGISTRATION_UNAVAILABLE', 'withdrawn registration is not reactivated'
);
select is(
  (select status from public.team_registrations where id = 9473),
  'withdrawn', 'withdrawn registration remains withdrawn'
);

select throws_ok(
  $$select public.admin_resolve_boxscore_team_registrations(
    94706,
    '{"teams":[{"sourceTeamName":"Equipe Confirmada","action":"existing_registration","registrationId":9471},{"sourceTeamName":"Equipe Diferente","action":"register_existing_team","teamId":9472}]}'::jsonb
  )$$,
  'BD317', 'BDB_PDF_TEAM_MISMATCH', 'selected existing team must match source name or abbreviation'
);

select throws_ok(
  $$select public.admin_resolve_boxscore_team_registrations(
    94705,
    '{"teams":[{"sourceTeamName":"Equipe Atômica Existente","action":"register_existing_team","teamId":9474},{"sourceTeamName":"Equipe Atômica Nova","action":"invalid"}]}'::jsonb
  )$$,
  'BD305', 'BDB_PDF_TEAM_RESOLUTION_INVALID', 'invalid second team rolls back the whole resolution'
);
select is(
  (select count(*)::integer from public.team_registrations
   where competition_id = 9470 and team_id = 9474),
  0, 'partial resolution does not leave a registration behind'
);
select is(
  (select count(*)::integer from public.teams where name = 'Equipe Atômica Nova'),
  0, 'partial resolution does not create the second team'
);

select is(
  (select count(*)::integer from public.games where competition_id = 9470),
  0, 'team resolution never creates games'
);
select is(
  (select count(*)::integer from public.matchups where competition_id = 9470),
  0, 'team resolution never creates matchups'
);
select is(
  (select count(*)::integer from public.competition_entry_assignments where competition_id = 9470),
  0, 'team resolution never creates structural entry assignments'
);

select * from finish();
rollback;
