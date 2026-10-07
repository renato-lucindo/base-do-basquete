-- MANUAL-SCORESHEET-V2-FIBA2024
-- Etapa 2: additive semantic foul, staff and officials persistence.

alter table public.foul_events
  alter column game_roster_slot_id drop not null,
  drop constraint foul_events_slot_period_sequence_unique,
  add column registration_id bigint,
  add column target_kind text not null default 'player',
  add column staff_role text,
  add column foul_type text,
  add column penalty_ft_count smallint,
  add column original_notation text,
  add column foul_rules_version text not null default 'FIBA_2024';

update public.foul_events foul
set
  registration_id = slot.registration_id,
  foul_type = case when foul.foul_code = 'U2' then 'U' else foul.foul_code end,
  penalty_ft_count = case when foul.foul_code = 'U2' then 2 else 0 end,
  original_notation = foul.foul_code
from public.game_roster_slots slot
where slot.id = foul.game_roster_slot_id
  and slot.game_id = foul.game_id;

alter table public.foul_events
  alter column registration_id set not null,
  alter column foul_type set not null,
  alter column penalty_ft_count set not null,
  alter column penalty_ft_count set default 0,
  alter column original_notation set not null,
  add constraint foul_events_participant_fkey
    foreign key (game_id, registration_id)
    references public.game_participants(game_id, registration_id) on delete restrict,
  add constraint foul_events_target_kind_check
    check (target_kind in ('player','bench','staff','team')),
  add constraint foul_events_staff_role_check
    check (staff_role is null or staff_role in ('coach','assistant_1')),
  add constraint foul_events_type_check
    check (foul_type in ('P','T','U','D')),
  add constraint foul_events_penalty_ft_count_check
    check (penalty_ft_count between 0 and 3),
  add constraint foul_events_original_notation_check
    check (original_notation = btrim(original_notation) and char_length(original_notation) between 1 and 8),
  add constraint foul_events_rules_version_check
    check (foul_rules_version = 'FIBA_2024'),
  add constraint foul_events_target_shape_check check (
    (target_kind = 'player' and game_roster_slot_id is not null and staff_role is null)
    or (target_kind = 'bench' and game_roster_slot_id is null and staff_role is null)
    or (target_kind = 'staff' and game_roster_slot_id is null and staff_role is not null)
    or (target_kind = 'team' and game_roster_slot_id is null and staff_role is null)
  );

create unique index foul_events_player_period_sequence_uidx
  on public.foul_events(game_roster_slot_id, period_number, sequence_number)
  where target_kind = 'player';

create unique index foul_events_nonplayer_period_sequence_uidx
  on public.foul_events(
    game_id, registration_id, target_kind, coalesce(staff_role, ''), period_number, sequence_number
  ) where target_kind <> 'player';

create function private.enforce_foul_event_target_v2()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  slot_registration_id bigint;
begin
  if new.target_kind = 'player' then
    select slot.registration_id
      into slot_registration_id
    from public.game_roster_slots slot
    where slot.id = new.game_roster_slot_id
      and slot.game_id = new.game_id
      and slot.is_applicable;

    if slot_registration_id is null then
      raise exception using errcode='23514', message='BDB_FOUL_PLAYER_TARGET_INVALID';
    end if;

    if new.registration_id is null then
      new.registration_id := slot_registration_id;
    elsif new.registration_id <> slot_registration_id then
      raise exception using errcode='23514', message='BDB_FOUL_PLAYER_TARGET_INVALID';
    end if;

    if new.foul_type is null then
      new.foul_type := case when new.foul_code = 'U2' then 'U' else new.foul_code end;
      new.penalty_ft_count := case when new.foul_code = 'U2' then 2 else 0 end;
      new.original_notation := coalesce(new.original_notation, new.foul_code);
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_foul_event_target_v2() from public, anon, authenticated;

create trigger foul_events_target_v2_enforce
before insert or update
on public.foul_events
for each row execute function private.enforce_foul_event_target_v2();

create table public.game_team_staff (
  game_id bigint not null,
  registration_id bigint not null,
  role text not null check (role in ('coach','assistant_1')),
  display_name text not null check (
    display_name = btrim(display_name) and char_length(display_name) between 2 and 160
  ),
  origin text not null check (origin in ('manual','captain_placeholder')),
  linked_captain_roster_entry_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (game_id, registration_id, role),
  constraint game_team_staff_participant_fkey
    foreign key (game_id, registration_id)
    references public.game_participants(game_id, registration_id) on delete restrict,
  constraint game_team_staff_linked_captain_fkey
    foreign key (linked_captain_roster_entry_id, registration_id)
    references public.roster_entries(id, registration_id) on delete restrict,
  constraint game_team_staff_placeholder_check check (
    (origin = 'manual' and linked_captain_roster_entry_id is null)
    or (origin = 'captain_placeholder' and role = 'coach' and linked_captain_roster_entry_id is not null)
  )
);

create index game_team_staff_linked_captain_idx
  on public.game_team_staff(linked_captain_roster_entry_id)
  where linked_captain_roster_entry_id is not null;

create table public.game_officials (
  game_id bigint not null references public.games(id) on delete restrict,
  role text not null check (role in (
    'Árbitro','Fiscal 1','Fiscal 2','Apontador','Cronometrista','Operador de 24 Segundos'
  )),
  display_name text not null check (
    display_name = btrim(display_name) and char_length(display_name) between 2 and 160
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (game_id, role)
);

alter table public.game_team_staff enable row level security;
alter table public.game_team_staff force row level security;
alter table public.game_officials enable row level security;
alter table public.game_officials force row level security;

create policy game_team_staff_admin_select
on public.game_team_staff for select to authenticated
using ((select public.is_current_admin_aal2()));

create policy game_officials_admin_select
on public.game_officials for select to authenticated
using ((select public.is_current_admin_aal2()));

revoke all on public.game_team_staff from public, anon, authenticated;
revoke all on public.game_officials from public, anon, authenticated;
grant select on public.game_team_staff to authenticated;
grant select on public.game_officials to authenticated;
