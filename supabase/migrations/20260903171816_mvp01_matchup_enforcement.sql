create function private.enforce_matchup_bound_game()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.matchup_id is null
    and coalesce(current_setting('bdb.allow_internal_ingestion_game', true), '') <> 'on'
  then
    raise exception using errcode = 'BD710', message = 'BDB_GAME_MATCHUP_REQUIRED';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_matchup_bound_game()
from public, anon, authenticated;

create trigger games_require_matchup_for_application
before insert or update of matchup_id, competition_id on public.games
for each row execute function private.enforce_matchup_bound_game();

create function private.validate_game_matchup_participants()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  checked_game_id bigint;
  selected_matchup public.matchups;
  home_registration_id bigint;
  away_registration_id bigint;
  participant_count integer;
begin
  if tg_table_name = 'games' then
    checked_game_id := case when tg_op = 'DELETE' then old.id else new.id end;
  else
    checked_game_id := case when tg_op = 'DELETE' then old.game_id else new.game_id end;
  end if;
  if coalesce(current_setting('bdb.allow_internal_ingestion_game', true), '') = 'on' then
    return null;
  end if;
  select matchup.* into selected_matchup
  from public.games game
  join public.matchups matchup on matchup.id = game.matchup_id
  where game.id = checked_game_id;
  if not found then
    if exists (select 1 from public.games game where game.id = checked_game_id) then
      raise exception using errcode = 'BD710', message = 'BDB_GAME_MATCHUP_REQUIRED';
    end if;
    return null;
  end if;

  select
    count(*),
    max(participant.registration_id) filter (where participant.side = 'home'),
    max(participant.registration_id) filter (where participant.side = 'away')
  into participant_count, home_registration_id, away_registration_id
  from public.game_participants participant
  where participant.game_id = checked_game_id;

  if participant_count <> 2 or not (
    home_registration_id = selected_matchup.home_registration_id
    and away_registration_id = selected_matchup.away_registration_id
  ) and not (
    selected_matchup.allow_side_inversion
    and home_registration_id = selected_matchup.away_registration_id
    and away_registration_id = selected_matchup.home_registration_id
  ) then
    raise exception using errcode = 'BD712', message = 'BDB_GAME_PARTICIPANTS_MISMATCH';
  end if;
  return null;
end;
$$;

revoke all on function private.validate_game_matchup_participants()
from public, anon, authenticated;

create constraint trigger games_validate_matchup_participants
after insert or update on public.games
deferrable initially deferred
for each row execute function private.validate_game_matchup_participants();

create constraint trigger game_participants_validate_matchup
after insert or update or delete on public.game_participants
deferrable initially deferred
for each row execute function private.validate_game_matchup_participants();

comment on function private.enforce_matchup_bound_game() is
  'Rejects application-created games without a structural matchup while retaining historical nullable rows.';
comment on function private.validate_game_matchup_participants() is
  'Deferred invariant requiring exactly the two evidenced matchup registrations, with explicit inversion only.';
