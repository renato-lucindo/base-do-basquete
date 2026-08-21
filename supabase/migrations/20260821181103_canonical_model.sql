-- WP-04: canonical basketball model, integrity, RLS and private boxscore storage.

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function private.set_updated_at() from public, anon, authenticated;

create table public.competition_series (
  id bigint generated always as identity primary key,
  name text not null check (name = btrim(name) and char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id bigint generated always as identity primary key,
  name text not null check (name = btrim(name) and char_length(name) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  has_advanced_stats boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.competitions (
  id bigint generated always as identity primary key,
  series_id bigint not null references public.competition_series(id) on delete restrict,
  category_id bigint not null references public.categories(id) on delete restrict,
  year smallint not null check (year between 1900 and 2200),
  display_name text not null check (
    display_name = btrim(display_name) and char_length(display_name) between 2 and 160
  ),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  starts_on date,
  ends_on date,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint competitions_context_unique unique (series_id, year, category_id),
  constraint competitions_dates_ordered check (
    starts_on is null or ends_on is null or starts_on <= ends_on
  ),
  constraint competitions_publication_consistent check (
    (status = 'draft' and published_at is null) or
    (status in ('published', 'archived') and published_at is not null)
  )
);

create table public.teams (
  id bigint generated always as identity primary key,
  name text not null check (name = btrim(name) and char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  abbreviation text check (
    abbreviation is null or
    (abbreviation = upper(btrim(abbreviation)) and abbreviation ~ '^[A-Z0-9]{2,8}$')
  ),
  is_active boolean not null default true,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.players (
  id bigint generated always as identity primary key,
  full_name text not null check (
    full_name = btrim(full_name) and char_length(full_name) between 2 and 160
  ),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  birth_date date,
  is_active boolean not null default true,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.team_registrations (
  id bigint generated always as identity primary key,
  competition_id bigint not null references public.competitions(id) on delete restrict,
  team_id bigint not null references public.teams(id) on delete restrict,
  status text not null default 'draft' check (
    status in ('draft', 'confirmed', 'withdrawn', 'completed')
  ),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_registrations_competition_team_unique unique (competition_id, team_id),
  constraint team_registrations_id_competition_unique unique (id, competition_id),
  constraint team_registrations_confirmation_consistent check (
    (status = 'draft' and confirmed_at is null) or
    (status <> 'draft' and confirmed_at is not null)
  )
);

create table public.roster_entries (
  id bigint generated always as identity primary key,
  competition_id bigint not null,
  registration_id bigint not null,
  player_id bigint not null references public.players(id) on delete restrict,
  jersey_number text check (
    jersey_number is null or jersey_number ~ '^(?:0|00|[1-9][0-9]?)$'
  ),
  status text not null default 'active' check (status in ('active', 'inactive')),
  joined_on date,
  left_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roster_entries_registration_competition_fkey
    foreign key (registration_id, competition_id)
    references public.team_registrations(id, competition_id) on delete restrict,
  constraint roster_entries_registration_player_unique unique (registration_id, player_id),
  constraint roster_entries_id_registration_unique unique (id, registration_id),
  constraint roster_entries_id_competition_unique unique (id, competition_id),
  constraint roster_entries_dates_ordered check (
    joined_on is null or left_on is null or joined_on <= left_on
  )
);

create unique index roster_entries_active_competition_player_uidx
on public.roster_entries (competition_id, player_id)
where status = 'active';

create unique index roster_entries_active_registration_jersey_uidx
on public.roster_entries (registration_id, jersey_number)
where status = 'active' and jersey_number is not null;

create table public.games (
  id bigint generated always as identity primary key,
  competition_id bigint not null references public.competitions(id) on delete restrict,
  game_number text check (
    game_number is null or
    (game_number = btrim(game_number) and char_length(game_number) between 1 and 40)
  ),
  scheduled_at timestamptz,
  venue text check (venue is null or (venue = btrim(venue) and char_length(venue) <= 160)),
  status text not null default 'draft' check (
    status in ('draft', 'scheduled', 'live', 'final', 'cancelled')
  ),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint games_id_competition_unique unique (id, competition_id),
  constraint games_competition_number_unique unique (competition_id, game_number),
  constraint games_times_ordered check (
    started_at is null or ended_at is null or started_at <= ended_at
  )
);

create table public.game_participants (
  game_id bigint not null,
  competition_id bigint not null,
  registration_id bigint not null,
  side text not null check (side in ('home', 'away')),
  primary key (game_id, side),
  constraint game_participants_game_registration_unique unique (game_id, registration_id),
  constraint game_participants_game_competition_fkey
    foreign key (game_id, competition_id)
    references public.games(id, competition_id) on delete restrict,
  constraint game_participants_registration_competition_fkey
    foreign key (registration_id, competition_id)
    references public.team_registrations(id, competition_id) on delete restrict
);

create table public.game_periods (
  game_id bigint not null references public.games(id) on delete restrict,
  period_number smallint not null check (period_number > 0),
  started_at timestamptz,
  ended_at timestamptz,
  primary key (game_id, period_number),
  constraint game_periods_times_ordered check (
    started_at is null or ended_at is null or started_at <= ended_at
  )
);

create table public.game_period_scores (
  game_id bigint not null,
  registration_id bigint not null,
  period_number smallint not null,
  points integer not null default 0 check (points >= 0),
  primary key (game_id, registration_id, period_number),
  constraint game_period_scores_participant_fkey
    foreign key (game_id, registration_id)
    references public.game_participants(game_id, registration_id) on delete restrict,
  constraint game_period_scores_period_fkey
    foreign key (game_id, period_number)
    references public.game_periods(game_id, period_number) on delete restrict
);

create table public.game_roster_slots (
  id bigint generated always as identity primary key,
  game_id bigint not null,
  registration_id bigint not null,
  slot_number smallint not null check (slot_number between 1 and 12),
  roster_entry_id bigint,
  jersey_number text check (
    jersey_number is null or jersey_number ~ '^(?:0|00|[1-9][0-9]?)$'
  ),
  is_applicable boolean not null default true,
  is_starter boolean not null default false,
  is_captain boolean not null default false,
  did_not_play boolean not null default false,
  created_at timestamptz not null default now(),
  constraint game_roster_slots_game_participant_fkey
    foreign key (game_id, registration_id)
    references public.game_participants(game_id, registration_id) on delete restrict,
  constraint game_roster_slots_roster_registration_fkey
    foreign key (roster_entry_id, registration_id)
    references public.roster_entries(id, registration_id) on delete restrict,
  constraint game_roster_slots_game_registration_slot_unique
    unique (game_id, registration_id, slot_number),
  constraint game_roster_slots_id_game_unique unique (id, game_id),
  constraint game_roster_slots_applicability_consistent check (
    (is_applicable and roster_entry_id is not null and jersey_number is not null) or
    (not is_applicable and roster_entry_id is null and jersey_number is null and
      not is_starter and not is_captain and not did_not_play)
  )
);

create unique index game_roster_slots_game_player_uidx
on public.game_roster_slots (game_id, roster_entry_id)
where roster_entry_id is not null;

create unique index game_roster_slots_game_registration_jersey_uidx
on public.game_roster_slots (game_id, registration_id, jersey_number)
where is_applicable and jersey_number is not null;

create table public.player_period_stats (
  game_roster_slot_id bigint not null,
  game_id bigint not null,
  period_number smallint not null,
  seconds_played integer not null default 0 check (seconds_played >= 0),
  two_point_made smallint not null default 0 check (two_point_made >= 0),
  two_point_attempted smallint not null default 0 check (
    two_point_attempted >= 0 and two_point_made <= two_point_attempted
  ),
  three_point_made smallint not null default 0 check (three_point_made >= 0),
  three_point_attempted smallint not null default 0 check (
    three_point_attempted >= 0 and three_point_made <= three_point_attempted
  ),
  free_throw_made smallint not null default 0 check (free_throw_made >= 0),
  free_throw_attempted smallint not null default 0 check (
    free_throw_attempted >= 0 and free_throw_made <= free_throw_attempted
  ),
  offensive_rebounds smallint not null default 0 check (offensive_rebounds >= 0),
  defensive_rebounds smallint not null default 0 check (defensive_rebounds >= 0),
  assists smallint not null default 0 check (assists >= 0),
  turnovers smallint not null default 0 check (turnovers >= 0),
  steals smallint not null default 0 check (steals >= 0),
  blocks smallint not null default 0 check (blocks >= 0),
  plus_minus smallint not null default 0,
  points smallint generated always as (
    (two_point_made * 2) + (three_point_made * 3) + free_throw_made
  ) stored,
  primary key (game_roster_slot_id, period_number),
  constraint player_period_stats_slot_game_fkey
    foreign key (game_roster_slot_id, game_id)
    references public.game_roster_slots(id, game_id) on delete restrict,
  constraint player_period_stats_period_fkey
    foreign key (game_id, period_number)
    references public.game_periods(game_id, period_number) on delete restrict
);

create table public.foul_events (
  id bigint generated always as identity primary key,
  game_roster_slot_id bigint not null,
  game_id bigint not null,
  period_number smallint not null,
  sequence_number smallint not null check (sequence_number > 0),
  elapsed_seconds integer check (elapsed_seconds is null or elapsed_seconds >= 0),
  foul_code text not null check (foul_code in ('P', 'T', 'U', 'U2', 'D')),
  created_at timestamptz not null default now(),
  constraint foul_events_slot_game_fkey
    foreign key (game_roster_slot_id, game_id)
    references public.game_roster_slots(id, game_id) on delete restrict,
  constraint foul_events_period_fkey
    foreign key (game_id, period_number)
    references public.game_periods(game_id, period_number) on delete restrict,
  constraint foul_events_slot_period_sequence_unique
    unique (game_roster_slot_id, period_number, sequence_number)
);

create table public.boxscore_imports (
  id bigint generated always as identity primary key,
  competition_id bigint not null references public.competitions(id) on delete restrict,
  game_id bigint,
  sha256 text not null unique check (sha256 ~ '^[0-9a-f]{64}$'),
  storage_path text not null unique check (
    storage_path = btrim(storage_path) and char_length(storage_path) between 1 and 512
  ),
  parser_version text not null check (
    parser_version = btrim(parser_version) and char_length(parser_version) between 1 and 40
  ),
  status text not null default 'uploaded' check (
    status in ('uploaded', 'extracted', 'review', 'confirmed', 'failed')
  ),
  error_code text check (
    error_code is null or error_code ~ '^[A-Z][A-Z0-9_]{2,63}$'
  ),
  created_by uuid not null references auth.users(id) on delete restrict
    deferrable initially immediate,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boxscore_imports_id_competition_unique unique (id, competition_id),
  constraint boxscore_imports_game_competition_fkey
    foreign key (game_id, competition_id)
    references public.games(id, competition_id) on delete restrict,
  constraint boxscore_imports_confirmation_consistent check (
    (status = 'confirmed' and confirmed_at is not null and game_id is not null) or
    (status <> 'confirmed' and confirmed_at is null)
  )
);

create table public.boxscore_import_player_matches (
  id bigint generated always as identity primary key,
  import_id bigint not null,
  competition_id bigint not null,
  source_team_name text not null check (
    source_team_name = btrim(source_team_name) and char_length(source_team_name) between 1 and 160
  ),
  source_player_name text not null check (
    source_player_name = btrim(source_player_name) and char_length(source_player_name) between 1 and 160
  ),
  roster_entry_id bigint,
  status text not null default 'unmatched' check (
    status in ('unmatched', 'suggested', 'confirmed', 'rejected')
  ),
  decided_by uuid references auth.users(id) on delete restrict deferrable initially immediate,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boxscore_import_player_matches_import_competition_fkey
    foreign key (import_id, competition_id)
    references public.boxscore_imports(id, competition_id) on delete restrict,
  constraint boxscore_import_player_matches_roster_competition_fkey
    foreign key (roster_entry_id, competition_id)
    references public.roster_entries(id, competition_id) on delete restrict,
  constraint boxscore_import_player_matches_source_unique
    unique (import_id, source_team_name, source_player_name),
  constraint boxscore_import_player_matches_decision_consistent check (
    (status in ('confirmed', 'rejected') and decided_by is not null and decided_at is not null) or
    (status in ('unmatched', 'suggested') and decided_by is null and decided_at is null)
  ),
  constraint boxscore_import_player_matches_roster_consistent check (
    (status = 'confirmed' and roster_entry_id is not null) or status <> 'confirmed'
  )
);

create table public.final_placements (
  id bigint generated always as identity primary key,
  competition_id bigint not null,
  registration_id bigint not null,
  placement smallint not null check (placement > 0),
  result_label text check (
    result_label is null or
    (result_label = btrim(result_label) and char_length(result_label) between 2 and 80)
  ),
  confirmed_by uuid references auth.users(id) on delete restrict deferrable initially immediate,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint final_placements_registration_competition_fkey
    foreign key (registration_id, competition_id)
    references public.team_registrations(id, competition_id) on delete restrict,
  constraint final_placements_competition_registration_unique
    unique (competition_id, registration_id),
  constraint final_placements_competition_place_unique unique (competition_id, placement),
  constraint final_placements_confirmation_consistent check (
    (confirmed_by is null and confirmed_at is null) or
    (confirmed_by is not null and confirmed_at is not null)
  )
);

-- Scores and achievements are derived so application code cannot persist conflicting totals.
create view public.game_scores
with (security_invoker = true)
as
select
  gp.game_id,
  gp.competition_id,
  gp.registration_id,
  gp.side,
  coalesce(sum(gps.points), 0)::integer as score
from public.game_participants gp
left join public.game_period_scores gps
  on gps.game_id = gp.game_id and gps.registration_id = gp.registration_id
group by gp.game_id, gp.competition_id, gp.registration_id, gp.side;

create view public.team_achievements
with (security_invoker = true)
as
select
  fp.competition_id,
  fp.registration_id,
  tr.team_id,
  fp.placement,
  fp.result_label,
  fp.confirmed_at
from public.final_placements fp
join public.team_registrations tr on tr.id = fp.registration_id
where fp.confirmed_at is not null;

create view public.player_achievements
with (security_invoker = true)
as
select
  fp.competition_id,
  fp.registration_id,
  re.player_id,
  fp.placement,
  fp.result_label,
  fp.confirmed_at
from public.final_placements fp
join public.roster_entries re
  on re.registration_id = fp.registration_id and re.competition_id = fp.competition_id
where fp.confirmed_at is not null;

-- Foreign-key and contextual read indexes not already covered by unique indexes.
create index competitions_category_id_idx on public.competitions (category_id);
create index teams_name_idx on public.teams (name);
create index players_full_name_idx on public.players (full_name);
create index team_registrations_team_id_idx on public.team_registrations (team_id);
create index roster_entries_player_id_idx on public.roster_entries (player_id);
create index games_competition_scheduled_idx on public.games (competition_id, scheduled_at desc);
create index game_participants_registration_id_idx on public.game_participants (registration_id);
create index game_period_scores_registration_id_idx on public.game_period_scores (registration_id);
create index game_roster_slots_registration_id_idx on public.game_roster_slots (registration_id);
create index player_period_stats_game_period_idx on public.player_period_stats (game_id, period_number);
create index foul_events_game_period_idx on public.foul_events (game_id, period_number);
create index boxscore_imports_competition_created_idx
  on public.boxscore_imports (competition_id, created_at desc);
create index boxscore_imports_game_id_idx on public.boxscore_imports (game_id) where game_id is not null;
create index boxscore_imports_created_by_idx on public.boxscore_imports (created_by);
create index boxscore_import_player_matches_roster_entry_id_idx
  on public.boxscore_import_player_matches (roster_entry_id)
  where roster_entry_id is not null;
create index boxscore_import_player_matches_competition_id_idx
  on public.boxscore_import_player_matches (competition_id);
create index boxscore_import_player_matches_decided_by_idx
  on public.boxscore_import_player_matches (decided_by)
  where decided_by is not null;
create index final_placements_registration_id_idx on public.final_placements (registration_id);
create index final_placements_confirmed_by_idx
  on public.final_placements (confirmed_by)
  where confirmed_by is not null;
create index roster_entries_registration_competition_idx
  on public.roster_entries (registration_id, competition_id);
create index game_participants_game_competition_idx
  on public.game_participants (game_id, competition_id);
create index game_participants_registration_competition_idx
  on public.game_participants (registration_id, competition_id);
create index game_period_scores_game_period_idx
  on public.game_period_scores (game_id, period_number);
create index game_roster_slots_roster_registration_idx
  on public.game_roster_slots (roster_entry_id, registration_id);
create index player_period_stats_slot_game_idx
  on public.player_period_stats (game_roster_slot_id, game_id);
create index foul_events_slot_game_idx
  on public.foul_events (game_roster_slot_id, game_id);
create index boxscore_imports_game_competition_idx
  on public.boxscore_imports (game_id, competition_id);
create index boxscore_import_matches_import_competition_idx
  on public.boxscore_import_player_matches (import_id, competition_id);
create index boxscore_import_matches_roster_competition_idx
  on public.boxscore_import_player_matches (roster_entry_id, competition_id);
create index final_placements_registration_competition_idx
  on public.final_placements (registration_id, competition_id);

-- Keep mutable records timestamped without granting direct access to the trigger function.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'competition_series', 'categories', 'competitions', 'teams', 'players',
    'team_registrations', 'roster_entries', 'games', 'boxscore_imports',
    'boxscore_import_player_matches', 'final_placements'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function private.set_updated_at()',
      table_name || '_set_updated_at',
      table_name
    );
  end loop;
end;
$$;

-- RLS is forced on all application tables. Public policies expose only published data.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'competition_series', 'categories', 'competitions', 'teams', 'players',
    'team_registrations', 'roster_entries', 'games', 'game_participants',
    'game_periods', 'game_period_scores', 'game_roster_slots', 'player_period_stats',
    'foul_events', 'boxscore_imports', 'boxscore_import_player_matches', 'final_placements'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select public.is_current_admin_aal2()))',
      table_name || '_admin_select',
      table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select public.is_current_admin_aal2()))',
      table_name || '_admin_insert',
      table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select public.is_current_admin_aal2())) with check ((select public.is_current_admin_aal2()))',
      table_name || '_admin_update',
      table_name
    );
  end loop;
