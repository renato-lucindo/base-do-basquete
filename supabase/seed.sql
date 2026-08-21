-- Deterministic, non-public development data. Supabase does not run seeds on production db push.
with inserted_series as (
  insert into public.competition_series (name, slug)
  values ('Liga de Desenvolvimento', 'liga-de-desenvolvimento')
  on conflict (slug) do update set name = excluded.name
  returning id
), inserted_category as (
  insert into public.categories (name, slug, has_advanced_stats)
  values ('Sub-15', 'sub-15', true)
  on conflict (slug) do update set name = excluded.name
  returning id
)
insert into public.competitions
  (series_id, category_id, year, display_name, status)
select s.id, c.id, 2026, 'Liga de Desenvolvimento 2026 Sub-15', 'draft'
from inserted_series s
cross join inserted_category c
on conflict (series_id, year, category_id) do update
set display_name = excluded.display_name;

insert into public.teams (name, slug, abbreviation, is_public)
values
  ('Equipe Demonstracao Azul', 'equipe-demonstracao-azul', 'AZL', false),
  ('Equipe Demonstracao Dourada', 'equipe-demonstracao-dourada', 'DOU', false)
on conflict (slug) do update
set name = excluded.name,
    abbreviation = excluded.abbreviation;

insert into public.players (full_name, slug, is_public)
values
  ('Atleta Demonstracao Um', 'atleta-demonstracao-um', false),
  ('Atleta Demonstracao Dois', 'atleta-demonstracao-dois', false)
on conflict (slug) do update set full_name = excluded.full_name;

insert into public.team_registrations (competition_id, team_id, status)
select c.id, t.id, 'draft'
from public.competitions c
join public.competition_series s on s.id = c.series_id
join public.categories ca on ca.id = c.category_id
cross join public.teams t
where s.slug = 'liga-de-desenvolvimento'
  and ca.slug = 'sub-15'
  and c.year = 2026
  and t.slug in ('equipe-demonstracao-azul', 'equipe-demonstracao-dourada')
on conflict (competition_id, team_id) do nothing;
