-- Cover every contextual foreign key introduced by POST-03. These indexes keep
-- deletes/updates on referenced rows bounded without changing domain behavior.
create index if not exists competition_group_advancements_closure_context_idx
  on public.competition_group_advancements(
    closure_id, group_id, ruleset_revision_id, competition_id
  );

create index if not exists competition_group_advancements_closure_row_idx
  on public.competition_group_advancements(closure_id, position, registration_id);

create index if not exists competition_group_advancements_slot_context_idx
  on public.competition_group_advancements(slot_id, ruleset_revision_id, competition_id);

create index if not exists competition_group_closure_rows_closure_context_idx
  on public.competition_group_closure_rows(
    closure_id, group_id, ruleset_revision_id, competition_id
  );

create index if not exists competition_group_closures_group_context_idx
  on public.competition_group_closures(group_id, ruleset_revision_id, competition_id);

create index if not exists competition_ruleset_amendments_source_context_idx
  on public.competition_ruleset_amendments(
    source_matchup_id, source_revision_id, competition_id
  );

create index if not exists competition_ruleset_amendments_target_matchup_context_idx
  on public.competition_ruleset_amendments(
    target_matchup_id, target_revision_id, competition_id
  );

create index if not exists competition_ruleset_amendments_target_revision_context_idx
  on public.competition_ruleset_amendments(target_revision_id, competition_id);

create index if not exists competition_ruleset_amendments_competition_idx
  on public.competition_ruleset_amendments(competition_id);

create index if not exists matchup_administrative_resolutions_matchup_context_idx
  on public.matchup_administrative_resolutions(
    matchup_id, ruleset_revision_id, competition_id
  );

create index if not exists matchup_revision_outcomes_matchup_context_idx
  on public.matchup_revision_outcomes(matchup_id, ruleset_revision_id, competition_id);
