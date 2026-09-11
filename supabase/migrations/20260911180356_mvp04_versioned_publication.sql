-- Versioned editorial snapshots. Sporting state remains in the canonical tables;
-- anonymous readers receive only the explicitly confirmed snapshot.
alter table public.admin_mutation_audit
  drop constraint admin_mutation_audit_action_check,
  add constraint admin_mutation_audit_action_check check(action in (
    'registration_created','registration_transitioned','roster_replaced','manual_scoresheet_saved',
    'boxscore_import_confirmed','boxscore_team_stats_refreshed','final_placement_confirmed','player_created',
    'competition_gender_reviewed','data_profile_created','data_profile_activated',
    'competition_data_profile_assigned','player_sex_reviewed','game_data_authority_activated',
    'competition_created_from_preset','competition_entry_assigned','matchup_prepared','matchup_resolved',
    'competition_published'
  ));

create table public.competition_publications(
  id bigint generated always as identity primary key,
  competition_id bigint not null references public.competitions(id) on delete restrict,
  version integer not null check(version>0),
  snapshot_schema_version integer not null default 1 check(snapshot_schema_version=1),
  snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),
  snapshot_hash text not null check(snapshot_hash ~ '^[0-9a-f]{32}$'),
  publication_kind text not null check(publication_kind in('legacy_backfill','admin')),
  published_by uuid references auth.users(id) on delete restrict,
  published_at timestamptz not null default now(),
  unique(competition_id,version),
  unique(id,competition_id),
  check((publication_kind='legacy_backfill' and published_by is null)
    or (publication_kind='admin' and published_by is not null))
);
create index competition_publications_actor_idx
  on public.competition_publications(published_by) where published_by is not null;
create index competition_publications_competition_published_idx
  on public.competition_publications(competition_id,published_at desc);

create table private.competition_publication_registrations(
  publication_id bigint not null,
  competition_id bigint not null,
  registration_id bigint not null,
  fingerprint text not null check(fingerprint ~ '^[0-9a-f]{32}$'),
  primary key(publication_id,registration_id),
  foreign key(publication_id,competition_id)
    references public.competition_publications(id,competition_id) on delete restrict,
  foreign key(registration_id,competition_id)
    references public.team_registrations(id,competition_id) on delete restrict
);
create index publication_registrations_context_idx
  on private.competition_publication_registrations(registration_id,competition_id);

create table private.competition_publication_roster_entries(
  publication_id bigint not null,
  competition_id bigint not null,
  roster_entry_id bigint not null,
  fingerprint text not null check(fingerprint ~ '^[0-9a-f]{32}$'),
  primary key(publication_id,roster_entry_id),
  foreign key(publication_id,competition_id)
    references public.competition_publications(id,competition_id) on delete restrict,
  foreign key(roster_entry_id,competition_id)
    references public.roster_entries(id,competition_id) on delete restrict
);
create index publication_roster_context_idx
  on private.competition_publication_roster_entries(roster_entry_id,competition_id);

create table private.competition_publication_games(
  publication_id bigint not null,
  competition_id bigint not null,
  game_id bigint not null,
  fingerprint text not null check(fingerprint ~ '^[0-9a-f]{32}$'),
  primary key(publication_id,game_id),
  foreign key(publication_id,competition_id)
    references public.competition_publications(id,competition_id) on delete restrict,
  foreign key(game_id,competition_id)
    references public.games(id,competition_id) on delete restrict
);
create index publication_games_context_idx
  on private.competition_publication_games(game_id,competition_id);

revoke all on private.competition_publication_registrations,
  private.competition_publication_roster_entries,
  private.competition_publication_games from public,anon,authenticated;

create function private.publication_registration_fingerprint(p_registration_id bigint)
returns text language sql stable security definer set search_path='' as $$
  select md5(jsonb_build_object(
    'id',registration.id,'competitionId',registration.competition_id,
    'teamId',registration.team_id,'status',registration.status,
    'confirmedAt',registration.confirmed_at
  )::text)
  from public.team_registrations registration where registration.id=p_registration_id;
