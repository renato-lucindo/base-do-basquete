begin;
create extension if not exists pgtap with schema extensions;
select plan(29);
set constraints all deferred;

insert into auth.users(id) values('11111111-1111-4111-8111-111111111111') on conflict do nothing;
insert into private.admin_accounts(user_id)
select '11111111-1111-4111-8111-111111111111' where not exists(select 1 from private.admin_accounts);
select set_config('request.jwt.claims',jsonb_build_object(
  'sub',(select user_id from private.admin_accounts limit 1),
  'role','authenticated','aal','aal2'
)::text,true);

create temporary table clone_context(
  series_id bigint,
  category_id bigint,
  other_category_id bigint,
  male_source_competition bigint,
  male_source_revision bigint,
  female_source_competition bigint,
  female_source_revision bigint,
  target_competition bigint,
  target_revision bigint,
  cross_gender_target bigint,
  cross_gender_revision bigint,
  incompatible_source_competition bigint,
  incompatible_source_revision bigint,
  published_target bigint,
  request_id uuid
);

with series as (
  insert into public.competition_series(name,slug)
  values('POST02 clone','post02-clone') returning id
), category as (
  insert into public.categories(name,slug)
  values('POST02 clone','post02-clone') returning id
), other_category as (
  insert into public.categories(name,slug)
  values('POST02 clone other','post02-clone-other') returning id
)
insert into clone_context(series_id,category_id,other_category_id,request_id)
select series.id,category.id,other_category.id,'40dde5c7-46b2-4241-995d-4e42223bbdf2'::uuid
from series,category,other_category;

with inserted as (
  insert into public.competitions(series_id,category_id,year,display_name,status,gender_division,gender_division_review_required)
  select series_id,category_id,1970,'POST02 male source','draft','male',false from clone_context
  returning id
)
update clone_context set male_source_competition=(select id from inserted);
with inserted as (
  insert into public.competitions(series_id,category_id,year,display_name,status,gender_division,gender_division_review_required)
  select series_id,category_id,1971,'POST02 female source','draft','female',false from clone_context
  returning id
)
update clone_context set female_source_competition=(select id from inserted);
with inserted as (
  insert into public.competitions(series_id,category_id,year,display_name,status,gender_division,gender_division_review_required)
  select series_id,category_id,1972,'POST02 target','draft','male',false from clone_context
  returning id
)
update clone_context set target_competition=(select id from inserted);
with inserted as (
  insert into public.competitions(series_id,category_id,year,display_name,status,gender_division,gender_division_review_required)
  select series_id,category_id,1973,'POST02 cross gender','draft','male',false from clone_context
  returning id
)
update clone_context set cross_gender_target=(select id from inserted);
with inserted as (
  insert into public.competitions(series_id,category_id,year,display_name,status,gender_division,gender_division_review_required)
  select series_id,other_category_id,1974,'POST02 incompatible','draft','male',false from clone_context
  returning id
)
update clone_context set incompatible_source_competition=(select id from inserted);
with inserted as (
  insert into public.competitions(series_id,category_id,year,display_name,status,gender_division,gender_division_review_required,published_at)
  select series_id,category_id,1975,'POST02 published target','published','male',false,clock_timestamp()
  from clone_context
  returning id
)
update clone_context set published_target=(select id from inserted);

update clone_context set
  male_source_revision=private.materialize_competition_preset(male_source_competition,'single_elimination',5),
  female_source_revision=private.materialize_competition_preset(female_source_competition,'single_group',4),
  incompatible_source_revision=private.materialize_competition_preset(incompatible_source_competition,'single_elimination',4);

grant select,update on clone_context to authenticated;

