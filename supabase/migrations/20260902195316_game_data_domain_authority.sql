alter table public.admin_mutation_audit
  drop constraint admin_mutation_audit_action_check,
  add constraint admin_mutation_audit_action_check check (
    action in (
      'registration_created',
      'registration_transitioned',
      'roster_replaced',
      'manual_scoresheet_saved',
      'boxscore_import_confirmed',
      'boxscore_team_stats_refreshed',
      'final_placement_confirmed',
      'player_created',
      'competition_gender_reviewed',
      'data_profile_created',
      'data_profile_activated',
      'competition_data_profile_assigned',
      'player_sex_reviewed',
      'game_data_authority_activated'
    )
  );

create table public.game_data_source_capabilities (
  source_type text not null check (
    source_type in ('manual_scoresheet', 'fiba_boxscore')
  ),
  domain text not null check (
    domain in (
      'official_result',
      'period_scores',
      'participation',
      'player_scoring',
      'player_advanced',
      'player_foul_total',
      'player_foul_timeline',
      'team_advanced',
      'game_advanced'
    )
  ),
  precision text not null check (
    precision in ('exact', 'game_total', 'timeline')
  ),
  required_when_primary boolean not null default true,
  primary key (source_type, domain)
);

insert into public.game_data_source_capabilities (
  source_type,
  domain,
  precision,
  required_when_primary
) values
  ('manual_scoresheet', 'official_result', 'exact', true),
  ('manual_scoresheet', 'period_scores', 'exact', true),
  ('manual_scoresheet', 'participation', 'exact', true),
  ('manual_scoresheet', 'player_scoring', 'exact', true),
  ('manual_scoresheet', 'player_foul_total', 'exact', true),
  ('manual_scoresheet', 'player_foul_timeline', 'timeline', true),
  ('fiba_boxscore', 'official_result', 'exact', true),
  ('fiba_boxscore', 'period_scores', 'exact', true),
  ('fiba_boxscore', 'participation', 'exact', true),
  ('fiba_boxscore', 'player_scoring', 'exact', true),
  ('fiba_boxscore', 'player_advanced', 'exact', true),
  ('fiba_boxscore', 'player_foul_total', 'game_total', true),
  ('fiba_boxscore', 'team_advanced', 'exact', true),
  ('fiba_boxscore', 'game_advanced', 'exact', true);

alter table public.game_data_submissions
  add constraint game_data_submissions_id_game_source_unique
  unique (id, game_id, source_type);

create table public.game_data_domain_authority (
  game_id bigint not null,
  domain text not null check (
    domain in (
      'official_result',
      'period_scores',
      'participation',
      'player_scoring',
      'player_advanced',
      'player_foul_total',
      'player_foul_timeline',
      'team_advanced',
      'game_advanced'
    )
  ),
  submission_id bigint not null,
  source_type text not null,
  revision integer not null default 1 check (revision > 0),
  change_reason text check (
    change_reason is null or (
      change_reason = btrim(change_reason)
      and char_length(change_reason) between 10 and 500
    )
  ),
  activated_by uuid not null
    references auth.users(id) on delete restrict deferrable initially immediate,
  activated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (game_id, domain),
  constraint game_data_domain_authority_game_fkey
    foreign key (game_id) references public.games(id) on delete restrict,
  constraint game_data_domain_authority_submission_fkey
    foreign key (submission_id, game_id, source_type)
    references public.game_data_submissions (id, game_id, source_type)
    on delete restrict,
  constraint game_data_domain_authority_capability_fkey
    foreign key (source_type, domain)
    references public.game_data_source_capabilities (source_type, domain)
    on delete restrict
);

create index game_data_domain_authority_submission_idx
  on public.game_data_domain_authority (submission_id);

create index game_data_domain_authority_activated_by_idx
  on public.game_data_domain_authority (activated_by, activated_at desc);

create function private.enforce_game_data_domain_authority()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  submission_status text;
begin
  if tg_op = 'UPDATE' and (
    new.game_id is distinct from old.game_id
    or new.domain is distinct from old.domain
  ) then
    raise exception using
      errcode = 'BD706',
      message = 'BDB_AUTHORITY_IDENTITY_IMMUTABLE';
  end if;

  select submission.status
  into submission_status
  from public.game_data_submissions submission
  where submission.id = new.submission_id
    and submission.game_id = new.game_id
    and submission.source_type = new.source_type
  for update;

  if not found then
    raise exception using
      errcode = 'BD404',
      message = 'BDB_GAME_DATA_SUBMISSION_NOT_FOUND';
  end if;

  if submission_status <> 'active' then
    raise exception using
      errcode = 'BD703',
      message = 'BDB_AUTHORITY_SUBMISSION_INACTIVE';
  end if;

  if tg_op = 'UPDATE' and new.submission_id is distinct from old.submission_id then
    if new.revision <> old.revision + 1 then
      raise exception using
        errcode = 'BD706',
        message = 'BDB_AUTHORITY_REVISION_INVALID';
    end if;

    if new.activated_by is not distinct from old.activated_by
      and new.activated_at is not distinct from old.activated_at
    then
      raise exception using
        errcode = 'BD706',
        message = 'BDB_AUTHORITY_VALIDATION_REQUIRED';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_game_data_domain_authority()
