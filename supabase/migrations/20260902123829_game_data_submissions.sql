create table public.game_data_submissions (
  id bigint generated always as identity primary key,
  game_id bigint not null references public.games(id) on delete restrict,
  submission_version integer not null check (submission_version > 0),
  source_type text not null check (
    source_type in ('manual_scoresheet', 'fiba_boxscore', 'legacy_seed')
  ),
  role text not null check (role in ('primary', 'fallback', 'supplemental')),
  status text not null default 'draft' check (
    status in ('draft', 'review', 'validated', 'active', 'rejected', 'superseded')
  ),
  parser_version text check (
    parser_version is null or (
      parser_version = btrim(parser_version)
      and char_length(parser_version) between 1 and 40
    )
  ),
  payload_hash text check (
    payload_hash is null
    or payload_hash ~ '^([0-9a-f]{32}|[0-9a-f]{64})$'
  ),
  storage_object_id uuid references storage.objects(id) on delete restrict,
  idempotency_key text not null check (
    idempotency_key = btrim(idempotency_key)
    and char_length(idempotency_key) between 1 and 200
  ),
  reason text check (
    reason is null or (
      reason = btrim(reason)
      and char_length(reason) between 1 and 1000
    )
  ),
  submitted_by uuid references auth.users(id) on delete restrict
    deferrable initially immediate,
  submitted_at timestamptz not null default now(),
  validated_by uuid references auth.users(id) on delete restrict
    deferrable initially immediate,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_data_submissions_game_source_version_unique
    unique (game_id, source_type, submission_version),
  constraint game_data_submissions_source_idempotency_unique
    unique (source_type, idempotency_key),
  constraint game_data_submissions_reason_required check (
    (role <> 'fallback' and status <> 'rejected') or reason is not null
  ),
  constraint game_data_submissions_validation_consistent check (
    (
      status in ('draft', 'review')
      and validated_by is null
      and validated_at is null
    ) or (
      status in ('validated', 'active', 'rejected', 'superseded')
      and validated_by is not null
      and validated_at is not null
    )
  ),
  constraint game_data_submissions_source_payload_consistent check (
    source_type not in ('manual_scoresheet', 'fiba_boxscore', 'legacy_seed')
    or (
      source_type = 'manual_scoresheet'
      and parser_version is null
      and payload_hash is not null
      and storage_object_id is null
      and submitted_by is not null
    ) or (
      source_type = 'fiba_boxscore'
      and parser_version is not null
      and payload_hash is not null
      and storage_object_id is not null
      and submitted_by is not null
    ) or (
      source_type = 'legacy_seed'
      and parser_version is null
      and storage_object_id is null
    )
  )
);

create unique index game_data_submissions_active_source_parser_uidx
  on public.game_data_submissions (
    game_id,
    source_type,
    coalesce(parser_version, '')
  )
  where status = 'active';

create index game_data_submissions_game_status_submitted_idx
  on public.game_data_submissions (game_id, status, submitted_at desc);

create index game_data_submissions_submitted_by_idx
  on public.game_data_submissions (submitted_by)
  where submitted_by is not null;

create index game_data_submissions_validated_by_idx
  on public.game_data_submissions (validated_by)
  where validated_by is not null;

create index game_data_submissions_storage_object_idx
  on public.game_data_submissions (storage_object_id)
  where storage_object_id is not null;

create function private.enforce_game_data_submission_immutability()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(
    new.game_id,
    new.submission_version,
    new.source_type,
    new.role,
    new.parser_version,
    new.payload_hash,
    new.storage_object_id,
    new.idempotency_key,
    new.submitted_by,
    new.submitted_at
  ) is distinct from row(
    old.game_id,
    old.submission_version,
    old.source_type,
    old.role,
    old.parser_version,
    old.payload_hash,
    old.storage_object_id,
    old.idempotency_key,
    old.submitted_by,
    old.submitted_at
  ) then
    raise exception using
      errcode = '23514',
      message = 'BDB_GAME_DATA_SUBMISSION_IMMUTABLE';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_game_data_submission_immutability()
from public, anon, authenticated;

create trigger game_data_submissions_enforce_immutability
before update on public.game_data_submissions
for each row execute function private.enforce_game_data_submission_immutability();

create trigger game_data_submissions_set_updated_at
before update on public.game_data_submissions
for each row execute function private.set_updated_at();

alter table public.game_data_submissions enable row level security;
alter table public.game_data_submissions force row level security;

create policy game_data_submissions_admin_select
on public.game_data_submissions
for select
to authenticated
using ((select public.is_current_admin_aal2()));

revoke all on public.game_data_submissions
from public, anon, authenticated;
revoke all on sequence public.game_data_submissions_id_seq
from public, anon, authenticated;

grant select on public.game_data_submissions to authenticated;

comment on table public.game_data_submissions is
  'Immutable versioned inputs attached to one game; domain authority and historical backfill are introduced separately.';
comment on column public.game_data_submissions.source_type is
  'manual_scoresheet, fiba_boxscore, or migration-only legacy_seed.';
comment on column public.game_data_submissions.storage_object_id is
  'Opaque reference to a private Storage object; paths and contents are not exposed by this table.';
