begin;
\ir ../helpers/final_profile_fixtures.inc
create extension if not exists pgtap with schema extensions;
select plan(35);
set constraints all deferred;
insert into auth.users(id) values('11111111-1111-4111-8111-111111111111') on conflict do nothing;
insert into private.admin_accounts(user_id) select '11111111-1111-4111-8111-111111111111'
where not exists(select 1 from private.admin_accounts);
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from private.admin_accounts limit 1),'role','authenticated','aal','aal2')::text,true);

create temporary table preset_context(series_id bigint,category_id bigint,request_id uuid,input jsonb,competition_id bigint);
with s as (insert into public.competition_series(name,slug) values('MVP03 test','mvp03-test') returning id),
c as (insert into public.categories(name,slug) values('MVP03 test','mvp03-test') returning id)
insert into preset_context(series_id,category_id,request_id) select s.id,c.id,'ee19b8f0-f345-46a5-ac6a-2b33c1dafd23'::uuid from s,c;
update preset_context set input=jsonb_build_object('seriesId',series_id,'categoryId',category_id,'year',1901,
'name','Edição teste','gender','male','source','manual_scoresheet','preset','single_elimination',
'entryCount',4,'reviewed',true,'expectedProfileId',null);
grant select,update on preset_context to authenticated;

set local role authenticated;
select lives_ok($$update preset_context set competition_id=public.admin_create_competition_from_preset(request_id,input)$$,'AAL2 creates private edition atomically');
select is(public.admin_create_competition_from_preset(request_id,input),competition_id,'identical retry returns the same edition') from preset_context;
select throws_ok($$select public.admin_create_competition_from_preset(request_id,input||'{"name":"Different"}'::jsonb) from preset_context$$,
'BR010','BDB_IDEMPOTENCY_CONFLICT','changed request cannot reuse idempotency key');
select throws_ok($$insert into public.competitions(series_id,category_id,year,display_name) select series_id,category_id,1902,'Bypass' from preset_context$$,
'42501',null,'direct edition creation is denied');
select throws_ok($$update public.competition_slots set origin_kind='entry'$$,'42501',null,'direct structural writes denied');
select is((select status from public.competitions where id=(select competition_id from preset_context)),'draft','edition stays private draft');
select is((select count(*) from public.games where competition_id=(select competition_id from preset_context)),0::bigint,'no games invented at creation');
select is((select count(*) from public.matchups where competition_id=(select competition_id from preset_context)),3::bigint,'four entries compile three reserved matchups');
select is((select count(*) from public.competition_slots where competition_id=(select competition_id from preset_context)),6::bigint,'two relational slots per matchup');
select is((select count(*) from public.competition_ruleset_revisions where competition_id=(select competition_id from preset_context) and status='active'),1::bigint,'one active revision');
reset role;
select is(private.preset_blueprint((select id from public.competition_ruleset_revisions where competition_id=(select competition_id from preset_context))),
  private.compile_competition_preset_v1('single_elimination',4),'persisted FKs reconstruct the canonical preset');
select throws_ok($$update public.competition_ruleset_revisions set entry_count=8 where competition_id=(select competition_id from preset_context)$$,
'BR004','BDB_ACTIVE_RULESET_IMMUTABLE','active revision immutable even for owner writes');
select throws_ok($$update public.competition_rounds set name='Changed' where competition_id=(select competition_id from preset_context)$$,
'BR004','BDB_ACTIVE_RULESET_IMMUTABLE','active structure immutable');
select throws_ok($$delete from public.competition_slots where competition_id=(select competition_id from preset_context)$$,
'BR004','BDB_ACTIVE_RULESET_IMMUTABLE','active slot cannot be removed');
select is((select count(*) from public.admin_mutation_audit where action='competition_created_from_preset' and entity_id=(select competition_id from preset_context)),1::bigint,'one audit event for idempotent creation');

select set_config('request.jwt.claims',jsonb_set(current_setting('request.jwt.claims')::jsonb,'{aal}','"aal1"')::text,true);
set local role authenticated;
select throws_ok($$select public.admin_create_competition_from_preset(null,'{}')$$,'BD401','BDB_ADMIN_AAL2_REQUIRED','AAL1 rejected before input processing');
select is((select count(*) from public.competition_slots),0::bigint,'AAL1 cannot read structure');
reset role;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select throws_ok($$select public.admin_create_competition_from_preset(null,'{}')$$,'BD401','BDB_ADMIN_AAL2_REQUIRED','non-admin AAL2 rejected');
reset role;
set local role anon;
select throws_ok($$select public.admin_create_competition_from_preset(null,'{}')$$,'42501',null,'anon cannot invoke creation');
select throws_ok($$select * from public.competition_slots$$,'42501',null,'anon cannot read slots');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from private.admin_accounts limit 1),'role','authenticated','aal','aal2')::text,true);
select throws_ok($$select public.admin_create_competition_from_preset(gen_random_uuid(),input||'{"year":1899}'::jsonb) from preset_context$$,
'BR009','BDB_EDITION_INPUT_INVALID','invalid year rejected');
select throws_ok($$select public.admin_create_competition_from_preset(gen_random_uuid(),input||'{"gender":null}'::jsonb) from preset_context$$,
'BR009','BDB_EDITION_INPUT_INVALID','explicit gender required');
select throws_ok($$select public.admin_create_competition_from_preset(gen_random_uuid(),input||'{"startsOn":"2026-02-30"}'::jsonb) from preset_context$$,
'BR009','BDB_EDITION_INPUT_INVALID','impossible date rejected');
select throws_ok($$select public.admin_create_competition_from_preset(gen_random_uuid(),input||'{"entryCount":17}'::jsonb) from preset_context$$,
'BR002','BDB_PRESET_CAPACITY_INVALID','capacity cannot exceed preset');
select throws_ok($$select public.admin_create_competition_from_preset(gen_random_uuid(),input||'{"year":1902}'::jsonb) from preset_context$$,
'BR012','BDB_PROFILE_CHANGED_RELOAD','stale profile choice rejected');
select is((select count(*) from public.competitions where series_id=(select series_id from preset_context)),1::bigint,'failed attempts leave no partial editions');

