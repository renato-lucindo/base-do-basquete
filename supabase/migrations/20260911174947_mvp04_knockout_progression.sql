-- A result resolves the sporting graph exactly once. Visibility remains a
-- separate editorial concern and is introduced by the publication unit.
alter table public.admin_mutation_audit
  drop constraint admin_mutation_audit_action_check,
  add constraint admin_mutation_audit_action_check check(action in (
    'registration_created','registration_transitioned','roster_replaced','manual_scoresheet_saved',
    'boxscore_import_confirmed','boxscore_team_stats_refreshed','final_placement_confirmed','player_created',
    'competition_gender_reviewed','data_profile_created','data_profile_activated',
    'competition_data_profile_assigned','player_sex_reviewed','game_data_authority_activated',
    'competition_created_from_preset','competition_entry_assigned','matchup_prepared','matchup_resolved'
  ));

create table public.matchup_resolutions (
  matchup_id bigint primary key,
  ruleset_revision_id bigint not null,
  competition_id bigint not null,
  game_id bigint not null,
  submission_id bigint not null,
  source_type text not null,
  winner_registration_id bigint not null,
  loser_registration_id bigint not null,
  home_score integer not null check(home_score >= 0),
  away_score integer not null check(away_score >= 0),
  resolved_by uuid not null references auth.users(id) on delete restrict,
  resolved_at timestamptz not null default now(),
  check(winner_registration_id <> loser_registration_id),
  check(home_score <> away_score),
  foreign key(matchup_id,ruleset_revision_id,competition_id)
    references public.matchups(id,ruleset_revision_id,competition_id) on delete restrict,
  foreign key(game_id,competition_id)
    references public.games(id,competition_id) on delete restrict,
  foreign key(submission_id,game_id,source_type)
    references public.game_data_submissions(id,game_id,source_type) on delete restrict,
  foreign key(winner_registration_id,competition_id)
    references public.team_registrations(id,competition_id) on delete restrict,
  foreign key(loser_registration_id,competition_id)
    references public.team_registrations(id,competition_id) on delete restrict
);

create index matchup_resolutions_context_idx
  on public.matchup_resolutions(ruleset_revision_id,competition_id);
create index matchup_resolutions_matchup_revision_comp_idx
  on public.matchup_resolutions(matchup_id,ruleset_revision_id,competition_id);
create index matchup_resolutions_game_comp_idx
  on public.matchup_resolutions(game_id,competition_id);
create index matchup_resolutions_submission_game_source_idx
  on public.matchup_resolutions(submission_id,game_id,source_type);
create index matchup_resolutions_winner_comp_idx
  on public.matchup_resolutions(winner_registration_id,competition_id);
create index matchup_resolutions_loser_comp_idx
  on public.matchup_resolutions(loser_registration_id,competition_id);
create index matchup_resolutions_actor_idx
  on public.matchup_resolutions(resolved_by);

create function private.guard_matchup_resolution()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op <> 'INSERT' then
    raise exception using errcode='BR030',message='BDB_MATCHUP_RESOLUTION_IMMUTABLE';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_matchup_resolution() from public,anon,authenticated;
create trigger guard_matchup_resolution
before update or delete on public.matchup_resolutions
for each row execute function private.guard_matchup_resolution();

alter table public.matchup_resolutions enable row level security;
alter table public.matchup_resolutions force row level security;
revoke all on public.matchup_resolutions from public,anon,authenticated;
grant select on public.matchup_resolutions to authenticated;
create policy matchup_resolutions_admin_select
on public.matchup_resolutions for select to authenticated
using((select public.is_current_admin_aal2()));

create or replace function private.resolved_slot_registration(p_slot_id bigint)
returns bigint language sql stable security invoker set search_path='' as $$
  select case s.origin_kind
    when 'entry' then assignment.registration_id
    when 'winner' then resolution.winner_registration_id
  end
  from public.competition_slots s
  left join public.competition_entry_assignments assignment
    on assignment.entry_id=s.entry_id
    and assignment.ruleset_revision_id=s.ruleset_revision_id
    and assignment.competition_id=s.competition_id
  left join public.matchup_resolutions resolution
    on resolution.matchup_id=s.source_matchup_id
    and resolution.ruleset_revision_id=s.ruleset_revision_id
    and resolution.competition_id=s.competition_id
  where s.id=p_slot_id;