$$;
create function private.publication_roster_fingerprint(p_roster_entry_id bigint)
returns text language sql stable security definer set search_path='' as $$
  select md5(jsonb_build_object(
    'id',entry.id,'competitionId',entry.competition_id,'registrationId',entry.registration_id,
    'playerId',entry.player_id,'jerseyNumber',entry.jersey_number,'status',entry.status,
    'joinedOn',entry.joined_on,'leftOn',entry.left_on
  )::text)
  from public.roster_entries entry where entry.id=p_roster_entry_id;
$$;
create function private.publication_game_fingerprint(p_game_id bigint)
returns text language sql stable security definer set search_path='' as $$
  select md5(jsonb_build_object(
    'id',game.id,'competitionId',game.competition_id,'number',game.game_number,
    'scheduledAt',game.scheduled_at,'venue',game.venue,'status',game.status,
    'matchupId',game.matchup_id,'matchupGameNumber',game.matchup_game_number,
    'participants',coalesce((select jsonb_agg(jsonb_build_object(
      'registrationId',participant.registration_id,'side',participant.side
    ) order by participant.side) from public.game_participants participant where participant.game_id=game.id),'[]'::jsonb),
    'periodScores',coalesce((select jsonb_agg(jsonb_build_object(
      'registrationId',score.registration_id,'period',score.period_number,'points',score.points
    ) order by score.period_number,score.registration_id) from public.game_period_scores score where score.game_id=game.id),'[]'::jsonb),
    'officialResultSubmissionId',(select authority.submission_id
      from public.game_data_domain_authority authority
      where authority.game_id=game.id and authority.domain='official_result')
  )::text)
  from public.games game where game.id=p_game_id;
$$;
revoke all on function private.publication_registration_fingerprint(bigint),
  private.publication_roster_fingerprint(bigint),private.publication_game_fingerprint(bigint)
  from public,anon,authenticated;

create function private.competition_publication_snapshot(p_competition_id bigint)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'schemaVersion',1,
    'competition',jsonb_build_object(
      'id',competition.id,'displayName',competition.display_name,'year',competition.year,
      'startsOn',competition.starts_on,'endsOn',competition.ends_on,
      'genderDivision',competition.gender_division
    ),
    'teams',coalesce((select jsonb_agg(jsonb_build_object(
      'registrationId',registration.id,'id',team.id,'name',team.name,
      'slug',team.slug,'abbreviation',team.abbreviation
    ) order by team.name,team.id)
      from public.team_registrations registration
      join public.teams team on team.id=registration.team_id
      where registration.competition_id=competition.id
        and registration.status in('confirmed','completed')),'[]'::jsonb),
    'games',coalesce((select jsonb_agg(jsonb_build_object(
      'id',game.id,
      'label',case when game.game_number is null then 'Jogo '||game.id::text else 'Jogo '||game.game_number end,
      'gameNumber',game.game_number,'status',game.status,
      'scheduledAt',game.scheduled_at,'venue',game.venue,
      'trackCode',track.code,'stageCode',stage.code,'stageName',stage.name,
      'roundCode',round_item.code,'roundName',round_item.name,'roundOrder',round_item.round_order,
      'matchupCode',matchup.code,'matchupOrder',matchup.matchup_order,
      'home',jsonb_build_object('registrationId',home_participant.registration_id,
        'id',home_team.id,'name',home_team.name,'slug',home_team.slug,'abbreviation',home_team.abbreviation),
      'away',jsonb_build_object('registrationId',away_participant.registration_id,
        'id',away_team.id,'name',away_team.name,'slug',away_team.slug,'abbreviation',away_team.abbreviation),
      'homeScore',case when game.status='scheduled' then null else
        (select sum(score.points)::integer from public.game_period_scores score
          where score.game_id=game.id and score.registration_id=home_participant.registration_id) end,
      'awayScore',case when game.status='scheduled' then null else
        (select sum(score.points)::integer from public.game_period_scores score
          where score.game_id=game.id and score.registration_id=away_participant.registration_id) end
    ) order by coalesce(round_item.round_order,32767),coalesce(matchup.matchup_order,32767),game.scheduled_at,game.id)
      from public.games game
      join public.game_participants home_participant on home_participant.game_id=game.id and home_participant.side='home'
      join public.game_participants away_participant on away_participant.game_id=game.id and away_participant.side='away'
      join public.team_registrations home_registration on home_registration.id=home_participant.registration_id
      join public.teams home_team on home_team.id=home_registration.team_id
      join public.team_registrations away_registration on away_registration.id=away_participant.registration_id
      join public.teams away_team on away_team.id=away_registration.team_id
      left join public.matchups matchup on matchup.id=game.matchup_id
      left join public.competition_rounds round_item on round_item.id=matchup.round_id
      left join public.competition_stages stage on stage.id=round_item.stage_id
      left join public.competition_tracks track on track.id=stage.track_id
      where game.competition_id=competition.id and game.status in('scheduled','live','final')),'[]'::jsonb)
  ) from public.competitions competition where competition.id=p_competition_id;