set local role authenticated;
select is(
  (select count(*) from clone_context context cross join lateral
    public.admin_list_ruleset_clone_sources(context.target_competition,false) source),
  1::bigint,'default source list filters series, category and gender'
);
select is(
  (select count(*) from clone_context context cross join lateral
    public.admin_list_ruleset_clone_sources(context.target_competition,true) source),
  2::bigint,'explicit source list may include the other gender'
);
select ok(
  (select bool_and(source.gender_mismatch) from clone_context context cross join lateral
    public.admin_list_ruleset_clone_sources(context.target_competition,true) source
    where source.source_revision_id=context.female_source_revision),
  'cross-gender source is marked for explicit recompilation'
);
select throws_ok(
  $$select public.admin_clone_competition_ruleset(gen_random_uuid(),target_competition,
      female_source_revision,false) from clone_context$$,
  'BR057','BDB_RULESET_GENDER_RECOMPILE_REQUIRED','cross-gender clone requires explicit acknowledgement'
);
select throws_ok(
  $$select public.admin_clone_competition_ruleset(gen_random_uuid(),target_competition,
      incompatible_source_revision,false) from clone_context$$,
  'BR056','BDB_RULESET_SOURCE_INCOMPATIBLE','different category is rejected server-side'
);
select throws_ok(
  $$select public.admin_clone_competition_ruleset(gen_random_uuid(),published_target,
      male_source_revision,false) from clone_context$$,
  'BR054','BDB_RULESET_TARGET_NOT_DRAFT','published target is immutable'
);
select lives_ok(
  $$update clone_context set target_revision=(
      public.admin_clone_competition_ruleset(request_id,target_competition,male_source_revision,false)
      ->>'rulesetRevisionId')::bigint$$,
  'AAL2 clones the complete graph into one draft revision'
);
select is(
  (select public.admin_clone_competition_ruleset(request_id,target_competition,
      male_source_revision,false)->>'outcome' from clone_context),
  'unchanged','identical clone retry is idempotent'
);
select throws_ok(
  $$select public.admin_clone_competition_ruleset(request_id,target_competition,
      female_source_revision,true) from clone_context$$,
  'BR010','BDB_IDEMPOTENCY_CONFLICT','changed clone input cannot reuse the request key'
);
select is(
  (select count(*) from public.competition_ruleset_revisions revision,clone_context context
    where revision.competition_id=context.target_competition and revision.status='draft'),
  1::bigint,'target has exactly one draft revision'
);
select ok(
  (select revision.status='draft' and revision.preset_key is null
      and revision.cloned_from_revision_id=context.male_source_revision
      and revision.gender_recompiled is false
    from public.competition_ruleset_revisions revision,clone_context context
    where revision.id=context.target_revision),
  'clone is detached from preset activation and retains provenance'
);
select is(
  (select jsonb_build_array(
      (select count(*) from public.competition_tracks where ruleset_revision_id=context.target_revision),
      (select count(*) from public.competition_stages where ruleset_revision_id=context.target_revision),
      (select count(*) from public.competition_groups where ruleset_revision_id=context.target_revision),
      (select count(*) from public.competition_rounds where ruleset_revision_id=context.target_revision),
      (select count(*) from public.competition_entries where ruleset_revision_id=context.target_revision),
      (select count(*) from public.competition_slots where ruleset_revision_id=context.target_revision),
      (select count(*) from public.matchups where ruleset_revision_id=context.target_revision),
      (select count(*) from public.competition_round_byes where ruleset_revision_id=context.target_revision)
    ) from clone_context context),
  (select jsonb_build_array(
      (select count(*) from public.competition_tracks where ruleset_revision_id=context.male_source_revision),
      (select count(*) from public.competition_stages where ruleset_revision_id=context.male_source_revision),
      (select count(*) from public.competition_groups where ruleset_revision_id=context.male_source_revision),
      (select count(*) from public.competition_rounds where ruleset_revision_id=context.male_source_revision),
      (select count(*) from public.competition_entries where ruleset_revision_id=context.male_source_revision),
      (select count(*) from public.competition_slots where ruleset_revision_id=context.male_source_revision),
      (select count(*) from public.matchups where ruleset_revision_id=context.male_source_revision),
      (select count(*) from public.competition_round_byes where ruleset_revision_id=context.male_source_revision)
    ) from clone_context context),
  'all normalized structural collections are copied'
);
select ok(
  not exists(
    select 1 from clone_context context,public.matchups target_matchup
    where target_matchup.ruleset_revision_id=context.target_revision
      and (target_matchup.id in (
        select source_matchup.id from public.matchups source_matchup
        where source_matchup.ruleset_revision_id=context.male_source_revision
      ) or target_matchup.home_slot_id in (
        select source_slot.id from public.competition_slots source_slot
        where source_slot.ruleset_revision_id=context.male_source_revision
      ) or target_matchup.away_slot_id in (
        select source_slot.id from public.competition_slots source_slot
        where source_slot.ruleset_revision_id=context.male_source_revision
      ))
  ),
  'clone uses independent matchup and slot identities'
);
select ok(
  not exists(
    select 1 from clone_context context,public.competition_slots slot
    where slot.ruleset_revision_id=context.target_revision and (
      slot.entry_id is not null and not exists(
        select 1 from public.competition_entries entry
        where entry.id=slot.entry_id and entry.ruleset_revision_id=context.target_revision
      ) or slot.source_matchup_id is not null and not exists(
        select 1 from public.matchups matchup
        where matchup.id=slot.source_matchup_id and matchup.ruleset_revision_id=context.target_revision
      )
    )
  ),
  'every cloned origin points inside the cloned revision'
);
select is(
  (select count(*) from public.competition_entry_assignments assignment,clone_context context
    where assignment.ruleset_revision_id=context.target_revision),
  0::bigint,'team assignments are not cloned'
);
select is(
  (select count(*) from public.games game,clone_context context
    where game.competition_id=context.target_competition),
  0::bigint,'games are not invented by cloning'
);
reset role;
select lives_ok(
  $$update public.competition_rounds set name='Independent draft'
    where id=(select min(round_item.id) from public.competition_rounds round_item,clone_context context
      where round_item.ruleset_revision_id=context.target_revision)$$,
  'draft clone can evolve independently'
);
set local role authenticated;
select ok(
  not exists(
    select 1 from public.competition_rounds round_item,clone_context context
    where round_item.ruleset_revision_id=context.male_source_revision
      and round_item.name='Independent draft'
  ),
  'editing the clone never changes the source snapshot'
);
select throws_ok(
  $$select public.admin_clone_competition_ruleset(gen_random_uuid(),target_competition,
      male_source_revision,false) from clone_context$$,
  'BR058','BDB_RULESET_DRAFT_EXISTS','second draft is refused'
);
select lives_ok(
  $$update clone_context set cross_gender_revision=(
      public.admin_clone_competition_ruleset(gen_random_uuid(),cross_gender_target,
        female_source_revision,true)->>'rulesetRevisionId')::bigint$$,
  'explicit cross-gender recompilation creates a new draft'
);
select ok(
  (select revision.gender_recompiled and revision.cloned_from_gender_division='female'
    from public.competition_ruleset_revisions revision,clone_context context
    where revision.id=context.cross_gender_revision),
  'cross-gender provenance and recompilation decision are persisted'
);
select is(
  (select count(*) from public.admin_mutation_audit audit,clone_context context
    where audit.action='ruleset_cloned' and audit.entity_id=context.target_revision),
  1::bigint,'clone is audited exactly once'
);

