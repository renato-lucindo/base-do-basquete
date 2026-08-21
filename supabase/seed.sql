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

insert into public.games (competition_id, game_number, status, venue, scheduled_at)
select
  competition.id,
  'DEMO-01',
  'scheduled',
  'Ginásio de demonstração',
  make_timestamptz(competition.year, 8, 15, 18, 0, 0, 'America/Sao_Paulo')
from public.competitions competition
join public.competition_series series on series.id = competition.series_id
where series.slug = 'liga-de-desenvolvimento'
  and competition.year in (2025, 2026)
on conflict (competition_id, game_number) do update
set status = 'scheduled',
    venue = excluded.venue,
    scheduled_at = excluded.scheduled_at;

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