from public, anon, authenticated;

create trigger game_data_domain_authority_enforce
before insert or update on public.game_data_domain_authority
for each row execute function private.enforce_game_data_domain_authority();

create trigger game_data_domain_authority_set_updated_at
before update on public.game_data_domain_authority
for each row execute function private.set_updated_at();

create function private.prevent_referenced_submission_deactivation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and exists (
    select 1
    from public.game_data_domain_authority authority
    where authority.submission_id = old.id
  ) then
    raise exception using
      errcode = 'BD707',
      message = 'BDB_SUBMISSION_HAS_ACTIVE_AUTHORITY';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if new.status <> 'active' and exists (
    select 1
    from public.game_data_domain_authority authority
    where authority.submission_id = old.id
  ) then
    raise exception using
      errcode = 'BD707',
      message = 'BDB_SUBMISSION_HAS_ACTIVE_AUTHORITY';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_referenced_submission_deactivation()
from public, anon, authenticated;

create trigger game_data_submissions_protect_active_authority
before update of status or delete on public.game_data_submissions
for each row execute function private.prevent_referenced_submission_deactivation();

alter table public.game_data_source_capabilities enable row level security;
alter table public.game_data_source_capabilities force row level security;
alter table public.game_data_domain_authority enable row level security;
alter table public.game_data_domain_authority force row level security;

create policy game_data_source_capabilities_admin_select
on public.game_data_source_capabilities
for select
to authenticated
using ((select public.is_current_admin_aal2()));

create policy game_data_domain_authority_admin_select
on public.game_data_domain_authority
for select
to authenticated
using ((select public.is_current_admin_aal2()));

revoke all on public.game_data_source_capabilities
from public, anon, authenticated;
revoke all on public.game_data_domain_authority
from public, anon, authenticated;

grant select on public.game_data_source_capabilities to authenticated;
grant select on public.game_data_domain_authority to authenticated;

