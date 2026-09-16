begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

select has_function(
  'public',
  'admin_bulk_set_player_sex',
  array['jsonb', 'text'],
  'bulk private review RPC exists'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_bulk_set_player_sex(jsonb,text)',
    'EXECUTE'
  ),
  'authenticated may execute the protected RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.admin_bulk_set_player_sex(jsonb,text)',
    'EXECUTE'
  ),
  'anon cannot execute the protected RPC'
);

insert into auth.users(id)
values ('11111111-1111-4111-8111-111111111111')
on conflict do nothing;
insert into private.admin_accounts(user_id)
select '11111111-1111-4111-8111-111111111111'
where not exists(select 1 from private.admin_accounts);

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', (select user_id from private.admin_accounts limit 1),
  'role', 'authenticated',
  'aal', 'aal1'
)::text, true);
select throws_ok(
  $$select * from public.admin_bulk_set_player_sex(
    '[{"playerId":99591,"sex":"female"}]'::jsonb,
    'Revisão administrativa em lote'
  )$$,
  'BD401',
  'BDB_ADMIN_AAL2_REQUIRED',
  'aal1 cannot submit a private review batch'
);

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', (select user_id from private.admin_accounts limit 1),
  'role', 'authenticated',
  'aal', 'aal2'
)::text, true);

insert into public.players(id,full_name,slug)
overriding system value values
  (99591,'Atleta Lote Um','atleta-lote-um'),
  (99592,'Atleta Lote Dois','atleta-lote-dois');
insert into private.player_private(player_id,sex,sex_review_required)
values
  (99591,'male',false),
  (99592,'male',false);

create temporary table bulk_private_review_result as
select *
from public.admin_bulk_set_player_sex(
  '[{"playerId":99591,"sex":"female"},{"playerId":99592,"sex":"female"}]'::jsonb,
  'Revisão administrativa em lote'
);

select is(
  (select reviewed_count from bulk_private_review_result),
  2,
  'the RPC reports the submitted review count'
);
select is(
  (select remaining_pending from bulk_private_review_result),
  0::bigint,
  'the RPC returns only aggregate remaining progress'
);
select is(
  (select enforcement_ready from bulk_private_review_result),
  true,
  'the RPC reports readiness without returning private values'
);
select is(
  (select sex from private.player_private where player_id=99591),
  'female',
  'the first explicit choice is persisted'
);
select is(
  (select sex from private.player_private where player_id=99592),
  'female',
  'the second explicit choice is persisted'
);
select is(
  (
    select count(*)
    from public.admin_mutation_audit
    where action='player_sex_reviewed'
      and entity_id in (99591,99592)
      and metadata ->> 'reason'='Revisão administrativa em lote'
  ),
  2::bigint,
  'each changed player receives an individual audit event'
);
select ok(
  not exists(
    select 1
    from public.admin_mutation_audit
    where entity_id in (99591,99592)
      and metadata::text ~ 'male|female'
  ),
  'audit metadata never stores private eligibility values'
);

select throws_ok(
  $$select * from public.admin_bulk_set_player_sex(
    '[{"playerId":99591,"sex":"male"},{"playerId":99591,"sex":"female"}]'::jsonb,
    'Revisão administrativa em lote'
  )$$,
  'BD501',
  'BDB_PLAYER_REVIEW_BATCH_DUPLICATE',
  'duplicate players are rejected before mutation'
);
select throws_ok(
  $$select * from public.admin_bulk_set_player_sex(
    '[{"playerId":99591,"sex":"unknown"}]'::jsonb,
    'Revisão administrativa em lote'
  )$$,
  'BD501',
  'BDB_PLAYER_REVIEW_BATCH_INVALID',
  'invalid private values are rejected'
);
select throws_ok(
  $$select * from public.admin_bulk_set_player_sex(
    '[{"playerId":99591,"sex":"male"}]'::jsonb,
    'curta'
  )$$,
  'BD501',
  'BDB_PLAYER_SEX_REASON_REQUIRED',
  'a bounded audit reason is mandatory'
);
select throws_ok(
  $$select * from public.admin_bulk_set_player_sex(
    '[{"playerId":99591,"sex":"male"},{"playerId":999999999,"sex":"female"}]'::jsonb,
    'Revisão administrativa em lote'
  )$$,
  'BD404',
  'BDB_PLAYER_NOT_FOUND',
  'an unknown player rejects the whole batch'
);
select is(
  (select sex from private.player_private where player_id=99591),
  'female',
  'prevalidation keeps the batch atomic when one player is unknown'
);

select throws_ok(
  $$select * from public.admin_bulk_set_player_sex(
    '[]'::jsonb,
    'Revisão administrativa em lote'
  )$$,
  'BD501',
  'BDB_PLAYER_REVIEW_BATCH_SIZE_INVALID',
  'empty batches are rejected'
);

select * from finish();
rollback;
