alter table public.admin_mutation_audit
  drop constraint admin_mutation_audit_action_check,
  add constraint admin_mutation_audit_action_check check(action in (
    'registration_created','registration_transitioned','roster_replaced','manual_scoresheet_saved',
    'boxscore_import_confirmed','boxscore_team_stats_refreshed','final_placement_confirmed','player_created',
    'competition_gender_reviewed','data_profile_created','data_profile_activated',
    'competition_data_profile_assigned','player_sex_reviewed','game_data_authority_activated',
    'competition_created_from_preset','competition_entry_assigned','matchup_prepared','matchup_resolved',
    'competition_published','manual_fallback_confirmed','boxscore_supplement_confirmed',
    'manual_fallback_finalized','game_data_comparison_created','game_data_conflict_resolved'
  ));

create table public.game_data_domain_comparisons (
  id bigint generated always as identity primary key,
  game_id bigint not null references public.games(id) on delete restrict,
  base_submission_id bigint not null,
  candidate_submission_id bigint not null,
  domain text not null,
  comparison_result text not null check (comparison_result in ('matching', 'conflict')),
  resolution_status text not null check (
    resolution_status in ('matching', 'pending', 'resolved')
  ),
  decision text check (decision in ('base', 'candidate')),
  expected_authority_submission_id bigint,
  expected_authority_revision integer check (
    expected_authority_revision is null or expected_authority_revision > 0
  ),
  compared_by uuid not null references auth.users(id) on delete restrict,
  compared_at timestamptz not null default now(),
  decided_by uuid references auth.users(id) on delete restrict,
  decided_at timestamptz,
  decision_reason text check (
    decision_reason is null or (
      decision_reason = btrim(decision_reason)
      and char_length(decision_reason) between 10 and 500
    )
  ),
  constraint game_data_domain_comparisons_base_fkey
    foreign key (base_submission_id, game_id)
    references public.game_data_submissions(id, game_id) on delete restrict,
  constraint game_data_domain_comparisons_candidate_fkey
    foreign key (candidate_submission_id, game_id)
    references public.game_data_submissions(id, game_id) on delete restrict,
  constraint game_data_domain_comparisons_expected_authority_fkey
    foreign key (expected_authority_submission_id, game_id)
    references public.game_data_submissions(id, game_id) on delete restrict,
  constraint game_data_domain_comparisons_distinct_submissions check (
    base_submission_id <> candidate_submission_id
  ),
  constraint game_data_domain_comparisons_expected_authority_consistent check (
    (expected_authority_submission_id is null and expected_authority_revision is null)
    or (expected_authority_submission_id is not null and expected_authority_revision is not null)
  ),
  constraint game_data_domain_comparisons_resolution_consistent check (
    (
      resolution_status in ('matching', 'pending')
      and decision is null
      and decided_by is null
      and decided_at is null
      and decision_reason is null
    ) or (
      resolution_status = 'resolved'
      and comparison_result = 'conflict'
      and decision is not null
      and decided_by is not null
      and decided_at is not null
      and decision_reason is not null
    )
  ),
  unique (candidate_submission_id, domain)
);

create index game_data_domain_comparisons_pending_idx
  on public.game_data_domain_comparisons(game_id, compared_at desc)
  where resolution_status = 'pending';
create index game_data_domain_comparisons_base_idx
  on public.game_data_domain_comparisons(base_submission_id);
create index game_data_domain_comparisons_expected_authority_idx
  on public.game_data_domain_comparisons(expected_authority_submission_id)
  where expected_authority_submission_id is not null;

create function private.enforce_game_data_domain_comparison()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and row(
    new.game_id,
    new.base_submission_id,
    new.candidate_submission_id,
    new.domain,
    new.comparison_result,
    new.expected_authority_submission_id,
    new.expected_authority_revision,
    new.compared_by,
    new.compared_at
  ) is distinct from row(
    old.game_id,
    old.base_submission_id,
    old.candidate_submission_id,
    old.domain,
    old.comparison_result,
    old.expected_authority_submission_id,
    old.expected_authority_revision,
    old.compared_by,
    old.compared_at
  ) then
    raise exception using errcode = '23514', message = 'BDB_DOMAIN_COMPARISON_IMMUTABLE';
  end if;

  if tg_op = 'UPDATE' and old.resolution_status <> 'pending' then
    raise exception using errcode = 'BD717', message = 'BDB_DOMAIN_COMPARISON_ALREADY_DECIDED';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_game_data_domain_comparison()
from public, anon, authenticated;

create trigger game_data_domain_comparisons_enforce
before update on public.game_data_domain_comparisons
for each row execute function private.enforce_game_data_domain_comparison();

alter table public.game_data_domain_comparisons enable row level security;
alter table public.game_data_domain_comparisons force row level security;

create policy game_data_domain_comparisons_admin_select
on public.game_data_domain_comparisons for select to authenticated
using ((select public.is_current_admin_aal2()));

revoke all on public.game_data_domain_comparisons from public, anon, authenticated;
revoke all on sequence public.game_data_domain_comparisons_id_seq
from public, anon, authenticated;
grant select on public.game_data_domain_comparisons to authenticated;