$$;
revoke all on function private.competition_publication_snapshot(bigint) from public,anon,authenticated;

alter table public.competitions add column current_publication_id bigint;

with snapshots as(
  select competition.id as competition_id,
    private.competition_publication_snapshot(competition.id) as snapshot
  from public.competitions competition where competition.status in('published','archived')
), inserted as(
  insert into public.competition_publications(
    competition_id,version,snapshot,snapshot_hash,publication_kind,published_at
  )
  select competition_id,1,snapshot,md5(snapshot::text),'legacy_backfill',
    coalesce((select published_at from public.competitions where id=competition_id),now())
  from snapshots returning id,competition_id
)
update public.competitions competition set current_publication_id=inserted.id
from inserted where competition.id=inserted.competition_id;

insert into private.competition_publication_registrations(
  publication_id,competition_id,registration_id,fingerprint
)
select publication.id,publication.competition_id,registration.id,
  private.publication_registration_fingerprint(registration.id)
from public.competition_publications publication
join public.team_registrations registration on registration.competition_id=publication.competition_id
where registration.status in('confirmed','completed');

insert into private.competition_publication_roster_entries(
  publication_id,competition_id,roster_entry_id,fingerprint
)
select publication.id,publication.competition_id,entry.id,
  private.publication_roster_fingerprint(entry.id)
from public.competition_publications publication
join public.roster_entries entry on entry.competition_id=publication.competition_id
where entry.status='active';

insert into private.competition_publication_games(
  publication_id,competition_id,game_id,fingerprint
)
select publication.id,publication.competition_id,game.id,
  private.publication_game_fingerprint(game.id)
from public.competition_publications publication
join public.games game on game.competition_id=publication.competition_id
where game.status in('scheduled','live','final')
  and (select count(*) from public.game_participants participant where participant.game_id=game.id)=2;

alter table public.competitions
  add constraint competitions_current_publication_fkey
    foreign key(current_publication_id,id)
    references public.competition_publications(id,competition_id) on delete restrict,
  add constraint competitions_editorial_state_consistent check(
    (status='draft' and current_publication_id is null)
    or (status in('published','archived') and current_publication_id is not null)
  );
create index competitions_current_publication_idx
  on public.competitions(current_publication_id,id) where current_publication_id is not null;

create function private.registration_is_currently_published(p_registration_id bigint)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.competitions competition
    join private.competition_publication_registrations member
      on member.publication_id=competition.current_publication_id
      and member.competition_id=competition.id
    where member.registration_id=p_registration_id
      and competition.status in('published','archived')
      and member.fingerprint=private.publication_registration_fingerprint(p_registration_id)
  );
$$;
create function private.roster_entry_is_currently_published(p_roster_entry_id bigint)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.competitions competition
    join private.competition_publication_roster_entries member
      on member.publication_id=competition.current_publication_id
      and member.competition_id=competition.id
    where member.roster_entry_id=p_roster_entry_id
      and competition.status in('published','archived')
      and member.fingerprint=private.publication_roster_fingerprint(p_roster_entry_id)
  );