-- All sizes and both presets, with explicit historical years and genders.
do $$
declare key text; n integer; payload jsonb;
begin
  foreach key in array array['single_group','single_elimination'] loop
    for n in 2..16 loop
      select input||jsonb_build_object('year',1910+n,'gender',case key when 'single_group' then 'male' else 'female' end,
        'preset',key,'entryCount',n,'expectedProfileId',(
          select p.id from public.series_category_data_profiles p where p.series_id=c.series_id and p.category_id=c.category_id
          and p.gender_division=case key when 'single_group' then 'male' else 'female' end and p.status='active'
        )) into payload from preset_context c;
      perform public.admin_create_competition_from_preset(gen_random_uuid(),payload);
    end loop;
  end loop;
end;
$$;
select is((select count(*) from public.competitions where series_id=(select series_id from preset_context)),31::bigint,'all thirty preset configurations materialize');
select ok(not exists(select 1 from public.competition_ruleset_revisions r join public.competitions c on c.id=r.competition_id
  where c.series_id=(select series_id from preset_context) and private.preset_blueprint(r.id) is distinct from private.compile_competition_preset_v1(r.preset_key,r.entry_count)),
'every materialized blueprint matches its compiler');
select ok(not exists(select 1 from public.competitions where series_id=(select series_id from preset_context) and (status<>'draft' or published_at is not null)),
'all historical male/female editions remain private');
select is((select count(*) from public.games where competition_id in(select id from public.competitions where series_id=(select series_id from preset_context))),0::bigint,
'no phantom games in any configuration');
select throws_ok($$insert into public.games(competition_id,matchup_id,matchup_game_number)
  select competition_id,id,1 from public.matchups where competition_id=(select competition_id from preset_context) limit 1$$,
'BR014','BDB_PRESET_GAME_NOT_READY','unresolved origins cannot become games');

create temporary table draft_contract(competition_id bigint,revision_id bigint,round_id bigint,slots bigint[]);
do $$
declare c bigint; rev bigint; st bigint; rnd bigint; e bigint; sl bigint; all_slots bigint[] := '{}'; i integer;
begin
  select pg_temp.create_final_competition(
    null,series_id,category_id,1950,'Contrato de teste','draft',null,'male','manual_scoresheet'
  ) into c from preset_context;
  insert into public.competition_ruleset_revisions(competition_id,revision_number,structure_kind,preset_key,preset_version,entry_count,created_by)
  values(c,1,'regulated','single_elimination',1,6,auth.uid()) returning id into rev;
  insert into public.competition_stages(competition_id,ruleset_revision_id,code,name,stage_order,structure_kind)
  values(c,rev,'test','Teste',1,'regulated') returning id into st;
  insert into public.competition_rounds(competition_id,stage_id,ruleset_revision_id,code,name,round_order,structure_kind,round_role,capacity,max_matchups)
  values(c,st,rev,'semifinal','Semifinal',1,'regulated','semifinal',4,2) returning id into rnd;
  for i in 1..6 loop
    insert into public.competition_entries(competition_id,ruleset_revision_id,seed) values(c,rev,i) returning id into e;
    insert into public.competition_slots(competition_id,ruleset_revision_id,round_id,origin_kind,entry_id)
    values(c,rev,rnd,'entry',e) returning id into sl;
    all_slots:=array_append(all_slots,sl);
  end loop;
  for i in 1..2 loop
    insert into public.matchups(competition_id,round_id,ruleset_revision_id,code,home_slot_id,away_slot_id,matchup_order,structure_kind,match_format,max_games)
    values(c,rnd,rev,'test_'||i,all_slots[2*i-1],all_slots[2*i],i,'regulated','single_game',1);
  end loop;
  insert into draft_contract values(c,rev,rnd,all_slots);
end;
$$;
select throws_ok($$insert into public.matchups(competition_id,round_id,ruleset_revision_id,code,home_slot_id,away_slot_id,matchup_order,structure_kind,match_format,max_games)
 select competition_id,round_id,revision_id,'third',slots[5],slots[6],3,'regulated','single_game',1 from draft_contract$$,
'BR006','BDB_ROUND_CAPACITY_EXCEEDED','third semifinal refused under the same locked round');
select throws_ok($$insert into public.competition_slots(competition_id,ruleset_revision_id,round_id,origin_kind,source_matchup_id)
 select d.competition_id,d.revision_id,d.round_id,'winner',m.id from draft_contract d join public.matchups m on m.competition_id=d.competition_id limit 1$$,
'BR003','BDB_PRESET_SOURCE_INVALID','same-round winner origin refused');
select throws_ok($$update public.competition_ruleset_revisions set status='active',activated_at=now() where id=(select revision_id from draft_contract)$$,
'BR005','BDB_RULESET_VALIDATION_FAILED','incomplete or altered graph cannot activate');
select throws_ok($$insert into public.competition_slots(competition_id,ruleset_revision_id,round_id,origin_kind,entry_id)
 select d.competition_id,d.revision_id,d.round_id,'entry',e.id from draft_contract d cross join public.competition_entries e
 where e.competition_id=(select competition_id from preset_context) limit 1$$,
'23503',null,'entry from another revision rejected by contextual FK');
select * from finish();
rollback;