reset role;
select set_config('request.jwt.claims',jsonb_set(
  current_setting('request.jwt.claims')::jsonb,'{aal}','"aal1"'
)::text,true);
set local role authenticated;
select throws_ok(
  $$select * from public.admin_list_ruleset_clone_sources(1,false)$$,
  'BD401','BDB_ADMIN_AAL2_REQUIRED','AAL1 cannot list clone sources'
);
select throws_ok(
  $$select public.admin_clone_competition_ruleset(null,null,null,false)$$,
  'BD401','BDB_ADMIN_AAL2_REQUIRED','AAL1 is rejected before clone input processing'
);
reset role;
set local role anon;
select throws_ok(
  $$select * from public.admin_list_ruleset_clone_sources(1,false)$$,
  '42501',null,'anon cannot list clone sources'
);
select throws_ok(
  $$select public.admin_clone_competition_ruleset(null,null,null,false)$$,
  '42501',null,'anon cannot invoke clone'
);
reset role;
select ok(
  has_function_privilege('authenticated',
    'public.admin_clone_competition_ruleset(uuid,bigint,bigint,boolean)','execute'),
  'authenticated has only guarded clone execution'
);
select ok(
  not has_function_privilege('anon',
    'public.admin_clone_competition_ruleset(uuid,bigint,bigint,boolean)','execute'),
  'anon has no clone execution grant'
);
select throws_ok(
  $$update public.competition_ruleset_revisions set status='draft'
    where id=(select male_source_revision from clone_context)$$,
  'BR004','BDB_ACTIVE_RULESET_IMMUTABLE','source active revision remains immutable'
);

select * from finish();
rollback;
