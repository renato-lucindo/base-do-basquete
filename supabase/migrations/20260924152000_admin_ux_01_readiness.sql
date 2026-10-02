create function public.admin_confirm_team_registrations(
  p_competition_id bigint,
  p_registration_ids bigint[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  registration_id bigint;
  requested_count integer;
  confirmed_ids bigint[] := '{}'::bigint[];
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  if p_competition_id is null
    or p_registration_ids is null
    or cardinality(p_registration_ids) = 0
    or cardinality(p_registration_ids) > 16
    or exists(select 1 from unnest(p_registration_ids) item where item is null)
  then
    raise exception using errcode = 'BD102', message = 'BDB_INVALID_REGISTRATION_TRANSITION';
  end if;

  select count(*) into requested_count
  from (select distinct item from unnest(p_registration_ids) item) requested;

  if requested_count <> cardinality(p_registration_ids) then
    raise exception using errcode = 'BD102', message = 'BDB_INVALID_REGISTRATION_TRANSITION';
  end if;

  perform 1
  from public.competitions
  where id = p_competition_id;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_COMPETITION_NOT_FOUND';
  end if;

  -- Lock the complete request in a deterministic order before mutating any row.
  perform registration.id
  from public.team_registrations registration
  where registration.competition_id = p_competition_id
    and registration.id = any(p_registration_ids)
  order by registration.id
  for update;

  if (
    select count(*)
    from public.team_registrations registration
    where registration.competition_id = p_competition_id
      and registration.id = any(p_registration_ids)
      and registration.status in ('draft', 'confirmed')
  ) <> requested_count then
    raise exception using errcode = 'BD102', message = 'BDB_INVALID_REGISTRATION_TRANSITION';
  end if;

  foreach registration_id in array (
    select array_agg(item order by item)
    from unnest(p_registration_ids) item
  )
  loop
    perform public.admin_transition_team_registration(registration_id, 'confirmed');
    confirmed_ids := array_append(confirmed_ids, registration_id);
  end loop;

  return jsonb_build_object(
    'confirmedCount', cardinality(confirmed_ids),
    'registrationIds', to_jsonb(confirmed_ids)
  );
end;
$$;

revoke all on function public.admin_confirm_team_registrations(bigint, bigint[])
  from public, anon, authenticated;
grant execute on function public.admin_confirm_team_registrations(bigint, bigint[])
  to authenticated;

create or replace function public.admin_get_competition_schedule(p_competition_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  active_revision_id bigint;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode='BD401',message='BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if not exists(select 1 from public.competitions where id=p_competition_id) then
    raise exception using errcode='BD404',message='BDB_COMPETITION_NOT_FOUND';
  end if;

  select revision.id into active_revision_id
  from public.competition_ruleset_revisions revision
  where revision.competition_id = p_competition_id
    and revision.status = 'active';

  return jsonb_build_object(
    'entries',coalesce((select jsonb_agg(jsonb_build_object(
      'id',entry.id,
      'seed',entry.seed,
      'registrationId',assignment.registration_id,
      'label',coalesce(entry_context.label, 'Posição ' || entry.seed::text)
    ) order by entry.seed)
      from public.competition_entries entry
      left join public.competition_entry_assignments assignment on assignment.entry_id=entry.id
      left join lateral (
        select stage_item.name || ' · ' || round_item.name || ' · posição ' || entry.seed::text as label
        from public.competition_slots slot_item
        join public.competition_rounds round_item on round_item.id=slot_item.round_id
        join public.competition_stages stage_item on stage_item.id=round_item.stage_id
        where slot_item.entry_id=entry.id
        order by stage_item.stage_order,round_item.round_order,slot_item.id
        limit 1
      ) entry_context on true
      where entry.competition_id=p_competition_id
        and entry.ruleset_revision_id=active_revision_id),'[]'::jsonb),
    'matchups',coalesce((select jsonb_agg(jsonb_build_object(
      'id',matchup.id,
      'code',matchup.code,
      'round',round_item.name,
      'order',matchup.matchup_order,
      'label',stage_item.name || ' · ' || round_item.name || ' · confronto ' || matchup.matchup_order::text,
      'homeRegistrationId',matchup.home_registration_id,
      'awayRegistrationId',matchup.away_registration_id,
      'revision',coalesce(preparation.revision,0),
      'scheduledAt',preparation.scheduled_at,
      'venue',preparation.venue,
      'gameId',preparation.game_id,
      'officialResultSubmissionId',official.submission_id,
      'readyToSchedule',(matchup.home_registration_id is not null and matchup.away_registration_id is not null and preparation.game_id is null),
      'readyToResolve',(game.status='final' and official.submission_id is not null and resolution.matchup_id is null),
      'resolution',case when resolution.matchup_id is null then null else jsonb_build_object(
        'winnerRegistrationId',resolution.winner_registration_id,
        'loserRegistrationId',resolution.loser_registration_id,
        'homeScore',resolution.home_score,
        'awayScore',resolution.away_score,
        'resolvedAt',resolution.resolved_at
      ) end
    ) order by stage_item.stage_order,round_item.round_order,matchup.matchup_order)
    from public.matchups matchup
    join public.competition_rounds round_item on round_item.id=matchup.round_id
    join public.competition_stages stage_item on stage_item.id=round_item.stage_id
    left join public.matchup_preparations preparation on preparation.matchup_id=matchup.id
    left join public.games game on game.id=preparation.game_id
    left join lateral(
      select authority.submission_id
      from public.game_data_domain_authority authority
      join public.game_data_submissions submission on submission.id=authority.submission_id
      where authority.game_id=game.id and authority.domain='official_result'
        and submission.status='active' and submission.role='primary'
    ) official on true
    left join public.matchup_resolutions resolution on resolution.matchup_id=matchup.id
    where matchup.competition_id=p_competition_id
      and matchup.ruleset_revision_id=active_revision_id), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_get_competition_schedule(bigint)
  from public,anon,authenticated;
grant execute on function public.admin_get_competition_schedule(bigint)
  to authenticated;
