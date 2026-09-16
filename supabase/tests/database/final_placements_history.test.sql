begin;
\ir ../helpers/final_profile_fixtures.inc

create extension if not exists pgtap with schema extensions;
select plan(27);
set constraints all deferred;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '11111111-1111-4111-8111-111111111111',
  'authenticated', 'authenticated', 'history-fixture@example.invalid', '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
)
on conflict (id) do nothing;

insert into private.admin_accounts (user_id)
select '11111111-1111-4111-8111-111111111111'
where not exists (select 1 from private.admin_accounts);

insert into public.competition_series (id, name, slug)
overriding system value values (9500, 'Histórico Teste', 'historico-teste');
insert into public.categories (id, name, slug)
overriding system value values (9500, 'Histórico Sub-15', 'historico-sub-15');
select pg_temp.create_final_competition(
  9500,9500,9500,2026,'Histórico Teste 2026','published',now(),'male','manual_scoresheet'
);
insert into public.teams (id, name, slug, abbreviation, is_public)
overriding system value values
  (9500, 'Equipe História Azul', 'equipe-historia-azul', 'EHA', true),
  (9501, 'Equipe História Ouro', 'equipe-historia-ouro', 'EHO', true),
  (9502, 'Equipe História Rascunho', 'equipe-historia-rascunho', 'EHR', true);
insert into public.players (id, full_name, slug, is_public)
overriding system value values
  (9500, 'Atleta História Azul', 'atleta-historia-azul', true),
  (9501, 'Atleta História Ouro', 'atleta-historia-ouro', true);
insert into private.player_private(player_id,sex,sex_review_required)
values(9500,'male',false),(9501,'male',false);
insert into public.team_registrations
  (id, competition_id, team_id, status, confirmed_at)
overriding system value values
  (9500, 9500, 9500, 'confirmed', now()),
  (9501, 9500, 9501, 'completed', now()),
  (9502, 9500, 9502, 'draft', null);
insert into public.roster_entries
  (id, competition_id, registration_id, player_id, jersey_number)
overriding system value values
  (9500, 9500, 9500, 9500, '1'),
  (9501, 9500, 9501, 9501, '2');

