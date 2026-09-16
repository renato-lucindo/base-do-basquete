begin;
\ir ../helpers/final_profile_fixtures.sql
create extension if not exists pgtap with schema extensions;
select plan(28);
set constraints all deferred;

insert into auth.users(id) values('11111111-1111-4111-8111-111111111111') on conflict do nothing;
insert into private.admin_accounts(user_id)
select '11111111-1111-4111-8111-111111111111' where not exists(select 1 from private.admin_accounts);

create temporary table removal_context(
  competition_id bigint,
  provisional_registration bigint,
  roster_registration bigint,
  completed_registration bigint,
  team_one bigint,
  team_two bigint,
  team_three bigint
);
with series as (
  insert into public.competition_series(name,slug) values('POST02 removal','post02-removal') returning id
), category as (
  insert into public.categories(name,slug) values('POST02 removal','post02-removal') returning id
), competition as (
  select pg_temp.create_final_competition(
    null,series.id,category.id,2028,'POST02 removal QA','draft',null,'male','manual_scoresheet'
  ) as id from series,category
), teams as (
  insert into public.teams(name,slug)
  select 'POST02 team '||number,'post02-team-'||number from generate_series(1,3) number returning id
)
insert into removal_context(competition_id,team_one,team_two,team_three)
select competition.id,min(teams.id),min(teams.id)+1,max(teams.id) from competition,teams group by competition.id;

insert into public.team_registrations(competition_id,team_id,status)
select competition_id,team_one,'draft' from removal_context;
insert into public.team_registrations(competition_id,team_id,status)
select competition_id,team_two,'draft' from removal_context;
insert into public.team_registrations(competition_id,team_id,status,confirmed_at)
select competition_id,team_three,'completed',clock_timestamp() from removal_context;
update removal_context set
  provisional_registration=(select id from public.team_registrations where competition_id=removal_context.competition_id and team_id=removal_context.team_one),
  roster_registration=(select id from public.team_registrations where competition_id=removal_context.competition_id and team_id=removal_context.team_two),
  completed_registration=(select id from public.team_registrations where competition_id=removal_context.competition_id and team_id=removal_context.team_three);

with player as (
  insert into public.players(full_name,slug) values('POST02 player','post02-player') returning id
), private_profile as (
  insert into private.player_private(player_id,sex,sex_review_required)
  select id,'male',false from player returning player_id
)
insert into public.roster_entries(competition_id,registration_id,player_id,status)
select context.competition_id,context.roster_registration,player.id,'active'
from removal_context context,player,private_profile;

grant select on removal_context to authenticated;

select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select throws_ok(
  $$select public.admin_get_registration_removal_decision(provisional_registration) from removal_context$$,
  'BD401','BDB_ADMIN_AAL2_REQUIRED','non-admin AAL2 cannot inspect the decision'
);

reset role;
select set_config('request.jwt.claims',jsonb_build_object(
  'sub',(select user_id from private.admin_accounts limit 1),'role','authenticated','aal','aal1')::text,true);
set local role authenticated;
select throws_ok(
  $$select public.admin_apply_registration_removal(provisional_registration,'remove','A justified removal') from removal_context$$,
  'BD401','BDB_ADMIN_AAL2_REQUIRED','admin AAL1 cannot mutate a registration'
);

reset role;
select set_config('request.jwt.claims',jsonb_build_object(
  'sub',(select user_id from private.admin_accounts limit 1),'role','authenticated','aal','aal2')::text,true);
set local role authenticated;

