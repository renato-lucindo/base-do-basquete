-- ADM-REF-02C / deterministic historical submission and authority backfill.
--
-- Existing sports rows are read but never rewritten. Manual hashes/idempotency
-- keys and confirmed FIBA import metadata are preserved verbatim. Seed games
-- receive a review-only historical envelope and never become authoritative.

create function private.game_data_snapshot_hash(p_game_id bigint)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select md5(jsonb_build_object(
    'game', (
      select to_jsonb(game) - 'created_at' - 'updated_at'
      from public.games game
      where game.id = p_game_id
    ),
    'participants', coalesce((
      select jsonb_agg(to_jsonb(participant) order by participant.side)
      from public.game_participants participant
      where participant.game_id = p_game_id
    ), '[]'::jsonb),
    'periods', coalesce((
      select jsonb_agg(to_jsonb(period) order by period.period_number)
      from public.game_periods period
      where period.game_id = p_game_id
    ), '[]'::jsonb),
    'periodScores', coalesce((
      select jsonb_agg(
        to_jsonb(score)
        order by score.registration_id, score.period_number
      )
      from public.game_period_scores score
      where score.game_id = p_game_id
    ), '[]'::jsonb),
    'rosterSlots', coalesce((
      select jsonb_agg(
        to_jsonb(slot) - 'created_at'
        order by slot.registration_id, slot.slot_number
      )
      from public.game_roster_slots slot
      where slot.game_id = p_game_id
    ), '[]'::jsonb),
    'playerStats', coalesce((
      select jsonb_agg(
        to_jsonb(stat)
        order by stat.game_roster_slot_id, stat.period_number
      )
      from public.player_period_stats stat
      where stat.game_id = p_game_id
    ), '[]'::jsonb),
    'fouls', coalesce((
      select jsonb_agg(
        to_jsonb(foul) - 'created_at'
        order by foul.id
      )
      from public.foul_events foul
      where foul.game_id = p_game_id
    ), '[]'::jsonb),
    'teamStatistics', coalesce((
      select jsonb_agg(
        to_jsonb(stat) - 'created_at' - 'updated_at'
        order by stat.registration_id
      )
      from public.game_team_statistics stat
      where stat.game_id = p_game_id
    ), '[]'::jsonb),
    'gameStatistics', (
      select to_jsonb(stat) - 'created_at' - 'updated_at'
      from public.game_statistics stat
      where stat.game_id = p_game_id
    )
  )::text);
$$;

revoke all on function private.game_data_snapshot_hash(bigint)
from public, anon, authenticated;