end;
$$;

create policy competition_series_public_select
on public.competition_series for select to anon
using (is_active);

create policy categories_public_select
on public.categories for select to anon
using (is_active);

create policy competitions_public_select
on public.competitions for select to anon
using (status in ('published', 'archived'));

create policy teams_public_select
on public.teams for select to anon
using (is_public);

create policy players_public_select
on public.players for select to anon
using (is_public);

create policy team_registrations_public_select
on public.team_registrations for select to anon
using (
  status in ('confirmed', 'completed') and
  exists (
    select 1 from public.competitions c
    where c.id = competition_id and c.status in ('published', 'archived')
  )
);

create policy roster_entries_public_select
on public.roster_entries for select to anon
using (
  exists (
    select 1 from public.team_registrations tr
    where tr.id = registration_id and tr.status in ('confirmed', 'completed')
  )
);

create policy games_public_select
on public.games for select to anon
using (
  status in ('scheduled', 'live', 'final') and
  exists (
    select 1 from public.competitions c
    where c.id = competition_id and c.status in ('published', 'archived')
  )
);

create policy game_participants_public_select
on public.game_participants for select to anon
using (exists (select 1 from public.games g where g.id = game_id));

create policy game_periods_public_select
on public.game_periods for select to anon
using (exists (select 1 from public.games g where g.id = game_id));