$$;
create function private.game_is_currently_published(p_game_id bigint)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.competitions competition
    join private.competition_publication_games member
      on member.publication_id=competition.current_publication_id
      and member.competition_id=competition.id
    where member.game_id=p_game_id
      and competition.status in('published','archived')
      and member.fingerprint=private.publication_game_fingerprint(p_game_id)
  );
$$;
revoke all on function private.registration_is_currently_published(bigint),
  private.roster_entry_is_currently_published(bigint),private.game_is_currently_published(bigint)
  from public,anon,authenticated;
grant execute on function private.registration_is_currently_published(bigint),
  private.roster_entry_is_currently_published(bigint),private.game_is_currently_published(bigint)
  to anon,authenticated;

drop policy competitions_public_select on public.competitions;
create policy competitions_public_select on public.competitions for select to anon
using(status in('published','archived') and current_publication_id is not null);
drop policy team_registrations_public_select on public.team_registrations;
create policy team_registrations_public_select on public.team_registrations for select to anon
using(private.registration_is_currently_published(id));
drop policy roster_entries_public_select on public.roster_entries;
create policy roster_entries_public_select on public.roster_entries for select to anon
using(private.roster_entry_is_currently_published(id));
drop policy games_public_select on public.games;
create policy games_public_select on public.games for select to anon
using(private.game_is_currently_published(id));

alter table public.competition_publications enable row level security;
alter table public.competition_publications force row level security;
revoke all on public.competition_publications from public,anon,authenticated;
grant select on public.competition_publications to anon,authenticated;
create policy competition_publications_admin_select
on public.competition_publications for select to authenticated
using((select public.is_current_admin_aal2()));
create policy competition_publications_current_public_select
on public.competition_publications for select to anon
using(exists(select 1 from public.competitions competition
  where competition.id=competition_publications.competition_id
    and competition.current_publication_id=competition_publications.id
    and competition.status in('published','archived')));