create function private.backfill_game_data_submissions()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  submission_count bigint;
  authority_count bigint;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('bdb:game-data-backfill:v1', 2003)
  );

  if exists (
    select 1 from public.games game
    where game.source not in ('manual', 'boxscore', 'seed')
  ) then
    raise exception using
      errcode = 'BD708',
      message = 'BDB_BACKFILL_GAME_SOURCE_UNSUPPORTED';
  end if;

  if exists (
    select 1
    from public.games game
    where game.source = 'manual'
      and (
        game.created_by is null
        or game.manual_idempotency_key is null
        or game.manual_payload_hash is null
        or game.manual_payload_hash !~ '^([0-9a-f]{32}|[0-9a-f]{64})$'
      )
  ) then
    raise exception using
      errcode = 'BD708',
      message = 'BDB_BACKFILL_MANUAL_EVIDENCE_MISSING';
  end if;

  if exists (
    select 1
    from public.games game
    where game.source = 'boxscore'
      and (
        select count(*)
        from public.boxscore_imports import
        where import.game_id = game.id
          and import.status = 'confirmed'
      ) <> 1
  ) then
    raise exception using
      errcode = 'BD708',
      message = 'BDB_BACKFILL_BOXSCORE_IMPORT_AMBIGUOUS';
  end if;

  if exists (
    select 1
    from public.games game
    join public.boxscore_imports import
      on import.game_id = game.id and import.status = 'confirmed'
    where game.source = 'boxscore'
      and (
        import.created_by is null
        or import.confirmed_at is null
        or (
          select count(*)
          from storage.objects object
          where object.bucket_id = 'boxscore-pdfs'
            and object.name = import.storage_path
        ) <> 1
      )
  ) then
    raise exception using
      errcode = 'BD708',
      message = 'BDB_BACKFILL_BOXSCORE_EVIDENCE_MISSING';
  end if;

  insert into public.game_data_submissions (
    game_id,
    submission_version,
    source_type,
    role,
    status,
    parser_version,
    payload_hash,
    storage_object_id,
    idempotency_key,
    reason,
    submitted_by,
    submitted_at,
    validated_by,
    validated_at,
    created_at,
    updated_at
  )
  select
    game.id,
    1,
    'manual_scoresheet',
    'primary',
    'active',
    null,
    game.manual_payload_hash,
    null,
    game.manual_idempotency_key::text,
    null,
    game.created_by,
    game.created_at,
    game.created_by,
    game.updated_at,
    game.created_at,
    game.updated_at
  from public.games game
  where game.source = 'manual'
  on conflict (game_id, source_type, submission_version) do nothing;

  insert into public.game_data_submissions (
    game_id,
    submission_version,
    source_type,
    role,
    status,
    parser_version,
    payload_hash,
    storage_object_id,
    idempotency_key,
    reason,
    submitted_by,
    submitted_at,
    validated_by,
    validated_at,
    created_at,
    updated_at
  )
  select
    game.id,
    1,
    'fiba_boxscore',
    'primary',
    'active',
    import.parser_version,
    import.sha256,
    object.id,
    'boxscore-import:' || import.id::text,
    null,
    import.created_by,
    import.created_at,
    import.created_by,
    import.confirmed_at,
    import.created_at,
    greatest(import.updated_at, import.confirmed_at)
  from public.games game
  join public.boxscore_imports import
    on import.game_id = game.id and import.status = 'confirmed'
  join storage.objects object
    on object.bucket_id = 'boxscore-pdfs'
   and object.name = import.storage_path
  where game.source = 'boxscore'
  on conflict (game_id, source_type, submission_version) do nothing;

  insert into public.game_data_submissions (
    game_id,
    submission_version,
    source_type,
    role,
    status,
    parser_version,
    payload_hash,
    storage_object_id,
    idempotency_key,
    reason,
    submitted_by,
    submitted_at,
    validated_by,
    validated_at,
    created_at,
    updated_at
  )
  select
    game.id,
    1,
    'legacy_seed',
    'primary',
    'review',
    null,
    private.game_data_snapshot_hash(game.id),
    null,
    'legacy-seed-game:' || game.id::text || ':v1',
    'Migração histórica; requer revisão administrativa explícita.',
    null,
    game.created_at,
    null,
    null,
    game.created_at,
    game.updated_at
  from public.games game
  where game.source = 'seed'
  on conflict (game_id, source_type, submission_version) do nothing;

  if exists (
    select 1
    from public.games game
    left join public.game_data_submissions submission
      on submission.game_id = game.id
     and submission.submission_version = 1
     and submission.source_type = case game.source
       when 'manual' then 'manual_scoresheet'
       when 'boxscore' then 'fiba_boxscore'
       when 'seed' then 'legacy_seed'
     end
    where submission.id is null
  ) then
    raise exception using
      errcode = 'BD708',
      message = 'BDB_BACKFILL_SUBMISSION_MISSING';
  end if;

  if exists (
    select 1
    from public.games game
    join public.game_data_submissions submission
      on submission.game_id = game.id
     and submission.source_type = 'manual_scoresheet'
     and submission.submission_version = 1
    where game.source = 'manual'
      and (
        submission.role <> 'primary'
        or submission.status <> 'active'
        or submission.parser_version is not null
        or submission.payload_hash is distinct from game.manual_payload_hash
        or submission.storage_object_id is not null
        or submission.idempotency_key is distinct from game.manual_idempotency_key::text
        or submission.submitted_by is distinct from game.created_by
        or submission.validated_by is distinct from game.created_by
      )
  ) then
    raise exception using
      errcode = 'BD708',
      message = 'BDB_BACKFILL_MANUAL_SUBMISSION_CONFLICT';
  end if;

  if exists (
    select 1
    from public.games game
    join public.boxscore_imports import
      on import.game_id = game.id and import.status = 'confirmed'
    join storage.objects object
      on object.bucket_id = 'boxscore-pdfs'
     and object.name = import.storage_path
    join public.game_data_submissions submission
      on submission.game_id = game.id
     and submission.source_type = 'fiba_boxscore'
     and submission.submission_version = 1
    where game.source = 'boxscore'
      and (
        submission.role <> 'primary'
        or submission.status <> 'active'
        or submission.parser_version is distinct from import.parser_version
        or submission.payload_hash is distinct from import.sha256
        or submission.storage_object_id is distinct from object.id
        or submission.idempotency_key is distinct from
          'boxscore-import:' || import.id::text
        or submission.submitted_by is distinct from import.created_by
        or submission.validated_by is distinct from import.created_by
      )
  ) then
    raise exception using
      errcode = 'BD708',
      message = 'BDB_BACKFILL_BOXSCORE_SUBMISSION_CONFLICT';
  end if;

  if exists (
    select 1
    from public.games game
    join public.game_data_submissions submission
      on submission.game_id = game.id
     and submission.source_type = 'legacy_seed'
     and submission.submission_version = 1
    where game.source = 'seed'
      and (
        submission.role <> 'primary'
        or submission.status <> 'review'
        or submission.parser_version is not null
        or submission.payload_hash is distinct from
          private.game_data_snapshot_hash(game.id)
        or submission.storage_object_id is not null
        or submission.submitted_by is not null
        or submission.validated_by is not null
        or submission.validated_at is not null
      )
  ) then
    raise exception using
      errcode = 'BD708',
      message = 'BDB_BACKFILL_SEED_SUBMISSION_CONFLICT';
  end if;

  insert into public.game_data_domain_authority (
    game_id,
    domain,
    submission_id,
    source_type,
    revision,
    change_reason,
    activated_by,
    activated_at
  )
  select
    submission.game_id,
    capability.domain,
    submission.id,
    submission.source_type,
    1,
    null,
    submission.validated_by,
    submission.validated_at
  from public.game_data_submissions submission
  join public.game_data_source_capabilities capability
    on capability.source_type = submission.source_type
   and capability.required_when_primary
  where submission.submission_version = 1
    and submission.role = 'primary'
    and submission.status = 'active'
    and exists (
      select 1
      from public.games game
      where game.id = submission.game_id
        and (
          (game.source = 'manual' and submission.source_type = 'manual_scoresheet')
          or (game.source = 'boxscore' and submission.source_type = 'fiba_boxscore')
        )
    )
  on conflict (game_id, domain) do nothing;

  if exists (
    select 1
    from public.game_data_submissions submission
    join public.game_data_source_capabilities capability
      on capability.source_type = submission.source_type
     and capability.required_when_primary
    left join public.game_data_domain_authority authority
      on authority.game_id = submission.game_id
     and authority.domain = capability.domain
     and authority.submission_id = submission.id
     and authority.source_type = submission.source_type
    where submission.submission_version = 1
      and submission.role = 'primary'
      and submission.status = 'active'
      and authority.game_id is null
      and exists (
        select 1
        from public.games game
        where game.id = submission.game_id
          and (
            (game.source = 'manual' and submission.source_type = 'manual_scoresheet')
            or (game.source = 'boxscore' and submission.source_type = 'fiba_boxscore')
          )
      )
  ) then
    raise exception using
      errcode = 'BD708',
      message = 'BDB_BACKFILL_AUTHORITY_CONFLICT';
  end if;

  if exists (
    select 1
    from public.game_data_domain_authority authority
    join public.game_data_submissions submission
      on submission.id = authority.submission_id
    where submission.source_type = 'legacy_seed'
  ) then
    raise exception using
      errcode = 'BD708',
      message = 'BDB_BACKFILL_SEED_AUTHORITY_FORBIDDEN';
  end if;

  select count(*) into submission_count
  from public.game_data_submissions submission
  where submission.submission_version = 1
    and exists (
      select 1 from public.games game
      where game.id = submission.game_id
        and submission.source_type = case game.source
          when 'manual' then 'manual_scoresheet'
          when 'boxscore' then 'fiba_boxscore'
          when 'seed' then 'legacy_seed'
        end
    );

  select count(*) into authority_count
  from public.game_data_domain_authority authority
  where exists (
    select 1
    from public.games game
    where game.id = authority.game_id
      and game.source in ('manual', 'boxscore')
  );

  return jsonb_build_object(
    'submissions', submission_count,
    'authorities', authority_count
  );
