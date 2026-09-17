begin;

create extension if not exists pgtap with schema extensions;
select plan(26);
set constraints all deferred;

insert into private.admin_accounts (user_id)
select '11111111-1111-4111-8111-111111111111'
where not exists (select 1 from private.admin_accounts);

insert into public.competition_series (id, name, slug)
overriding system value values (9761, 'Liga Elegibilidade', 'liga-elegibilidade');
insert into public.categories (id, name, slug)
overriding system value values (9761, 'Categoria Elegibilidade', 'categoria-elegibilidade');
insert into public.competitions (
  id,
  series_id,
  category_id,
  year,
  display_name,
  gender_division,
  gender_division_review_required,
  status,
  published_at
)
overriding system value values
  (9761, 9761, 9761, 2090, 'Liga Elegibilidade Masculina', 'male', false, 'published', now()),
  (9762, 9761, 9761, 2090, 'Liga Elegibilidade Feminina', 'female', false, 'published', now()),
  (9763, 9761, 9761, 2091, 'Liga Elegibilidade Pendente', null, true, 'published', now());
insert into public.teams (id, name, slug)
overriding system value values
  (9761, 'Equipe Elegível Um', 'equipe-elegivel-um'),
  (9762, 'Equipe Elegível Dois', 'equipe-elegivel-dois'),
  (9763, 'Equipe Elegível Três', 'equipe-elegivel-tres'),
  (9764, 'Equipe Elegível Quatro', 'equipe-elegivel-quatro');
insert into public.players (id, full_name, slug)
overriding system value values
  (9761, 'Atleta Compatível', 'atleta-compativel'),
  (9762, 'Atleta Pendente', 'atleta-pendente'),
  (9763, 'Atleta Incompatível', 'atleta-incompativel'),
  (9764, 'Atleta Histórico', 'atleta-historico'),
  (9765, 'Atleta Sem Perfil', 'atleta-sem-perfil'),
  (9766, 'Atleta Em Revisão', 'atleta-em-revisao');

update private.player_private
set sex = 'male', sex_review_required = false
where player_id = 9761;
update private.player_private
set sex = null, sex_review_required = true
where player_id = 9762;
update private.player_private
set sex = 'female', sex_review_required = false
where player_id in (9763, 9764);
update private.player_private
set sex = 'male', sex_review_required = true
where player_id = 9766;
delete from private.player_private where player_id = 9765;

insert into public.team_registrations (id, competition_id, team_id, status, confirmed_at)
overriding system value values
  (9761, 9761, 9761, 'confirmed', now()),
  (9762, 9761, 9762, 'confirmed', now()),
  (9763, 9762, 9763, 'confirmed', now()),
  (9764, 9763, 9764, 'confirmed', now());

-- This incompatible association predates the enforcement rollout and must be preserved.
insert into public.roster_entries (
  id,
  competition_id,
  registration_id,
  player_id,
  jersey_number,
  status
)
overriding system value values (9764, 9761, 9761, 9764, '4', 'active');

