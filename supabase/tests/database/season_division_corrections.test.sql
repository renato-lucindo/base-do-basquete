begin;
\ir ../helpers/final_profile_fixtures.inc
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111') on conflict do nothing;
insert into private.admin_accounts(user_id)
select '11111111-1111-4111-8111-111111111111' where not exists(select 1 from private.admin_accounts);
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', (select user_id from private.admin_accounts limit 1), 'role', 'authenticated', 'aal', 'aal2'
)::text, true);
create temporary table correction_context(
  series_id bigint, category_id bigint, competition_id bigint, male_season_id bigint,
  female_season_id bigint, male_gold_id bigint, male_silver_id bigint, duplicate_competition_id bigint
);
with s as (
  insert into public.competition_series(name,slug) values ('Correções','season-corrections') returning id
), c as (
  insert into public.categories(name,slug) values ('Categoria correções','season-corrections') returning id
)
insert into correction_context(series_id,category_id) select s.id,c.id from s,c;
update correction_context set competition_id = pg_temp.create_final_competition(
  null,series_id,category_id,2026,'Correção masculina','draft',null,'male','manual_scoresheet'
);
update correction_context context set male_season_id = competition.season_id
from public.competitions competition where competition.id = context.competition_id;
select pg_temp.ensure_final_profile(series_id,category_id,'female','manual_scoresheet') from correction_context;
grant select,update on correction_context to authenticated;

set local role authenticated;
select lives_ok(
  $$select public.admin_review_competition_gender(competition_id,'female') from correction_context$$,
  'gender correction keeps the shared edition under final-profile constraints'
);
reset role;
update correction_context context set female_season_id = competition.season_id
from public.competitions competition where competition.id = context.competition_id;
select ok((select c.gender_division='female' and c.season_id=x.female_season_id
  and c.season_id=x.male_season_id and not c.data_profile_review_required
  and p.gender_division='female' and p.primary_source='manual_scoresheet'
  from correction_context x join public.competitions c on c.id=x.competition_id
  join public.series_category_data_profiles p on p.id=c.data_profile_id),
  'gender changes on the dispute while edition and validated profile stay consistent');
set local role authenticated;
select lives_ok(
  $$select public.admin_review_competition_gender(competition_id,'female') from correction_context$$,
  'same-gender retry is idempotent'
);
select lives_ok(
  $$select public.admin_review_competition_gender(competition_id,'male') from correction_context$$,
  'gender correction reuses the same edition'
);
reset role;
select is((select count(*) from public.competition_seasons s join correction_context x on x.series_id=s.series_id),
  1::bigint,'gender retries never duplicate the championship-year edition');
select is((select count(*) from public.admin_mutation_audit a join correction_context x on x.competition_id=a.entity_id
  where a.action='competition_gender_reviewed'),2::bigint,'only actual gender changes are audited');
select ok((select bool_and(a.metadata ?& array['previousGenderDivision','genderDivision',
  'seasonId','competitiveDivisionValueId','previousDataProfileId','dataProfileId'])
  from public.admin_mutation_audit a join correction_context x on x.competition_id=a.entity_id
  where a.action='competition_gender_reviewed'),'gender audit includes both contextual identities');

set local role authenticated;
update correction_context set male_gold_id=public.admin_add_competitive_division_value(
  gen_random_uuid(),male_season_id,'Série','serie','Ouro','ouro',1
), male_silver_id=public.admin_add_competitive_division_value(
  gen_random_uuid(),male_season_id,'Série','serie','Prata','prata',2
);
select lives_ok(
  $$select public.admin_assign_competition_competitive_division(competition_id,null,male_gold_id) from correction_context$$,
  'CAS accepts the expected empty division'
);
select throws_ok(
  $$select public.admin_assign_competition_competitive_division(competition_id,null,male_silver_id) from correction_context$$,
  'BD409','BDB_COMPETITION_DIVISION_STALE','divergent stale CAS is rejected'
);
select is(public.admin_assign_competition_competitive_division(competition_id,null,male_gold_id),competition_id,
  'exact retry succeeds after its own CAS changed the row') from correction_context;
select lives_ok(
  $$select public.admin_review_competition_gender(competition_id,'female') from correction_context$$,
  'gender changes without remapping the edition-level competitive division'
);
reset role;
select ok((select c.gender_division='female' and c.season_id=x.male_season_id
  and c.competitive_division_value_id=x.male_gold_id from correction_context x
  join public.competitions c on c.id=x.competition_id),'gender change preserves the same edition-level division');