end;
$$;

revoke all on function private.backfill_game_data_submissions()
from public, anon, authenticated;

select private.backfill_game_data_submissions();

create function private.build_game_data_backfill_report()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with expected_submissions as (
    select
      game.id as game_id,
      game.competition_id,
      game.game_number,
      game.status as game_status,
      game.source as legacy_source,
      case game.source
        when 'manual' then 'manual_scoresheet'
        when 'boxscore' then 'fiba_boxscore'
        when 'seed' then 'legacy_seed'
      end as expected_source_type
    from public.games game
  ), submission_rows as (
    select
      expected.*,
      submission.id as submission_id,
      submission.role,
      submission.status as submission_status,
      submission.parser_version,
      submission.payload_hash,
      submission.storage_object_id
    from expected_submissions expected
    left join public.game_data_submissions submission
      on submission.game_id = expected.game_id
     and submission.source_type = expected.expected_source_type
     and submission.submission_version = 1
  )
  select jsonb_build_object(
    'reportVersion', 1,
    'counts', jsonb_build_object(
      'games', (select count(*) from public.games),
      'submissions', (select count(*) from submission_rows where submission_id is not null),
      'activeSubmissions', (
        select count(*) from submission_rows where submission_status = 'active'
      ),
      'legacySeedReviews', (
        select count(*) from submission_rows
        where expected_source_type = 'legacy_seed' and submission_status = 'review'
      ),
      'authorities', (select count(*) from public.game_data_domain_authority)
    ),
    'historicalIntegrity', private.build_classification_backfill_report()
      -> 'historicalIntegrity',
    'games', coalesce((
      select jsonb_agg(jsonb_build_object(
        'gameId', row.game_id,
        'competitionId', row.competition_id,
        'gameNumber', row.game_number,
        'gameStatus', row.game_status,
        'legacySource', row.legacy_source,
        'submissionId', row.submission_id,
        'submissionSource', row.expected_source_type,
        'submissionRole', row.role,
        'submissionStatus', row.submission_status,
        'payloadHash', row.payload_hash,
        'parserVersion', row.parser_version,
        'storageBound', row.storage_object_id is not null,
        'finalScore', jsonb_build_object(
          'home', (
            select sum(score.points)
            from public.game_participants participant
            join public.game_period_scores score
              on score.game_id = participant.game_id
             and score.registration_id = participant.registration_id
            where participant.game_id = row.game_id and participant.side = 'home'
          ),
          'away', (
            select sum(score.points)
            from public.game_participants participant
            join public.game_period_scores score
              on score.game_id = participant.game_id
             and score.registration_id = participant.registration_id
            where participant.game_id = row.game_id and participant.side = 'away'
          )
        ),
        'teamPoints', (
          select sum(score.points)
          from public.game_period_scores score
          where score.game_id = row.game_id
        ),
        'playerPoints', (
          select sum(stat.points)
          from public.player_period_stats stat
          where stat.game_id = row.game_id
        ),
        'fouls', case when exists (
          select 1 from public.game_roster_slots slot
          where slot.game_id = row.game_id
        ) then (
          select count(*) from public.foul_events foul
          where foul.game_id = row.game_id
        ) else null end,
        'disqualifications', case when exists (
          select 1 from public.game_roster_slots slot
          where slot.game_id = row.game_id
        ) then (
          select count(*) from public.game_roster_slots slot
          where slot.game_id = row.game_id
            and slot.disqualified_at_period is not null
        ) else null end,
        'authorityDomains', coalesce((
          select jsonb_agg(authority.domain order by authority.domain)
          from public.game_data_domain_authority authority
          where authority.game_id = row.game_id
            and authority.submission_id = row.submission_id
        ), '[]'::jsonb),
        'expectedAuthorityDomains', coalesce((
          select jsonb_agg(capability.domain order by capability.domain)
          from public.game_data_source_capabilities capability
          where capability.source_type = row.expected_source_type
            and capability.required_when_primary
        ), '[]'::jsonb),
        'missingAuthorityDomains', coalesce((
          select jsonb_agg(capability.domain order by capability.domain)
          from public.game_data_source_capabilities capability
          where capability.source_type = row.expected_source_type
            and capability.required_when_primary
            and not exists (
              select 1
              from public.game_data_domain_authority authority
              where authority.game_id = row.game_id
                and authority.domain = capability.domain
                and authority.submission_id = row.submission_id
            )
        ), '[]'::jsonb),
        'historicalReviewOnly',
          row.expected_source_type = 'legacy_seed'
          and row.submission_status = 'review'
      ) order by row.game_id)
      from submission_rows row
    ), '[]'::jsonb),
    'ready',
      not exists (select 1 from submission_rows where submission_id is null)
      and not exists (
        select 1
        from submission_rows row
        join public.game_data_source_capabilities capability
          on capability.source_type = row.expected_source_type
         and capability.required_when_primary
        where row.submission_status = 'active'
          and not exists (
            select 1
            from public.game_data_domain_authority authority
            where authority.game_id = row.game_id
              and authority.domain = capability.domain
              and authority.submission_id = row.submission_id
          )
      )
      and not exists (
        select 1
        from submission_rows row
        where row.expected_source_type = 'legacy_seed'
          and row.submission_status <> 'review'
      )
  );
$$;

revoke all on function private.build_game_data_backfill_report()
from public, anon, authenticated;

create function public.admin_get_game_data_backfill_report()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  return private.build_game_data_backfill_report();
end;
$$;

revoke all on function public.admin_get_game_data_backfill_report()
from public, anon, authenticated;
grant execute on function public.admin_get_game_data_backfill_report()
to authenticated;

comment on function private.game_data_snapshot_hash(bigint) is
  'Deterministic hash of existing sports facts used only for historical seed envelopes.';
comment on function private.backfill_game_data_submissions() is
  'Idempotently encapsulates legacy manual, FIBA and seed games without rewriting sports facts.';
comment on function public.admin_get_game_data_backfill_report() is
  'AAL2-only reconciliation of origins, hashes, scores, points, fouls and domain coverage.';
