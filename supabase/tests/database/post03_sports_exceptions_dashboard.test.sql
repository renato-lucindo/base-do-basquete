begin;
create extension if not exists pgtap with schema extensions;
select plan(8);
set constraints all deferred;

insert into auth.users(id)
values ('11111111-1111-4111-8111-111111111111') on conflict do nothing;
insert into private.admin_accounts(user_id)
select '11111111-1111-4111-8111-111111111111'
where not exists(select 1 from private.admin_accounts);
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', (select user_id from private.admin_accounts limit 1),
  'role', 'authenticated', 'aal', 'aal2'
)::text, true);

create temporary table dashboard_context(
  competition_id bigint, matchup_id bigint,
  home_registration_id bigint, away_registration_id bigint
);
with series as (
  insert into public.competition_series(name, slug)
  values ('POST03 dashboard', 'post03-dashboard') returning id
), category as (
  insert into public.categories(name, slug)
  values ('POST03 dashboard', 'post03-dashboard') returning id
)
insert into dashboard_context(competition_id)
select public.admin_create_competition_from_preset(
  gen_random_uuid(), jsonb_build_object(
    'seriesId', series.id, 'categoryId', category.id, 'year', 2026,
    'name', 'Private exceptions dashboard QA', 'gender', 'female',
    'source', 'manual_scoresheet', 'preset', 'single_elimination',
    'entryCount', 2, 'reviewed', true, 'expectedProfileId', null,
    'startsOn', '2026-01-01', 'endsOn', '2026-12-31'
  )
) from series, category;
insert into public.teams(name, slug)
values ('POST03 dashboard home', 'post03-dashboard-home'),
  ('POST03 dashboard away', 'post03-dashboard-away');
insert into public.team_registrations(competition_id, team_id, status, confirmed_at)
select context.competition_id, team.id, 'confirmed', now()
from dashboard_context context
join public.teams team on team.slug like 'post03-dashboard-%';
update dashboard_context context set
  matchup_id = (select id from public.matchups
    where competition_id = context.competition_id),
  home_registration_id = (select registration.id
    from public.team_registrations registration
    join public.teams team on team.id = registration.team_id
    where registration.competition_id = context.competition_id
      and team.slug = 'post03-dashboard-home'),
  away_registration_id = (select registration.id
    from public.team_registrations registration
    join public.teams team on team.id = registration.team_id
    where registration.competition_id = context.competition_id
      and team.slug = 'post03-dashboard-away');
grant select on dashboard_context to authenticated;

set local role authenticated;
select lives_ok($$
  select public.admin_assign_competition_entry(entry.id, registration.id)
  from public.competition_entries entry
  join dashboard_context context on context.competition_id = entry.competition_id
  cross join lateral(values
    (1, context.home_registration_id),
    (2, context.away_registration_id)
  ) registration(seed, id)
  where entry.seed = registration.seed
$$, 'dashboard fixture entries are assigned');
select lives_ok($$
  select public.admin_resolve_matchup_administratively(
    gen_random_uuid(), matchup_id, home_registration_id,
    away_registration_id, home_registration_id,
    'walkover', 'W.O. confirmado para o contrato do dashboard'
  ) from dashboard_context
$$, 'dashboard fixture has one typed decision');
select is((select public.admin_get_sports_exceptions_dashboard(competition_id)
  ->>'preset' from dashboard_context), 'single_elimination',
  'dashboard identifies the active preset');
select is((select jsonb_array_length(
  public.admin_get_sports_exceptions_dashboard(competition_id)->'matchups'
) from dashboard_context), 1, 'dashboard contains the active matchup graph');
select is((select (matchup->'outcome'->>'winnerRegistrationId')::bigint
  from dashboard_context context,
    lateral jsonb_array_elements(
      public.admin_get_sports_exceptions_dashboard(context.competition_id)->'matchups'
    ) matchup), (select home_registration_id from dashboard_context),
  'dashboard exposes the immutable winner');
select is((select jsonb_array_length(
  public.admin_get_sports_exceptions_dashboard(competition_id)->'groups'
) from dashboard_context), 0, 'knockout dashboard has no group action');
select set_config('request.jwt.claims', jsonb_set(
  current_setting('request.jwt.claims')::jsonb, '{aal}', '"aal1"'
)::text, true);
select throws_ok($$
  select public.admin_get_sports_exceptions_dashboard(null)
$$, 'BD401', 'BDB_ADMIN_AAL2_REQUIRED', 'AAL1 cannot load the private dashboard');
reset role;
set local role anon;
select throws_ok($$
  select public.admin_get_sports_exceptions_dashboard(null)
$$, '42501', null, 'anon cannot execute the dashboard RPC');
reset role;

select * from finish();
rollback;
