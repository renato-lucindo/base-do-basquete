begin;
create extension if not exists pgtap with schema extensions;
select plan(36);
set constraints all deferred;

insert into auth.users(id) values('11111111-1111-4111-8111-111111111111') on conflict do nothing;
insert into private.admin_accounts(user_id)
select '11111111-1111-4111-8111-111111111111' where not exists(select 1 from private.admin_accounts);
select set_config('request.jwt.claims',jsonb_build_object(
  'sub',(select user_id from private.admin_accounts limit 1),
  'role','authenticated','aal','aal2'
)::text,true);

create temporary table editor_context(
  source_competition bigint,
  source_revision bigint,
  target_competition bigint,
  target_revision bigint,
  stage_id bigint,
  semifinal_round_id bigint,
  final_round_id bigint,
  semifinal_matchup_id bigint,
  semifinal_matchup_2_id bigint,
  final_matchup_id bigint,
  final_home_slot_id bigint,
  final_away_slot_id bigint
);

with series as (
  insert into public.competition_series(name,slug)
  values('POST02 editor','post02-editor') returning id
), category as (
  insert into public.categories(name,slug)
  values('POST02 editor','post02-editor') returning id
), source as (
  insert into public.competitions(
    series_id,category_id,year,display_name,status,gender_division,gender_division_review_required
  ) select series.id,category.id,1976,'POST02 editor source','draft','male',false
    from series,category returning id
), target as (
  insert into public.competitions(
    series_id,category_id,year,display_name,status,gender_division,gender_division_review_required
  ) select series.id,category.id,1977,'POST02 editor target','draft','male',false
    from series,category returning id
)
insert into editor_context(source_competition,target_competition)
select source.id,target.id from source,target;

update editor_context set source_revision=
  private.materialize_competition_preset(source_competition,'single_elimination',4);
update editor_context set target_revision=(
  public.admin_clone_competition_ruleset(
    '40dde5c7-46b2-4241-995d-4e42223bbdf2',target_competition,source_revision,false
  )->>'rulesetRevisionId'
)::bigint;
update editor_context context set
  stage_id=(select min(stage.id) from public.competition_stages stage
    where stage.ruleset_revision_id=context.target_revision),
  semifinal_round_id=(select round_item.id from public.competition_rounds round_item
    where round_item.ruleset_revision_id=context.target_revision and round_item.round_role='semifinal'),
  final_round_id=(select round_item.id from public.competition_rounds round_item
    where round_item.ruleset_revision_id=context.target_revision and round_item.round_role='final');
update editor_context context set
  semifinal_matchup_id=(select min(matchup.id) from public.matchups matchup
    where matchup.round_id=context.semifinal_round_id),
  semifinal_matchup_2_id=(select max(matchup.id) from public.matchups matchup
    where matchup.round_id=context.semifinal_round_id),
  final_matchup_id=(select matchup.id from public.matchups matchup
    where matchup.round_id=context.final_round_id);
update editor_context context set
  final_home_slot_id=(select matchup.home_slot_id from public.matchups matchup
    where matchup.id=context.final_matchup_id),
  final_away_slot_id=(select matchup.away_slot_id from public.matchups matchup
    where matchup.id=context.final_matchup_id);

grant select,update on editor_context to authenticated;
set local role authenticated;

