-- ADMIN-UX-02 follow-up: manual games are operational records associated with
-- an active round. They do not mutate the automatic seed/winner graph.

alter table public.admin_mutation_audit
  drop constraint admin_mutation_audit_action_check,
  add constraint admin_mutation_audit_action_check check (action in (
    'registration_created','registration_transitioned','roster_replaced','manual_scoresheet_saved',
    'boxscore_import_confirmed','boxscore_team_stats_refreshed','final_placement_confirmed','player_created',
    'competition_gender_reviewed','data_profile_created','data_profile_activated',
    'competition_data_profile_assigned','player_sex_reviewed','game_data_authority_activated',
    'competition_created_from_preset','competition_entry_assigned','matchup_prepared','matchup_resolved',
    'competition_published','manual_fallback_confirmed','boxscore_supplement_confirmed',
    'manual_fallback_finalized','game_data_comparison_created','game_data_conflict_resolved',
    'fiba_candidate_staged','registration_removed','registration_withdrawn','ruleset_cloned',
    'ruleset_draft_edited','competition_group_closed','matchup_administratively_resolved',
    'ruleset_amended','manual_matchup_created','manual_matchup_participants_updated'
  ));

create table private.manual_matchup_requests (
  request_id uuid primary key,
  actor_id uuid not null references auth.users(id) on delete restrict,
  competition_id bigint not null references public.competitions(id) on delete restrict,
  round_id bigint not null,
  home_registration_id bigint not null,
  away_registration_id bigint not null,
  scheduled_at timestamptz,
  venue text,
  matchup_id bigint references public.matchups(id) on delete restrict,
  game_id bigint references public.games(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint manual_matchup_request_distinct_teams check (
    home_registration_id <> away_registration_id
  ),
  constraint manual_matchup_request_venue check (
    venue is null or (venue = btrim(venue) and char_length(venue) between 1 and 160)
  ),
  constraint manual_matchup_request_result_pair check (
    (matchup_id is null) = (game_id is null)
  )
);
create index manual_matchup_requests_actor_idx
  on private.manual_matchup_requests(actor_id, created_at desc);
create index manual_matchup_requests_competition_idx
  on private.manual_matchup_requests(competition_id, created_at desc);
alter table private.manual_matchup_requests enable row level security;
alter table private.manual_matchup_requests force row level security;
revoke all on private.manual_matchup_requests from public, anon, authenticated;

-- Scheduling is valid for any active ruleset. A preset is an optional way to
-- create the graph, not a prerequisite for a game to exist.
create or replace function public.admin_prepare_matchup(
  p_matchup_id bigint,
  p_expected_revision integer,
  p_scheduled_at timestamptz,
  p_venue text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  matchup_row public.matchups;
  competition public.competitions;
  preparation public.matchup_preparations;
  normalized_venue text := nullif(btrim(p_venue), '');
  target_game bigint;
  participants_ready boolean;
  manual_matchup boolean;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode='BD401',message='BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if p_expected_revision is null or p_expected_revision < 0
    or char_length(normalized_venue) > 160
    or (p_scheduled_at is not null and not isfinite(p_scheduled_at)) then
    raise exception using errcode='BR025',message='BDB_SCHEDULE_INPUT_INVALID';
  end if;

  select * into matchup_row from public.matchups where id = p_matchup_id;
  if not found then
    raise exception using errcode='BD404',message='BDB_MATCHUP_NOT_FOUND';
  end if;
  manual_matchup := matchup_row.ruleset_revision_id is null
    and matchup_row.structure_kind = 'regulated'
    and matchup_row.legacy_game_id is null
    and matchup_row.home_slot_id is null
    and matchup_row.away_slot_id is null;

  select * into competition from public.competitions
  where id = matchup_row.competition_id for update;
  if competition.status = 'archived' then
    raise exception using errcode='BR032',message='BDB_ACTIVE_COMPETITION_REQUIRED';
  end if;

  if manual_matchup then
    perform 1
    from public.competition_rounds round_item
    join public.competition_ruleset_revisions revision
      on revision.id = round_item.ruleset_revision_id
     and revision.competition_id = round_item.competition_id
    where round_item.id = matchup_row.round_id
      and round_item.competition_id = matchup_row.competition_id
      and revision.status = 'active'
    for update of revision;
  else
    perform 1 from public.competition_ruleset_revisions
    where id = matchup_row.ruleset_revision_id and status = 'active'
    for update;
  end if;
  if not found then
    raise exception using errcode='BR022',message='BDB_ACTIVE_RULESET_REQUIRED';
  end if;

  select * into matchup_row from public.matchups where id = p_matchup_id for update;
  if p_scheduled_at is not null and (
    (p_scheduled_at at time zone 'America/Sao_Paulo')::date < competition.starts_on
    or (p_scheduled_at at time zone 'America/Sao_Paulo')::date > competition.ends_on
  ) then
    raise exception using errcode='BR025',message='BDB_SCHEDULE_INPUT_INVALID';
  end if;

  select * into preparation from public.matchup_preparations
  where matchup_id = matchup_row.id for update;
  participants_ready := matchup_row.home_registration_id is not null
    and matchup_row.away_registration_id is not null;
  if participants_ready and exists(
    select 1 from public.team_registrations
    where id in (matchup_row.home_registration_id, matchup_row.away_registration_id)
      and status <> 'confirmed'
  ) then
    raise exception using errcode='BR023',message='BDB_CONFIRMED_REGISTRATION_REQUIRED';
  end if;
  if preparation.matchup_id is not null
    and preparation.scheduled_at is not distinct from p_scheduled_at
    and preparation.venue is not distinct from normalized_venue
    and (preparation.game_id is not null or not participants_ready)
  then
    return preparation.game_id;
  end if;
  if coalesce(preparation.revision, 0) <> p_expected_revision then
    raise exception using errcode='BR026',message='BDB_SCHEDULE_CHANGED_RELOAD';
  end if;

  target_game := preparation.game_id;
  if target_game is not null then
    perform 1 from public.games
    where id = target_game and status in ('draft','scheduled') and started_at is null
    for update;
    if not found or exists(
      select 1 from public.game_data_submissions where game_id = target_game
    ) then
      raise exception using errcode='BR027',message='BDB_STARTED_GAME_SCHEDULE_IMMUTABLE';
    end if;
    update public.games
    set scheduled_at = p_scheduled_at,
        venue = normalized_venue,
        status = case when p_scheduled_at is null then 'draft' else 'scheduled' end
    where id = target_game;
  elsif participants_ready then
    insert into public.games(
      competition_id, matchup_id, matchup_game_number, scheduled_at, venue,
      status, created_by, source
    ) values(
      matchup_row.competition_id, matchup_row.id, 1, p_scheduled_at, normalized_venue,
      case when p_scheduled_at is null then 'draft' else 'scheduled' end,
      auth.uid(), 'structural'
    ) returning id into target_game;
    insert into public.game_participants(game_id, competition_id, registration_id, side)
    values
      (target_game, matchup_row.competition_id, matchup_row.home_registration_id, 'home'),
      (target_game, matchup_row.competition_id, matchup_row.away_registration_id, 'away');
  end if;

  insert into public.matchup_preparations(
    matchup_id, competition_id, scheduled_at, venue, game_id, updated_by
  ) values(
    matchup_row.id, matchup_row.competition_id, p_scheduled_at,
    normalized_venue, target_game, auth.uid()
  ) on conflict(matchup_id) do update set
    scheduled_at = excluded.scheduled_at,
    venue = excluded.venue,
    game_id = excluded.game_id,
    revision = public.matchup_preparations.revision + 1,
    updated_by = auth.uid(),
    updated_at = clock_timestamp();
  insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
  values('matchup_prepared','matchup',matchup_row.id,jsonb_build_object(
    'competitionId',matchup_row.competition_id,
    'gameId',target_game,
    'revision',coalesce(preparation.revision,0)+1
  ));
  return target_game;
end;
$$;
revoke all on function public.admin_prepare_matchup(bigint,integer,timestamptz,text)
  from public, anon, authenticated;
grant execute on function public.admin_prepare_matchup(bigint,integer,timestamptz,text)
  to authenticated;

create function public.admin_create_manual_matchup(
  p_request_id uuid,
  p_competition_id bigint,
  p_round_id bigint,
  p_home_registration_id bigint,
  p_away_registration_id bigint,
  p_scheduled_at timestamptz,
  p_venue text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  competition public.competitions;
  existing private.manual_matchup_requests;
  normalized_venue text := nullif(btrim(p_venue), '');
  active_revision_id bigint;
  next_order integer;
  created_matchup_id bigint;
  created_game_id bigint;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode='BD401',message='BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if p_request_id is null or p_competition_id is null or p_round_id is null
    or p_home_registration_id is null or p_away_registration_id is null
    or p_home_registration_id = p_away_registration_id
    or char_length(normalized_venue) > 160
    or (p_scheduled_at is not null and not isfinite(p_scheduled_at)) then
    raise exception using errcode='BR025',message='BDB_SCHEDULE_INPUT_INVALID';
  end if;

  select * into existing from private.manual_matchup_requests
  where request_id = p_request_id for update;
  if found then
    if existing.actor_id <> auth.uid()
      or existing.competition_id <> p_competition_id
      or existing.round_id <> p_round_id
      or existing.home_registration_id <> p_home_registration_id
      or existing.away_registration_id <> p_away_registration_id
      or existing.scheduled_at is distinct from p_scheduled_at
      or existing.venue is distinct from normalized_venue then
      raise exception using errcode='BR098',message='BDB_MANUAL_MATCHUP_REQUEST_CONFLICT';
    end if;
    if existing.matchup_id is not null and existing.game_id is not null then
      return jsonb_build_object('matchupId',existing.matchup_id,'gameId',existing.game_id);
    end if;
  end if;

  select * into competition from public.competitions
  where id = p_competition_id for update;
  if not found then
    raise exception using errcode='BD404',message='BDB_COMPETITION_NOT_FOUND';
  end if;
  if competition.status = 'archived' then
    raise exception using errcode='BR032',message='BDB_ACTIVE_COMPETITION_REQUIRED';
  end if;
  if p_scheduled_at is not null and (
    (p_scheduled_at at time zone 'America/Sao_Paulo')::date < competition.starts_on
    or (p_scheduled_at at time zone 'America/Sao_Paulo')::date > competition.ends_on
  ) then
    raise exception using errcode='BR025',message='BDB_SCHEDULE_INPUT_INVALID';
  end if;

  select id into active_revision_id
  from public.competition_ruleset_revisions
  where competition_id = p_competition_id and status = 'active'
  for update;
  if active_revision_id is null then
    raise exception using errcode='BR022',message='BDB_ACTIVE_RULESET_REQUIRED';
  end if;
  perform 1 from public.competition_rounds
  where id = p_round_id
    and competition_id = p_competition_id
    and ruleset_revision_id = active_revision_id
  for update;
  if not found then
    raise exception using errcode='BD404',message='BDB_ROUND_NOT_FOUND';
  end if;
  if (
    select count(*) from public.team_registrations
    where competition_id = p_competition_id
      and id in (p_home_registration_id, p_away_registration_id)
      and status = 'confirmed'
  ) <> 2 then
    raise exception using errcode='BR023',message='BDB_CONFIRMED_REGISTRATION_REQUIRED';
  end if;

  insert into private.manual_matchup_requests(
    request_id, actor_id, competition_id, round_id,
    home_registration_id, away_registration_id, scheduled_at, venue
  ) values(
    p_request_id, auth.uid(), p_competition_id, p_round_id,
    p_home_registration_id, p_away_registration_id, p_scheduled_at, normalized_venue
  ) on conflict(request_id) do nothing;
  select * into existing from private.manual_matchup_requests
  where request_id = p_request_id for update;
  if existing.actor_id <> auth.uid()
    or existing.competition_id <> p_competition_id
    or existing.round_id <> p_round_id
    or existing.home_registration_id <> p_home_registration_id
    or existing.away_registration_id <> p_away_registration_id
    or existing.scheduled_at is distinct from p_scheduled_at
    or existing.venue is distinct from normalized_venue then
    raise exception using errcode='BR098',message='BDB_MANUAL_MATCHUP_REQUEST_CONFLICT';
  end if;
  if existing.matchup_id is not null and existing.game_id is not null then
    return jsonb_build_object('matchupId',existing.matchup_id,'gameId',existing.game_id);
  end if;

  select coalesce(max(matchup_order),0)+1 into next_order
  from public.matchups where round_id = p_round_id;
  insert into public.matchups(
    competition_id, round_id, home_registration_id, away_registration_id,
    matchup_order, structure_kind, allow_side_inversion
  ) values(
    p_competition_id, p_round_id, p_home_registration_id, p_away_registration_id,
    next_order, 'regulated', false
  ) returning id into created_matchup_id;

  created_game_id := public.admin_prepare_matchup(
    created_matchup_id, 0, p_scheduled_at, normalized_venue
  );
  if created_game_id is null then
    raise exception using errcode='BR097',message='BDB_MANUAL_MATCHUP_GAME_REQUIRED';
  end if;

  update private.manual_matchup_requests
  set matchup_id = created_matchup_id,
      game_id = created_game_id
  where request_id = p_request_id;
  insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
  values('manual_matchup_created','matchup',created_matchup_id,jsonb_build_object(
    'competitionId',p_competition_id,
    'roundId',p_round_id,
    'gameId',created_game_id,
    'homeRegistrationId',p_home_registration_id,
    'awayRegistrationId',p_away_registration_id
  ));
  return jsonb_build_object('matchupId',created_matchup_id,'gameId',created_game_id);
end;
$$;
revoke all on function public.admin_create_manual_matchup(
  uuid,bigint,bigint,bigint,bigint,timestamptz,text
) from public, anon, authenticated;
grant execute on function public.admin_create_manual_matchup(
  uuid,bigint,bigint,bigint,bigint,timestamptz,text
) to authenticated;

create function public.admin_update_manual_matchup_participants(
  p_matchup_id bigint,
  p_expected_home_registration_id bigint,
  p_expected_away_registration_id bigint,
  p_home_registration_id bigint,
  p_away_registration_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  matchup_row public.matchups;
  competition public.competitions;
  preparation public.matchup_preparations;
  game_row public.games;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode='BD401',message='BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if p_matchup_id is null or p_expected_home_registration_id is null
    or p_expected_away_registration_id is null or p_home_registration_id is null
    or p_away_registration_id is null or p_home_registration_id = p_away_registration_id then
    raise exception using errcode='BR025',message='BDB_SCHEDULE_INPUT_INVALID';
  end if;

  select * into matchup_row from public.matchups where id = p_matchup_id for update;
  if not found then
    raise exception using errcode='BD404',message='BDB_MATCHUP_NOT_FOUND';
  end if;
  if not (
    matchup_row.ruleset_revision_id is null
    and matchup_row.structure_kind = 'regulated'
    and matchup_row.legacy_game_id is null
    and matchup_row.home_slot_id is null
    and matchup_row.away_slot_id is null
  ) then
    raise exception using errcode='BR097',message='BDB_MANUAL_MATCHUP_REQUIRED';
  end if;

  select * into competition from public.competitions
  where id = matchup_row.competition_id for update;
  if competition.status = 'archived' then
    raise exception using errcode='BR032',message='BDB_ACTIVE_COMPETITION_REQUIRED';
  end if;
  if matchup_row.home_registration_id = p_home_registration_id
    and matchup_row.away_registration_id = p_away_registration_id then
    select * into preparation from public.matchup_preparations
    where matchup_id = matchup_row.id;
    return jsonb_build_object('matchupId',matchup_row.id,'gameId',preparation.game_id);
  end if;
  if matchup_row.home_registration_id is distinct from p_expected_home_registration_id
    or matchup_row.away_registration_id is distinct from p_expected_away_registration_id then
    raise exception using errcode='BR098',message='BDB_MANUAL_MATCHUP_CHANGED_RELOAD';
  end if;
  if (
    select count(*) from public.team_registrations
    where competition_id = matchup_row.competition_id
      and id in (p_home_registration_id, p_away_registration_id)
      and status = 'confirmed'
  ) <> 2 then
    raise exception using errcode='BR023',message='BDB_CONFIRMED_REGISTRATION_REQUIRED';
  end if;

  select * into preparation from public.matchup_preparations
  where matchup_id = matchup_row.id for update;
  if preparation.game_id is null then
    raise exception using errcode='BR097',message='BDB_MANUAL_MATCHUP_GAME_REQUIRED';
  end if;
  select * into game_row from public.games where id = preparation.game_id for update;
  if game_row.status not in ('draft','scheduled') or game_row.started_at is not null
    or exists(select 1 from private.competition_publication_games published where published.game_id=game_row.id)
    or exists(select 1 from public.game_data_submissions where game_id = game_row.id)
    or exists(select 1 from public.game_periods where game_id = game_row.id)
    or exists(select 1 from public.game_period_scores where game_id = game_row.id)
    or exists(select 1 from public.game_roster_slots where game_id = game_row.id)
    or exists(select 1 from public.game_team_statistics where game_id = game_row.id)
    or exists(select 1 from public.game_statistics where game_id = game_row.id)
    or exists(select 1 from public.matchup_resolutions where matchup_id = matchup_row.id)
    or exists(select 1 from public.matchup_administrative_resolutions where matchup_id = matchup_row.id)
    or exists(select 1 from public.matchup_revision_outcomes where matchup_id = matchup_row.id) then
    raise exception using errcode='BR099',message='BDB_MANUAL_MATCHUP_PARTICIPANTS_IMMUTABLE';
  end if;

  update public.matchups
  set home_registration_id = p_home_registration_id,
      away_registration_id = p_away_registration_id
  where id = matchup_row.id;
  delete from public.game_participants where game_id = game_row.id;
  insert into public.game_participants(game_id, competition_id, registration_id, side)
  values
    (game_row.id, matchup_row.competition_id, p_home_registration_id, 'home'),
    (game_row.id, matchup_row.competition_id, p_away_registration_id, 'away');
  insert into public.admin_mutation_audit(action, entity_type, entity_id, metadata)
  values('manual_matchup_participants_updated','matchup',matchup_row.id,jsonb_build_object(
    'competitionId',matchup_row.competition_id,
    'gameId',game_row.id,
    'fromHomeRegistrationId',p_expected_home_registration_id,
    'fromAwayRegistrationId',p_expected_away_registration_id,
    'toHomeRegistrationId',p_home_registration_id,
    'toAwayRegistrationId',p_away_registration_id
  ));
  return jsonb_build_object('matchupId',matchup_row.id,'gameId',game_row.id);
end;
$$;
revoke all on function public.admin_update_manual_matchup_participants(
  bigint,bigint,bigint,bigint,bigint
) from public, anon, authenticated;
grant execute on function public.admin_update_manual_matchup_participants(
  bigint,bigint,bigint,bigint,bigint
) to authenticated;

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
  where revision.competition_id = p_competition_id and revision.status = 'active';

  return jsonb_build_object(
    'rounds',coalesce((select jsonb_agg(jsonb_build_object(
      'id',round_item.id,
      'name',round_item.name,
      'stage',stage_item.name,
      'label',stage_item.name || ' · ' || round_item.name,
      'order',round_item.round_order
    ) order by stage_item.stage_order,round_item.round_order)
      from public.competition_rounds round_item
      join public.competition_stages stage_item on stage_item.id=round_item.stage_id
      where round_item.competition_id=p_competition_id
        and round_item.ruleset_revision_id=active_revision_id),'[]'::jsonb),
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
      'label',stage_item.name || ' · ' || round_item.name || ' · ' ||
        case when matchup.ruleset_revision_id is null then 'jogo manual ' else 'confronto ' end ||
        matchup.matchup_order::text,
      'manual',(matchup.ruleset_revision_id is null),
      'homeRegistrationId',matchup.home_registration_id,
      'awayRegistrationId',matchup.away_registration_id,
      'revision',coalesce(preparation.revision,0),
      'scheduledAt',preparation.scheduled_at,
      'venue',preparation.venue,
      'gameId',preparation.game_id,
      'gameStatus',game.status,
      'participantsEditable',(
        matchup.ruleset_revision_id is null
        and game.status in ('draft','scheduled')
        and game.started_at is null
        and not exists(select 1 from private.competition_publication_games published where published.game_id=game.id)
        and not exists(select 1 from public.game_data_submissions submission where submission.game_id=game.id)
        and not exists(select 1 from public.game_periods game_period where game_period.game_id=game.id)
        and not exists(select 1 from public.game_period_scores score where score.game_id=game.id)
        and not exists(select 1 from public.game_roster_slots roster_slot where roster_slot.game_id=game.id)
        and not exists(select 1 from public.game_team_statistics team_statistics where team_statistics.game_id=game.id)
        and not exists(select 1 from public.game_statistics statistics where statistics.game_id=game.id)
      ),
      'officialResultSubmissionId',official.submission_id,
      'readyToSchedule',(matchup.home_registration_id is not null and matchup.away_registration_id is not null and preparation.game_id is null),
      'readyToResolve',(
        matchup.ruleset_revision_id is not null
        and game.status='final'
        and official.submission_id is not null
        and resolution.matchup_id is null
      ),
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
      and (
        matchup.ruleset_revision_id=active_revision_id
        or (
          matchup.ruleset_revision_id is null
          and matchup.structure_kind='regulated'
          and matchup.legacy_game_id is null
          and round_item.ruleset_revision_id=active_revision_id
        )
      )), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.admin_get_competition_schedule(bigint)
  from public, anon, authenticated;
grant execute on function public.admin_get_competition_schedule(bigint)
  to authenticated;

-- Seed assignments remain available to automatic brackets, but are no longer
-- a publication prerequisite. Only games that actually exist are published.
create or replace function private.competition_publication_review(p_competition_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  competition public.competitions;
  data_profile public.series_category_data_profiles;
  snapshot jsonb;
  current_publication public.competition_publications;
  current_statistics public.competition_publication_statistics;
  blockers jsonb := '[]'::jsonb;
  confirmed_teams integer;
  eligible_games integer;
  invalid_games integer;
  snapshot_hash text;
  statistics_fingerprint text;
  statistics_changed boolean := false;
begin
  select * into competition from public.competitions where id = p_competition_id;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_COMPETITION_NOT_FOUND';
  end if;
  select * into data_profile from public.series_category_data_profiles
  where id = competition.data_profile_id;
  select * into current_publication from public.competition_publications
  where id = competition.current_publication_id;
  select * into current_statistics from public.competition_publication_statistics
  where publication_id = competition.current_publication_id;
  select count(*) into confirmed_teams from public.team_registrations
  where competition_id = competition.id and status in ('confirmed', 'completed');
  select count(*) into eligible_games from public.games
  where competition_id = competition.id and status in ('scheduled', 'live', 'final');
  select count(*) into invalid_games from public.games game
  where game.competition_id = competition.id and game.status in ('scheduled', 'live', 'final')
    and (select count(*) from public.game_participants participant
      where participant.game_id = game.id) <> 2;
  if competition.status = 'archived' then
    blockers := blockers || jsonb_build_array('ARCHIVED');
  end if;
  if competition.starts_on is null then
    blockers := blockers || jsonb_build_array('START_DATE_REQUIRED');
  elsif (clock_timestamp() at time zone 'America/Sao_Paulo')::date < competition.starts_on then
    blockers := blockers || jsonb_build_array('BEFORE_STARTS_ON');
  end if;
  if coalesce(competition.gender_division_review_required, true) then
    blockers := blockers || jsonb_build_array('GENDER_REVIEW_REQUIRED');
  end if;
  if coalesce(competition.data_profile_review_required, true) then
    blockers := blockers || jsonb_build_array('DATA_PROFILE_REVIEW_REQUIRED');
  end if;
  if confirmed_teams < 2 then
    blockers := blockers || jsonb_build_array('CONFIRMED_TEAMS_REQUIRED');
  end if;
  if invalid_games > 0 then
    blockers := blockers || jsonb_build_array('INVALID_PUBLIC_GAME');
  end if;
  snapshot := private.competition_publication_snapshot(competition.id);
  snapshot_hash := md5(snapshot::text);
  if data_profile.primary_source = 'fiba_boxscore' and data_profile.status = 'active' then
    statistics_fingerprint := private.competition_boxscore_statistics_fingerprint(competition.id);
    statistics_changed := current_statistics.publication_id is null
      or current_statistics.source_fingerprint is distinct from statistics_fingerprint
      or current_statistics.data_profile_id is distinct from data_profile.id
      or current_statistics.data_profile_version is distinct from data_profile.version;
  end if;
  return jsonb_build_object(
    'competitionId', competition.id,
    'currentVersion', coalesce(current_publication.version, 0),
    'nextVersion', coalesce(current_publication.version, 0) + 1,
    'confirmedTeams', confirmed_teams,
    'eligibleGames', eligible_games,
    'invalidGames', invalid_games,
    'startsOn', competition.starts_on,
    'canPublish', jsonb_array_length(blockers) = 0,
    'blockers', blockers,
    'changed', current_publication.id is null
      or current_publication.snapshot_hash <> snapshot_hash
      or statistics_changed
  );
end;
$$;
revoke all on function private.competition_publication_review(bigint)
  from public, anon, authenticated;
