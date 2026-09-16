begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

select has_index(
  'public', 'competition_group_advancements',
  'competition_group_advancements_closure_context_idx',
  array['closure_id','group_id','ruleset_revision_id','competition_id'],
  'group advancement closure context is indexed'
);
select has_index(
  'public', 'competition_group_advancements',
  'competition_group_advancements_closure_row_idx',
  array['closure_id','"position"','registration_id'],
  'group advancement closure row is indexed'
);
select has_index(
  'public', 'competition_group_advancements',
  'competition_group_advancements_slot_context_idx',
  array['slot_id','ruleset_revision_id','competition_id'],
  'group advancement slot context is indexed'
);
select has_index(
  'public', 'competition_group_closure_rows',
  'competition_group_closure_rows_closure_context_idx',
  array['closure_id','group_id','ruleset_revision_id','competition_id'],
  'group closure row context is indexed'
);
select has_index(
  'public', 'competition_group_closures',
  'competition_group_closures_group_context_idx',
  array['group_id','ruleset_revision_id','competition_id'],
  'group closure group context is indexed'
);
select has_index(
  'public', 'competition_ruleset_amendments',
  'competition_ruleset_amendments_source_context_idx',
  array['source_matchup_id','source_revision_id','competition_id'],
  'amendment source context is indexed'
);
select has_index(
  'public', 'competition_ruleset_amendments',
  'competition_ruleset_amendments_target_matchup_context_idx',
  array['target_matchup_id','target_revision_id','competition_id'],
  'amendment target matchup context is indexed'
);
select has_index(
  'public', 'competition_ruleset_amendments',
  'competition_ruleset_amendments_target_revision_context_idx',
  array['target_revision_id','competition_id'],
  'amendment target revision context is indexed'
);
select has_index(
  'public', 'competition_ruleset_amendments',
  'competition_ruleset_amendments_competition_idx',
  array['competition_id'],
  'amendment competition is indexed'
);
select has_index(
  'public', 'matchup_administrative_resolutions',
  'matchup_administrative_resolutions_matchup_context_idx',
  array['matchup_id','ruleset_revision_id','competition_id'],
  'administrative resolution matchup context is indexed'
);
select has_index(
  'public', 'matchup_revision_outcomes',
  'matchup_revision_outcomes_matchup_context_idx',
  array['matchup_id','ruleset_revision_id','competition_id'],
  'revision outcome matchup context is indexed'
);

select * from finish();
rollback;