select is(
  (select public.admin_get_ruleset_draft_editor(target_competition)#>>'{revision,status}'
    from editor_context),
  'draft','editor exposes only the private draft'
);
select is(
  (select (public.admin_get_ruleset_draft_editor(target_competition)#>>'{summary,entries}')::integer
    from editor_context),
  4,'normalized editor reports entry count'
);
select lives_ok(
  $$select public.admin_apply_ruleset_draft_edit(
    '624f1220-f0b0-44a7-9aa0-fcca0f2d0a01',target_revision,1,'rename_stage',
    jsonb_build_object('stageId',stage_id,'name','Eliminatórias editadas')) from editor_context$$,
  'AAL2 can rename a stage in the draft'
);
select is(
  (select editor_revision from public.competition_ruleset_revisions revision,editor_context context
    where revision.id=context.target_revision),
  2,'successful edit advances the CAS revision'
);
select is(
  (select stage.name from public.competition_stages stage,editor_context context
    where stage.id=context.stage_id),
  'Eliminatórias editadas','stage rename is persisted'
);
select is(
  (select public.admin_apply_ruleset_draft_edit(
    '624f1220-f0b0-44a7-9aa0-fcca0f2d0a01',target_revision,1,'rename_stage',
    jsonb_build_object('stageId',stage_id,'name','Eliminatórias editadas'))->>'outcome'
    from editor_context),
  'unchanged','identical retry is idempotent'
);
select is(
  (select count(*) from public.admin_mutation_audit audit,editor_context context
    where audit.action='ruleset_draft_edited' and audit.entity_id=context.target_revision),
  1::bigint,'idempotent retry does not duplicate audit'
);
select throws_ok(
  $$select public.admin_apply_ruleset_draft_edit(
    '624f1220-f0b0-44a7-9aa0-fcca0f2d0a01',target_revision,1,'rename_stage',
    jsonb_build_object('stageId',stage_id,'name','Outro nome')) from editor_context$$,
  'BR010','BDB_IDEMPOTENCY_CONFLICT','request key cannot be reused with changed input'
);
select throws_ok(
  $$select public.admin_apply_ruleset_draft_edit(
    gen_random_uuid(),target_revision,1,'rename_round',
    jsonb_build_object('roundId',semifinal_round_id,'name','Semifinal antiga')) from editor_context$$,
  'BR060','BDB_RULESET_EDIT_CHANGED_RELOAD','stale editor revision is rejected'
);
select lives_ok(
  $$select public.admin_apply_ruleset_draft_edit(
    '624f1220-f0b0-44a7-9aa0-fcca0f2d0a02',target_revision,2,'rename_round',
    jsonb_build_object('roundId',semifinal_round_id,'name','Semifinais')) from editor_context$$,
  'round name can be edited'
);
select lives_ok(
  $$select public.admin_apply_ruleset_draft_edit(
    '624f1220-f0b0-44a7-9aa0-fcca0f2d0a03',target_revision,3,'set_origin',
    jsonb_build_object('slotId',final_home_slot_id,'kind','undefined')) from editor_context$$,
  'slot origin can be cleared without inventing an entry'
);
select is(
  (select (public.admin_get_ruleset_draft_editor(target_competition)#>>'{summary,undefinedOrigins}')::integer
    from editor_context),
  1,'normalized editor reports an undefined origin'
);
select lives_ok(
  $$select public.admin_apply_ruleset_draft_edit(
    '624f1220-f0b0-44a7-9aa0-fcca0f2d0a04',target_revision,4,'set_origin',
    jsonb_build_object('slotId',final_home_slot_id,'kind','winner',
      'sourceMatchupId',semifinal_matchup_id)) from editor_context$$,
  'winner from a prior round is accepted'
);
select is(
  (select slot.source_matchup_id from public.competition_slots slot,editor_context context
    where slot.id=context.final_home_slot_id),
  (select semifinal_matchup_id from editor_context),
  'winner origin points to the selected matchup'
);
select throws_ok(
  $$select public.admin_apply_ruleset_draft_edit(
    gen_random_uuid(),target_revision,5,'set_origin',
    jsonb_build_object('slotId',final_home_slot_id,'kind','winner',
      'sourceMatchupId',final_matchup_id)) from editor_context$$,
  'BR003','BDB_PRESET_SOURCE_INVALID','same-round winner cannot feed a slot'
);
select throws_ok(
  $$select public.admin_apply_ruleset_draft_edit(
    gen_random_uuid(),target_revision,5,'rename_stage',
    jsonb_build_object('stageId',stage_id,'name','Nome','unexpected',true)) from editor_context$$,
  'BR059','BDB_RULESET_EDIT_INPUT_INVALID','unexpected input fields fail closed'
);
select lives_ok(
  $$select public.admin_apply_ruleset_draft_edit(
    '624f1220-f0b0-44a7-9aa0-fcca0f2d0a05',target_revision,5,'remove_matchup',
    jsonb_build_object('matchupId',final_matchup_id)) from editor_context$$,
  'dependency-free matchup can be removed'
);
select lives_ok(
  $$select public.admin_apply_ruleset_draft_edit(
    '624f1220-f0b0-44a7-9aa0-fcca0f2d0a06',target_revision,6,'add_matchup',
    jsonb_build_object('roundId',final_round_id,'code','final_editada')) from editor_context$$,
  'matchup can be recreated inside round capacity'
);
update editor_context context set
  final_matchup_id=(select matchup.id from public.matchups matchup
    where matchup.round_id=context.final_round_id),
  final_home_slot_id=(select matchup.home_slot_id from public.matchups matchup
    where matchup.round_id=context.final_round_id),
  final_away_slot_id=(select matchup.away_slot_id from public.matchups matchup
    where matchup.round_id=context.final_round_id);
select is(
  (select count(*) from public.competition_slots slot,editor_context context
    where slot.id in (context.final_home_slot_id,context.final_away_slot_id)
      and slot.origin_kind='undefined'),
  2::bigint,'new matchup starts with two explicit undefined origins'
);
select lives_ok(
  $$select public.admin_apply_ruleset_draft_edit(
    '624f1220-f0b0-44a7-9aa0-fcca0f2d0a07',target_revision,7,'set_origin',
    jsonb_build_object('slotId',final_home_slot_id,'kind','winner',
      'sourceMatchupId',semifinal_matchup_id)) from editor_context$$,
  'first new final origin is wired explicitly'
);
select lives_ok(
  $$select public.admin_apply_ruleset_draft_edit(
    '624f1220-f0b0-44a7-9aa0-fcca0f2d0a08',target_revision,8,'set_origin',
    jsonb_build_object('slotId',final_away_slot_id,'kind','winner',
      'sourceMatchupId',semifinal_matchup_2_id)) from editor_context$$,
  'second new final origin is wired explicitly'
);
select throws_ok(
  $$select public.admin_apply_ruleset_draft_edit(
    gen_random_uuid(),target_revision,9,'remove_matchup',
    jsonb_build_object('matchupId',semifinal_matchup_id)) from editor_context$$,
  'BR061','BDB_RULESET_MATCHUP_DEPENDENCY','a matchup feeding another slot cannot be removed'
);
select throws_ok(
  $$select public.admin_apply_ruleset_draft_edit(
    gen_random_uuid(),target_revision,9,'add_matchup',
    jsonb_build_object('roundId',final_round_id,'code','final_excedente')) from editor_context$$,
  'BR006','BDB_ROUND_CAPACITY_EXCEEDED','round capacity is enforced in the database'
);
select throws_ok(
  $$update public.competition_stages set name='Bypass'
    where id=(select stage_id from editor_context)$$,
  '42501',null,'authenticated cannot bypass the editor with direct table update'
);

reset role;
select set_config('request.jwt.claims',jsonb_set(
  current_setting('request.jwt.claims')::jsonb,'{aal}','"aal1"'
)::text,true);
set local role authenticated;
select throws_ok(
  $$select public.admin_get_ruleset_draft_editor(target_competition) from editor_context$$,
  'BD401','BDB_ADMIN_AAL2_REQUIRED','AAL1 cannot read the editor document'
);
select throws_ok(
  $$select public.admin_apply_ruleset_draft_edit(
    gen_random_uuid(),target_revision,9,'rename_stage','{}') from editor_context$$,
  'BD401','BDB_ADMIN_AAL2_REQUIRED','AAL1 cannot edit the draft'
);
reset role;
set local role anon;
select throws_ok(
  $$select public.admin_get_ruleset_draft_editor(1)$$,
  '42501',null,'anon cannot read the editor document'
);
select throws_ok(
  $$select public.admin_apply_ruleset_draft_edit(null,null,null,null,null)$$,
  '42501',null,'anon cannot invoke the editor mutation'
);
reset role;
select set_config('request.jwt.claims',jsonb_set(
  current_setting('request.jwt.claims')::jsonb,'{aal}','"aal2"'
)::text,true);
select ok(
  has_function_privilege('authenticated',
    'public.admin_apply_ruleset_draft_edit(uuid,bigint,integer,text,jsonb)','execute'),
  'authenticated has guarded editor execution'
);
select ok(
  not has_function_privilege('anon',
    'public.admin_apply_ruleset_draft_edit(uuid,bigint,integer,text,jsonb)','execute'),
  'anon has no editor execution grant'
);
select is(
  (select count(*) from public.admin_mutation_audit audit,editor_context context
    where audit.action='ruleset_draft_edited' and audit.entity_id=context.target_revision),
  8::bigint,'every successful mutation is audited exactly once'
);
select throws_ok(
  $$update public.competition_rounds set name='Active bypass'
    where ruleset_revision_id=(select source_revision from editor_context)$$,
  'BR004','BDB_ACTIVE_RULESET_IMMUTABLE','active source structure remains immutable'
);
select is(
  (select (public.admin_get_ruleset_draft_editor(target_competition)#>>'{revision,editorRevision}')::integer
    from editor_context),
  9,'editor document returns the latest CAS revision'
);
select is(
  (select (public.admin_get_ruleset_draft_editor(target_competition)#>>'{summary,matchups}')::integer
    from editor_context),
  3,'normalized document reflects the edited matchup graph'
);
update public.competitions set status='published',published_at=clock_timestamp()
where id=(select target_competition from editor_context);
set local role authenticated;
select throws_ok(
  $$select public.admin_apply_ruleset_draft_edit(
    gen_random_uuid(),target_revision,9,'rename_stage',
    jsonb_build_object('stageId',stage_id,'name','Published bypass')) from editor_context$$,
  'BR054','BDB_RULESET_TARGET_NOT_DRAFT','draft revision under a published edition cannot be edited'
);
select throws_ok(
  $$select public.admin_get_ruleset_draft_editor(target_competition) from editor_context$$,
  'BD404','BDB_RULESET_DRAFT_NOT_FOUND','published edition no longer exposes the draft editor'
);
reset role;

select * from finish();
rollback;
