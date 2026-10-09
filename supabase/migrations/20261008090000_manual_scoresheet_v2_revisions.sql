-- MANUAL-SCORESHEET-V2-FIBA2024 - stage 4 (backend only).
-- Versioned revisions preserve the original scheduling key and immutable submissions.

-- Retain audit actions introduced by concurrently integrated season/division workflows.
-- Replacing the full legacy list here would silently remove newer action values.
do $$
declare prior_action_check text;
begin
  select pg_get_expr(conbin, conrelid)
    into strict prior_action_check
  from pg_constraint
  where conrelid = 'public.admin_mutation_audit'::regclass
    and conname = 'admin_mutation_audit_action_check';

  alter table public.admin_mutation_audit
    drop constraint admin_mutation_audit_action_check;
  execute format(
    'alter table public.admin_mutation_audit add constraint admin_mutation_audit_action_check check ((%s) or action=%L)',
    prior_action_check, 'manual_scoresheet_revised'
  );
end;
$$;

create table public.manual_scoresheet_revisions (
  id bigint generated always as identity primary key,
  game_id bigint not null references public.games(id) on delete restrict,
  submission_id bigint not null unique,
  base_submission_id bigint not null,
  base_payload_hash text not null check (base_payload_hash ~ '^[0-9a-f]{32}$'),
  reason text not null check (reason = btrim(reason) and char_length(reason) between 10 and 500),
  diff jsonb not null check (jsonb_typeof(diff) = 'array' and jsonb_array_length(diff) > 0),
  penalty_free_throws jsonb not null check (jsonb_typeof(penalty_free_throws) = 'object'),
  revised_by uuid not null references auth.users(id) on delete restrict deferrable initially immediate,
  revised_at timestamptz not null default now(),
  constraint manual_scoresheet_revisions_submission_fkey
    foreign key (submission_id, game_id)
    references public.game_data_submissions(id, game_id) on delete restrict,
  constraint manual_scoresheet_revisions_base_fkey
    foreign key (base_submission_id, game_id)
    references public.game_data_submissions(id, game_id) on delete restrict
);

create index manual_scoresheet_revisions_game_idx
  on public.manual_scoresheet_revisions(game_id, revised_at desc, id desc);

alter table public.manual_scoresheet_revisions enable row level security;
alter table public.manual_scoresheet_revisions force row level security;
create policy manual_scoresheet_revisions_admin_select
  on public.manual_scoresheet_revisions for select to authenticated
  using ((select public.is_current_admin_aal2()));
revoke all on public.manual_scoresheet_revisions from public, anon, authenticated;
revoke all on sequence public.manual_scoresheet_revisions_id_seq from public, anon, authenticated;
grant select on public.manual_scoresheet_revisions to authenticated;

-- Permit a guarded handover from the active manual submission to its already
-- validated successor. The existing authority guard remains in force for all
-- other status changes, and the full handover is one transaction.
create or replace function private.prevent_referenced_submission_deactivation()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.game_data_domain_authority authority
      where authority.submission_id = old.id) then
      raise exception using errcode='BD707', message='BDB_SUBMISSION_HAS_ACTIVE_AUTHORITY';
    end if;
    return old;
  end if;

  if new.status <> 'active' and exists (
    select 1 from public.game_data_domain_authority authority
    where authority.submission_id = old.id
  ) then
    if old.status = 'active' and new.status = 'superseded'
      and old.source_type = 'manual_scoresheet' and private.is_admin_aal2()
      and exists (
        select 1 from public.manual_scoresheet_revisions revision
        join public.game_data_submissions successor on successor.id = revision.submission_id
        where revision.base_submission_id = old.id
          and revision.game_id = old.game_id
          and revision.base_payload_hash = old.payload_hash
          and revision.revised_by = auth.uid()
          and successor.game_id = old.game_id
          and successor.source_type = old.source_type
          and successor.status = 'validated'
          and successor.submission_version > old.submission_version
      )
    then
      return new;
    end if;
    raise exception using errcode='BD707', message='BDB_SUBMISSION_HAS_ACTIVE_AUTHORITY';
  end if;
  return new;
end;
$$;

create function private.reject_manual_scoresheet_history_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception using errcode='BD222', message='BDB_SCORESHEET_HISTORY_IMMUTABLE';
end;
$$;
revoke all on function private.reject_manual_scoresheet_history_mutation() from public, anon, authenticated;

create trigger manual_scoresheet_submission_payloads_immutable
before update or delete on public.manual_scoresheet_submission_payloads
for each row execute function private.reject_manual_scoresheet_history_mutation();
create trigger manual_scoresheet_revisions_immutable
before update or delete on public.manual_scoresheet_revisions
for each row execute function private.reject_manual_scoresheet_history_mutation();

