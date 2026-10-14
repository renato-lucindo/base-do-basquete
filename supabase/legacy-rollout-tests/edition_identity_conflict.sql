-- Disposable CI-only fixture at the schema immediately before the edition
-- identity consolidation. The upgrade must stop instead of guessing which
-- shared edition data should win.
with inserted_series as (
  insert into public.competition_series (name, slug)
  values ('Edição divergente', 'edicao-divergente')
  returning id
)
insert into public.competition_seasons (
  series_id,
  year,
  gender_division,
  name,
  description
)
select id, 2031, 'male', 'Edição divergente', 'Descrição masculina'
from inserted_series
union all
select id, 2031, 'female', 'Edição divergente', 'Descrição feminina'
from inserted_series;
