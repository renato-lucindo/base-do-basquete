-- Issue #84: acquire all category locks before processing any batch dispute.
-- The existing private workflow remains authoritative for input validation,
-- AAL2, profile CAS, idempotency, ledger, and audits.
create or replace function public.admin_create_competition_edition_batch(
  p_request_id uuid,
  p_input jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  category_key text;
begin
  -- Invalid inputs keep the original private workflow's domain errors.
  -- Avoid acquiring advisory locks for unauthorized requests.
  if public.is_current_admin_aal2()
    and p_request_id is not null
    and jsonb_typeof(p_input) = 'object'
    and jsonb_typeof(p_input -> 'disputes') = 'array'
  then
    if jsonb_array_length(p_input -> 'disputes') not between 1 and 12 then
      return private.create_edition_workflow_batch(p_request_id, p_input);
    end if;

    -- Preserve the outer ledger lock before any context lock. Replays keep
    -- their original validation/return path without locking categories again.
    perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 434));
    if exists (
      select 1 from private.edition_batch_creation_requests
      where request_id = p_request_id
    ) then
      return private.create_edition_workflow_batch(p_request_id, p_input);
    end if;

    -- Single-dispute creation takes the new championship lock before category
    -- locks. Keep that order so a batch cannot invert it with another writer.
    if p_input ->> 'seriesId' is null
      and jsonb_typeof(p_input -> 'championshipName') = 'string'
    then
      perform pg_advisory_xact_lock(hashtextextended(
        private.slugify_team_name(btrim(p_input ->> 'championshipName')), 432
      ));
    end if;
    -- private.create_edition_workflow uses namespace 433 with exactly
    -- "kind:age" as its category key. Acquire each unique key in the
    -- same order across requests, regardless of their dispute array order.
    for category_key in
      select distinct
        (item ->> 'categoryKind') || ':' ||
        coalesce(item ->> 'categoryAge', '') as lock_key
      from jsonb_array_elements(p_input -> 'disputes') item
      where jsonb_typeof(item) = 'object'
        and item ->> 'categoryKind' in ('adult', 'base', 'master')
        and (
          item ->> 'categoryAge' is null
          or (
            jsonb_typeof(item -> 'categoryAge') = 'number'
            and item ->> 'categoryAge' ~ '^[0-9]{1,9}$'
          )
        )
      order by lock_key
    loop
      perform pg_advisory_xact_lock(hashtextextended(category_key, 433));
    end loop;
  end if;

  return private.create_edition_workflow_batch(p_request_id, p_input);
end;
$$;

revoke all on function public.admin_create_competition_edition_batch(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_create_competition_edition_batch(uuid, jsonb)
  to authenticated;