select has_function(
  'public',
  'admin_replace_roster',
  array['bigint', 'jsonb'],
  'the authoritative roster RPC exists'
);
select ok(
  not has_function_privilege('anon', 'public.admin_replace_roster(bigint,jsonb)', 'execute'),
  'anonymous users cannot execute roster replacement'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select * from public.admin_replace_roster(9761, '[{"playerId":9764,"jerseyNumber":"4"}]')$$,
  'BD401', 'BDB_ADMIN_AAL2_REQUIRED',
  'an authenticated non-admin cannot use the security-definer RPC'
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
  $$select * from public.admin_replace_roster(9761, '[{"playerId":9764,"jerseyNumber":"4"}]')$$,
  'BD401', 'BDB_ADMIN_AAL2_REQUIRED',
  'the administrator at aal1 cannot replace a roster'
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

select lives_ok(
  $$select * from public.admin_replace_roster(9761, '[{"playerId":9764,"jerseyNumber":"4"}]')$$,
  'an exact repeat preserves a historical incompatible association'
);
select is(
  (select count(*) from public.admin_mutation_audit
   where action = 'roster_replaced' and entity_id = 9761),
  0::bigint,
  'the exact repeat is idempotent and does not duplicate audit events'
);
select throws_ok(
  $$select * from public.admin_replace_roster(
      9761,
      '[{"playerId":9764,"jerseyNumber":"4"},{"playerId":9762,"jerseyNumber":"2"}]'
    )$$,
  'BD601', 'BDB_PLAYER_ELIGIBILITY_PENDING',
  'a null private value blocks a new association'
);
select throws_ok(
  $$select * from public.admin_replace_roster(
      9761,
      '[{"playerId":9764,"jerseyNumber":"4"},{"playerId":9766,"jerseyNumber":"6"}]'
    )$$,
  'BD601', 'BDB_PLAYER_ELIGIBILITY_PENDING',
  'a private value still under review blocks a new association'
);
select throws_ok(
  $$select * from public.admin_replace_roster(
      9761,
      '[{"playerId":9764,"jerseyNumber":"4"},{"playerId":9765,"jerseyNumber":"5"}]'
    )$$,
  'BD601', 'BDB_PLAYER_ELIGIBILITY_PENDING',
  'a missing private row is treated as pending without exposing a value'
);
select throws_ok(
  $$select * from public.admin_replace_roster(
      9761,
      '[{"playerId":9764,"jerseyNumber":"4"},{"playerId":9763,"jerseyNumber":"3"}]'
    )$$,
  'BD602', 'BDB_PLAYER_NOT_ELIGIBLE_FOR_DIVISION',
  'an incompatible private value blocks a new association'
);
select is(
  (select count(*) from public.roster_entries
   where registration_id = 9761 and status = 'active'),
  1::bigint,
  'failed eligibility checks never deactivate the historical roster'
);
select lives_ok(
  $$select * from public.admin_replace_roster(
      9761,
      '[{"playerId":9764,"jerseyNumber":"4"},{"playerId":9761,"jerseyNumber":"1"}]'
    )$$,
  'a compatible new association succeeds in the same transaction'
);
select is(
  (select count(*) from public.roster_entries
   where registration_id = 9761 and status = 'active'),
  2::bigint,
  'the compatible player and historical player are both active'
);
select is(
  (select count(*) from public.roster_entries
   where registration_id = 9761 and player_id = 9764),
  1::bigint,
  'the historical association is preserved rather than duplicated'
);
select lives_ok(
  $$select * from public.admin_replace_roster(
      9761,
      '[{"playerId":9764,"jerseyNumber":"4"},{"playerId":9761,"jerseyNumber":"1"}]'
    )$$,
  'repeating the compatible roster is safe'
);
select is(
  (select count(*) from public.roster_entries
   where registration_id = 9761 and player_id = 9761),
  1::bigint,
  'an idempotent repeat never duplicates a roster row'
);
select is(
  (select count(*) from public.admin_mutation_audit
   where action = 'roster_replaced' and entity_id = 9761),
  1::bigint,
  'an idempotent repeat does not duplicate the roster audit'
);

select lives_ok(
  $$select * from public.admin_replace_roster(
      9761,
      '[{"playerId":9764,"jerseyNumber":"4"}]'
    )$$,
  'removing the compatible player from the source roster succeeds'
);
select lives_ok(
  $$select * from public.admin_replace_roster(
      9762,
      '[{"playerId":9761,"jerseyNumber":"10"}]'
    )$$,
  'a compatible transfer to another team succeeds through the same contract'
);
select is(
  (select count(*) from public.roster_entries
   where competition_id = 9761 and player_id = 9761 and status = 'active'),
  1::bigint,
  'the transfer leaves exactly one active association in the edition'
);
select throws_ok(
  $$select * from public.admin_replace_roster(
      9763,
      '[{"playerId":9761,"jerseyNumber":"10"}]'
    )$$,
  'BD602', 'BDB_PLAYER_NOT_ELIGIBLE_FOR_DIVISION',
  'a transfer to an incompatible division is rejected before any write'
);
select is(
  (select status from public.roster_entries
   where registration_id = 9762 and player_id = 9761),
  'active'::text,
  'a failed transfer preserves the current active association'
);
select throws_ok(
  $$select * from public.admin_replace_roster(
      9764,
      '[{"playerId":9761,"jerseyNumber":"10"}]'
    )$$,
  'BD505', 'BDB_COMPETITION_GENDER_REVIEW_REQUIRED',
  'an unclassified edition cannot receive a new sporting association'
);
select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'roster_entries'
      and column_name = 'sex'
  ),
  0::bigint,
  'the roster contract contains no private value column'
);
select ok(
  not exists (
    select 1
    from public.admin_mutation_audit
    where action = 'roster_replaced'
      and (
        metadata ? 'sex'
        or metadata::text like '%male%'
        or metadata::text like '%female%'
      )
  ),
  'roster audit metadata never contains the private value'
);
select throws_ok(
  $$select sex from private.player_private where player_id = 9761$$,
  '42501', 'permission denied for table player_private',
  'the browser role still cannot read the private table directly'
);

reset role;
select * from finish();
rollback;