create function private.activate_game_data_domain_authority(
  p_game_id bigint,
  p_domain text,
  p_submission_id bigint,
  p_expected_submission_id bigint default null,
  p_reason text default null
)
returns public.game_data_domain_authority
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_variable
declare
  normalized_domain text := lower(btrim(coalesce(p_domain, '')));
  normalized_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  selected_submission public.game_data_submissions;
  current_authority public.game_data_domain_authority;
  saved_authority public.game_data_domain_authority;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  if normalized_domain not in (
    'official_result',
    'period_scores',
    'participation',
    'player_scoring',
    'player_advanced',
    'player_foul_total',
    'player_foul_timeline',
    'team_advanced',
    'game_advanced'
  ) then
    raise exception using errcode = 'BD701', message = 'BDB_AUTHORITY_DOMAIN_INVALID';
  end if;

  if normalized_reason is not null
    and char_length(normalized_reason) not between 10 and 500
  then
    raise exception using errcode = 'BD705', message = 'BDB_AUTHORITY_REASON_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_game_id::text || ':' || normalized_domain, 2002)
  );

  select submission.*
  into selected_submission
  from public.game_data_submissions submission
  where submission.id = p_submission_id
    and submission.game_id = p_game_id
  for update;

  if not found then
    if not exists (select 1 from public.games game where game.id = p_game_id) then
      raise exception using errcode = 'BD404', message = 'BDB_GAME_NOT_FOUND';
    end if;

    raise exception using
      errcode = 'BD404',
      message = 'BDB_GAME_DATA_SUBMISSION_NOT_FOUND';
  end if;

  if selected_submission.status <> 'active' then
    raise exception using
      errcode = 'BD703',
      message = 'BDB_AUTHORITY_SUBMISSION_INACTIVE';
  end if;

  if not exists (
    select 1
    from public.game_data_source_capabilities capability
    where capability.source_type = selected_submission.source_type
      and capability.domain = normalized_domain
  ) then
    raise exception using
      errcode = 'BD702',
      message = 'BDB_SOURCE_DOMAIN_UNSUPPORTED';
  end if;

  select authority.*
  into current_authority
  from public.game_data_domain_authority authority
  where authority.game_id = p_game_id
    and authority.domain = normalized_domain
  for update;

  if found and current_authority.submission_id = p_submission_id then
    return current_authority;
  end if;

  if current_authority.submission_id is distinct from p_expected_submission_id then
    raise exception using errcode = 'BD704', message = 'BDB_AUTHORITY_CONFLICT';
  end if;

  if current_authority.submission_id is not null and normalized_reason is null then
    raise exception using
      errcode = 'BD705',
      message = 'BDB_AUTHORITY_REASON_REQUIRED';
  end if;

  if current_authority.submission_id is null then
    insert into public.game_data_domain_authority (
      game_id,
      domain,
      submission_id,
      source_type,
      revision,
      change_reason,
      activated_by,
      activated_at
    ) values (
      p_game_id,
      normalized_domain,
      selected_submission.id,
      selected_submission.source_type,
      1,
      normalized_reason,
      auth.uid(),
      now()
    )
    returning * into saved_authority;
  else
    update public.game_data_domain_authority authority
    set
      submission_id = selected_submission.id,
      source_type = selected_submission.source_type,
      revision = current_authority.revision + 1,
      change_reason = normalized_reason,
      activated_by = auth.uid(),
      activated_at = greatest(
        clock_timestamp(),
        current_authority.activated_at + interval '1 microsecond'
      )
    where authority.game_id = p_game_id
      and authority.domain = normalized_domain
    returning * into saved_authority;
  end if;

  insert into public.admin_mutation_audit (
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    'game_data_authority_activated',
    'game',
    p_game_id,
    jsonb_build_object(
      'domain', normalized_domain,
      'sourceType', selected_submission.source_type,
      'submissionId', selected_submission.id,
      'previousSubmissionId', current_authority.submission_id,
      'revision', saved_authority.revision,
      'reasonProvided', normalized_reason is not null
    )
  );

  return saved_authority;
end;
$$;

revoke all on function private.activate_game_data_domain_authority(
  bigint,
  text,
  bigint,
  bigint,
  text
) from public, anon, authenticated;

create function public.admin_activate_game_data_authority(
  p_game_id bigint,
  p_domain text,
  p_submission_id bigint,
  p_expected_submission_id bigint default null,
  p_reason text default null
)
returns public.game_data_domain_authority
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  return private.activate_game_data_domain_authority(
    p_game_id,
    p_domain,
    p_submission_id,
    p_expected_submission_id,
    p_reason
  );
end;
$$;

revoke all on function public.admin_activate_game_data_authority(
  bigint,
  text,
  bigint,
  bigint,
  text
) from public, anon, authenticated;
grant execute on function public.admin_activate_game_data_authority(
  bigint,
  text,
  bigint,
  bigint,
  text
) to authenticated;

create function public.admin_activate_game_data_authorities(
  p_game_id bigint,
  p_submission_id bigint,
  p_domains text[],
  p_expected_submission_id bigint default null,
  p_reason text default null
)
returns setof public.game_data_domain_authority
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  requested_domain text;
  saved_authority public.game_data_domain_authority;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  if p_domains is null
    or cardinality(p_domains) = 0
    or exists (
      select 1
      from unnest(p_domains) supplied_domain
      where supplied_domain is null or btrim(supplied_domain) = ''
    )
  then
    raise exception using
      errcode = 'BD708',
      message = 'BDB_AUTHORITY_DOMAINS_INVALID';
  end if;

  for requested_domain in
    select distinct lower(btrim(supplied_domain))
    from unnest(p_domains) supplied_domain
    order by 1
  loop
    saved_authority := private.activate_game_data_domain_authority(
      p_game_id,
      requested_domain,
      p_submission_id,
      p_expected_submission_id,
      p_reason
    );
    return next saved_authority;
  end loop;

  return;
end;
$$;

revoke all on function public.admin_activate_game_data_authorities(
  bigint,
  bigint,
  text[],
  bigint,
  text
) from public, anon, authenticated;
grant execute on function public.admin_activate_game_data_authorities(
  bigint,
  bigint,
  text[],
  bigint,
  text
) to authenticated;

