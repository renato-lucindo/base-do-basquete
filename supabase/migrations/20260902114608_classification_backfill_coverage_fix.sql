alter function private.build_classification_backfill_report()
rename to build_classification_backfill_report_v1;

revoke all on function private.build_classification_backfill_report_v1()
from public, anon, authenticated;

create function private.build_classification_backfill_report()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with original_report as (
    select private.build_classification_backfill_report_v1() as value
  ),
  corrected_coverage as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'competitionId', competition.id,
          'teamStatisticRows', (
            select count(*)
            from public.game_team_statistics team_stats
            join public.games game on game.id = team_stats.game_id
            where game.competition_id = competition.id
          ),
          'gameStatisticRows', (
            select count(*)
            from public.game_statistics game_stats
            join public.games game on game.id = game_stats.game_id
            where game.competition_id = competition.id
          )
        ) order by competition.id
      ),
      '[]'::jsonb
    ) as value
    from public.competitions competition
  )
  select jsonb_set(
    jsonb_set(
      original_report.value,
      '{reportVersion}',
      '2'::jsonb
    ),
    '{historicalIntegrity,advancedCoverageByCompetition}',
    corrected_coverage.value
  )
  from original_report
  cross join corrected_coverage;
$$;

revoke all on function private.build_classification_backfill_report()
from public, anon, authenticated;

comment on function private.build_classification_backfill_report() is
  'Version 2 classification report with exact per-edition advanced-stat coverage counts.';

comment on function private.build_classification_backfill_report_v1() is
  'Internal version 1 classification report retained for the additive version 2 correction.';