update correction_context set duplicate_competition_id=pg_temp.create_final_competition(
  null,series_id,category_id,2026,'Colisão feminina','draft',null,'female','manual_scoresheet'
);
set local role authenticated;
select throws_ok(
  $$select public.admin_assign_competition_competitive_division(duplicate_competition_id,null,male_gold_id) from correction_context$$,
  'BD506','BDB_COMPETITION_DISPUTE_CONFLICT','same category gender and division cannot be duplicated'
);
reset role;
select is((select c.competitive_division_value_id from public.competitions c join correction_context x on x.duplicate_competition_id=c.id),
  null::bigint,'failed duplicate assignment preserves the competing dispute');

-- A second male dispute collides only after the first returns to the male context.
select pg_temp.create_final_competition(null,series_id,category_id,2026,'Colisão masculina','draft',null,'male','manual_scoresheet')
from correction_context;
update public.competitions set competitive_division_value_id=(select male_gold_id from correction_context)
where display_name='Colisão masculina';
set local role authenticated;
select throws_ok(
  $$select public.admin_review_competition_gender(competition_id,'male') from correction_context$$,
  'BD506','BDB_COMPETITION_CONTEXT_ALREADY_EXISTS','gender collision returns the stable context conflict'
);
reset role;
select is((select c.gender_division from public.competitions c join correction_context x on x.competition_id=c.id),
  'female','context collision rolls back the gender change');
update public.series_category_data_profiles set status='superseded'
where series_id=(select series_id from correction_context) and gender_division='male';
set local role authenticated;
select throws_ok(
  $$select public.admin_review_competition_gender(competition_id,'male') from correction_context$$,
  'BD409','BDB_COMPETITION_PROFILE_MAPPING_NOT_FOUND','missing active same-source profile never clears required profile fields'
);
select throws_ok(
  $$select public.admin_create_competition_season(gen_random_uuid(),series_id,
    extract(year from current_date)::integer+2,'male','Ano distante',null,null,null) from correction_context$$,
  'BD501','BDB_COMPETITION_SEASON_INPUT_INVALID','season rejects current year plus two'
);
select throws_ok(
  $$select public.admin_create_competition_season(gen_random_uuid(),series_id,1899,
    'male','Ano antigo',null,null,null) from correction_context$$,
  'BD501','BDB_COMPETITION_SEASON_INPUT_INVALID','season rejects year below 1900'
);
select lives_ok(
  $$select public.admin_create_competition_season(gen_random_uuid(),series_id,
    extract(year from current_date)::integer+1,'male','Próximo ano',null,null,null) from correction_context$$,
  'season accepts current year plus one'
);
reset role;

-- Unexpected failures in audit must not become a misleading domain duplicate.
create function pg_temp.reject_correction_audit() returns trigger language plpgsql as $$
begin
  raise unique_violation using constraint='unexpected_audit_unique';
end;
$$;
create trigger reject_correction_audit before insert on public.admin_mutation_audit
for each row execute function pg_temp.reject_correction_audit();
set local role authenticated;
select throws_ok(
  $$select public.admin_create_competition_season(gen_random_uuid(),series_id,1900,
    'male','Erro auditoria',null,null,null) from correction_context$$,
  '23505',null,'unexpected audit uniqueness is not translated as a season conflict'
);
select throws_ok(
  $$select public.admin_add_competitive_division_value(gen_random_uuid(),male_season_id,
    'Série','serie','Bronze','bronze',3) from correction_context$$,
  '23505',null,'unexpected audit uniqueness is not translated as a division conflict'
);
select throws_ok(
  $$select public.admin_assign_competition_competitive_division(competition_id,male_gold_id,male_silver_id) from correction_context$$,
  '23505',null,'unexpected audit uniqueness is not translated as a dispute conflict'
);
reset role;
drop trigger reject_correction_audit on public.admin_mutation_audit;

select set_config('request.jwt.claims',jsonb_set(current_setting('request.jwt.claims')::jsonb,'{aal}','"aal1"')::text,true);
set local role authenticated;
select throws_ok($$select public.admin_review_competition_gender(competition_id,'male') from correction_context$$,
  'BD401','BDB_ADMIN_AAL2_REQUIRED','AAL1 cannot change gender');
select throws_ok($$select public.admin_assign_competition_competitive_division(competition_id,male_gold_id,null) from correction_context$$,
  'BD401','BDB_ADMIN_AAL2_REQUIRED','AAL1 cannot assign division');
reset role;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select throws_ok($$select public.admin_review_competition_gender(1,'male')$$,
  'BD401','BDB_ADMIN_AAL2_REQUIRED','non-admin AAL2 cannot change gender');
reset role;
select * from finish();
rollback;