$$;
revoke all on function private.resolved_slot_registration(bigint) from public,anon,authenticated;

create function public.admin_resolve_matchup(
  p_matchup_id bigint,
  p_expected_submission_id bigint
)
returns bigint language plpgsql security definer set search_path='' as $$
declare
  matchup_row public.matchups;
  game_row public.games;
  resolution_row public.matchup_resolutions;
  round_role text;
  authority_submission_id bigint;
  authority_source_type text;
  home_registration bigint;
  away_registration bigint;
  home_score integer;
  away_score integer;
  winner_registration bigint;
  loser_registration bigint;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode='BD401',message='BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if p_matchup_id is null or p_expected_submission_id is null then
    raise exception using errcode='BR031',message='BDB_OFFICIAL_RESULT_REQUIRED';
  end if;

  select * into matchup_row from public.matchups where id=p_matchup_id;
  if not found then
    raise exception using errcode='BD404',message='BDB_MATCHUP_NOT_FOUND';
  end if;
  perform 1 from public.competitions
    where id=matchup_row.competition_id and status<>'archived' for update;
  if not found then
    raise exception using errcode='BR032',message='BDB_ACTIVE_COMPETITION_REQUIRED';
  end if;
  perform 1 from public.competition_ruleset_revisions
    where id=matchup_row.ruleset_revision_id and status='active' and preset_key='single_elimination'
    for update;
  if not found then
    raise exception using errcode='BR022',message='BDB_ACTIVE_PRESET_REQUIRED';
  end if;
  select * into matchup_row from public.matchups where id=p_matchup_id for update;
  select r.round_role into round_role from public.competition_rounds r where r.id=matchup_row.round_id;
  if round_role is null or round_role='round_robin' then
    raise exception using errcode='BR033',message='BDB_KNOCKOUT_MATCHUP_REQUIRED';
  end if;

  select * into game_row from public.games
    where matchup_id=matchup_row.id and matchup_game_number=1 and status='final'
    for update;
  if not found then
    raise exception using errcode='BR034',message='BDB_FINAL_GAME_REQUIRED';
  end if;

  select authority.submission_id,authority.source_type
    into authority_submission_id,authority_source_type
  from public.game_data_domain_authority authority
  join public.game_data_submissions submission
    on submission.id=authority.submission_id
    and submission.game_id=authority.game_id
    and submission.source_type=authority.source_type
  where authority.game_id=game_row.id
    and authority.domain='official_result'
    and submission.status='active'
    and submission.role='primary'
  for update of authority,submission;
  if not found or authority_submission_id<>p_expected_submission_id then
    raise exception using errcode='BR031',message='BDB_OFFICIAL_RESULT_REQUIRED';
  end if;

  select * into resolution_row from public.matchup_resolutions
    where matchup_id=matchup_row.id for update;
  if found then
    if resolution_row.submission_id=authority_submission_id then
      return matchup_row.id;
    end if;
    raise exception using errcode='BR030',message='BDB_MATCHUP_RESOLUTION_IMMUTABLE';
  end if;

  select
    max(participant.registration_id) filter(where participant.side='home'),
    max(participant.registration_id) filter(where participant.side='away'),
    sum(score.points) filter(where participant.side='home'),
    sum(score.points) filter(where participant.side='away')
  into home_registration,away_registration,home_score,away_score
  from public.game_participants participant
  left join public.game_period_scores score
    on score.game_id=participant.game_id and score.registration_id=participant.registration_id
  where participant.game_id=game_row.id;
  if home_registration is distinct from matchup_row.home_registration_id
    or away_registration is distinct from matchup_row.away_registration_id
    or home_score is null or away_score is null or home_score=away_score
  then
    raise exception using errcode='BR035',message='BDB_OFFICIAL_RESULT_INVALID';
  end if;

  if home_score>away_score then
    winner_registration:=home_registration;
    loser_registration:=away_registration;
  else
    winner_registration:=away_registration;
    loser_registration:=home_registration;
  end if;

  insert into public.matchup_resolutions(
    matchup_id,ruleset_revision_id,competition_id,game_id,submission_id,source_type,
    winner_registration_id,loser_registration_id,home_score,away_score,resolved_by
  ) values(
    matchup_row.id,matchup_row.ruleset_revision_id,matchup_row.competition_id,
    game_row.id,authority_submission_id,authority_source_type,
    winner_registration,loser_registration,home_score,away_score,auth.uid()
  );

  update public.matchups dependent
  set home_registration_id=private.resolved_slot_registration(dependent.home_slot_id),
      away_registration_id=private.resolved_slot_registration(dependent.away_slot_id)
  where dependent.ruleset_revision_id=matchup_row.ruleset_revision_id
    and exists(
      select 1 from public.competition_slots slot
      where slot.id in(dependent.home_slot_id,dependent.away_slot_id)
        and slot.origin_kind='winner' and slot.source_matchup_id=matchup_row.id
    )
    and (
      dependent.home_registration_id is distinct from private.resolved_slot_registration(dependent.home_slot_id)
      or dependent.away_registration_id is distinct from private.resolved_slot_registration(dependent.away_slot_id)
    );

  insert into public.admin_mutation_audit(action,entity_type,entity_id,metadata)
  values('matchup_resolved','matchup',matchup_row.id,jsonb_build_object(
    'competitionId',matchup_row.competition_id,
    'gameId',game_row.id,
    'submissionId',authority_submission_id,
    'winnerRegistrationId',winner_registration,
    'loserRegistrationId',loser_registration,
    'homeScore',home_score,
    'awayScore',away_score
  ));
  return matchup_row.id;
