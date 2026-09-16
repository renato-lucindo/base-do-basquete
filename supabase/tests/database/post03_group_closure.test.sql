begin;
create extension if not exists pgtap with schema extensions;
select plan(29);
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

create temporary table closure_context (
  competition_id bigint,
  group_id bigint,
  matchup_id bigint,
  home_registration_id bigint,
  away_registration_id bigint,
  game_id bigint,
  submission_id bigint,
  source_hash text,
  request_id uuid,
  closure_id bigint
);

with series as (
  insert into public.competition_series(name, slug)
  values ('POST03 closure', 'post03-closure') returning id
), category as (
  insert into public.categories(name, slug)
  values ('POST03 closure', 'post03-closure') returning id
)
insert into closure_context(competition_id, request_id)
select public.admin_create_competition_from_preset(
  gen_random_uuid(), jsonb_build_object(
    'seriesId', series.id, 'categoryId', category.id, 'year', 2026,
    'name', 'Private group closure QA', 'gender', 'male',
    'source', 'manual_scoresheet', 'preset', 'single_group',
    'entryCount', 2, 'reviewed', true, 'expectedProfileId', null,
    'startsOn', '2026-01-01', 'endsOn', '2026-12-31'
  )
), gen_random_uuid()
from series, category;

insert into public.teams(name, slug)
values ('POST03 home team', 'post03-closure-home'),
  ('POST03 away team', 'post03-closure-away');
insert into public.team_registrations(competition_id, team_id, status, confirmed_at)
select context.competition_id, team.id, 'confirmed', now()
from closure_context context
join public.teams team on team.slug like 'post03-closure-%';
update closure_context context set
  group_id = (select id from public.competition_groups
    where competition_id = context.competition_id),
  matchup_id = (select id from public.matchups
    where competition_id = context.competition_id),
  home_registration_id = (select registration.id
    from public.team_registrations registration
    join public.teams team on team.id = registration.team_id
    where registration.competition_id = context.competition_id
      and team.slug = 'post03-closure-home'),
  away_registration_id = (select registration.id
    from public.team_registrations registration
    join public.teams team on team.id = registration.team_id
    where registration.competition_id = context.competition_id
      and team.slug = 'post03-closure-away');
grant select, update on closure_context to authenticated;

set local role authenticated;
select lives_ok($$
  select public.admin_assign_competition_entry(entry.id, registration.id)
  from public.competition_entries entry
  join closure_context context on context.competition_id = entry.competition_id
  cross join lateral(values
    (1, context.home_registration_id),
    (2, context.away_registration_id)
  ) registration(seed, id)
  where entry.seed = registration.seed
$$, 'both group entries are explicitly assigned');
select ok((select not (public.admin_get_group_closure_preview(group_id)->>'eligible')::boolean
  from closure_context), 'provisional group is not eligible to close');
select throws_ok($$
  select public.admin_close_competition_group(request_id, group_id,
    public.admin_get_group_closure_preview(group_id)->>'sourceHash',
    array[home_registration_id, away_registration_id], null, '[]'::jsonb)
  from closure_context
$$, 'BR073', 'BDB_GROUP_RESULTS_INCOMPLETE',
  'unfinished group cannot create a closure');
select lives_ok($$
  update closure_context set game_id = public.admin_prepare_matchup(
    matchup_id, 0, '2026-03-01T18:00:00-03:00', 'Court 1')
$$, 'administrator prepares the group game explicitly');
reset role;

insert into public.game_periods(game_id, period_number)
select context.game_id, period
from closure_context context cross join generate_series(1, 4) period;
insert into public.game_period_scores(game_id, registration_id, period_number, points)
select context.game_id, score.registration_id, score.period_number, score.points
from closure_context context
cross join lateral(values
  (context.home_registration_id, 1, 20),
  (context.home_registration_id, 2, 20),
  (context.home_registration_id, 3, 20),
  (context.home_registration_id, 4, 20),
  (context.away_registration_id, 1, 15),
  (context.away_registration_id, 2, 15),
  (context.away_registration_id, 3, 15),
  (context.away_registration_id, 4, 15)
) score(registration_id, period_number, points);
update public.games set status = 'final', started_at = scheduled_at,
  ended_at = scheduled_at + interval '2 hours'
where id = (select game_id from closure_context);

select is((select jsonb_array_length(
  public.admin_get_group_closure_preview(group_id)->'invalidMatchupIds'
) from closure_context), 1, 'final scores without official authority remain invalid');

with submission as (
  insert into public.game_data_submissions(
    game_id, submission_version, source_type, role, status,
    payload_hash, idempotency_key, submitted_by, validated_by, validated_at
  )
  select context.game_id, 1, 'manual_scoresheet', 'primary', 'active',
    repeat('a', 64), 'post03-closure-source',
    (select user_id from private.admin_accounts limit 1),
    (select user_id from private.admin_accounts limit 1), now()
  from closure_context context returning id, game_id, source_type
)
insert into public.game_data_domain_authority(
  game_id, domain, submission_id, source_type, activated_by
)
select submission.game_id, 'official_result', submission.id,
  submission.source_type, (select user_id from private.admin_accounts limit 1)
from submission;
update closure_context context set
  submission_id = (select submission_id
    from public.game_data_domain_authority authority
    where authority.game_id = context.game_id
      and authority.domain = 'official_result'),
  source_hash = public.admin_get_group_closure_preview(context.group_id)->>'sourceHash';

set local role authenticated;
select ok((select (public.admin_get_group_closure_preview(group_id)->>'eligible')::boolean
  from closure_context), 'active primary official result enables group closure');