select is(
  (select public.admin_get_registration_removal_decision(provisional_registration)->>'decision' from removal_context),
  'remove','empty draft registration is strictly provisional'
);
select is(
  (select public.admin_get_registration_removal_decision(roster_registration)->>'decision' from removal_context),
  'withdraw','draft registration with roster history is withdrawn instead of deleted'
);
select is(
  (select public.admin_get_registration_removal_decision(completed_registration)->>'decision' from removal_context),
  'blocked','completed registration is immutable'
);
select throws_ok(
  $$select public.admin_apply_registration_removal(provisional_registration,'withdraw','A justified removal') from removal_context$$,
  'BR052','BDB_REGISTRATION_REMOVAL_CHANGED_RELOAD','stale client decision is rejected'
);
select throws_ok(
  $$select public.admin_apply_registration_removal(provisional_registration,'remove','short') from removal_context$$,
  'BR050','BDB_REGISTRATION_REMOVAL_INPUT_INVALID','short reason is rejected'
);
select throws_ok(
  $$select public.admin_apply_registration_removal(completed_registration,'withdraw','Completed must stay') from removal_context$$,
  'BR051','BDB_REGISTRATION_REMOVAL_BLOCKED','completed registration cannot be removed or withdrawn'
);
select throws_ok(
  $$select public.admin_transition_team_registration(roster_registration,'withdrawn') from removal_context$$,
  'BR053','BDB_REGISTRATION_WITHDRAWAL_POLICY_REQUIRED','legacy transition cannot bypass the policy'
);
select throws_ok(
  $$update public.team_registrations set status='withdrawn',confirmed_at=clock_timestamp()
    where id=(select roster_registration from removal_context)$$,
  '42501',null,'direct update cannot bypass the policy'
);
select is(
  (select public.admin_apply_registration_removal(roster_registration,'withdraw','Preserve roster history')->>'outcome' from removal_context),
  'withdrawn','roster registration is withdrawn'
);
select is(
  (select status from public.team_registrations where id=(select roster_registration from removal_context)),
  'withdrawn','withdrawal preserves the registration row'
);
select is(
  (select status from public.roster_entries where registration_id=(select roster_registration from removal_context)),
  'inactive','withdrawal closes the active roster'
);
select is(
  (select public.admin_apply_registration_removal(roster_registration,'withdraw','Preserve roster history')->>'outcome' from removal_context),
  'unchanged','repeated withdrawal is idempotent'
);
select is(
  (select count(*) from public.admin_mutation_audit where action='registration_withdrawn'
    and entity_id=(select roster_registration from removal_context)),
  1::bigint,'repeated withdrawal writes one audit event'
);
select is(
  (select public.admin_apply_registration_removal(provisional_registration,'remove','Created by mistake')->>'outcome' from removal_context),
  'removed','strictly provisional registration is removed'
);
select is(
  (select count(*) from public.team_registrations where id=(select provisional_registration from removal_context)),
  0::bigint,'provisional registration row no longer exists'
);
select is(
  (select count(*) from public.teams where id=(select team_one from removal_context)),
  1::bigint,'global team is never deleted'
);
select is(
  (select count(*) from public.admin_mutation_audit where action='registration_removed'
    and entity_id=(select provisional_registration from removal_context)),
  1::bigint,'removal is audited once'
);
select is(
  (select public.admin_apply_registration_removal(provisional_registration,'remove','Created by mistake')->>'outcome' from removal_context),
  'unchanged','repeated provisional removal is idempotent'
);
select throws_ok(
  $$select public.admin_get_registration_removal_decision(provisional_registration) from removal_context$$,
  'BD404','BDB_REGISTRATION_NOT_FOUND','removed registration is no longer addressable'
);

reset role;
set local role anon;
select throws_ok(
  $$select public.admin_get_registration_removal_decision(null)$$,
  '42501',null,'anon cannot inspect removal policy'
);
select throws_ok(
  $$select public.admin_apply_registration_removal(null,null,null)$$,
  '42501',null,'anon cannot apply removal policy'
);
reset role;

select ok(
  has_function_privilege('authenticated','public.admin_get_registration_removal_decision(bigint)','execute'),
  'authenticated may execute the guarded reader'
);
select ok(
  has_function_privilege('authenticated','public.admin_apply_registration_removal(bigint,text,text)','execute'),
  'authenticated may execute the guarded mutation'
);
select ok(
  not has_function_privilege('anon','public.admin_get_registration_removal_decision(bigint)','execute'),
  'anon has no reader grant'
);
select ok(
  not has_function_privilege('anon','public.admin_apply_registration_removal(bigint,text,text)','execute'),
  'anon has no mutation grant'
);
select is(
  (select metadata->>'reason' from public.admin_mutation_audit where action='registration_removed'
    and entity_id=(select provisional_registration from removal_context)),
  'Created by mistake','audit retains the administrator reason without private athlete data'
);

set constraints all immediate;
select * from finish();
rollback;
