begin;
\ir ../helpers/final_profile_fixtures.inc

create extension if not exists pgtap with schema extensions;
select plan(23);
set constraints all deferred;
select set_config('bdb.allow_internal_ingestion_game', 'on', true);

insert into auth.users(id)
values ('11111111-1111-4111-8111-111111111111')
on conflict do nothing;
insert into private.admin_accounts(user_id)
select '11111111-1111-4111-8111-111111111111'
where not exists(select 1 from private.admin_accounts);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select user_id from private.admin_accounts limit 1),
    'role', 'authenticated',
    'aal', 'aal2'
  )::text,
  true
);

insert into public.competition_series(id,name,slug)
overriding system value values
  (97001,'Cópia independente','copia-independente'),
  (97101,'Correção de contexto','correcao-contexto');
insert into public.categories(id,name,slug)
overriding system value values
  (97001,'Cópia origem','copia-origem'),
  (97002,'Cópia destino','copia-destino'),
  (97101,'Contexto origem','contexto-origem'),
  (97102,'Contexto destino','contexto-destino');

select pg_temp.create_final_competition(
  97001,97001,97001,2026,'Cópia independente - origem','draft',null,'male','manual_scoresheet'
);
select pg_temp.create_final_competition(
  97002,97001,97002,2026,'Cópia independente - destino','draft',null,'male','manual_scoresheet'
);
select pg_temp.create_final_competition(
  97101,97101,97101,2026,'Correção de contexto - origem','draft',null,'male','manual_scoresheet'
);
select pg_temp.ensure_final_profile(97101,97102,'male','manual_scoresheet');
select pg_temp.ensure_final_profile(97101,97102,'female','manual_scoresheet');

insert into public.teams(id,name,slug,abbreviation)
overriding system value values
  (97001,'Lobos','lobos','LOB'),
  (97101,'Contexto EC','contexto-ec','CTX');
insert into public.players(id,full_name,slug)
overriding system value values
  (97021,'Atleta Lobos A','atleta-lobos-a'),
  (97022,'Atleta Lobos B','atleta-lobos-b'),
  (97121,'Atleta Contexto','atleta-contexto');
insert into private.player_private(player_id,sex,sex_review_required)
values
  (97021,'male',false),
  (97022,'male',false),
  (97121,'male',false);

insert into public.team_registrations(
  id,competition_id,team_id,public_name,status,confirmed_at
)
overriding system value values
  (97011,97001,97001,'Lobos','confirmed',now()),
  (97012,97001,97001,'Lobos B','confirmed',now()),
  (97111,97101,97101,'Contexto EC','confirmed',now());
insert into public.roster_entries(
  id,competition_id,registration_id,player_id,jersey_number,status
)
overriding system value values
  (97031,97001,97011,97021,'7','active'),
  (97032,97001,97012,97022,'8','active'),
  (97131,97101,97111,97121,'9','active');

create temporary table copy_context(
  source_competition_id bigint not null,
  target_competition_id bigint not null,
  request_id uuid not null,
  input jsonb not null,
  result jsonb
);
insert into copy_context values (
  97001,
  97002,
  '97000000-0000-4000-8000-000000000001',
  jsonb_build_array(
    jsonb_build_object(
      'sourceRegistrationId',97011,
      'publicName','Lobos',
      'playerIds',jsonb_build_array(97021)
    ),
    jsonb_build_object(
      'sourceRegistrationId',97012,
      'publicName','Lobos B',
      'playerIds',jsonb_build_array(97022)
    )
  ),
  null
);
grant select,update on copy_context to authenticated;

select is(
  (select source.season_id
   from public.competitions source
   where source.id=97001),
  (select target.season_id
   from public.competitions target
   where target.id=97002),
  'copy source and target share the same edition'
);

set local role authenticated;
select is(
  jsonb_array_length(
    public.admin_preview_registration_copy(97001,97002)->'registrations'
  ),
  2,
  'copy preview exposes both independent registrations of the same global team'
);
select is(
  (
    select string_agg(item->>'publicName',',' order by item->>'publicName')
    from jsonb_array_elements(
      public.admin_preview_registration_copy(97001,97002)->'registrations'
    ) item
  ),
  'Lobos,Lobos B',
  'copy preview preserves each registration public name'
);
select lives_ok(
  $$update copy_context
    set result=public.admin_copy_team_registrations(
      request_id,source_competition_id,target_competition_id,input
    )$$,
  'AAL2 can copy selected independent registrations transactionally'
);
reset role;

