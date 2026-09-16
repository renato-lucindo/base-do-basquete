begin;
create extension if not exists pgtap with schema extensions;
select plan(33);
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

create temporary table decision_context (
  competition_id bigint,
  semi_one bigint,
  semi_two bigint,
  final_matchup bigint,
  reg_one bigint,
  reg_two bigint,
  reg_three bigint,
  reg_four bigint,
  scheduled_game bigint,
  started_game bigint,
  request_id uuid
);
with series as (
  insert into public.competition_series(name, slug)
  values ('POST03 decisions', 'post03-decisions') returning id
), category as (
  insert into public.categories(name, slug)
  values ('POST03 decisions', 'post03-decisions') returning id
)
insert into decision_context(competition_id, request_id)
select public.admin_create_competition_from_preset(
  gen_random_uuid(), jsonb_build_object(
    'seriesId', series.id, 'categoryId', category.id, 'year', 2026,
    'name', 'Private administrative decision QA', 'gender', 'male',
    'source', 'manual_scoresheet', 'preset', 'single_elimination',
    'entryCount', 4, 'reviewed', true, 'expectedProfileId', null,
    'startsOn', '2026-01-01', 'endsOn', '2026-12-31'
  )
), gen_random_uuid()
from series, category;
insert into public.teams(name, slug)
select 'POST03 decision team ' || n, 'post03-decision-team-' || n
from generate_series(1, 4) n;
insert into public.team_registrations(competition_id, team_id, status, confirmed_at)
select context.competition_id, team.id, 'confirmed', now()
from decision_context context
join public.teams team on team.slug like 'post03-decision-team-%';
update decision_context context set
  semi_one = (select id from public.matchups
    where competition_id = context.competition_id and code = 'semifinal_match_1'),
  semi_two = (select id from public.matchups
    where competition_id = context.competition_id and code = 'semifinal_match_2'),
  final_matchup = (select id from public.matchups
    where competition_id = context.competition_id and code = 'final_match_1'),
  reg_one = (select registration.id from public.team_registrations registration
    join public.teams team on team.id = registration.team_id
    where registration.competition_id = context.competition_id
      and team.slug = 'post03-decision-team-1'),
  reg_two = (select registration.id from public.team_registrations registration
    join public.teams team on team.id = registration.team_id
    where registration.competition_id = context.competition_id
      and team.slug = 'post03-decision-team-2'),
  reg_three = (select registration.id from public.team_registrations registration
    join public.teams team on team.id = registration.team_id
    where registration.competition_id = context.competition_id
      and team.slug = 'post03-decision-team-3'),
  reg_four = (select registration.id from public.team_registrations registration
    join public.teams team on team.id = registration.team_id
    where registration.competition_id = context.competition_id
      and team.slug = 'post03-decision-team-4');
grant select, update on decision_context to authenticated;

set local role authenticated;
select lives_ok($$
  select public.admin_assign_competition_entry(entry.id, registration.id)
  from public.competition_entries entry
  join decision_context context on context.competition_id = entry.competition_id
  cross join lateral(values
    (1, context.reg_one), (2, context.reg_two),
    (3, context.reg_three), (4, context.reg_four)
  ) registration(seed, id)
  where entry.seed = registration.seed
$$, 'four explicit entries are assigned');
select lives_ok($$
  update decision_context set
    scheduled_game = public.admin_prepare_matchup(
      semi_one, 0, '2026-03-01T18:00:00-03:00', 'Court 1'
    ),
    started_game = public.admin_prepare_matchup(
      semi_two, 0, '2026-03-01T20:00:00-03:00', 'Court 1'
    )
$$, 'two semifinals are explicitly prepared');
select is((select
  (public.admin_get_matchup_administrative_impact(semi_one, reg_one)
    ->>'dependentSlots')::integer from decision_context), 1,
  'impact preview identifies the future winner slot');
select is((select
  public.admin_get_matchup_administrative_impact(semi_one, reg_one)
    ->'game'->>'status' from decision_context), 'scheduled',
  'impact preview exposes the existing unstarted game');
select throws_ok($$
  select public.admin_resolve_matchup_administratively(
    request_id, semi_one, reg_four, reg_one, reg_one,
    'walkover', 'W.O. confirmado pela organização'
  ) from decision_context
$$, 'BR083', 'BDB_MATCHUP_PARTICIPANTS_CHANGED_RELOAD',
  'stale or inverted participants cannot be trusted');
select throws_ok($$
  select public.admin_resolve_matchup_administratively(
    request_id, semi_one, reg_one, reg_four, reg_one,
    'unsupported', 'Decisão inválida para teste'
  ) from decision_context
$$, 'BR082', 'BDB_ADMINISTRATIVE_DECISION_INPUT_INVALID',
  'decision type is allowlisted');