create function private.manual_scoresheet_v2_diff(p_before jsonb, p_after jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'section', section_name,
    'before', p_before -> section_name,
    'after', p_after -> section_name
  ) order by section_order), '[]'::jsonb)
  from (values
    (1,'game'),(2,'teams'),(3,'periods'),(4,'fouls'),(5,'officials')
  ) as sections(section_order, section_name)
  where (p_before -> section_name) is distinct from (p_after -> section_name);
$$;
revoke all on function private.manual_scoresheet_v2_diff(jsonb,jsonb) from public, anon, authenticated;

-- Counts awarded by foul registration, including bench/staff/team, independently of FT conversions.
create function private.manual_scoresheet_v2_penalty_ft_totals(p_game_id bigint)
returns jsonb language sql stable set search_path = '' as $$
  with awarded as (
    select participant.side, coalesce(sum(foul.penalty_ft_count),0)::integer as total
    from public.game_participants participant
    left join public.foul_events foul on foul.game_id = participant.game_id
      and foul.registration_id = participant.registration_id
    where participant.game_id = p_game_id
    group by participant.side
  )
  select jsonb_build_object(
    'homeConceded',coalesce((select total from awarded where side='home'),0),
    'homeReceived',coalesce((select total from awarded where side='away'),0),
    'awayConceded',coalesce((select total from awarded where side='away'),0),
    'awayReceived',coalesce((select total from awarded where side='home'),0)
  );
$$;
revoke all on function private.manual_scoresheet_v2_penalty_ft_totals(bigint) from public, anon, authenticated;

