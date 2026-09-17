-- POST-04: contextual player review queue plus optimistic concurrency.
--
-- The queue still never exposes the private eligibility value. Team and
-- competition associations are public operational context. reviewRevision is
-- an opaque version used only to reject stale administrative batches.
create function public.admin_get_player_review_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  with pending_players as (
    select
      player.id as player_id,
      player.full_name,
      player.is_active,
      floor(extract(epoch from private_data.updated_at) * 1000000)::bigint
        as review_revision,
      count(roster.id)::bigint as roster_entry_count,
      count(roster.id) filter (where roster.status = 'active')::bigint
        as active_roster_entry_count,
      count(distinct roster.competition_id)::bigint as competition_count
    from public.players player
    join private.player_private private_data on private_data.player_id = player.id
    left join public.roster_entries roster on roster.player_id = player.id
    where private_data.sex_review_required
    group by
      player.id,
      player.full_name,
      player.is_active,
      private_data.updated_at
  ),
  player_context as (
    select
      pending.player_id,
      pending.full_name,
      pending.is_active,
      pending.review_revision,
      pending.roster_entry_count,
      pending.active_roster_entry_count,
      pending.competition_count,
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object('teamId', team.team_id, 'name', team.name)
            order by team.name, team.team_id
          )
          from (
            select distinct registered_team.id as team_id, registered_team.name
            from public.roster_entries roster
            join public.team_registrations registration
              on registration.id = roster.registration_id
             and registration.competition_id = roster.competition_id
            join public.teams registered_team on registered_team.id = registration.team_id
            where roster.player_id = pending.player_id
          ) team
        ),
        '[]'::jsonb
      ) as teams,
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'competitionId', competition.competition_id,
              'displayName', competition.display_name,
              'year', competition.year
            )
            order by competition.year desc, competition.display_name, competition.competition_id
          )
          from (
            select distinct
              edition.id as competition_id,
              edition.display_name,
              edition.year
            from public.roster_entries roster
            join public.competitions edition on edition.id = roster.competition_id
            where roster.player_id = pending.player_id
          ) competition
        ),
        '[]'::jsonb
      ) as competitions
    from pending_players pending
  )
  select jsonb_build_object(
    'queueVersion', 1,
    'players', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'playerId', context.player_id,
          'fullName', context.full_name,
          'isActive', context.is_active,
          'reviewRevision', context.review_revision,
          'rosterEntryCount', context.roster_entry_count,
          'activeRosterEntryCount', context.active_roster_entry_count,
          'competitionCount', context.competition_count,
          'teams', context.teams,
          'competitions', context.competitions
        ) order by context.full_name, context.player_id
      ),
      '[]'::jsonb
    )
  )
  into result
  from player_context context;

  return result;
end;
$$;

create or replace function public.admin_bulk_set_player_sex(
  p_reviews jsonb,
  p_reason text
)
returns table (
  reviewed_count integer,
  remaining_pending bigint,
  enforcement_ready boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_reason text := btrim(coalesce(p_reason, ''));
  item record;
  item_count integer;
  invalid_count bigint;
  duplicate_count bigint;
  missing_count bigint;
  stale_count bigint;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  if jsonb_typeof(p_reviews) is distinct from 'array' then
    raise exception using errcode = 'BD501', message = 'BDB_PLAYER_REVIEW_BATCH_INVALID';
  end if;

  item_count := jsonb_array_length(p_reviews);
  if item_count not between 1 and 100 then
    raise exception using errcode = 'BD501', message = 'BDB_PLAYER_REVIEW_BATCH_SIZE_INVALID';
  end if;
  if char_length(clean_reason) not between 10 and 500 then
    raise exception using errcode = 'BD501', message = 'BDB_PLAYER_SEX_REASON_REQUIRED';
  end if;

  select count(*)
  into invalid_count
  from jsonb_array_elements(p_reviews) review(value)
  where jsonb_typeof(review.value) is distinct from 'object'
     or jsonb_typeof(review.value -> 'playerId') is distinct from 'number'
     or coalesce(review.value ->> 'playerId', '') !~ '^[1-9][0-9]{0,17}$'
     or jsonb_typeof(review.value -> 'sex') is distinct from 'string'
     or review.value ->> 'sex' not in ('male', 'female')
     or jsonb_typeof(review.value -> 'expectedRevision') is distinct from 'number'
     or coalesce(review.value ->> 'expectedRevision', '') !~ '^[1-9][0-9]{0,17}$';

  if invalid_count > 0 then
    raise exception using errcode = 'BD501', message = 'BDB_PLAYER_REVIEW_BATCH_INVALID';
  end if;

  select count(*)
  into duplicate_count
  from (
    select (review.value ->> 'playerId')::bigint
    from jsonb_array_elements(p_reviews) review(value)
    group by (review.value ->> 'playerId')::bigint
    having count(*) > 1
  ) duplicate;

  if duplicate_count > 0 then
    raise exception using errcode = 'BD501', message = 'BDB_PLAYER_REVIEW_BATCH_DUPLICATE';
  end if;

  select count(*)
  into missing_count
  from jsonb_array_elements(p_reviews) review(value)
  left join public.players player
    on player.id = (review.value ->> 'playerId')::bigint
  left join private.player_private private_data
    on private_data.player_id = player.id
  where player.id is null or private_data.player_id is null;

  if missing_count > 0 then
    raise exception using errcode = 'BD404', message = 'BDB_PLAYER_NOT_FOUND';
  end if;

  -- Lock every requested row before checking any revision. The stable order
  -- prevents deadlocks and makes the stale check plus updates one transaction.
  perform private_data.player_id
  from private.player_private private_data
  join jsonb_array_elements(p_reviews) review(value)
    on private_data.player_id = (review.value ->> 'playerId')::bigint
  order by private_data.player_id
  for update of private_data;

  select count(*)
  into stale_count
  from jsonb_array_elements(p_reviews) review(value)
  join private.player_private private_data
    on private_data.player_id = (review.value ->> 'playerId')::bigint
  where not private_data.sex_review_required
     or floor(extract(epoch from private_data.updated_at) * 1000000)::bigint
        <> (review.value ->> 'expectedRevision')::bigint;

  if stale_count > 0 then
    raise exception using errcode = 'BD409', message = 'BDB_PLAYER_REVIEW_STALE';
  end if;

  for item in
    select
      (review.value ->> 'playerId')::bigint as player_id,
      review.value ->> 'sex' as sex
    from jsonb_array_elements(p_reviews) review(value)
    order by (review.value ->> 'playerId')::bigint
  loop
    perform *
    from public.admin_set_player_sex(item.player_id, item.sex, clean_reason);
  end loop;

  return query
  select
    item_count,
    (
      select count(*)
      from private.player_private private_data
      where private_data.sex is null
         or private_data.sex_review_required
    ),
    (private.build_classification_backfill_report() ->> 'enforcementReady')::boolean;
end;
$$;

revoke all on function public.admin_get_player_review_queue()
  from public, anon, authenticated;
grant execute on function public.admin_get_player_review_queue()
  to authenticated;

revoke all on function public.admin_bulk_set_player_sex(jsonb, text)
  from public, anon, authenticated;
grant execute on function public.admin_bulk_set_player_sex(jsonb, text)
  to authenticated;

comment on function public.admin_get_player_review_queue() is
  'AAL2-only value-free player review queue with public team/competition context and opaque revisions.';
comment on function public.admin_bulk_set_player_sex(jsonb, text) is
  'AAL2-only atomic batch with value-free audit metadata and stale-write rejection.';