create view public.game_data_status
with (security_invoker = true)
as
with expected as (
  select
    game.id as game_id,
    game.competition_id,
    profile.primary_source as expected_primary_source,
    competition.data_profile_review_required
  from public.games game
  join public.competitions competition on competition.id = game.competition_id
  left join public.series_category_data_profiles profile
    on profile.id = competition.data_profile_id
  where (select public.is_current_admin_aal2())
),
submission_rollup as (
  select
    submission.game_id,
    count(*) filter (where submission.status = 'active') as active_submission_count,
    count(*) filter (
      where submission.status in ('draft', 'review', 'validated')
    ) as pending_submission_count,
    count(*) filter (
      where submission.status = 'active' and submission.role = 'primary'
    ) as active_primary_submission_count,
    coalesce(
      bool_or(
        submission.status = 'active'
        and submission.source_type = 'manual_scoresheet'
        and submission.role = 'fallback'
      ),
      false
    ) as has_active_manual_fallback,
    coalesce(
      bool_or(
        submission.status = 'active'
        and submission.source_type = 'fiba_boxscore'
        and submission.role = 'primary'
      ),
      false
    ) as has_active_fiba_primary,
    array_agg(distinct submission.source_type order by submission.source_type)
      filter (where submission.status = 'active') as active_sources
  from public.game_data_submissions submission
  group by submission.game_id
),
authority_rollup as (
  select
    authority.game_id,
    count(*) as active_authority_count
  from public.game_data_domain_authority authority
  group by authority.game_id
),
required_coverage as (
  select
    expected.game_id,
    count(capability.domain) as required_domain_count,
    count(authority.domain) filter (
      where authority.source_type = expected.expected_primary_source
    ) as covered_required_domain_count,
    array_agg(capability.domain order by capability.domain) filter (
      where authority.domain is null
        or authority.source_type <> expected.expected_primary_source
    ) as missing_domains
  from expected
  left join public.game_data_source_capabilities capability
    on capability.source_type = expected.expected_primary_source
    and capability.required_when_primary
  left join public.game_data_domain_authority authority
    on authority.game_id = expected.game_id
    and authority.domain = capability.domain
  group by expected.game_id, expected.expected_primary_source
),
domain_candidates as (
  select
    submission.game_id,
    capability.domain,
    count(*) as candidate_count
  from public.game_data_submissions submission
  join public.game_data_source_capabilities capability
    on capability.source_type = submission.source_type
  where submission.status = 'active'
  group by submission.game_id, capability.domain
),
unresolved_conflicts as (
  select candidate.game_id, count(*) as unresolved_conflict_count
  from domain_candidates candidate
  where candidate.candidate_count > 1
    and not exists (
      select 1
      from public.game_data_domain_authority authority
      where authority.game_id = candidate.game_id
        and authority.domain = candidate.domain
    )
  group by candidate.game_id
)
select
  expected.game_id,
  expected.competition_id,
  expected.expected_primary_source,
  case
    when coalesce(submission.active_primary_submission_count, 0) > 1
      or coalesce(conflict.unresolved_conflict_count, 0) > 0
      then 'conflict'
    when expected.expected_primary_source = 'fiba_boxscore'
      and coalesce(submission.has_active_manual_fallback, false)
      and not coalesce(submission.has_active_fiba_primary, false)
      then 'awaiting_primary_source'
    when expected.expected_primary_source is null
      or expected.data_profile_review_required
      or coalesce(submission.pending_submission_count, 0) > 0
      then 'review'
    when coverage.required_domain_count > 0
      and coverage.covered_required_domain_count = coverage.required_domain_count
      then 'ready'
    else 'review'
  end as data_status,
  coalesce(submission.active_submission_count, 0) as active_submission_count,
  coalesce(submission.pending_submission_count, 0) as pending_submission_count,
  coalesce(authority.active_authority_count, 0) as active_authority_count,
  coverage.required_domain_count,
  coverage.covered_required_domain_count,
  case
    when expected.expected_primary_source is null then null
    else coalesce(coverage.missing_domains, array[]::text[])
  end as missing_domains,
  coalesce(submission.active_sources, array[]::text[]) as active_sources
from expected
left join submission_rollup submission on submission.game_id = expected.game_id
left join authority_rollup authority on authority.game_id = expected.game_id
join required_coverage coverage on coverage.game_id = expected.game_id
left join unresolved_conflicts conflict on conflict.game_id = expected.game_id;

revoke all on public.game_data_status from public, anon, authenticated;
grant select on public.game_data_status to authenticated;

comment on table public.game_data_source_capabilities is
  'Closed matrix of domains each first-season source can authoritatively provide; absence means unsupported.';
comment on table public.game_data_domain_authority is
  'One current authority per game and data domain, changed only through singleton-AAL2 compare-and-swap RPCs.';
comment on view public.game_data_status is
  'Derived administrative coverage state; never persisted in games and never treats unavailable data as zero.';