select is((select (standing->>'wins')::integer
  from closure_context context,
    lateral jsonb_array_elements(
      public.admin_get_group_closure_preview(context.group_id)->'standings'
    ) standing
  where (standing->>'registrationId')::bigint = context.home_registration_id),
  1, 'home win is computed in PostgreSQL from canonical scores');
select throws_ok($$
  select public.admin_close_competition_group(request_id, group_id,
    repeat('0', 32), array[home_registration_id, away_registration_id],
    null, '[]'::jsonb) from closure_context
$$, 'BR074', 'BDB_GROUP_RESULTS_CHANGED_RELOAD',
  'stale source hash cannot close the group');
select throws_ok($$
  select public.admin_close_competition_group(request_id, group_id,
    source_hash, array[away_registration_id, home_registration_id],
    null, '[]'::jsonb) from closure_context
$$, 'BR075', 'BDB_GROUP_ORDER_INVALID',
  'fewer wins cannot be promoted above more wins');
select throws_ok($$
  select public.admin_close_competition_group(request_id, group_id,
    source_hash, array[home_registration_id, home_registration_id],
    null, '[]'::jsonb) from closure_context
$$, 'BR075', 'BDB_GROUP_ORDER_INVALID',
  'duplicate registration in final order is rejected');
select throws_ok($$
  select public.admin_close_competition_group(request_id, group_id,
    source_hash, array[home_registration_id, away_registration_id],
    null, '[{"position":1,"slotId":1}]'::jsonb) from closure_context
$$, 'BR077', 'BDB_GROUP_ADVANCEMENT_INVALID',
  'a slot outside a later stage cannot be advanced');
select lives_ok($$
  update closure_context set closure_id = (
    public.admin_close_competition_group(request_id, group_id,
      source_hash, array[home_registration_id, away_registration_id],
      null, '[]'::jsonb)->>'closureId'
  )::bigint
$$, 'complete authoritative result closes the group once');
select is((select wins from public.competition_group_closure_rows
  where closure_id = (select closure_id from closure_context) and position = 1),
  1, 'winner position is frozen in the immutable snapshot');
select is((select points_for from public.competition_group_closure_rows
  where closure_id = (select closure_id from closure_context) and position = 1),
  80, 'canonical points are snapshotted');
select is((select points_against from public.competition_group_closure_rows
  where closure_id = (select closure_id from closure_context) and position = 1),
  60, 'canonical points against are snapshotted');
select is((select (result->>'submissionId')::bigint
  from public.competition_group_closures closure,
  lateral jsonb_array_elements(closure.source_results) result
  where closure.id = (select closure_id from closure_context)),
  (select submission_id from closure_context),
  'closure pins the active official submission ID');
select is((select count(*) from public.competition_group_closure_rows
  where closure_id = (select closure_id from closure_context)),
  2::bigint, 'every assigned team has exactly one frozen row');
select is((select count(*) from public.games
  where competition_id = (select competition_id from closure_context)),
  1::bigint, 'closing a group never invents a dependent game');
select is((select count(*) from public.admin_mutation_audit
  where action = 'competition_group_closed'
    and entity_id = (select group_id from closure_context)),
  1::bigint, 'closure creates one essential audit event');
select is((select public.admin_close_competition_group(request_id, group_id,
  source_hash, array[home_registration_id, away_registration_id], null,
  '[]'::jsonb)->>'outcome' from closure_context),
  'unchanged', 'identical request replay is idempotent');
select throws_ok($$
  select public.admin_close_competition_group(request_id, group_id,
    source_hash, array[away_registration_id, home_registration_id],
    null, '[]'::jsonb) from closure_context
$$, 'BR010', 'BDB_IDEMPOTENCY_CONFLICT',
  'reused request with changed order conflicts');
select throws_ok($$
  select public.admin_close_competition_group(gen_random_uuid(), group_id,
    source_hash, array[home_registration_id, away_registration_id],
    null, '[]'::jsonb) from closure_context
$$, 'BR070', 'BDB_GROUP_CLOSURE_IMMUTABLE',
  'another request cannot reclose an immutable group');
select throws_ok($$
  update public.competition_group_closure_rows set wins = 0
  where closure_id = (select closure_id from closure_context)
$$, '42501', null, 'direct snapshot write is denied');
select ok((select (public.admin_get_group_closure_preview(group_id)->>'closed')::boolean
  from closure_context), 'preview reports closure state explicitly');

select set_config('request.jwt.claims', jsonb_set(
  current_setting('request.jwt.claims')::jsonb, '{aal}', '"aal1"'
)::text, true);
select throws_ok($$
  select public.admin_close_competition_group(null, null, null, null, null, null)
$$, 'BD401', 'BDB_ADMIN_AAL2_REQUIRED',
  'AAL1 is rejected before closure input validation');
select is((select count(*) from public.competition_group_closures),
  0::bigint, 'AAL1 cannot read private closures through RLS');
reset role;
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',
  true);
set local role authenticated;
select throws_ok($$
  select public.admin_get_group_closure_preview(null)
$$, 'BD401', 'BDB_ADMIN_AAL2_REQUIRED',
  'non-admin AAL2 cannot preview group source');
reset role;
set local role anon;
select throws_ok($$
  select public.admin_close_competition_group(null, null, null, null, null, null)
$$, '42501', null, 'anon cannot execute the closure RPC');
select throws_ok($$
  select * from public.competition_group_closures
$$, '42501', null, 'anon cannot read closure snapshots');
reset role;

select * from finish();
rollback;
