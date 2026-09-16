-- POST-04 / ADM-REF-01H: final profile enforcement.
--
-- This migration is intentionally self-blocking. It can be committed and
-- exercised on a clean database, but it cannot be applied to a populated
-- environment until every explicit administrative review queue is empty.
do $$
declare
  competition_gender_pending bigint;
  competition_profile_pending bigint;
  player_profile_pending bigint;
  player_private_missing bigint;
begin
  select count(*) into competition_gender_pending
  from public.competitions competition
  where competition.gender_division is null
     or competition.gender_division_review_required;

  select count(*) into competition_profile_pending
  from public.competitions competition
  where competition.data_profile_id is null
     or competition.data_profile_review_required
     or competition.data_profile_validated_at is null
     or competition.data_profile_validated_by is null;

  select count(*) into player_profile_pending
  from private.player_private private_data
  where private_data.sex is null
     or private_data.sex_review_required;

  select count(*) into player_private_missing
  from public.players player
  left join private.player_private private_data on private_data.player_id = player.id
  where private_data.player_id is null;

  if competition_gender_pending > 0
     or competition_profile_pending > 0
     or player_profile_pending > 0
     or player_private_missing > 0
  then
    raise exception using
      errcode = 'BR100',
      message = 'BDB_FINAL_ENFORCEMENT_NOT_READY',
      detail = jsonb_build_object(
        'competitionGenderPending', competition_gender_pending,
        'competitionProfilePending', competition_profile_pending,
        'playerEligibilityPending', player_profile_pending,
        'playerPrivateMissing', player_private_missing
      )::text;
  end if;
end;
$$;

-- Compatibility rows are no longer created with an unknown private value.
-- The two authorized creation flows insert the explicit private value in the
-- same transaction; a deferred FK proves that every player leaves the
-- transaction with exactly one complete private row.
drop trigger if exists players_ensure_private_row on public.players;
drop function if exists private.ensure_player_private_row();

alter table public.competitions
  alter column gender_division set not null,
  alter column gender_division_review_required set default false,
  alter column data_profile_id set not null,
  alter column data_profile_review_required set default false,
  alter column data_profile_validated_at set not null,
  alter column data_profile_validated_by set not null,
  add constraint competitions_gender_review_complete
    check (not gender_division_review_required),
  add constraint competitions_profile_review_complete
    check (not data_profile_review_required);

drop index public.competitions_classified_context_uidx;
drop index public.competitions_unclassified_context_uidx;

alter table public.competitions
  add constraint competitions_context_unique
    unique (series_id, category_id, gender_division, year);

alter table private.player_private
  alter column sex set not null,
  alter column sex_review_required set default false,
  add constraint player_private_review_complete
    check (not sex_review_required);

alter table public.players
  add constraint players_private_profile_fkey
    foreign key (id)
    references private.player_private(player_id)
    on delete no action
    deferrable initially deferred;

create or replace function public.admin_set_player_sex(
  p_player_id bigint,
  p_sex text,
  p_reason text
)
returns table (
  player_id bigint,
  eligibility_pending boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_reason text := btrim(coalesce(p_reason, ''));
  current_sex text;
  review_required boolean;
  roster_count bigint;
  active_roster_count bigint;
  competition_count bigint;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if p_sex not in ('male', 'female') then
    raise exception using errcode = 'BD501', message = 'BDB_PLAYER_SEX_INVALID';
  end if;
  if char_length(clean_reason) not between 10 and 500 then
    raise exception using errcode = 'BD501', message = 'BDB_PLAYER_SEX_REASON_REQUIRED';
  end if;
  if not exists (
    select 1 from public.players player where player.id = p_player_id
  ) then
    raise exception using errcode = 'BD404', message = 'BDB_PLAYER_NOT_FOUND';
  end if;

  select private_data.sex, private_data.sex_review_required
  into current_sex, review_required
  from private.player_private private_data
  where private_data.player_id = p_player_id
  for update;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_PLAYER_PRIVATE_PROFILE_NOT_FOUND';
  end if;

  if current_sex is not distinct from p_sex and not review_required then
    return query select p_player_id, false;
    return;
  end if;

  select
    count(roster.id),
    count(roster.id) filter (where roster.status = 'active'),
    count(distinct roster.competition_id)
  into roster_count, active_roster_count, competition_count
  from public.roster_entries roster
  where roster.player_id = p_player_id;

  update private.player_private as private_data
  set
    sex = p_sex,
    sex_review_required = false
  where private_data.player_id = p_player_id;

  insert into public.admin_mutation_audit (
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    'player_sex_reviewed',
    'player',
    p_player_id,
    jsonb_build_object(
      'reason', clean_reason,
      'impact', jsonb_build_object(
        'rosterEntries', roster_count,
        'activeRosterEntries', active_roster_count,
        'competitions', competition_count
      )
    )
  );

  return query select p_player_id, false;
end;
$$;

comment on constraint competitions_context_unique on public.competitions is
  'Final edition identity after explicit gender and data-profile review.';
comment on constraint players_private_profile_fkey on public.players is
  'Deferred one-to-one enforcement for the complete private eligibility profile.';
comment on column public.competitions.gender_division_review_required is
  'Preserved rollout column; final enforcement requires it to remain false.';
comment on column public.competitions.data_profile_review_required is
  'Preserved rollout column; final enforcement requires it to remain false.';
comment on column private.player_private.sex_review_required is
  'Preserved private rollout column; final enforcement requires it to remain false.';
