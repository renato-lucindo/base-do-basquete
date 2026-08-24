-- WP-15 / PR 1: public player profiles, private identity data and safe aggregates.

alter table public.players
  add column nickname text,
  add constraint players_nickname_check check (
    nickname is null or
    (nickname = btrim(nickname) and char_length(nickname) between 1 and 80)
  );

create index players_nickname_lower_idx
  on public.players (lower(nickname))
  where nickname is not null;

create table public.player_profiles (
  player_id bigint primary key references public.players(id) on delete restrict,
  birth_year smallint check (birth_year is null or birth_year between 1900 and 2200),
  bio text check (
    bio is null or (bio = btrim(bio) and char_length(bio) between 1 and 2000)
  ),
  height_cm smallint check (height_cm is null or height_cm between 50 and 260),
  weight_kg numeric(5,2) check (weight_kg is null or weight_kg between 20 and 300),
  main_position text check (
    main_position is null or
    (main_position = btrim(main_position) and char_length(main_position) between 1 and 40)
  ),
  hand text check (
    hand is null or (hand = btrim(hand) and char_length(hand) between 1 and 30)
  ),
  home_city text check (
    home_city is null or (home_city = btrim(home_city) and char_length(home_city) between 1 and 120)
  ),
  home_state text check (
    home_state is null or
    (home_state = btrim(home_state) and char_length(home_state) between 2 and 80)
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.player_private (
  player_id bigint primary key references public.players(id) on delete restrict,
  birth_date date,
  federation_no text check (
    federation_no is null or
    (federation_no = btrim(federation_no) and char_length(federation_no) between 1 and 80)
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.player_profiles (player_id, birth_year)
select id, extract(year from birth_date)::smallint
from public.players;

insert into private.player_private (player_id, birth_date)
select id, birth_date
from public.players
where birth_date is not null;

alter table public.players drop column birth_date;

alter table public.roster_entries
  add column position text,
  add constraint roster_entries_position_check check (
    position is null or
    (position = btrim(position) and char_length(position) between 1 and 40)
  );

create table public.player_honors (
  id bigint generated always as identity primary key,
  player_id bigint not null references public.players(id) on delete restrict,
  competition_id bigint references public.competitions(id) on delete restrict,
  title text not null check (
    title = btrim(title) and char_length(title) between 2 and 120
  ),
  description text check (
    description is null or
    (description = btrim(description) and char_length(description) between 1 and 1000)
  ),
  year smallint check (year is null or year between 1900 and 2200),
  status text not null default 'draft' check (status in ('draft', 'confirmed')),
  confirmed_by uuid references auth.users(id) on delete restrict deferrable initially immediate,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_honors_confirmation_consistent check (
    (status = 'draft' and confirmed_by is null and confirmed_at is null) or
    (status = 'confirmed' and confirmed_by is not null and confirmed_at is not null)
  )
);

create index player_honors_player_year_idx
  on public.player_honors (player_id, year desc nulls last);
create index player_honors_competition_idx
  on public.player_honors (competition_id)
  where competition_id is not null;
create index player_honors_confirmed_by_idx
  on public.player_honors (confirmed_by)
  where confirmed_by is not null;
create index player_profiles_birth_year_idx
  on public.player_profiles (birth_year)
  where birth_year is not null;

create trigger player_profiles_set_updated_at
before update on public.player_profiles
for each row execute function private.set_updated_at();

create trigger player_private_set_updated_at
before update on private.player_private
for each row execute function private.set_updated_at();

create trigger player_honors_set_updated_at
before update on public.player_honors
for each row execute function private.set_updated_at();

alter table public.player_profiles enable row level security;
alter table public.player_profiles force row level security;
alter table public.player_honors enable row level security;
alter table public.player_honors force row level security;
alter table private.player_private enable row level security;
alter table private.player_private force row level security;

create policy player_profiles_admin_select
on public.player_profiles for select to authenticated
using ((select public.is_current_admin_aal2()));

create policy player_profiles_admin_insert
on public.player_profiles for insert to authenticated
with check ((select public.is_current_admin_aal2()));

create policy player_profiles_admin_update
on public.player_profiles for update to authenticated
using ((select public.is_current_admin_aal2()))
with check ((select public.is_current_admin_aal2()));

create policy player_profiles_public_select
on public.player_profiles for select to anon
using (exists (
  select 1 from public.players player
  where player.id = player_id and player.is_public
));

create policy player_honors_admin_select
on public.player_honors for select to authenticated
using ((select public.is_current_admin_aal2()));

create policy player_honors_admin_insert
on public.player_honors for insert to authenticated
with check ((select public.is_current_admin_aal2()));

create policy player_honors_admin_update
on public.player_honors for update to authenticated
using ((select public.is_current_admin_aal2()))
with check ((select public.is_current_admin_aal2()));

create policy player_honors_public_select
on public.player_honors for select to anon
using (
  status = 'confirmed' and confirmed_at is not null and
  exists (
    select 1 from public.players player
    where player.id = player_id and player.is_public
  ) and
  (
    competition_id is null or exists (
      select 1 from public.competitions competition
      where competition.id = competition_id
        and competition.status in ('published', 'archived')
    )
  )
);

revoke all on public.player_profiles, public.player_honors
  from public, anon, authenticated;
revoke all on private.player_private from public, anon, authenticated;

grant select on public.player_profiles, public.player_honors to anon, authenticated;
grant insert, update on public.player_profiles, public.player_honors to authenticated;
grant usage, select on sequence public.player_honors_id_seq to authenticated;

create view public.public_player_profiles
with (security_invoker = true)
as
select
  player.id,
  player.full_name,
  player.slug,
  player.nickname,
  player.is_active,
  player.is_public,
  profile.birth_year,
  profile.bio,
  profile.height_cm,
  profile.weight_kg,
  profile.main_position,
  profile.hand,
  profile.home_city,
  profile.home_state,
  player.created_at,
  greatest(player.updated_at, coalesce(profile.updated_at, player.updated_at)) as updated_at
from public.players player
left join public.player_profiles profile on profile.player_id = player.id;

revoke all on public.public_player_profiles from public, anon, authenticated;
grant select on public.public_player_profiles to anon, authenticated;

create or replace view public.competition_player_statistics
with (security_invoker = true)
as
with eligible_slots as (
  select
    game.competition_id,
    game.id as game_id,
    slot.id as game_roster_slot_id,
    slot.registration_id,
    slot.is_starter,
    roster.player_id
  from public.games game
  join public.game_roster_slots slot on slot.game_id = game.id
  join public.roster_entries roster
    on roster.id = slot.roster_entry_id
   and roster.registration_id = slot.registration_id
  where game.status = 'final'
    and slot.is_applicable
    and not slot.did_not_play
), participation_totals as (
  select
    competition_id,
    player_id,
    count(distinct game_id)::bigint as games_played,
    count(distinct game_id) filter (where is_starter)::bigint as starter_appearances
  from eligible_slots
  group by competition_id, player_id
), stat_totals as (
  select
    eligible.competition_id,
    eligible.player_id,
    sum(stats.seconds_played)::bigint as seconds_played,
    sum(stats.two_point_made)::bigint as two_point_made,
    sum(stats.two_point_attempted)::bigint as two_point_attempted,
    sum(stats.three_point_made)::bigint as three_point_made,
    sum(stats.three_point_attempted)::bigint as three_point_attempted,
    sum(stats.free_throw_made)::bigint as free_throw_made,
    sum(stats.free_throw_attempted)::bigint as free_throw_attempted,
    sum(stats.offensive_rebounds)::bigint as offensive_rebounds,
    sum(stats.defensive_rebounds)::bigint as defensive_rebounds,
    sum(stats.assists)::bigint as assists,
    sum(stats.turnovers)::bigint as turnovers,
    sum(stats.steals)::bigint as steals,
    sum(stats.blocks)::bigint as blocks,
    sum(stats.plus_minus)::bigint as plus_minus,
    sum(stats.points)::bigint as points
  from eligible_slots eligible
  join public.player_period_stats stats
    on stats.game_id = eligible.game_id
   and stats.game_roster_slot_id = eligible.game_roster_slot_id
  group by eligible.competition_id, eligible.player_id
), foul_totals as (
  select
    eligible.competition_id,
    eligible.player_id,
    count(*)::bigint as fouls
  from eligible_slots eligible
  join public.foul_events foul
    on foul.game_id = eligible.game_id
   and foul.game_roster_slot_id = eligible.game_roster_slot_id
  group by eligible.competition_id, eligible.player_id
), roster_ranked as (
  select
    roster.competition_id,
    roster.player_id,
    roster.registration_id,
    registration.team_id,
    team.name as team_name,
    team.slug as team_slug,
    team.abbreviation as team_abbreviation,
    roster.jersey_number,
    roster.position as roster_position,
    row_number() over (
      partition by roster.competition_id, roster.player_id
      order by (roster.status = 'active') desc, roster.updated_at desc, roster.id desc
    ) as context_rank
  from public.roster_entries roster
  join public.team_registrations registration
    on registration.id = roster.registration_id
   and registration.competition_id = roster.competition_id
  join public.teams team on team.id = registration.team_id
), roster_context as (
  select * from roster_ranked where context_rank = 1
)
select
  participation.competition_id,
  participation.player_id,
  player.full_name as player_name,
  player.slug as player_slug,
  participation.games_played,
  coalesce(stats.seconds_played, 0)::bigint as seconds_played,
  coalesce(stats.two_point_made, 0)::bigint as two_point_made,
  coalesce(stats.two_point_attempted, 0)::bigint as two_point_attempted,
  coalesce(stats.three_point_made, 0)::bigint as three_point_made,
  coalesce(stats.three_point_attempted, 0)::bigint as three_point_attempted,
  coalesce(stats.free_throw_made, 0)::bigint as free_throw_made,
  coalesce(stats.free_throw_attempted, 0)::bigint as free_throw_attempted,
  coalesce(stats.offensive_rebounds, 0)::bigint as offensive_rebounds,
  coalesce(stats.defensive_rebounds, 0)::bigint as defensive_rebounds,
  coalesce(stats.assists, 0)::bigint as assists,
  coalesce(stats.turnovers, 0)::bigint as turnovers,
  coalesce(stats.steals, 0)::bigint as steals,
  coalesce(stats.blocks, 0)::bigint as blocks,
  coalesce(stats.plus_minus, 0)::bigint as plus_minus,
  coalesce(stats.points, 0)::bigint as points,
  player.nickname as player_nickname,
  roster.registration_id,
  roster.team_id,
  roster.team_name,
  roster.team_slug,
  roster.team_abbreviation,
  roster.jersey_number,
  roster.roster_position,
  participation.starter_appearances,
  coalesce(foul.fouls, 0)::bigint as fouls
from participation_totals participation
join public.players player on player.id = participation.player_id
join roster_context roster
  on roster.competition_id = participation.competition_id
 and roster.player_id = participation.player_id
left join stat_totals stats
  on stats.competition_id = participation.competition_id
 and stats.player_id = participation.player_id
left join foul_totals foul
  on foul.competition_id = participation.competition_id
 and foul.player_id = participation.player_id;

revoke all on public.competition_player_statistics from public, anon, authenticated;
grant select on public.competition_player_statistics to anon, authenticated;

comment on column public.players.nickname is
  'Optional public and non-unique nickname used by profile and search.';
comment on table public.player_profiles is
  'Optional public-by-default biographical fields in a one-to-one player profile.';
comment on table private.player_private is
  'Non-exposed full birth date and federation registration for one player.';
comment on table public.player_honors is
  'Manual individual honors; anonymous access is restricted to confirmed rows.';
comment on view public.public_player_profiles is
  'Safe public player facade that never includes the full birth date or federation number.';
comment on view public.competition_player_statistics is
  'Edition aggregates built from separate participation, statistic and foul totals.';

