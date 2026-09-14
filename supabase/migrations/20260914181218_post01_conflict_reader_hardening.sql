create index game_data_domain_comparisons_game_id_idx
  on public.game_data_domain_comparisons(game_id);
create index game_data_domain_comparisons_base_context_idx
  on public.game_data_domain_comparisons(base_submission_id, game_id);
create index game_data_domain_comparisons_candidate_context_idx
  on public.game_data_domain_comparisons(candidate_submission_id, game_id);
create index game_data_domain_comparisons_expected_authority_context_idx
  on public.game_data_domain_comparisons(expected_authority_submission_id, game_id)
  where expected_authority_submission_id is not null;
create index game_data_domain_comparisons_compared_by_idx
  on public.game_data_domain_comparisons(compared_by);
create index game_data_domain_comparisons_decided_by_idx
  on public.game_data_domain_comparisons(decided_by)
  where decided_by is not null;

create or replace function public.admin_get_game_data_conflict(p_game_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  response jsonb;
  selected_candidate_submission_id bigint;
  resolved_decision text;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  select max(comparison.candidate_submission_id)
  into selected_candidate_submission_id
  from public.game_data_domain_comparisons comparison
  where comparison.game_id = p_game_id;

  select audit.metadata ->> 'decision'
  into resolved_decision
  from public.admin_mutation_audit audit
  where audit.action = 'game_data_conflict_resolved'
    and audit.entity_type = 'game'
    and audit.entity_id = p_game_id
    and audit.metadata ->> 'candidateSubmissionId' = selected_candidate_submission_id::text
  order by audit.occurred_at desc
  limit 1;

  select jsonb_build_object(
    'gameId', p_game_id,
    'candidateSubmissionId', selected_candidate_submission_id,
    'resolvedDecision', resolved_decision,
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
    ) order by comparison.domain) filter (where comparison.id is not null), '[]'::jsonb)
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
    'candidateSubmissionId', null,
    'resolvedDecision', null,
    'pendingCount', 0,
    'domains', '[]'::jsonb
  ));
end;
$$;

revoke all on function public.admin_get_game_data_conflict(bigint)
from public, anon, authenticated;
grant execute on function public.admin_get_game_data_conflict(bigint) to authenticated;

comment on function public.admin_get_game_data_conflict(bigint) is
  'Returns singleton-AAL2 conflict evidence ordered by the immutable audit occurrence timestamp.';
