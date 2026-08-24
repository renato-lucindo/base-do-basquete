-- WP-10: authoritative final results and derived historical achievements.

alter table public.final_placements
  add column result_status text not null default 'pending';

update public.final_placements
set result_status = case when confirmed_at is null then 'pending' else 'placed' end;

alter table public.final_placements
  alter column placement drop not null,
  drop constraint final_placements_confirmation_consistent,
  add constraint final_placements_result_status_check check (
    result_status in ('pending', 'placed', 'withdrawn', 'disqualified')
  ),
  add constraint final_placements_result_consistent check (
    (result_status = 'pending' and placement is null and confirmed_by is null and confirmed_at is null) or
    (result_status = 'placed' and placement > 0 and confirmed_by is not null and confirmed_at is not null) or
    (result_status in ('withdrawn', 'disqualified') and placement is null and confirmed_by is not null and confirmed_at is not null)
  );

alter table public.admin_mutation_audit
  drop constraint admin_mutation_audit_action_check,
  add constraint admin_mutation_audit_action_check check (
    action in (
      'registration_created',
      'registration_transitioned',
      'roster_replaced',
      'manual_scoresheet_saved',
      'boxscore_import_confirmed',
      'final_placement_confirmed'
    )
  ),
  drop constraint admin_mutation_audit_entity_type_check,
  add constraint admin_mutation_audit_entity_type_check check (
    entity_type in ('team_registration', 'game', 'boxscore_import', 'final_placement')
  );

create function private.admin_confirm_final_placement_impl(
  p_registration_id bigint,
  p_result_status text,
  p_placement smallint default null,
  p_result_label text default null
)
returns public.final_placements
language plpgsql
security definer
set search_path = ''
as $$
declare
  registration public.team_registrations;
  existing public.final_placements;
  saved public.final_placements;
  normalized_status text := lower(btrim(coalesce(p_result_status, '')));
  normalized_label text := nullif(btrim(coalesce(p_result_label, '')), '');
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  if normalized_status not in ('placed', 'withdrawn', 'disqualified') then
    raise exception using errcode = 'BD201', message = 'BDB_FINAL_RESULT_INVALID';
  end if;
  if (normalized_status = 'placed' and (p_placement is null or p_placement <= 0)) or
     (normalized_status <> 'placed' and p_placement is not null) then
    raise exception using errcode = 'BD201', message = 'BDB_FINAL_RESULT_INVALID';
  end if;
  if normalized_label is not null and char_length(normalized_label) not between 2 and 80 then
    raise exception using errcode = 'BD201', message = 'BDB_FINAL_RESULT_INVALID';
  end if;
  if normalized_status <> 'placed' then
    normalized_label := null;
  end if;

  select * into registration
  from public.team_registrations
  where id = p_registration_id
  for update;
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_REGISTRATION_NOT_FOUND';
  end if;
  if registration.status = 'draft' then
    raise exception using errcode = 'BD202', message = 'BDB_REGISTRATION_NOT_FINALIZABLE';
  end if;

  select * into existing
  from public.final_placements
  where competition_id = registration.competition_id
    and registration_id = registration.id
  for update;

  if found and existing.result_status = normalized_status
    and existing.placement is not distinct from p_placement
    and existing.result_label is not distinct from normalized_label then
    return existing;
  end if;

  insert into public.final_placements (
    competition_id, registration_id, placement, result_label, result_status,
    confirmed_by, confirmed_at
  ) values (
    registration.competition_id, registration.id, p_placement, normalized_label,
    normalized_status, auth.uid(), now()
  )
  on conflict (competition_id, registration_id) do update
  set placement = excluded.placement,
    result_label = excluded.result_label,
    result_status = excluded.result_status,
    confirmed_by = auth.uid(),
    confirmed_at = now()
  returning * into saved;

  insert into public.admin_mutation_audit (action, entity_type, entity_id, metadata)
  values (
    'final_placement_confirmed',
    'final_placement',
    saved.id,
    jsonb_build_object(
      'competitionId', saved.competition_id,
      'registrationId', saved.registration_id,
      'resultStatus', saved.result_status,
      'placement', saved.placement
    )
  );

  return saved;
exception
  when unique_violation then
    raise exception using errcode = 'BD203', message = 'BDB_FINAL_PLACEMENT_CONFLICT';
end;
$$;

create function public.admin_confirm_final_placement(
  p_registration_id bigint,
  p_result_status text,
  p_placement smallint default null,
  p_result_label text default null
)
returns public.final_placements
language sql
security invoker
set search_path = ''
as $$
  select private.admin_confirm_final_placement_impl(
    p_registration_id, p_result_status, p_placement, p_result_label
  );
$$;

revoke insert, update on public.final_placements from authenticated;
revoke all on function private.admin_confirm_final_placement_impl(bigint, text, smallint, text)
  from public, anon;
grant execute on function private.admin_confirm_final_placement_impl(bigint, text, smallint, text)
  to authenticated;
revoke all on function public.admin_confirm_final_placement(bigint, text, smallint, text)
  from public, anon;
grant execute on function public.admin_confirm_final_placement(bigint, text, smallint, text)
  to authenticated;

create or replace view public.team_achievements
with (security_invoker = true)
as
select
  placement.competition_id,
  placement.registration_id,
  registration.team_id,
  placement.placement,
  placement.result_label,
  placement.confirmed_at,
  series.name as series_name,
  series.slug as series_slug,
  competition.year,
  category.name as category_name,
  category.slug as category_slug,
  competition.display_name as competition_display_name
from public.final_placements placement
join public.team_registrations registration on registration.id = placement.registration_id
join public.competitions competition on competition.id = placement.competition_id
join public.competition_series series on series.id = competition.series_id
join public.categories category on category.id = competition.category_id
where placement.result_status = 'placed'
  and placement.confirmed_at is not null;

create or replace view public.player_achievements
with (security_invoker = true)
as
select
  placement.competition_id,
  placement.registration_id,
  roster.player_id,
  placement.placement,
  placement.result_label,
  placement.confirmed_at,
  registration.team_id,
  team.name as team_name,
  team.slug as team_slug,
  series.name as series_name,
  series.slug as series_slug,
  competition.year,
  category.name as category_name,
  category.slug as category_slug,
  competition.display_name as competition_display_name
from public.final_placements placement
join public.team_registrations registration on registration.id = placement.registration_id
join public.teams team on team.id = registration.team_id
join public.roster_entries roster
  on roster.registration_id = registration.id
 and roster.competition_id = placement.competition_id
join public.competitions competition on competition.id = placement.competition_id
join public.competition_series series on series.id = competition.series_id
join public.categories category on category.id = competition.category_id
where placement.result_status = 'placed'
  and placement.confirmed_at is not null;

comment on column public.final_placements.result_status is
  'Authoritative final result state; only placed results become achievements.';
comment on function public.admin_confirm_final_placement(bigint, text, smallint, text) is
  'AAL2-only, idempotent wrapper for authoritative placement confirmation.';