select is(
  (select count(*) from public.team_registrations where competition_id=97002),
  2::bigint,
  'copy creates two target registrations'
);
select is(
  (select count(*) from public.team_registrations
   where competition_id=97002 and team_id=97001),
  2::bigint,
  'both target registrations may reference the same global team'
);
select is(
  (select count(*) from public.roster_entries where competition_id=97002 and status='active'),
  2::bigint,
  'selected roster links are copied independently'
);
select is(
  (select count(*) from public.team_registrations where competition_id=97001),
  2::bigint,
  'source registrations remain unchanged'
);
select is(
  (select count(*) from public.roster_entries where competition_id=97001 and status='active'),
  2::bigint,
  'source roster links remain unchanged'
);

set local role authenticated;
select is(
  public.admin_copy_team_registrations(
    request_id,source_competition_id,target_competition_id,input
  ),
  result,
  'exact copy retry returns the recorded result'
) from copy_context;
reset role;
select is(
  (select count(*) from public.team_registrations where competition_id=97002),
  2::bigint,
  'idempotent retry creates no extra registrations'
);
set local role authenticated;
select throws_ok(
  $$select public.admin_copy_team_registrations(
    request_id,
    source_competition_id,
    target_competition_id,
    '[{"sourceRegistrationId":97011,"publicName":"Lobos X","playerIds":[97021]}]'::jsonb
  ) from copy_context$$,
  'BD409',
  'BDB_IDEMPOTENCY_KEY_REUSED',
  'a copy idempotency key cannot be reused with different input'
);
select throws_ok(
  $$select public.admin_copy_team_registrations(
    gen_random_uuid(),source_competition_id,target_competition_id,input
  ) from copy_context$$,
  'BD409',
  'BDB_REGISTRATION_PUBLIC_NAME_CONFLICT',
  'a fresh copy reports target public-name conflicts explicitly'
);
reset role;

select ok(
  (
    select (public.admin_preview_dispute_context_change(97101,97102,'male')->>'canApply')::boolean
  ),
  'context preview allows a compatible pre-game correction'
);
set local role authenticated;
select lives_ok(
  $$select public.admin_apply_dispute_context_change(97101,97102,'male')$$,
  'compatible pre-game category correction is transactional'
);
reset role;
select is(
  (select category_id from public.competitions where id=97101),
  97102::bigint,
  'context correction persists the reviewed category'
);
select ok(
  (
    select
      not (preview->>'canApply')::boolean
      and jsonb_array_length(preview->'playerConflicts')=1
    from (
      select public.admin_preview_dispute_context_change(97101,97102,'female') preview
    ) checked
  ),
  'context preview exposes a value-free player blocker for incompatible gender'
);
set local role authenticated;
select throws_ok(
  $$select public.admin_apply_dispute_context_change(97101,97102,'female')$$,
  'BD602',
  'BDB_PLAYER_NOT_ELIGIBLE_FOR_DIVISION',
  'context correction rejects an incompatible active roster'
);
reset role;

insert into public.games(id,competition_id,game_number,status,source)
overriding system value values (97141,97101,'CTX-01','scheduled','seed');
set local role authenticated;
select throws_ok(
  $$select public.admin_apply_dispute_context_change(97101,97101,'male')$$,
  'BD409',
  'BDB_COMPETITION_CONTEXT_LOCKED_BY_GAMES',
  'context correction is locked after the first game exists'
);
reset role;

select ok(
  not has_table_privilege('authenticated','private.registration_copy_requests','select'),
  'copy idempotency ledger remains private'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.admin_copy_team_registrations(uuid,bigint,bigint,jsonb)',
    'execute'
  ),
  'anonymous clients cannot execute registration copy'
);

select set_config(
  'request.jwt.claims',
  jsonb_set(current_setting('request.jwt.claims')::jsonb,'{aal}','"aal1"')::text,
  true
);
set local role authenticated;
select throws_ok(
  $$select public.admin_copy_team_registrations(null,null,null,null)$$,
  'BD401',
  'BDB_ADMIN_AAL2_REQUIRED',
  'AAL1 is rejected before copy input processing'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.admin_preview_dispute_context_change(97101,97102,'male')$$,
  'BD401',
  'BDB_ADMIN_AAL2_REQUIRED',
  'non-admin AAL2 cannot preview a private context correction'
);
reset role;

select * from finish();
rollback;
