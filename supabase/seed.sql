-- Deterministic staging/local fixtures. Supabase does not run seeds on production db push.
insert into public.competition_series (name, slug)
values ('Liga de Desenvolvimento', 'liga-de-desenvolvimento')
on conflict (slug) do update set name = excluded.name, is_active = true;

insert into public.categories (name, slug, has_advanced_stats)
values
  ('Sub-15', 'sub-15', true),
  ('Sub-17', 'sub-17', true)
on conflict (slug) do update
set name = excluded.name,
    has_advanced_stats = excluded.has_advanced_stats,
    is_active = true;

insert into public.competitions
  (series_id, category_id, year, display_name, status, published_at)
select s.id, c.id, fixture.year, fixture.display_name, 'published', now()
from public.competition_series s
join (
  values
    (2026::smallint, 'sub-15'::text, 'Liga de Desenvolvimento 2026 Sub-15'::text),
    (2026::smallint, 'sub-17'::text, 'Liga de Desenvolvimento 2026 Sub-17'::text),
    (2025::smallint, 'sub-15'::text, 'Liga de Desenvolvimento 2025 Sub-15'::text)
) as fixture(year, category_slug, display_name) on true
join public.categories c on c.slug = fixture.category_slug
where s.slug = 'liga-de-desenvolvimento'
on conflict (series_id, year, category_id) do update
set display_name = excluded.display_name,
    status = 'published',
    published_at = coalesce(public.competitions.published_at, excluded.published_at);

insert into public.teams (name, slug, abbreviation, is_public)
values
  ('Equipe Demonstracao Azul', 'equipe-demonstracao-azul', 'AZL', true),
  ('Equipe Demonstracao Dourada', 'equipe-demonstracao-dourada', 'DOU', true)
on conflict (slug) do update
set name = excluded.name,
    abbreviation = excluded.abbreviation,
    is_active = true,
    is_public = true;

insert into public.players (full_name, slug, is_public)
values
  ('Atleta Demonstracao Um', 'atleta-demonstracao-um', true),
  ('Atleta Demonstracao Dois', 'atleta-demonstracao-dois', true)
on conflict (slug) do update
set full_name = excluded.full_name,
    is_active = true,
    is_public = true;

insert into public.team_registrations
  (competition_id, team_id, status, confirmed_at)
select c.id, t.id, 'confirmed', now()
from public.competitions c
join public.competition_series s on s.id = c.series_id
cross join public.teams t
where s.slug = 'liga-de-desenvolvimento'
  and c.year in (2025, 2026)
  and t.slug in ('equipe-demonstracao-azul', 'equipe-demonstracao-dourada')
on conflict (competition_id, team_id) do update
set status = 'confirmed',
    confirmed_at = coalesce(public.team_registrations.confirmed_at, excluded.confirmed_at);

insert into public.roster_entries
  (competition_id, registration_id, player_id, jersey_number, status)
select
  registration.competition_id,
  registration.id,
  player.id,
  mapping.jersey_number,
  'active'
from (
  values
    ('equipe-demonstracao-azul'::text, 'atleta-demonstracao-um'::text, '00'::text),
    ('equipe-demonstracao-dourada'::text, 'atleta-demonstracao-dois'::text, '7'::text)
) as mapping(team_slug, player_slug, jersey_number)
join public.teams team on team.slug = mapping.team_slug
join public.players player on player.slug = mapping.player_slug
join public.team_registrations registration on registration.team_id = team.id
join public.competitions competition on competition.id = registration.competition_id
join public.competition_series series on series.id = competition.series_id
where series.slug = 'liga-de-desenvolvimento'
  and competition.year in (2025, 2026)
on conflict (registration_id, player_id) do update
set jersey_number = excluded.jersey_number,
    status = 'active';

insert into public.games (competition_id, game_number, status, venue, scheduled_at, source)
select
  competition.id,
  'DEMO-01',
  'scheduled',
  'Ginásio de demonstração',
  make_timestamptz(competition.year, 8, 15, 18, 0, 0, 'America/Sao_Paulo'),
  'seed'