select throws_ok($$
  select public.admin_resolve_matchup_administratively(
    request_id, semi_one, reg_one, reg_four, reg_one,
    'walkover', 'curto'
  ) from decision_context
$$, 'BR082', 'BDB_ADMINISTRATIVE_DECISION_INPUT_INVALID',
  'administrative reason is mandatory and meaningful');
select lives_ok($$
  select public.admin_resolve_matchup_administratively(
    request_id, semi_one, reg_one, reg_four, reg_one,
    'walkover', 'W.O. confirmado pela organização'
  ) from decision_context
$$, 'AAL2 records a W.O. without a score');
select is((select status from public.games
  where id = (select scheduled_game from decision_context)), 'cancelled',
  'an existing unstarted game is preserved and cancelled');
select is((select winner_registration_id
  from public.matchup_administrative_resolutions
  where matchup_id = (select semi_one from decision_context)),
  (select reg_one from decision_context),
  'winner is stored as an immutable sporting fact');
select is((select loser_registration_id
  from public.matchup_administrative_resolutions
  where matchup_id = (select semi_one from decision_context)),
  (select reg_four from decision_context),
  'loser is derived from locked matchup participants');
select is((select decision_type from public.matchup_administrative_resolutions
  where matchup_id = (select semi_one from decision_context)),
  'walkover', 'typed decision is retained without a fake score');
select is((select count(*) from public.game_period_scores
  where game_id = (select scheduled_game from decision_context)),
  0::bigint, 'W.O. creates no period or score row');
select ok((select home_registration_id = reg_one
    or away_registration_id = reg_one
  from public.matchups, decision_context
  where id = final_matchup),
  'administrative winner propagates to the dependent final');
select is((select count(*) from public.games
  where matchup_id = (select final_matchup from decision_context)),
  0::bigint, 'progression still does not invent the final game');
select is((select public.admin_resolve_matchup_administratively(
  request_id, semi_one, reg_one, reg_four, reg_one,
  'walkover', 'W.O. confirmado pela organização'
)->>'outcome' from decision_context), 'unchanged',
  'identical request replay is idempotent');
select throws_ok($$
  select public.admin_resolve_matchup_administratively(
    request_id, semi_one, reg_one, reg_four, reg_one,
    'withdrawal', 'Desistência posterior com a mesma chave'
  ) from decision_context
$$, 'BR010', 'BDB_IDEMPOTENCY_CONFLICT',
  'changed decision cannot reuse an idempotency key');
select throws_ok($$
  select public.admin_resolve_matchup_administratively(
    gen_random_uuid(), semi_one, reg_one, reg_four, reg_one,
    'walkover', 'Nova tentativa sobre decisão existente'
  ) from decision_context
$$, 'BR081', 'BDB_MATCHUP_ALREADY_RESOLVED',
  'resolved matchup cannot receive a second decision');
select is((select count(*) from public.admin_mutation_audit
  where action = 'matchup_administratively_resolved'
    and entity_id = (select semi_one from decision_context)),
  1::bigint, 'one essential audit row records the decision');
select throws_ok($$
  update public.matchup_administrative_resolutions
  set reason = 'Alteração indevida do fato histórico'
  where matchup_id = (select semi_one from decision_context)
$$, '42501', null, 'direct mutation of the resolution is denied');
reset role;

update public.games set status = 'live', started_at = scheduled_at
where id = (select started_game from decision_context);
set local role authenticated;
select throws_ok($$
  select public.admin_resolve_matchup_administratively(
    gen_random_uuid(), semi_two, reg_two, reg_three, reg_three,
    'administrative_decision', 'Decisão tentada após o início do jogo'
  ) from decision_context
$$, 'BR084', 'BDB_STARTED_GAME_REQUIRES_AMENDMENT',
  'started game is a hard cutoff and requires an amendment');
reset role;