select has_column('public', 'final_placements', 'result_status', 'final result state is explicit');
select has_function(
  'public', 'admin_confirm_final_placement', array['bigint', 'text', 'smallint', 'text'],
  'placement confirmation RPC exists'
);
select is(
  has_table_privilege('authenticated', 'public.final_placements', 'INSERT'),
  false,
  'authenticated clients cannot insert placements directly'
);
select is(
  has_table_privilege('authenticated', 'public.final_placements', 'UPDATE'),
  false,
  'authenticated clients cannot update placements directly'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.admin_confirm_final_placement(bigint,text,smallint,text)'::regprocedure),
  false,
  'public RPC remains security invoker'
);
select is(
  (select prosecdef from pg_proc where oid = 'private.admin_confirm_final_placement_impl(bigint,text,smallint,text)'::regprocedure),
  true,
  'privileged implementation stays in the private schema'
);
select throws_ok(
  $$insert into public.final_placements
      (competition_id, registration_id, placement, result_status)
    values (9500, 9500, 1, 'pending')$$,
  '23514',
  'new row for relation "final_placements" violates check constraint "final_placements_result_consistent"',
  'pending results cannot carry a placement'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.admin_confirm_final_placement(9500, 'placed', 1::smallint, 'Campeão')$$,
  'BD401', 'BDB_ADMIN_AAL2_REQUIRED',
  'an unrelated authenticated user cannot confirm a result'
);

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (select user_id from private.admin_accounts),
    'role', 'authenticated', 'aal', 'aal1'
  )::text,
  true
);
set local role authenticated;
select throws_ok(
  $$select public.admin_confirm_final_placement(9500, 'placed', 1::smallint, 'Campeão')$$,
  'BD401', 'BDB_ADMIN_AAL2_REQUIRED',
  'the singleton administrator at aal1 cannot confirm a result'
);

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (select user_id from private.admin_accounts),
    'role', 'authenticated', 'aal', 'aal2'
  )::text,
  true
);
set local role authenticated;
select throws_ok(
  $$select public.admin_confirm_final_placement(9500, 'placed', null, 'Campeão')$$,
  'BD201', 'BDB_FINAL_RESULT_INVALID',
  'placed requires a positive placement'
);
select throws_ok(
  $$select public.admin_confirm_final_placement(9500, 'withdrawn', 1::smallint, null)$$,
  'BD201', 'BDB_FINAL_RESULT_INVALID',
  'withdrawn cannot carry a placement'
);
select throws_ok(
  $$select public.admin_confirm_final_placement(9502, 'placed', 3::smallint, null)$$,
  'BD202', 'BDB_REGISTRATION_NOT_FINALIZABLE',
  'a draft registration cannot receive a final result'
);
select lives_ok(
  $$select public.admin_confirm_final_placement(9500, 'placed', 1::smallint, '  Campeão  ')$$,
  'aal2 administrator confirms a placed result atomically'
);
select is(
  (select result_status from public.final_placements where registration_id = 9500),
  'placed'::text,
  'placed status is persisted'
);
select is(
  (select result_label from public.final_placements where registration_id = 9500),
  'Campeão'::text,
  'result labels are normalized server-side'
);
select ok(
  (select confirmed_at is not null and confirmed_by = auth.uid()
   from public.final_placements where registration_id = 9500),
  'confirmation identity and timestamp are server-controlled'
);
select is(
  (select count(*) from public.admin_mutation_audit
   where action = 'final_placement_confirmed' and entity_id =
     (select id from public.final_placements where registration_id = 9500)),
  1::bigint,
  'the first confirmation writes one audit event'
);
select lives_ok(
  $$select public.admin_confirm_final_placement(9500, 'placed', 1::smallint, 'Campeão')$$,
  'an identical confirmation is idempotent'
);
select is(
  (select count(*) from public.admin_mutation_audit
   where action = 'final_placement_confirmed' and entity_id =
     (select id from public.final_placements where registration_id = 9500)),
  1::bigint,
  'idempotent retry does not duplicate the audit event'
);
select throws_ok(
  $$select public.admin_confirm_final_placement(9501, 'placed', 1::smallint, null)$$,
  'BD203', 'BDB_FINAL_PLACEMENT_CONFLICT',
  'two teams cannot share a placement in one edition'
);
select lives_ok(
  $$select public.admin_confirm_final_placement(9501, 'placed', 2::smallint, 'Vice-campeão')$$,
  'a distinct placement can be confirmed'
);
select is(
  (select count(*) from public.team_achievements where competition_id = 9500),
  2::bigint,
  'confirmed placed teams become achievements'
);
select is(
  (select count(*) from public.player_achievements where competition_id = 9500),
  2::bigint,
  'only roster members inherit their team achievement'
);
select lives_ok(
  $$select public.admin_confirm_final_placement(9501, 'withdrawn', null, 'Ignorado')$$,
  'a finalized result can transition atomically to withdrawn'
);
select is(
  (select count(*) from public.team_achievements where competition_id = 9500),
  1::bigint,
  'withdrawn results are excluded from team achievements'
);
select is(
  (select count(*) from public.player_achievements
   where competition_id = 9500 and player_id = 9501),
  0::bigint,
  'withdrawn results are excluded from player achievements'
);

reset role;
do $$begin
  perform private.backfill_legacy_competition_publication(9500,'published');
end$$;
set local role anon;
select is(
  (select count(*) from public.team_achievements where competition_id = 9500),
  1::bigint,
  'anonymous readers see only confirmed achievements through RLS'
);

reset role;
select * from finish();
rollback;