from public.competitions competition
join public.competition_series series on series.id = competition.series_id
where series.slug = 'liga-de-desenvolvimento'
  and competition.year in (2025, 2026)
on conflict (competition_id, game_number) do update
set status = 'scheduled',
    venue = excluded.venue,
    scheduled_at = excluded.scheduled_at,
    source = excluded.source;

insert into public.game_participants (game_id, competition_id, registration_id, side)
select
  game.id,
  game.competition_id,
  registration.id,
  case team.slug
    when 'equipe-demonstracao-azul' then 'home'
    else 'away'
  end
from public.games game
join public.team_registrations registration
  on registration.competition_id = game.competition_id
join public.teams team on team.id = registration.team_id
where game.game_number = 'DEMO-01'
  and team.slug in ('equipe-demonstracao-azul', 'equipe-demonstracao-dourada')
on conflict (game_id, side) do update
set competition_id = excluded.competition_id,
    registration_id = excluded.registration_id;

-- Two isolated final-game fixtures for public statistics (2025 and 2026 Sub-15).
insert into public.games
  (competition_id, game_number, status, venue, scheduled_at, started_at, ended_at, source)
select
  competition.id,
  'STATS-01',
  'final',
  'Ginásio de estatísticas',
  make_timestamptz(competition.year, 8, 20, 18, 0, 0, 'America/Sao_Paulo'),
  make_timestamptz(competition.year, 8, 20, 18, 0, 0, 'America/Sao_Paulo'),
  make_timestamptz(competition.year, 8, 20, 19, 15, 0, 'America/Sao_Paulo'),
  'seed'
from public.competitions competition
join public.competition_series series on series.id = competition.series_id
join public.categories category on category.id = competition.category_id
where series.slug = 'liga-de-desenvolvimento'
  and category.slug = 'sub-15'
  and competition.year in (2025, 2026)
on conflict (competition_id, game_number) do update
set status = excluded.status,
    venue = excluded.venue,
    scheduled_at = excluded.scheduled_at,
    started_at = excluded.started_at,
    ended_at = excluded.ended_at,
    source = excluded.source;

insert into public.game_participants (game_id, competition_id, registration_id, side)
select
  game.id,
  game.competition_id,
  registration.id,
  case team.slug
    when 'equipe-demonstracao-azul' then 'home'
    else 'away'
  end
from public.games game
join public.team_registrations registration
  on registration.competition_id = game.competition_id
join public.teams team on team.id = registration.team_id
where game.game_number = 'STATS-01'
  and team.slug in ('equipe-demonstracao-azul', 'equipe-demonstracao-dourada')
on conflict (game_id, side) do update
set competition_id = excluded.competition_id,
    registration_id = excluded.registration_id;

insert into public.game_periods (game_id, period_number)
select game.id, period.period_number
from public.games game
cross join (values (1::smallint), (2::smallint), (3::smallint), (4::smallint)) period(period_number)
where game.game_number = 'STATS-01'
on conflict (game_id, period_number) do nothing;

insert into public.game_roster_slots
  (game_id, registration_id, slot_number, roster_entry_id, jersey_number, is_applicable)
select
  game.id,
  participant.registration_id,
  1,
  roster.id,
  roster.jersey_number,
  true
from public.games game
join public.game_participants participant on participant.game_id = game.id
join public.roster_entries roster
  on roster.registration_id = participant.registration_id
 and roster.competition_id = game.competition_id
where game.game_number = 'STATS-01'
  and roster.status = 'active'
on conflict (game_id, registration_id, slot_number) do update
set roster_entry_id = excluded.roster_entry_id,
    jersey_number = excluded.jersey_number,
    is_applicable = true;