end;
$$;
revoke all on function public.admin_resolve_matchup(bigint,bigint) from public,anon,authenticated;
grant execute on function public.admin_resolve_matchup(bigint,bigint) to authenticated;

create or replace function public.admin_get_competition_schedule(p_competition_id bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_admin_aal2() then
    raise exception using errcode='BD401',message='BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if not exists(select 1 from public.competitions where id=p_competition_id) then
    raise exception using errcode='BD404',message='BDB_COMPETITION_NOT_FOUND';
  end if;
  return jsonb_build_object(
    'entries',coalesce((select jsonb_agg(jsonb_build_object(
      'id',entry.id,'seed',entry.seed,'registrationId',assignment.registration_id
    ) order by entry.seed)
      from public.competition_entries entry
      left join public.competition_entry_assignments assignment on assignment.entry_id=entry.id
      where entry.competition_id=p_competition_id),'[]'::jsonb),
    'matchups',coalesce((select jsonb_agg(jsonb_build_object(
      'id',matchup.id,'code',matchup.code,'round',round_item.name,'order',matchup.matchup_order,
      'homeRegistrationId',matchup.home_registration_id,
      'awayRegistrationId',matchup.away_registration_id,
      'revision',coalesce(preparation.revision,0),
      'scheduledAt',preparation.scheduled_at,'venue',preparation.venue,'gameId',preparation.game_id,
      'officialResultSubmissionId',official.submission_id,
      'readyToSchedule',(matchup.home_registration_id is not null and matchup.away_registration_id is not null and preparation.game_id is null),
      'readyToResolve',(game.status='final' and official.submission_id is not null and resolution.matchup_id is null),
      'resolution',case when resolution.matchup_id is null then null else jsonb_build_object(
        'winnerRegistrationId',resolution.winner_registration_id,
        'loserRegistrationId',resolution.loser_registration_id,
        'homeScore',resolution.home_score,'awayScore',resolution.away_score,
        'resolvedAt',resolution.resolved_at
      ) end
    ) order by round_item.round_order,matchup.matchup_order)
    from public.matchups matchup
    join public.competition_rounds round_item on round_item.id=matchup.round_id
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
    where matchup.competition_id=p_competition_id and matchup.ruleset_revision_id is not null), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.admin_get_competition_schedule(bigint) from public,anon,authenticated;
grant execute on function public.admin_get_competition_schedule(bigint) to authenticated;