create function private.compare_game_data_submissions(
  p_base_submission_id bigint,
  p_candidate_submission_id bigint
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  base_submission public.game_data_submissions;
  candidate_submission public.game_data_submissions;
  compared_count integer;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  select submission.* into base_submission
  from public.game_data_submissions submission
  where submission.id = p_base_submission_id and submission.status = 'active';
  if not found then
    raise exception using errcode = 'BD703', message = 'BDB_AUTHORITY_SUBMISSION_INACTIVE';
  end if;
  select submission.* into candidate_submission
  from public.game_data_submissions submission
  where submission.id = p_candidate_submission_id and submission.status = 'active';
  if not found then
    raise exception using errcode = 'BD703', message = 'BDB_AUTHORITY_SUBMISSION_INACTIVE';
  end if;
  if base_submission.game_id <> candidate_submission.game_id
    or base_submission.id = candidate_submission.id
  then
    raise exception using errcode = 'BD713', message = 'BDB_GAME_DATA_CONFLICT';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'submission-compare:' || candidate_submission.id::text,
    2004
  ));

  insert into public.game_data_domain_comparisons(
    game_id,
    base_submission_id,
    candidate_submission_id,
    domain,
    comparison_result,
    resolution_status,
    expected_authority_submission_id,
    expected_authority_revision,
    compared_by
  )
  select
    candidate_submission.game_id,
    base_submission.id,
    candidate_submission.id,
    base_snapshot.domain,
    case
      when base_snapshot.payload_hash = candidate_snapshot.payload_hash then 'matching'
      else 'conflict'
    end,
    case
      when base_snapshot.payload_hash = candidate_snapshot.payload_hash then 'matching'
      else 'pending'
    end,
    authority.submission_id,
    authority.revision,
    auth.uid()
  from public.game_data_submission_snapshots base_snapshot
  join public.game_data_submission_snapshots candidate_snapshot
    on candidate_snapshot.submission_id = candidate_submission.id
    and candidate_snapshot.domain = base_snapshot.domain
  left join public.game_data_domain_authority authority
    on authority.game_id = candidate_submission.game_id
    and authority.domain = base_snapshot.domain
  where base_snapshot.submission_id = base_submission.id
  on conflict (candidate_submission_id, domain) do nothing;
  get diagnostics compared_count = row_count;

  if compared_count = 0 and not exists (
    select 1 from public.game_data_domain_comparisons comparison
    where comparison.candidate_submission_id = candidate_submission.id
  ) then
    raise exception using errcode = 'BD718', message = 'BDB_SUBMISSION_SNAPSHOTS_MISSING';
  end if;

  insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
  select
    'game_data_comparison_created',
    'game',
    candidate_submission.game_id,
    jsonb_build_object(
      'baseSubmissionId', base_submission.id,
      'candidateSubmissionId', candidate_submission.id,
      'domainCount', (
        select count(*)
        from public.game_data_domain_comparisons comparison
        where comparison.candidate_submission_id = candidate_submission.id
      ),
      'conflictCount', (
        select count(*)
        from public.game_data_domain_comparisons comparison
        where comparison.candidate_submission_id = candidate_submission.id
          and comparison.comparison_result = 'conflict'
      )
    )
  where not exists (
    select 1
    from public.admin_mutation_audit audit
    where audit.action = 'game_data_comparison_created'
      and audit.entity_type = 'game'
      and audit.entity_id = candidate_submission.game_id
      and audit.metadata ->> 'candidateSubmissionId' = candidate_submission.id::text
  );

  return compared_count;
end;
$$;

revoke all on function private.compare_game_data_submissions(bigint, bigint)
from public, anon, authenticated;

create function public.admin_get_game_data_conflict(p_game_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  response jsonb;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  select jsonb_build_object(
    'gameId', p_game_id,
    'pendingCount', count(*) filter (where comparison.resolution_status = 'pending'),
    'domains', coalesce(jsonb_agg(jsonb_build_object(
      'comparisonId', comparison.id,
      'domain', comparison.domain,
      'result', comparison.comparison_result,
      'status', comparison.resolution_status,
      'baseSubmissionId', comparison.base_submission_id,
      'candidateSubmissionId', comparison.candidate_submission_id,
      'expectedAuthoritySubmissionId', comparison.expected_authority_submission_id,
      'expectedAuthorityRevision', comparison.expected_authority_revision,
      'base', base_snapshot.payload,
      'candidate', candidate_snapshot.payload
    ) order by comparison.domain), '[]'::jsonb)
  )
  into response
  from public.game_data_domain_comparisons comparison
  join public.game_data_submission_snapshots base_snapshot
    on base_snapshot.submission_id = comparison.base_submission_id
    and base_snapshot.domain = comparison.domain
  join public.game_data_submission_snapshots candidate_snapshot
    on candidate_snapshot.submission_id = comparison.candidate_submission_id
    and candidate_snapshot.domain = comparison.domain
  where comparison.game_id = p_game_id;

  return coalesce(response, jsonb_build_object(
    'gameId', p_game_id,
    'pendingCount', 0,
    'domains', '[]'::jsonb
  ));
end;
$$;

revoke all on function public.admin_get_game_data_conflict(bigint)
from public, anon, authenticated;
grant execute on function public.admin_get_game_data_conflict(bigint) to authenticated;

comment on table public.game_data_domain_comparisons is
  'Immutable per-domain comparison evidence plus one-way AAL2 resolution metadata.';
comment on function private.compare_game_data_submissions(bigint, bigint) is
  'Creates idempotent comparisons only from immutable canonical snapshots.';
comment on function public.admin_get_game_data_conflict(bigint) is
  'Returns the three-block administrative comparison payload without exposing it publicly.';