insert into public.player_period_stats (
  game_roster_slot_id,
  game_id,
  period_number,
  seconds_played,
  two_point_made,
  two_point_attempted,
  three_point_made,
  three_point_attempted,
  free_throw_made,
  free_throw_attempted,
  offensive_rebounds,
  defensive_rebounds,
  assists,
  turnovers,
  steals,
  blocks,
  plus_minus
)
select
  slot.id,
  game.id,
  period.period_number,
  case when period.period_number = 1 then case when game_context.year = 2026 then 1200 else 900 end else 0 end,
  case when period.period_number = 1 then
    case when team.slug = 'equipe-demonstracao-azul' then case when game_context.year = 2026 then 2 else 1 end
         else case when game_context.year = 2026 then 1 else 0 end end
    else 0 end,
  case when period.period_number = 1 then
    case when team.slug = 'equipe-demonstracao-azul' then case when game_context.year = 2026 then 3 else 2 end
         else case when game_context.year = 2026 then 2 else 1 end end
    else 0 end,
  case when period.period_number = 1 then
    case when team.slug = 'equipe-demonstracao-azul' then case when game_context.year = 2026 then 1 else 0 end
         else 1 end
    else 0 end,
  case when period.period_number = 1 then
    case when team.slug = 'equipe-demonstracao-azul' then case when game_context.year = 2026 then 2 else 1 end
         else 2 end
    else 0 end,
  case when period.period_number = 1 and game_context.year = 2026 then 1 else 0 end,
  case when period.period_number = 1 then case when game_context.year = 2026 then 2 else 1 end else 0 end,
  case when period.period_number = 1 and team.slug = 'equipe-demonstracao-azul' and game_context.year = 2026 then 1 else 0 end,
  case when period.period_number = 1 then case when game_context.year = 2026 then 2 else 1 end else 0 end,
  case when period.period_number = 1 then case when team.slug = 'equipe-demonstracao-azul' and game_context.year = 2026 then 3 else 1 end else 0 end,
  case when period.period_number = 1 then 1 else 0 end,
  case when period.period_number = 1 and team.slug = 'equipe-demonstracao-azul' and game_context.year = 2026 then 2 else 0 end,
  case when period.period_number = 1 and team.slug = 'equipe-demonstracao-azul' and game_context.year = 2026 then 1 else 0 end,
  case when period.period_number = 1 then
    case when team.slug = 'equipe-demonstracao-azul' then case when game_context.year = 2026 then 5 else 1 end
         else case when game_context.year = 2026 then -5 else -1 end end
    else 0 end
from public.games game
join public.competitions game_context on game_context.id = game.competition_id
join public.game_roster_slots slot on slot.game_id = game.id and slot.is_applicable
join public.team_registrations registration on registration.id = slot.registration_id
join public.teams team on team.id = registration.team_id
join public.game_periods period on period.game_id = game.id
where game.game_number = 'STATS-01'
on conflict (game_roster_slot_id, period_number) do update
set seconds_played = excluded.seconds_played,
    two_point_made = excluded.two_point_made,
    two_point_attempted = excluded.two_point_attempted,
    three_point_made = excluded.three_point_made,
    three_point_attempted = excluded.three_point_attempted,
    free_throw_made = excluded.free_throw_made,
    free_throw_attempted = excluded.free_throw_attempted,
    offensive_rebounds = excluded.offensive_rebounds,
    defensive_rebounds = excluded.defensive_rebounds,
    assists = excluded.assists,
    turnovers = excluded.turnovers,
    steals = excluded.steals,
    blocks = excluded.blocks,
    plus_minus = excluded.plus_minus;

insert into public.game_period_scores (game_id, registration_id, period_number, points)
select
  stats.game_id,
  slot.registration_id,
  stats.period_number,
  sum(stats.points)::integer
from public.player_period_stats stats
join public.game_roster_slots slot
  on slot.id = stats.game_roster_slot_id
 and slot.game_id = stats.game_id
join public.games game on game.id = stats.game_id
where game.game_number = 'STATS-01'
group by stats.game_id, slot.registration_id, stats.period_number
on conflict (game_id, registration_id, period_number) do update
set points = excluded.points;
