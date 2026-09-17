-- POST-04: explicit private eligibility review in one transactional batch.
--
-- Every value still comes from a human choice. The function accepts no
-- defaults, applies the existing single-player policy for every item and
-- returns only aggregate progress. Private values are never copied to audit
-- metadata or returned to the caller.
create function public.admin_bulk_set_player_sex(
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
     or review.value ->> 'sex' not in ('male', 'female');

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
  where player.id is null;

  if missing_count > 0 then
    raise exception using errcode = 'BD404', message = 'BDB_PLAYER_NOT_FOUND';
  end if;

  -- A deterministic lock order prevents two administrative batches from
  -- deadlocking if the singleton restriction is relaxed in a future season.
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

revoke all on function public.admin_bulk_set_player_sex(jsonb, text)
  from public, anon, authenticated;
grant execute on function public.admin_bulk_set_player_sex(jsonb, text)
  to authenticated;

comment on function public.admin_bulk_set_player_sex(jsonb, text) is
  'AAL2-only atomic batch of explicit private eligibility choices with value-free audit metadata.';
