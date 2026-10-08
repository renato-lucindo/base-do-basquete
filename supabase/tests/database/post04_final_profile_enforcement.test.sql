begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

select col_not_null(
  'public', 'competitions', 'gender_division',
  'competition gender is mandatory after final enforcement'
);
select col_not_null(
  'public', 'competitions', 'data_profile_id',
  'competition data profile is mandatory after final enforcement'
);
select col_not_null(
  'public', 'competitions', 'data_profile_validated_at',
  'profile validation timestamp is mandatory after final enforcement'
);
select col_not_null(
  'public', 'competitions', 'data_profile_validated_by',
  'profile validation actor is mandatory after final enforcement'
);
select col_not_null(
  'private', 'player_private', 'sex',
  'private eligibility value is mandatory after final enforcement'
);
select has_index(
  'public', 'competitions', 'competitions_dispute_unique',
  array['season_id','category_id','competitive_division_value_id'],
  'final dispute identity is unique by season, category and optional competitive division'
);
select has_fk(
  'public', 'players',
  'every player must have a private profile before commit'
);
select is(
  (
    select condeferrable and condeferred
    from pg_constraint
    where conname = 'players_private_profile_fkey'
  ),
  true,
  'player private profile FK is deferred for atomic creation flows'
);
select is(
  to_regprocedure('private.ensure_player_private_row()'),
  null,
  'legacy null private-row trigger function was removed'
);

insert into auth.users(id)
values ('11111111-1111-4111-8111-111111111111')
on conflict do nothing;
insert into private.admin_accounts(user_id)
select '11111111-1111-4111-8111-111111111111'
where not exists(select 1 from private.admin_accounts);
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', (select user_id from private.admin_accounts limit 1),
  'role', 'authenticated',
  'aal', 'aal2'
)::text, true);

insert into public.competition_series(id,name,slug)
overriding system value values(99601,'POST04 Final','post04-final');
insert into public.categories(id,name,slug)
overriding system value values(99601,'POST04 Final','post04-final');
insert into public.series_category_data_profiles(
  id,series_id,category_id,gender_division,version,primary_source,status,
  created_by,activated_by,activated_at
) overriding system value values(
  99601,99601,99601,'male',1,'manual_scoresheet','active',
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',clock_timestamp()
);
insert into public.competitions(
  id,series_id,category_id,year,display_name,status,
  gender_division,gender_division_review_required,
  data_profile_id,data_profile_review_required,
  data_profile_validated_at,data_profile_validated_by
) overriding system value values(
  99601,99601,99601,2030,'POST04 Final 2030','draft',
  'male',false,99601,false,clock_timestamp(),
  '11111111-1111-4111-8111-111111111111'
);

select throws_ok(
  $$insert into public.competitions(
      series_id,category_id,year,display_name,status,data_profile_id,
      data_profile_validated_at,data_profile_validated_by
    ) values(
      99601,99601,2031,'Sem naipe','draft',99601,clock_timestamp(),
      '11111111-1111-4111-8111-111111111111'
    )$$,
  '23502',
  null,
  'new editions cannot omit gender'
);
select throws_ok(
  $$insert into public.competitions(
      series_id,category_id,year,display_name,status,gender_division,
      gender_division_review_required,data_profile_id,data_profile_review_required,
      data_profile_validated_at,data_profile_validated_by
    ) values(
      99601,99601,2030,'Duplicada','draft','male',false,99601,false,
      clock_timestamp(),'11111111-1111-4111-8111-111111111111'
    )$$,
  '23505',
  null,
  'same year series category and gender cannot be duplicated'
);
select throws_ok(
  $$update public.competitions
    set gender_division_review_required=true where id=99601$$,
  '23514',
  null,
  'gender review cannot be reopened after enforcement'
);
select throws_ok(
  $$update public.competitions
    set data_profile_review_required=true where id=99601$$,
  '23514',
  null,
  'profile review cannot be reopened after enforcement'
);

select lives_ok(
  $$select public.admin_create_player_with_private_profile(
    'Atleta POST04 Completo','male',null,false
  )$$,
  'authorized player creation writes both rows atomically'
);
select is(
  (
    select private_data.sex
    from private.player_private private_data
    join public.players player on player.id=private_data.player_id
    where player.full_name='Atleta POST04 Completo'
  ),
  'male',
  'atomic creation persists the explicit private value'
);
select is(
  (
    select private_data.sex_review_required
    from private.player_private private_data
    join public.players player on player.id=private_data.player_id
    where player.full_name='Atleta POST04 Completo'
  ),
  false,
  'atomic creation leaves no private review pending'
);
select throws_ok(
  $$insert into private.player_private(player_id,sex,sex_review_required)
    select id,null,false from public.players
    where full_name='Atleta POST04 Completo'$$,
  '23502',
  null,
  'private eligibility cannot be null'
);
select throws_ok(
  $$update private.player_private
    set sex_review_required=true
    where player_id=(
      select id from public.players where full_name='Atleta POST04 Completo'
    )$$,
  '23514',
  null,
  'private review cannot be reopened after enforcement'
);
select is(
  public.admin_get_classification_backfill_report() ->> 'enforcementReady',
  'true',
  'classification report confirms the final enforcement queues are empty'
);

select set_config('request.jwt.claims', '{"role":"anon","aal":"aal1"}', true);
select throws_ok(
  $$select * from public.admin_get_player_private_profile(
    (select id from public.players where full_name='Atleta POST04 Completo')
  )$$,
  'BD401',
  'BDB_ADMIN_AAL2_REQUIRED',
  'anon cannot read the private eligibility profile'
);
set local role anon;
select throws_ok(
  $$select sex from private.player_private limit 1$$,
  '42501',
  null,
  'anon cannot read private eligibility rows'
);
reset role;

select * from finish();
rollback;
