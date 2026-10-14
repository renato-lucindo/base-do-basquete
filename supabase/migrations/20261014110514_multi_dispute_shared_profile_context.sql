-- Reconcile only profile expectations changed by this transaction's own batch.
-- Preserve the original input in the outer ledger and all AAL2/stale-profile guards.

create or replace function private.create_edition_workflow_batch(
  p_request_id uuid,
  p_input jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous private.edition_batch_creation_requests;
  disputes jsonb;
  dispute jsonb;
  first_input jsonb;
  add_input jsonb;
  first_result jsonb;
  add_result jsonb;
  batch_result jsonb;
  competition_ids jsonb := '[]'::jsonb;
  v_season_id bigint;
  reused_division_id bigint;
  existing_division_type_id bigint;
  existing_division_type_name text;
  navigation_order text;
  dispute_count integer;
  profile_contexts jsonb := '{}'::jsonb;
  profile_key text;
  prior_profile_context jsonb;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  if p_request_id is null
    or p_input is null
    or jsonb_typeof(p_input) <> 'object'
    or p_input -> 'reviewed' is distinct from 'true'::jsonb
    or not (p_input ?& array[
      'seriesId','championshipName','seasonId','year','description',
      'navigationOrder','disputes','reviewed'
    ])
    or exists (
      select 1
      from jsonb_object_keys(p_input) key
      where key not in (
        'seriesId','championshipName','seasonId','year','description',
        'navigationOrder','disputes','reviewed'
      )
    )
  then
    raise exception using errcode = 'BD501', message = 'BDB_EDITION_BATCH_INPUT_INVALID';
  end if;

  if p_input -> 'seasonId' is distinct from 'null'::jsonb then
    raise exception using errcode = 'BD501', message = 'BDB_EDITION_BATCH_INPUT_INVALID';
  end if;

  navigation_order := p_input ->> 'navigationOrder';
  disputes := p_input -> 'disputes';
  if navigation_order is null
    or navigation_order not in ('category_division', 'division_category')
    or disputes is null
    or jsonb_typeof(disputes) <> 'array'
  then
    raise exception using errcode = 'BD501', message = 'BDB_EDITION_BATCH_INPUT_INVALID';
  end if;

  dispute_count := jsonb_array_length(disputes);
  if dispute_count not between 1 and 12
    or exists (
      select 1
      from jsonb_array_elements(disputes) item
      where jsonb_typeof(item) <> 'object'
        or item ->> 'divisionMode' = 'existing'
        or exists (
          select 1
          from jsonb_object_keys(item) key
          where key not in (
            'categoryKind','categoryAge','gender','startsOn','endsOn',
            'divisionMode','divisionValueId','divisionTypeName','divisionValueName',
            'source','preset','entryCount','expectedProfileId','reason'
          )
        )
    )
  then
    raise exception using errcode = 'BD501', message = 'BDB_EDITION_BATCH_INPUT_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 434));
  select request.* into previous
  from private.edition_batch_creation_requests request
  where request.request_id = p_request_id;

  if found then
    if previous.actor_id <> auth.uid() or previous.input is distinct from p_input then
      raise exception using errcode = 'BD409', message = 'BDB_IDEMPOTENCY_CONFLICT';
    end if;
    return previous.result;
  end if;

  dispute := disputes -> 0;
  first_input := (p_input - 'navigationOrder' - 'disputes')
    || dispute
    || jsonb_build_object('seasonId', null, 'reviewed', true);
  first_result := private.create_edition_workflow(gen_random_uuid(), first_input, false);
  v_season_id := (first_result ->> 'seasonId')::bigint;
  competition_ids := competition_ids || jsonb_build_array((first_result -> 'competitionId'));
  profile_key := jsonb_build_array(dispute -> 'categoryKind', dispute -> 'categoryAge', dispute -> 'gender')::text;
  profile_contexts := jsonb_build_object(profile_key, jsonb_build_object(
    'initialExpected', dispute -> 'expectedProfileId',
    'currentId', (select competition.data_profile_id from public.competitions competition
      where competition.id = (first_result ->> 'competitionId')::bigint)
  ));

  update public.competition_seasons target
  set dispute_navigation_order = navigation_order
  where target.id = v_season_id;

  insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
  values (
    'competition_season_navigation_configured',
    'competition_season',
    v_season_id,
    jsonb_build_object('disputeNavigationOrder', navigation_order)
  );

  for dispute in
    select value
    from jsonb_array_elements(disputes) with ordinality items(value, ordinal)
    where ordinal > 1
    order by ordinal
  loop
    if dispute ->> 'divisionMode' = 'new' then
      reused_division_id := null;
      existing_division_type_id := null;
      existing_division_type_name := null;

      select division_type.id, division_type.name
      into existing_division_type_id, existing_division_type_name
      from public.competition_competitive_division_types division_type
      where division_type.season_id = v_season_id
        and division_type.slug = private.slugify_team_name(dispute ->> 'divisionTypeName')
      limit 1;

      if existing_division_type_name is not null then
        dispute := dispute || jsonb_build_object(
          'divisionTypeName', existing_division_type_name
        );

        select division_value.id into reused_division_id
        from public.competition_competitive_division_values division_value
        where division_value.season_id = v_season_id
          and division_value.competitive_division_type_id = existing_division_type_id
          and division_value.slug = private.slugify_team_name(dispute ->> 'divisionValueName')
        limit 1;

        if reused_division_id is not null then
          dispute := dispute || jsonb_build_object(
            'divisionMode', 'existing',
            'divisionValueId', reused_division_id,
            'divisionTypeName', null,
            'divisionValueName', null
          );
        end if;
      end if;
    end if;

    -- The first item for a profile context already passed the authoritative CAS
    -- and retains its transaction locks. Only the same original expectation
    -- may advance to a profile ID produced by an earlier item in this batch.
    -- A stale or divergent caller expectation is left untouched and rejected.
    profile_key := jsonb_build_array(dispute -> 'categoryKind', dispute -> 'categoryAge', dispute -> 'gender')::text;
    prior_profile_context := profile_contexts -> profile_key;
    if prior_profile_context is not null
      and dispute -> 'expectedProfileId' is not distinct from prior_profile_context -> 'initialExpected'
    then
      dispute := dispute || jsonb_build_object('expectedProfileId', prior_profile_context -> 'currentId');
    end if;

    add_input := jsonb_build_object(
      'seriesId', null,
      'championshipName', null,
      'seasonId', v_season_id,
      'year', p_input -> 'year',
      'description', p_input -> 'description',
      'reviewed', true
    ) || dispute;
    add_result := private.create_edition_workflow(gen_random_uuid(), add_input, true);
    competition_ids := competition_ids || jsonb_build_array((add_result -> 'competitionId'));
    profile_contexts := profile_contexts || jsonb_build_object(profile_key, jsonb_build_object(
      'initialExpected', coalesce(prior_profile_context -> 'initialExpected', dispute -> 'expectedProfileId'),
      'currentId', (select competition.data_profile_id from public.competitions competition
        where competition.id = (add_result ->> 'competitionId')::bigint)
    ));
  end loop;

  batch_result := jsonb_build_object(
    'seasonId', v_season_id,
    'competitionId', competition_ids -> 0,
    'competitionIds', competition_ids
  );

  insert into private.edition_batch_creation_requests(request_id, actor_id, input, result)
  values (p_request_id, auth.uid(), p_input, batch_result);

  return batch_result;
end;
$$;

revoke all on function private.create_edition_workflow_batch(uuid,jsonb)
  from public, anon, authenticated;
