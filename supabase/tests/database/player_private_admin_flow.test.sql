begin;
\ir ../helpers/final_profile_fixtures.inc

create extension if not exists pgtap with schema extensions;
select plan(24);
set constraints all deferred;

insert into private.admin_accounts (user_id)
select '11111111-1111-4111-8111-111111111111'
where not exists (select 1 from private.admin_accounts);

insert into public.competition_series (id, name, slug)
overriding system value values (9751, 'Liga Privada', 'liga-privada');
insert into public.categories (id, name, slug)
overriding system value values (9751, 'Categoria Privada', 'categoria-privada');
select pg_temp.create_final_competition(
  9751,9751,9751,2026,'Liga Privada 2026','published',now(),'female','manual_scoresheet'
);
insert into public.teams (id, name, slug)
overriding system value values (9751, 'Equipe Privada', 'equipe-privada');
insert into public.players (id, full_name, slug)
overriding system value values (9751, 'Atleta Privada', 'atleta-privada');
insert into private.player_private(player_id,sex,sex_review_required)
values(9751,'female',false);
insert into public.team_registrations (id, competition_id, team_id, status, confirmed_at)
overriding system value values (9751, 9751, 9751, 'confirmed', now());
insert into public.roster_entries (
  id,
  competition_id,
  registration_id,
  player_id,
  jersey_number,
  status
)
overriding system value values (9751, 9751, 9751, 9751, '7', 'active');

select has_function(
  'public',
  'admin_get_player_private_profile',
  array['bigint'],
  'dedicated private-form reader exists'
);
select has_function(
  'public',
  'admin_create_player_with_private_profile',
  array['text', 'text', 'text', 'boolean'],
  'private player creation RPC exists'
);
select ok(
  not has_function_privilege('anon', 'public.admin_get_player_private_profile(bigint)', 'execute'),
  'anonymous users cannot execute the private-form reader'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.admin_create_player_with_private_profile(text,text,text,boolean)',
    'execute'
  ),
  'anonymous users cannot execute private player creation'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select * from public.admin_get_player_private_profile(9751)$$,
  'BD401', 'BDB_ADMIN_AAL2_REQUIRED',
  'an authenticated non-admin cannot read the private form'
);
select throws_ok(
  $$select * from public.admin_set_player_sex(
      9751, 'female', 'Tentativa sem autorização administrativa'
    )$$,
  'BD401', 'BDB_ADMIN_AAL2_REQUIRED',
  'an authenticated non-admin cannot change the private value'
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
select throws_ok(
  $$select * from public.admin_get_player_private_profile(9751)$$,
  'BD401', 'BDB_ADMIN_AAL2_REQUIRED',
  'the administrator at aal1 cannot read the private form'
);
select throws_ok(
  $$select * from public.admin_set_player_sex(
      9751, 'female', 'Tentativa antes do segundo fator'
    )$$,
  'BD401', 'BDB_ADMIN_AAL2_REQUIRED',
  'the administrator at aal1 cannot change the private value'
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

select is(
  (select eligibility_pending from public.admin_get_player_private_profile(9751)),
  false,
  'the dedicated form reports the final profile as complete'
);
select is(
  (select sex from public.admin_get_player_private_profile(9751)),
  'female'::text,
  'the dedicated form returns the current complete private value'
);
select is(
  (select roster_entries from public.admin_get_player_private_profile(9751)),
  1::bigint,
  'impact preview counts historical roster entries'
);
select is(
  (select active_roster_entries from public.admin_get_player_private_profile(9751)),
  1::bigint,
  'impact preview counts active roster entries'
);
select is(
  (select affected_competitions from public.admin_get_player_private_profile(9751)),
  1::bigint,
  'impact preview counts affected competitions'
);

select lives_ok(
  $$select * from public.admin_set_player_sex(
      9751, 'male', 'Revisão documental realizada pelo administrador'
    )$$,
  'the aal2 administrator updates the private form'
);
select is(
  (select sex from public.admin_get_player_private_profile(9751)),
  'male'::text,
  'the protected form returns the explicitly stored value'
);
select is(
  (
    select metadata ->> 'reason'
    from public.admin_mutation_audit
    where action = 'player_sex_reviewed' and entity_id = 9751
  ),
  'Revisão documental realizada pelo administrador'::text,
  'the audit records the required reason'
);
select is(
  (
    select (metadata #>> '{impact,rosterEntries}')::integer
    from public.admin_mutation_audit
    where action = 'player_sex_reviewed' and entity_id = 9751
  ),
  1,
  'the audit records the reviewed impact'
);
select ok(
  (
    select
      not (metadata ? 'sex') and
      metadata::text not like '%male%' and
      metadata::text not like '%female%'
    from public.admin_mutation_audit
    where action = 'player_sex_reviewed' and entity_id = 9751
  ),
  'the audit never records the former or new private value'
);
select lives_ok(
  $$select * from public.admin_set_player_sex(
      9751, 'male', 'Repetição idempotente da mesma revisão'
    )$$,
  'repeating the same update is safe'
);
select is(
  (
    select count(*)
    from public.admin_mutation_audit
    where action = 'player_sex_reviewed' and entity_id = 9751
  ),
  1::bigint,
  'an idempotent repeat does not duplicate the audit'
);
select throws_ok(
  $$select * from public.admin_set_player_sex(
      9751, 'unknown', 'Valor fora da lista permitida'
    )$$,
  'BD501', 'BDB_PLAYER_SEX_INVALID',
  'invalid private values are rejected by the database'
);
select throws_ok(
  $$select * from public.admin_set_player_sex(9751, 'female', 'curta')$$,
  'BD501', 'BDB_PLAYER_SEX_REASON_REQUIRED',
  'a meaningful edit reason is required'
);
select throws_ok(
  $$select sex from private.player_private where player_id = 9751$$,
  '42501', 'permission denied for table player_private',
  'even the aal2 browser role cannot query the private table directly'
);

reset role;
select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('players', 'public_players', 'public_player_profiles')
      and column_name = 'sex'
  ),
  0::bigint,
  'public player tables and views expose no private value column'
);

select * from finish();
rollback;
