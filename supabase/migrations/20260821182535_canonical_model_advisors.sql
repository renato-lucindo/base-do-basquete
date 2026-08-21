-- Reconcile the already-provisioned staging schema with the final WP-04 advisor fixes.
create index if not exists roster_entries_registration_competition_idx
  on public.roster_entries (registration_id, competition_id);
create index if not exists game_participants_game_competition_idx
  on public.game_participants (game_id, competition_id);
create index if not exists game_participants_registration_competition_idx
  on public.game_participants (registration_id, competition_id);
create index if not exists game_period_scores_game_period_idx
  on public.game_period_scores (game_id, period_number);
create index if not exists game_roster_slots_roster_registration_idx
  on public.game_roster_slots (roster_entry_id, registration_id);
create index if not exists player_period_stats_slot_game_idx
  on public.player_period_stats (game_roster_slot_id, game_id);
create index if not exists foul_events_slot_game_idx
  on public.foul_events (game_roster_slot_id, game_id);
create index if not exists boxscore_imports_game_competition_idx
  on public.boxscore_imports (game_id, competition_id);
create index if not exists boxscore_import_matches_import_competition_idx
  on public.boxscore_import_player_matches (import_id, competition_id);
create index if not exists boxscore_import_matches_roster_competition_idx
  on public.boxscore_import_player_matches (roster_entry_id, competition_id);
create index if not exists final_placements_registration_competition_idx
  on public.final_placements (registration_id, competition_id);

alter policy competition_series_public_select on public.competition_series to anon;
alter policy categories_public_select on public.categories to anon;
alter policy competitions_public_select on public.competitions to anon;
alter policy teams_public_select on public.teams to anon;
alter policy players_public_select on public.players to anon;
alter policy team_registrations_public_select on public.team_registrations to anon;
alter policy roster_entries_public_select on public.roster_entries to anon;
alter policy games_public_select on public.games to anon;
alter policy game_participants_public_select on public.game_participants to anon;
alter policy game_periods_public_select on public.game_periods to anon;
alter policy game_period_scores_public_select on public.game_period_scores to anon;
alter policy game_roster_slots_public_select on public.game_roster_slots to anon;
alter policy player_period_stats_public_select on public.player_period_stats to anon;
alter policy foul_events_public_select on public.foul_events to anon;
alter policy final_placements_public_select on public.final_placements to anon;
