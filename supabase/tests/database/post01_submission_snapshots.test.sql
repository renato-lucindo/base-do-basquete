begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select has_table(
  'public', 'game_data_submission_snapshots',
  'immutable per-domain submission snapshots exist'
);
select has_column(
  'public', 'game_data_submission_snapshots', 'payload_hash',
  'snapshots have a deterministic comparison hash'
);
select has_function(
  'private', 'capture_game_data_submission_snapshots', array['bigint', 'bigint'],
  'the private canonical snapshot builder exists'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'game_data_submissions_capture_snapshot' and not tgisinternal
  ),
  'new submissions are snapshotted in their ingestion transaction'
);
select ok(
  (select relrowsecurity and relforcerowsecurity
    from pg_class where oid = 'public.game_data_submission_snapshots'::regclass),
  'snapshot rows have forced RLS'
);
select ok(
  has_table_privilege('authenticated', 'public.game_data_submission_snapshots', 'select'),
  'authenticated callers can read snapshots through AAL2 RLS'
);
select ok(
  not has_table_privilege('anon', 'public.game_data_submission_snapshots', 'select'),
  'anonymous callers cannot read snapshots'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'private.capture_game_data_submission_snapshots(bigint,bigint)',
    'execute'
  ),
  'clients cannot forge canonical snapshots'
);

select set_config('bdb.post01_submission_role', '', true);
insert into public.game_data_submissions(
  game_id, submission_version, source_type, role, status,
  payload_hash, idempotency_key, reason, submitted_by
)
select
  game.id,
  coalesce((select max(existing.submission_version) + 200
    from public.game_data_submissions existing
    where existing.game_id = game.id and existing.source_type = 'manual_scoresheet'), 200),
  'manual_scoresheet', 'primary', 'draft', repeat('c', 32),
  'post01-snapshot-trigger', null, (select user_id from private.admin_accounts)
from public.games game
order by game.id
limit 1;

select is(
  (select count(*)::integer
    from public.game_data_submission_snapshots snapshot
    join public.game_data_submissions submission on submission.id = snapshot.submission_id
    where submission.idempotency_key = 'post01-snapshot-trigger'),
  6,
  'a manual submission receives exactly its six supported domain snapshots'
);
select is(
  (select count(*)::integer
    from public.game_data_submission_snapshots snapshot
    join public.game_data_submissions submission on submission.id = snapshot.submission_id
    where submission.idempotency_key = 'post01-snapshot-trigger'
      and snapshot.payload_hash ~ '^[0-9a-f]{32}$'),
  6,
  'each captured manual domain has a deterministic comparison hash'
);
select ok(
  (select snapshot.payload ? 'teams'
    from public.game_data_submission_snapshots snapshot
    join public.game_data_submissions submission on submission.id = snapshot.submission_id
    where submission.idempotency_key = 'post01-snapshot-trigger'
      and snapshot.domain = 'official_result'),
  'the official result snapshot is canonical structured JSON'
);
select throws_ok(
  $$update public.game_data_submission_snapshots snapshot
    set payload = '{}'::jsonb
    from public.game_data_submissions submission
    where submission.id = snapshot.submission_id
      and submission.idempotency_key = 'post01-snapshot-trigger'
      and snapshot.domain = 'official_result'$$,
  '23514',
  'BDB_SUBMISSION_SNAPSHOT_IMMUTABLE',
  'captured evidence cannot be rewritten'
);
select throws_ok(
  $$insert into public.game_data_submission_snapshots(
      submission_id, game_id, domain, payload, payload_hash
    )
    select submission.id, submission.game_id, 'player_advanced', '{}'::jsonb, repeat('d', 32)
    from public.game_data_submissions submission
    where submission.idempotency_key = 'post01-snapshot-trigger'$$,
  'BD702',
  'BDB_SOURCE_DOMAIN_UNSUPPORTED',
  'a snapshot cannot claim a domain unsupported by its source'
);

select * from finish();
rollback;