create temporary table group_decision_context (
  competition_id bigint, group_id bigint, matchup_id bigint,
  home_registration_id bigint, away_registration_id bigint,
  decision_request_id uuid, closure_request_id uuid, source_hash text
);
with series as (
  insert into public.competition_series(name, slug)
  values ('POST03 group decision', 'post03-group-decision') returning id
), category as (
  insert into public.categories(name, slug)
  values ('POST03 group decision', 'post03-group-decision') returning id
)
insert into group_decision_context(
  competition_id, decision_request_id, closure_request_id
)
select public.admin_create_competition_from_preset(
  gen_random_uuid(), jsonb_build_object(
    'seriesId', series.id, 'categoryId', category.id, 'year', 2026,
    'name', 'Private group administrative QA', 'gender', 'female',
    'source', 'manual_scoresheet', 'preset', 'single_group',
    'entryCount', 2, 'reviewed', true, 'expectedProfileId', null,
    'startsOn', '2026-01-01', 'endsOn', '2026-12-31'
  )
), gen_random_uuid(), gen_random_uuid()
from series, category;
insert into public.teams(name, slug)
values ('POST03 group home', 'post03-group-home'),
  ('POST03 group away', 'post03-group-away');
insert into public.team_registrations(competition_id, team_id, status, confirmed_at)
select context.competition_id, team.id, 'confirmed', now()
from group_decision_context context
join public.teams team on team.slug like 'post03-group-%';
update group_decision_context context set
  group_id = (select id from public.competition_groups
    where competition_id = context.competition_id),
  matchup_id = (select id from public.matchups
    where competition_id = context.competition_id),
  home_registration_id = (select registration.id
    from public.team_registrations registration
    join public.teams team on team.id = registration.team_id
    where registration.competition_id = context.competition_id
      and team.slug = 'post03-group-home'),
  away_registration_id = (select registration.id
    from public.team_registrations registration
    join public.teams team on team.id = registration.team_id
    where registration.competition_id = context.competition_id
      and team.slug = 'post03-group-away');
grant select, update on group_decision_context to authenticated;
set local role authenticated;
select lives_ok($$
  select public.admin_assign_competition_entry(entry.id, registration.id)
  from public.competition_entries entry
  join group_decision_context context
    on context.competition_id = entry.competition_id
  cross join lateral(values
    (1, context.home_registration_id),
    (2, context.away_registration_id)
  ) registration(seed, id)
  where entry.seed = registration.seed
$$, 'group entries are assigned');
select lives_ok($$
  select public.admin_resolve_matchup_administratively(
    decision_request_id, matchup_id, home_registration_id,
    away_registration_id, home_registration_id, 'withdrawal',
    'Desistência formal registrada antes da partida'
  ) from group_decision_context
$$, 'withdrawal resolves a group matchup without creating a game');
select is((select count(*) from public.games
  where competition_id = (select competition_id from group_decision_context)),
  0::bigint, 'group withdrawal creates no game');
select ok((select
  (public.admin_get_group_closure_preview(group_id)->>'eligible')::boolean
  from group_decision_context),
  'administrative group result is valid closure evidence');
select is((select (standing->>'wins')::integer
  from group_decision_context context,
    lateral jsonb_array_elements(
      public.admin_get_group_closure_preview(context.group_id)->'standings'
    ) standing
  where (standing->>'registrationId')::bigint =
    context.home_registration_id), 1,
  'administrative winner receives a win');
select is((select (standing->>'pointsFor')::integer
  from group_decision_context context,
    lateral jsonb_array_elements(
      public.admin_get_group_closure_preview(context.group_id)->'standings'
    ) standing
  where (standing->>'registrationId')::bigint =
    context.home_registration_id), 0,
  'administrative result never fabricates points');
select lives_ok($$
  update group_decision_context set source_hash =
    public.admin_get_group_closure_preview(group_id)->>'sourceHash'
$$, 'server source hash is captured after the decision');
select lives_ok($$
  select public.admin_close_competition_group(
    closure_request_id, group_id, source_hash,
    array[home_registration_id, away_registration_id],
    null, '[]'::jsonb
  ) from group_decision_context
$$, 'group closes from the typed decision snapshot');
select is((select points_for from public.competition_group_closure_rows
  where closure_id = (select id from public.competition_group_closures
    where group_id = (select group_id from group_decision_context))
    and position = 1), 0,
  'immutable closure also retains zero synthetic points');

select set_config('request.jwt.claims', jsonb_set(
  current_setting('request.jwt.claims')::jsonb, '{aal}', '"aal1"'
)::text, true);
select throws_ok($$
  select public.admin_resolve_matchup_administratively(
    null, null, null, null, null, null, null
  )
$$, 'BD401', 'BDB_ADMIN_AAL2_REQUIRED',
  'AAL1 cannot create a sporting decision');
select is((select count(*) from public.matchup_administrative_resolutions),
  0::bigint, 'AAL1 cannot read decisions through RLS');
reset role;
set local role anon;
select throws_ok($$
  select public.admin_resolve_matchup_administratively(
    null, null, null, null, null, null, null
  )
$$, '42501', null, 'anon cannot execute the decision RPC');
reset role;

select * from finish();
rollback;
