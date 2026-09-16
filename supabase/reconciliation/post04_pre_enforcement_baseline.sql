-- POST-04 read-only baseline.
--
-- Run before and after final enforcement and compare the inventory and
-- historical integrity checksums. This query deliberately returns only
-- aggregate counts, public competition classification data and hashes; it
-- never returns private player eligibility values.
select jsonb_pretty(
  jsonb_build_object(
    'capturedAt', timezone('utc', statement_timestamp()),
    'inventory', jsonb_build_object(
      'competitions', (select count(*) from public.competitions),
      'players', (select count(*) from public.players),
      'playerPrivate', (select count(*) from private.player_private),
      'games', (select count(*) from public.games),
      'participants', (select count(*) from public.game_participants),
      'periodScores', (select count(*) from public.game_period_scores),
      'rosterSlots', (select count(*) from public.game_roster_slots),
      'playerPeriodStats', (select count(*) from public.player_period_stats),
      'fouls', (select count(*) from public.foul_events),
      'imports', (select count(*) from public.boxscore_imports),
      'publications', (select count(*) from public.competition_publications),
      'rulesetRevisions', (select count(*) from public.competition_ruleset_revisions)
    ),
    'classification', private.build_classification_backfill_report(),
    'gameData', private.build_game_data_backfill_report()
  )
) as post04_pre_enforcement_baseline;