create policy game_period_scores_public_select
on public.game_period_scores for select to anon
using (exists (select 1 from public.games g where g.id = game_id));

create policy game_roster_slots_public_select
on public.game_roster_slots for select to anon
using (exists (select 1 from public.games g where g.id = game_id));

create policy player_period_stats_public_select
on public.player_period_stats for select to anon
using (exists (select 1 from public.games g where g.id = game_id));

create policy foul_events_public_select
on public.foul_events for select to anon
using (exists (select 1 from public.games g where g.id = game_id));

create policy final_placements_public_select
on public.final_placements for select to anon
using (
  confirmed_at is not null and
  exists (
    select 1 from public.competitions c
    where c.id = competition_id and c.status in ('published', 'archived')
  )
);

-- Neutralize legacy/default grants before exposing the deliberate API surface below.
revoke all on public.competition_series, public.categories, public.competitions,
  public.teams, public.players, public.team_registrations, public.roster_entries,
  public.games, public.game_participants, public.game_periods, public.game_period_scores,
  public.game_roster_slots, public.player_period_stats, public.foul_events,
  public.boxscore_imports, public.boxscore_import_player_matches,
  public.final_placements from public, anon, authenticated;

revoke all on public.game_scores, public.team_achievements,
  public.player_achievements from public, anon, authenticated;

