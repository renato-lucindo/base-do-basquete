-- Cover every contextual foreign key introduced by the structural and scheduling
-- packages. These indexes are additive and keep parent updates/deletes bounded.
create index competition_entry_assignments_entry_revision_comp_idx
  on public.competition_entry_assignments (entry_id, ruleset_revision_id, competition_id);

create index competition_rounds_stage_comp_idx
  on public.competition_rounds (stage_id, competition_id);

create index competition_stages_revision_comp_idx
  on public.competition_stages (ruleset_revision_id, competition_id);

create index games_matchup_comp_idx
  on public.games (matchup_id, competition_id)
  where matchup_id is not null;

create index matchup_preparations_game_comp_idx
  on public.matchup_preparations (game_id, competition_id)
  where game_id is not null;

create index matchup_preparations_matchup_comp_idx
  on public.matchup_preparations (matchup_id, competition_id);

create index matchups_away_registration_comp_idx
  on public.matchups (away_registration_id, competition_id)
  where away_registration_id is not null;

create index matchups_home_registration_comp_idx
  on public.matchups (home_registration_id, competition_id)
  where home_registration_id is not null;

create index matchups_round_comp_idx
  on public.matchups (round_id, competition_id);