create function private.replace_manual_scoresheet_v2_game(
  p_game_id bigint, p_competition_id bigint, p_payload jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin_aal2() then
    raise exception using errcode='BD401', message='BDB_ADMIN_AAL2_REQUIRED';
  end if;
  -- FK order: the existing semantic writer creates all new rows in one transaction.
  delete from public.foul_events where game_id = p_game_id;
  delete from public.player_period_stats where game_id = p_game_id;
  delete from public.game_period_scores where game_id = p_game_id;
  delete from public.game_team_staff where game_id = p_game_id;
  delete from public.game_officials where game_id = p_game_id;
  delete from public.game_roster_slots where game_id = p_game_id;
  delete from public.game_periods where game_id = p_game_id;
  return private.write_manual_scoresheet_v2_game(p_game_id, p_competition_id, p_payload);
end;
$$;
revoke all on function private.replace_manual_scoresheet_v2_game(bigint,bigint,jsonb)
  from public, anon, authenticated;

-- Input is a full creation-shaped payload plus gameId, revisionKey (new UUID),
-- baseSubmissionId, basePayloadHash and revisionReason. The original
-- idempotencyKey remains part of the immutable game payload.
create function public.admin_revise_manual_scoresheet_v2(p_payload jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  saved_game_id bigint;
  competition_id bigint;
  base_submission_id bigint;
  base_payload_hash text;
  revision_key uuid;
  revision_reason text;
  canonical_payload jsonb;
  payload_hash text;
  game_record public.games;
  base_submission public.game_data_submissions;
  base_snapshot public.manual_scoresheet_submission_payloads;
  prior_revision public.manual_scoresheet_revisions;
  retry_submission public.game_data_submissions;
  home_registration_id bigint;
  away_registration_id bigint;
  home_team jsonb;
  away_team jsonb;
  game_date date;
  game_time time;
  game_time_text text;
  normalized_venue text;
  normalized_game_number text;
  normalized_phase_round text;
  normalized_notes text;
  scheduled_at timestamptz;
  changes jsonb;
  write_result jsonb;
  new_submission_id bigint;
  next_version integer;
  authority_domain text;
  authority_domains text[] := array[
    'official_result','period_scores','participation',
    'player_scoring','player_foul_total','player_foul_timeline'
  ]::text[];
begin
  if not private.is_admin_aal2() then
    raise exception using errcode='BD401', message='BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode='BD201', message='BDB_INVALID_SCORESHEET';
  end if;
  begin
    saved_game_id := (p_payload ->> 'gameId')::bigint;
    competition_id := (p_payload ->> 'competitionId')::bigint;
    base_submission_id := (p_payload ->> 'baseSubmissionId')::bigint;
    revision_key := (p_payload ->> 'revisionKey')::uuid;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode='BD203', message='BDB_INVALID_GAME_HEADER';
  end;
  base_payload_hash := p_payload ->> 'basePayloadHash';
  revision_reason := nullif(btrim(coalesce(p_payload ->> 'revisionReason','')), '');
  if revision_reason is null or char_length(revision_reason) not between 10 and 500 then
    raise exception using errcode='BD220', message='BDB_REVISION_REASON_REQUIRED';
  end if;
  if saved_game_id is null or saved_game_id <= 0 or competition_id is null or competition_id <= 0
    or base_submission_id is null or base_submission_id <= 0 or revision_key is null
    or base_payload_hash is null or base_payload_hash !~ '^[0-9a-f]{32}$'
    or jsonb_typeof(p_payload -> 'game') <> 'object'
    or jsonb_typeof(p_payload -> 'teams') <> 'array'
    or jsonb_array_length(p_payload -> 'teams') <> 2
  then
    raise exception using errcode='BD203', message='BDB_INVALID_GAME_HEADER';
  end if;
  canonical_payload := p_payload - 'gameId' - 'revisionKey'
    - 'baseSubmissionId' - 'basePayloadHash' - 'revisionReason';
  payload_hash := md5(canonical_payload::text);

  perform pg_advisory_xact_lock(hashtextextended('manual-v2:' || revision_key::text,2001));
  select submission.* into retry_submission
  from public.game_data_submissions submission
  where submission.source_type='manual_scoresheet' and submission.idempotency_key=revision_key::text;
  if found then
    select revision.* into prior_revision from public.manual_scoresheet_revisions revision
    where revision.submission_id=retry_submission.id;
    if retry_submission.game_id=saved_game_id and retry_submission.payload_hash=payload_hash
      and prior_revision.base_submission_id=base_submission_id
      and prior_revision.base_payload_hash=base_payload_hash
      and prior_revision.reason=revision_reason
    then
      return saved_game_id;
    end if;
    raise exception using errcode='BD209', message='BDB_IDEMPOTENCY_CONFLICT';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('manual-v2-game:' || saved_game_id::text,2001));
  select game.* into game_record from public.games game
  where game.id=saved_game_id for update;
  if not found then
    raise exception using errcode='BD404', message='BDB_GAME_NOT_FOUND';
  end if;
  if game_record.competition_id <> competition_id or game_record.status <> 'final'
    or game_record.source <> 'manual' or game_record.manual_idempotency_key is null
    or canonical_payload ->> 'idempotencyKey' is distinct from game_record.manual_idempotency_key::text
  then
    raise exception using errcode='BD712', message='BDB_GAME_PARTICIPANTS_MISMATCH';
  end if;
  select submission.* into base_submission from public.game_data_submissions submission
  where submission.game_id=saved_game_id and submission.source_type='manual_scoresheet'
    and submission.status='active' for update;
  if not found or base_submission.id <> base_submission_id
    or base_submission.payload_hash <> base_payload_hash
  then
    raise exception using errcode='BD221', message='BDB_REVISION_CONFLICT';
  end if;
  select snapshot.* into base_snapshot from public.manual_scoresheet_submission_payloads snapshot
  where snapshot.submission_id=base_submission_id and snapshot.game_id=saved_game_id;
  if not found or base_snapshot.payload_hash <> base_payload_hash
    or md5(base_snapshot.payload::text) <> base_payload_hash
  then
    raise exception using errcode='BD221', message='BDB_REVISION_CONFLICT';
  end if;
  if (select count(*) from public.game_data_domain_authority authority
      where authority.game_id=saved_game_id and authority.domain=any(authority_domains)
        and authority.submission_id=base_submission_id) <> 6
  then
    raise exception using errcode='BD704', message='BDB_AUTHORITY_CONFLICT';
  end if;

  -- Game identity and matchup are fixed by the initial submission.
  if canonical_payload ->> 'competitionId' is distinct from base_snapshot.payload ->> 'competitionId'
    or canonical_payload -> 'roundId' is distinct from base_snapshot.payload -> 'roundId'
    or canonical_payload -> 'fallbackReason' is distinct from base_snapshot.payload -> 'fallbackReason'
  then
    raise exception using errcode='BD712', message='BDB_GAME_PARTICIPANTS_MISMATCH';
  end if;
  select value into home_team from jsonb_array_elements(canonical_payload -> 'teams')
    where value ->> 'side'='home';
  select value into away_team from jsonb_array_elements(canonical_payload -> 'teams')
    where value ->> 'side'='away';
  begin
    home_registration_id := (home_team ->> 'registrationId')::bigint;
    away_registration_id := (away_team ->> 'registrationId')::bigint;
    game_date := (canonical_payload #>> '{game,date}')::date;
  exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then
    raise exception using errcode='BD203', message='BDB_INVALID_GAME_HEADER';
  end;
  if game_date is null or home_registration_id is null or away_registration_id is null
    or not exists(select 1 from public.game_participants participant
      where participant.game_id=saved_game_id and participant.side='home'
        and participant.registration_id=home_registration_id)
    or not exists(select 1 from public.game_participants participant
      where participant.game_id=saved_game_id and participant.side='away'
        and participant.registration_id=away_registration_id)
  then
    raise exception using errcode='BD712', message='BDB_GAME_PARTICIPANTS_MISMATCH';
  end if;
  game_time_text := nullif(btrim(coalesce(canonical_payload #>> '{game,time}','')), '');
  if game_time_text is not null and game_time_text !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception using errcode='BD203', message='BDB_INVALID_GAME_HEADER';
  end if;
  if game_time_text is not null then game_time := game_time_text::time; end if;
  normalized_venue := nullif(btrim(coalesce(canonical_payload #>> '{game,venue}','')), '');
  normalized_game_number := nullif(btrim(coalesce(canonical_payload #>> '{game,gameNumber}','')), '');
  normalized_phase_round := nullif(btrim(coalesce(canonical_payload #>> '{game,phaseRound}','')), '');
  normalized_notes := nullif(btrim(coalesce(canonical_payload #>> '{game,notes}','')), '');
  if char_length(normalized_venue) > 160 or char_length(normalized_game_number) > 40
    or char_length(normalized_phase_round) > 120 or char_length(normalized_notes) > 2000
  then
    raise exception using errcode='BD203', message='BDB_INVALID_GAME_HEADER';
  end if;

  changes := private.manual_scoresheet_v2_diff(base_snapshot.payload,canonical_payload);
  if jsonb_array_length(changes)=0 then
    raise exception using errcode='BD223', message='BDB_REVISION_NO_CHANGES';
  end if;

  scheduled_at := ((game_date + coalesce(game_time,time '00:00'))::timestamp at time zone 'America/Sao_Paulo');
  write_result := private.replace_manual_scoresheet_v2_game(saved_game_id,competition_id,canonical_payload);
  update public.manual_scoresheet_game_details details
    set scheduled_date=game_date,scheduled_time=game_time,phase_round=normalized_phase_round,
      notes=normalized_notes,updated_at=now()
    where details.game_id=saved_game_id;
  update public.games game
    set scheduled_at=scheduled_at, game_number=normalized_game_number, venue=normalized_venue
    where game.id=saved_game_id;

  select coalesce(max(submission.submission_version),0)+1 into next_version
  from public.game_data_submissions submission
  where submission.game_id=saved_game_id and submission.source_type='manual_scoresheet';
  insert into public.game_data_submissions(
    game_id,submission_version,source_type,role,status,payload_hash,idempotency_key,
    reason,submitted_by,submitted_at,validated_by,validated_at
  ) values (
    saved_game_id,next_version,'manual_scoresheet',base_submission.role,'validated',
    payload_hash,revision_key::text,revision_reason,auth.uid(),now(),auth.uid(),now()
  ) returning id into new_submission_id;
  insert into public.manual_scoresheet_submission_payloads(
    submission_id,game_id,payload,payload_hash,created_by
  ) values(new_submission_id,saved_game_id,canonical_payload,payload_hash,auth.uid());
  insert into public.manual_scoresheet_revisions(
    game_id,submission_id,base_submission_id,base_payload_hash,reason,diff,
    penalty_free_throws,revised_by
  ) values(
    saved_game_id,new_submission_id,base_submission_id,base_payload_hash,revision_reason,
    changes,private.manual_scoresheet_v2_penalty_ft_totals(saved_game_id),auth.uid()
  );
  update public.game_data_submissions submission set status='superseded'
    where submission.id=base_submission_id;
  update public.game_data_submissions submission set status='active'
    where submission.id=new_submission_id;
  perform private.refresh_manual_scoresheet_public_projection(saved_game_id, new_submission_id);
  foreach authority_domain in array authority_domains loop
    perform private.activate_game_data_domain_authority(
      saved_game_id,authority_domain,new_submission_id,base_submission_id,revision_reason
    );
  end loop;
  insert into public.admin_mutation_audit(action,entity_type,entity_id,metadata)
  values('manual_scoresheet_revised','game',saved_game_id,jsonb_build_object(
    'submissionId',new_submission_id,'baseSubmissionId',base_submission_id,
    'revision',next_version,'changedSections',jsonb_array_length(changes),
    'reasonProvided',true,'periodCount',(write_result ->> 'periodCount')::integer
  ));
  return saved_game_id;
exception when unique_violation then
  raise exception using errcode='BD205', message='BDB_DUPLICATE_GAME_DATA';
end;
$$;
revoke all on function public.admin_revise_manual_scoresheet_v2(jsonb) from public, anon, authenticated;
grant execute on function public.admin_revise_manual_scoresheet_v2(jsonb) to authenticated;
comment on function public.admin_revise_manual_scoresheet_v2(jsonb) is
  'Atomically revises a manual game with baseSubmissionId/hash CAS, immutable snapshots and six domain authority updates.';