revoke all on all sequences in schema public from public, anon, authenticated;

grant select on public.competition_series, public.categories, public.competitions,
  public.teams, public.players, public.team_registrations, public.roster_entries,
  public.games, public.game_participants, public.game_periods, public.game_period_scores,
  public.game_roster_slots, public.player_period_stats, public.foul_events,
  public.final_placements to anon, authenticated;

grant select on public.game_scores, public.team_achievements,
  public.player_achievements to anon, authenticated;

grant select, insert, update on public.boxscore_imports,
  public.boxscore_import_player_matches to authenticated;

grant insert, update on public.competition_series, public.categories, public.competitions,
  public.teams, public.players, public.team_registrations, public.roster_entries,
  public.games, public.game_participants, public.game_periods, public.game_period_scores,
  public.game_roster_slots, public.player_period_stats, public.foul_events,
  public.final_placements to authenticated;

grant usage, select on all sequences in schema public to authenticated;

-- Private bucket for the single supported FIBA/Genius Sports PDF format.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('boxscore-pdfs', 'boxscore-pdfs', false, 10485760, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy boxscore_pdfs_admin_select
on storage.objects for select to authenticated
using (bucket_id = 'boxscore-pdfs' and (select public.is_current_admin_aal2()));

create policy boxscore_pdfs_admin_insert
on storage.objects for insert to authenticated
with check (bucket_id = 'boxscore-pdfs' and (select public.is_current_admin_aal2()));

create policy boxscore_pdfs_admin_update
on storage.objects for update to authenticated
using (bucket_id = 'boxscore-pdfs' and (select public.is_current_admin_aal2()))
with check (bucket_id = 'boxscore-pdfs' and (select public.is_current_admin_aal2()));

comment on table public.competition_series is 'Generic championships independent of year/category.';
comment on table public.competitions is 'One edition identified by series, year and category.';
comment on table public.game_participants is 'Single source of truth for home/away registrations; score is derived from period scores.';
comment on table public.game_roster_slots is 'Twelve ordered slots per game participant; N/A slots remain explicit.';
comment on table public.final_placements is 'Confirmed placements; team and player achievements are derived from these rows.';
comment on view public.game_scores is 'Authoritative game scores derived from per-period scores.';
comment on view public.team_achievements is 'Team achievements derived from confirmed final placements.';
comment on view public.player_achievements is 'Player achievements derived from confirmed final placements and rosters.';
