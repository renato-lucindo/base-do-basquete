begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

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
select has_function(
  'public',
  'admin_get_player_review_queue',
  array[]::text[],
  'contextual value-free player queue RPC exists'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_get_player_review_queue()',
    'EXECUTE'
  ),
  'authenticated may execute the protected queue RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.admin_get_player_review_queue()',
    'EXECUTE'
  ),
  'anon cannot execute the protected queue RPC'
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

create temporary table bulk_private_review_baseline as
select
  count(*) filter (where sex is null or sex_review_required)::bigint as remaining_pending,
  (private.build_classification_backfill_report() ->> 'enforcementReady')::boolean
    as enforcement_ready
from private.player_private;

insert into public.players(id,full_name,slug)
overriding system value values
  (99591,'Atleta Lote Um','atleta-lote-um'),
  (99592,'Atleta Lote Dois','atleta-lote-dois');
insert into private.player_private(player_id,sex,sex_review_required)
values
  (99591,'male',true),
  (99592,'male',true)
on conflict (player_id) do update
set sex=excluded.sex,
    sex_review_required=excluded.sex_review_required;

select is(
  jsonb_array_length(public.admin_get_player_review_queue() -> 'players'),
  (select remaining_pending::integer + 2 from bulk_private_review_baseline),
  'the queue returns every pending player'
);
select ok(
  public.admin_get_player_review_queue()::text !~ '"sex"|"male"|"female"'
  and jsonb_typeof(
    public.admin_get_player_review_queue() #> '{players,0,reviewRevision}'
  ) = 'number',
  'the queue exposes an opaque revision but no private eligibility value'
);

create temporary table bulk_private_review_result as
select *
from public.admin_bulk_set_player_sex(
  jsonb_build_array(
    jsonb_build_object(
      'playerId',99591,
      'sex','female',
      'expectedRevision',(
        select floor(extract(epoch from updated_at)*1000000)::bigint
        from private.player_private where player_id=99591
      )
    ),
    jsonb_build_object(
      'playerId',99592,
      'sex','female',
      'expectedRevision',(
        select floor(extract(epoch from updated_at)*1000000)::bigint
        from private.player_private where player_id=99592
      )
    )
  ),
  'Revisão administrativa em lote'
);

select is(
  (select reviewed_count from bulk_private_review_result),
  2,
  'the RPC reports the submitted review count'
);
select is(
  (select remaining_pending from bulk_private_review_result),
  (select remaining_pending from bulk_private_review_baseline),
  'the RPC returns only aggregate remaining progress'
);
select is(
  (select enforcement_ready from bulk_private_review_result),
  (select enforcement_ready from bulk_private_review_baseline),
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
    '[{"playerId":99591,"sex":"male","expectedRevision":1},{"playerId":99591,"sex":"female","expectedRevision":1}]'::jsonb,
    'Revisão administrativa em lote'
  )$$,
  'BD501',
  'BDB_PLAYER_REVIEW_BATCH_DUPLICATE',
  'duplicate players are rejected before mutation'
);
select throws_ok(
  $$select * from public.admin_bulk_set_player_sex(
    '[{"playerId":99591,"sex":"unknown","expectedRevision":1}]'::jsonb,
    'Revisão administrativa em lote'
  )$$,
  'BD501',
  'BDB_PLAYER_REVIEW_BATCH_INVALID',
  'invalid private values are rejected'
);
select throws_ok(
  $$select * from public.admin_bulk_set_player_sex(
    '[{"playerId":99591,"sex":"male","expectedRevision":1}]'::jsonb,
    'curta'
  )$$,
  'BD501',
  'BDB_PLAYER_SEX_REASON_REQUIRED',
  'a bounded audit reason is mandatory'
);
select throws_ok(
  $$select * from public.admin_bulk_set_player_sex(
    '[{"playerId":99591,"sex":"male","expectedRevision":1},{"playerId":999999999,"sex":"female","expectedRevision":1}]'::jsonb,
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
    '[{"playerId":99591,"sex":"male","expectedRevision":1}]'::jsonb,
    'Revisão administrativa em lote'
  )$$,
  'BD409',
  'BDB_PLAYER_REVIEW_STALE',
  'a completed or concurrently changed row rejects the stale batch'
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