create function private.competition_publication_review(p_competition_id bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  competition public.competitions;
  snapshot jsonb;
  current_publication public.competition_publications;
  blockers jsonb:='[]'::jsonb;
  confirmed_teams integer;
  eligible_games integer;
  invalid_games integer;
  unassigned_entries integer;
  snapshot_hash text;
begin
  select * into competition from public.competitions where id=p_competition_id;
  if not found then raise exception using errcode='BD404',message='BDB_COMPETITION_NOT_FOUND'; end if;
  select * into current_publication from public.competition_publications
    where id=competition.current_publication_id;
  select count(*) into confirmed_teams from public.team_registrations
    where competition_id=competition.id and status in('confirmed','completed');
  select count(*) into eligible_games from public.games
    where competition_id=competition.id and status in('scheduled','live','final');
  select count(*) into invalid_games from public.games game
    where game.competition_id=competition.id and game.status in('scheduled','live','final')
      and (select count(*) from public.game_participants participant where participant.game_id=game.id)<>2;
  select count(*) into unassigned_entries from public.competition_entries entry
    join public.competition_ruleset_revisions revision on revision.id=entry.ruleset_revision_id and revision.status='active'
    left join public.competition_entry_assignments assignment on assignment.entry_id=entry.id
    where entry.competition_id=competition.id and assignment.entry_id is null;
  if competition.status='archived' then blockers:=blockers||jsonb_build_array('ARCHIVED'); end if;
  if competition.starts_on is null then blockers:=blockers||jsonb_build_array('START_DATE_REQUIRED');
  elsif (clock_timestamp() at time zone 'America/Sao_Paulo')::date<competition.starts_on then
    blockers:=blockers||jsonb_build_array('BEFORE_STARTS_ON');
  end if;
  if coalesce(competition.gender_division_review_required,true) then
    blockers:=blockers||jsonb_build_array('GENDER_REVIEW_REQUIRED'); end if;
  if coalesce(competition.data_profile_review_required,true) then
    blockers:=blockers||jsonb_build_array('DATA_PROFILE_REVIEW_REQUIRED'); end if;
  if confirmed_teams<2 then blockers:=blockers||jsonb_build_array('CONFIRMED_TEAMS_REQUIRED'); end if;
  if invalid_games>0 then blockers:=blockers||jsonb_build_array('INVALID_PUBLIC_GAME'); end if;
  if unassigned_entries>0 then blockers:=blockers||jsonb_build_array('UNASSIGNED_ENTRIES'); end if;
  snapshot:=private.competition_publication_snapshot(competition.id);
  snapshot_hash:=md5(snapshot::text);
  return jsonb_build_object(
    'competitionId',competition.id,'currentVersion',coalesce(current_publication.version,0),
    'nextVersion',coalesce(current_publication.version,0)+1,
    'confirmedTeams',confirmed_teams,'eligibleGames',eligible_games,
    'unassignedEntries',unassigned_entries,'invalidGames',invalid_games,
    'startsOn',competition.starts_on,
    'canPublish',jsonb_array_length(blockers)=0,'blockers',blockers,
    'changed',current_publication.id is null or current_publication.snapshot_hash<>snapshot_hash
  );
end;
$$;
revoke all on function private.competition_publication_review(bigint) from public,anon,authenticated;

create function public.admin_get_publication_review(p_competition_id bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_admin_aal2() then
    raise exception using errcode='BD401',message='BDB_ADMIN_AAL2_REQUIRED';
  end if;
  return private.competition_publication_review(p_competition_id);
end;
$$;
revoke all on function public.admin_get_publication_review(bigint) from public,anon,authenticated;
grant execute on function public.admin_get_publication_review(bigint) to authenticated;

create function public.admin_publish_competition(
  p_competition_id bigint,p_expected_version integer,p_confirmed boolean
)
returns bigint language plpgsql security definer set search_path='' as $$
declare
  competition public.competitions;
  current_publication public.competition_publications;
  review jsonb;
  snapshot jsonb;
  snapshot_hash text;
  saved_publication_id bigint;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode='BD401',message='BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if p_confirmed is distinct from true then
    raise exception using errcode='BR043',message='BDB_PUBLICATION_CONFIRMATION_REQUIRED';
  end if;
  if p_expected_version is null or p_expected_version<0 then
    raise exception using errcode='BR041',message='BDB_PUBLICATION_CHANGED_RELOAD';
  end if;
  select * into competition from public.competitions where id=p_competition_id for update;
  if not found then raise exception using errcode='BD404',message='BDB_COMPETITION_NOT_FOUND'; end if;
  select * into current_publication from public.competition_publications
    where id=competition.current_publication_id for update;
  review:=private.competition_publication_review(competition.id);
  if not (review->>'canPublish')::boolean then
    raise exception using errcode='BR042',message='BDB_PUBLICATION_BLOCKED';
  end if;
  snapshot:=private.competition_publication_snapshot(competition.id);
  snapshot_hash:=md5(snapshot::text);
  if current_publication.id is not null and current_publication.snapshot_hash=snapshot_hash then
    return current_publication.id;
  end if;
  if coalesce(current_publication.version,0)<>p_expected_version then
    raise exception using errcode='BR041',message='BDB_PUBLICATION_CHANGED_RELOAD';
  end if;

  update public.teams team set is_public=true
  where exists(select 1 from public.team_registrations registration
    where registration.competition_id=competition.id and registration.team_id=team.id
      and registration.status in('confirmed','completed'));
  update public.players player set is_public=true
  where exists(select 1 from public.roster_entries entry
    where entry.competition_id=competition.id and entry.player_id=player.id and entry.status='active');

  insert into public.competition_publications(
    competition_id,version,snapshot,snapshot_hash,publication_kind,published_by
  ) values(
    competition.id,p_expected_version+1,snapshot,snapshot_hash,'admin',auth.uid()
  ) returning id into saved_publication_id;
  insert into private.competition_publication_registrations(
    publication_id,competition_id,registration_id,fingerprint
  ) select saved_publication_id,competition.id,registration.id,
      private.publication_registration_fingerprint(registration.id)
    from public.team_registrations registration
    where registration.competition_id=competition.id and registration.status in('confirmed','completed');
  insert into private.competition_publication_roster_entries(
    publication_id,competition_id,roster_entry_id,fingerprint
  ) select saved_publication_id,competition.id,entry.id,
      private.publication_roster_fingerprint(entry.id)
    from public.roster_entries entry
    where entry.competition_id=competition.id and entry.status='active';
  insert into private.competition_publication_games(
    publication_id,competition_id,game_id,fingerprint
  ) select saved_publication_id,competition.id,game.id,private.publication_game_fingerprint(game.id)
    from public.games game
    where game.competition_id=competition.id and game.status in('scheduled','live','final')
      and (select count(*) from public.game_participants participant where participant.game_id=game.id)=2;
  update public.competitions set status='published',published_at=coalesce(published_at,now()),
    current_publication_id=saved_publication_id where id=competition.id;
  insert into public.admin_mutation_audit(action,entity_type,entity_id,metadata)
  values('competition_published','competition',competition.id,jsonb_build_object(
    'publicationId',saved_publication_id,'version',p_expected_version+1,
    'confirmedTeams',(review->>'confirmedTeams')::integer,
    'eligibleGames',(review->>'eligibleGames')::integer
  ));
  return saved_publication_id;
end;
$$;
revoke all on function public.admin_publish_competition(bigint,integer,boolean)
  from public,anon,authenticated;
grant execute on function public.admin_publish_competition(bigint,integer,boolean) to authenticated;

create function public.public_get_competition_publication(p_competition_id bigint)
returns jsonb language sql stable security definer set search_path='' as $$
  select publication.snapshot
  from public.competitions competition
  join public.competition_publications publication on publication.id=competition.current_publication_id
  where competition.id=p_competition_id and competition.status in('published','archived');
$$;
revoke all on function public.public_get_competition_publication(bigint)
  from public,anon,authenticated;
grant execute on function public.public_get_competition_publication(bigint) to anon,authenticated;

-- Publishing does not freeze sporting operations. A later schedule/result stays
-- private because public membership and fingerprints change only on republish.
create or replace function public.admin_prepare_matchup(
  p_matchup_id bigint,p_expected_revision integer,p_scheduled_at timestamptz,p_venue text
)
returns bigint language plpgsql security definer set search_path='' as $$
declare
  matchup_row public.matchups;
  competition public.competitions;
  preparation public.matchup_preparations;
  normalized_venue text:=nullif(btrim(p_venue),'');
  target_game bigint;
  participants_ready boolean;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode='BD401',message='BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if p_expected_revision is null or p_expected_revision<0 or char_length(normalized_venue)>160
    or (p_scheduled_at is not null and not isfinite(p_scheduled_at)) then
    raise exception using errcode='BR025',message='BDB_SCHEDULE_INPUT_INVALID';
  end if;
  select * into matchup_row from public.matchups where id=p_matchup_id;
  if not found then raise exception using errcode='BD404',message='BDB_MATCHUP_NOT_FOUND'; end if;
  select * into competition from public.competitions where id=matchup_row.competition_id for update;
  if competition.status='archived' then
    raise exception using errcode='BR032',message='BDB_ACTIVE_COMPETITION_REQUIRED';
  end if;
  perform 1 from public.competition_ruleset_revisions
    where id=matchup_row.ruleset_revision_id and status='active' and preset_key is not null for update;
  if not found then raise exception using errcode='BR022',message='BDB_ACTIVE_PRESET_REQUIRED'; end if;
  select * into matchup_row from public.matchups where id=p_matchup_id for update;
  if p_scheduled_at is not null and (
    (p_scheduled_at at time zone 'America/Sao_Paulo')::date<competition.starts_on
    or (p_scheduled_at at time zone 'America/Sao_Paulo')::date>competition.ends_on
  ) then raise exception using errcode='BR025',message='BDB_SCHEDULE_INPUT_INVALID'; end if;
  select * into preparation from public.matchup_preparations
    where matchup_id=matchup_row.id for update;
  participants_ready:=matchup_row.home_registration_id is not null
    and matchup_row.away_registration_id is not null;
  if participants_ready and exists(select 1 from public.team_registrations
    where id in(matchup_row.home_registration_id,matchup_row.away_registration_id)
      and status<>'confirmed') then
    raise exception using errcode='BR023',message='BDB_CONFIRMED_REGISTRATION_REQUIRED';
  end if;
  if preparation.matchup_id is not null
    and preparation.scheduled_at is not distinct from p_scheduled_at
    and preparation.venue is not distinct from normalized_venue
    and (preparation.game_id is not null or not participants_ready)
  then return preparation.game_id; end if;
  if coalesce(preparation.revision,0)<>p_expected_revision then
    raise exception using errcode='BR026',message='BDB_SCHEDULE_CHANGED_RELOAD';
  end if;
  target_game:=preparation.game_id;
  if target_game is not null then
    perform 1 from public.games where id=target_game and status in('draft','scheduled')
      and started_at is null for update;
    if not found or exists(select 1 from public.game_data_submissions where game_id=target_game) then
      raise exception using errcode='BR027',message='BDB_STARTED_GAME_SCHEDULE_IMMUTABLE';
    end if;
    update public.games set scheduled_at=p_scheduled_at,venue=normalized_venue,
      status=case when p_scheduled_at is null then 'draft' else 'scheduled' end
      where id=target_game;
  elsif participants_ready then
    insert into public.games(
      competition_id,matchup_id,matchup_game_number,scheduled_at,venue,status,created_by,source
    ) values(
      matchup_row.competition_id,matchup_row.id,1,p_scheduled_at,normalized_venue,
      case when p_scheduled_at is null then 'draft' else 'scheduled' end,auth.uid(),'structural'
    ) returning id into target_game;
    insert into public.game_participants(game_id,competition_id,registration_id,side)
    values(target_game,matchup_row.competition_id,matchup_row.home_registration_id,'home'),
      (target_game,matchup_row.competition_id,matchup_row.away_registration_id,'away');
  end if;
  insert into public.matchup_preparations(
    matchup_id,competition_id,scheduled_at,venue,game_id,updated_by
  ) values(
    matchup_row.id,matchup_row.competition_id,p_scheduled_at,normalized_venue,target_game,auth.uid()
  ) on conflict(matchup_id) do update set scheduled_at=excluded.scheduled_at,
    venue=excluded.venue,game_id=excluded.game_id,
    revision=public.matchup_preparations.revision+1,updated_by=auth.uid(),updated_at=clock_timestamp();
  insert into public.admin_mutation_audit(action,entity_type,entity_id,metadata)
  values('matchup_prepared','matchup',matchup_row.id,jsonb_build_object(
    'competitionId',matchup_row.competition_id,'gameId',target_game,
    'revision',coalesce(preparation.revision,0)+1
  ));
  return target_game;
end;
$$;
revoke all on function public.admin_prepare_matchup(bigint,integer,timestamptz,text)
  from public,anon,authenticated;
grant execute on function public.admin_prepare_matchup(bigint,integer,timestamptz,text) to authenticated;

create function private.guard_competition_publication()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  raise exception using errcode='BR044',message='BDB_PUBLICATION_IMMUTABLE';
end;
$$;
revoke all on function private.guard_competition_publication() from public,anon,authenticated;
create trigger guard_competition_publication
before update or delete on public.competition_publications
for each row execute function private.guard_competition_publication();

comment on table public.competition_publications is
  'Immutable explicit editorial releases; anonymous public reads use only competitions.current_publication_id.';
comment on function public.public_get_competition_publication(bigint) is
  'Public allowlisted snapshot for the current explicit publication; returns null for private competitions.';
