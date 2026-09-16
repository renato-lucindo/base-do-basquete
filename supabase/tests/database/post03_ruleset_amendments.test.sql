begin;
create extension if not exists pgtap with schema extensions;
select plan(34);
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

create temporary table amendment_context (
  competition_id bigint,
  source_revision_id bigint,
  semi_one bigint,
  semi_two bigint,
  final_matchup bigint,
  reg_one bigint,
  reg_two bigint,
  reg_three bigint,
  reg_four bigint,
  final_game bigint,
  amendment_request_id uuid,
  amendment_id bigint,
  target_revision_id bigint,
  target_semi_one bigint,
  target_semi_two bigint,
  target_final bigint,
  target_final_game bigint
);
with series as (
  insert into public.competition_series(name, slug)
  values ('POST03 amendments', 'post03-amendments') returning id
), category as (
  insert into public.categories(name, slug)
  values ('POST03 amendments', 'post03-amendments') returning id
)
insert into amendment_context(competition_id, amendment_request_id)
select public.admin_create_competition_from_preset(
  gen_random_uuid(), jsonb_build_object(
    'seriesId', series.id, 'categoryId', category.id, 'year', 2026,
    'name', 'Private ruleset amendment QA', 'gender', 'male',
    'source', 'manual_scoresheet', 'preset', 'single_elimination',
    'entryCount', 4, 'reviewed', true, 'expectedProfileId', null,
    'startsOn', '2026-01-01', 'endsOn', '2026-12-31'
  )
), gen_random_uuid()
from series, category;
insert into public.teams(name, slug)
select 'POST03 amendment team ' || n, 'post03-amendment-team-' || n
from generate_series(1, 4) n;
insert into public.team_registrations(competition_id, team_id, status, confirmed_at)
select context.competition_id, team.id, 'confirmed', now()
from amendment_context context
join public.teams team on team.slug like 'post03-amendment-team-%';
update amendment_context context set
  source_revision_id = (select id from public.competition_ruleset_revisions
    where competition_id = context.competition_id and status = 'active'),
  semi_one = (select id from public.matchups
    where competition_id = context.competition_id and code = 'semifinal_match_1'),
  semi_two = (select id from public.matchups
    where competition_id = context.competition_id and code = 'semifinal_match_2'),
  final_matchup = (select id from public.matchups
    where competition_id = context.competition_id and code = 'final_match_1'),
  reg_one = (select registration.id from public.team_registrations registration
    join public.teams team on team.id = registration.team_id
    where registration.competition_id = context.competition_id
      and team.slug = 'post03-amendment-team-1'),
  reg_two = (select registration.id from public.team_registrations registration
    join public.teams team on team.id = registration.team_id
    where registration.competition_id = context.competition_id
      and team.slug = 'post03-amendment-team-2'),
  reg_three = (select registration.id from public.team_registrations registration
    join public.teams team on team.id = registration.team_id
    where registration.competition_id = context.competition_id
      and team.slug = 'post03-amendment-team-3'),
  reg_four = (select registration.id from public.team_registrations registration
    join public.teams team on team.id = registration.team_id
    where registration.competition_id = context.competition_id
      and team.slug = 'post03-amendment-team-4');
grant select, update on amendment_context to authenticated;

set local role authenticated;
select lives_ok($$
  select public.admin_assign_competition_entry(entry.id, registration.id)
  from public.competition_entries entry
  join amendment_context context on context.competition_id = entry.competition_id
  cross join lateral(values
    (1, context.reg_one), (2, context.reg_two),
    (3, context.reg_three), (4, context.reg_four)
  ) registration(seed, id)
  where entry.seed = registration.seed
$$, 'four explicit entries are assigned');
select lives_ok($$
  select public.admin_resolve_matchup_administratively(
    gen_random_uuid(), semi_one, reg_one, reg_four, reg_one,
    'administrative_decision', 'Resultado inicial confirmado para a semifinal'
  ) from amendment_context
$$, 'first semifinal receives its original immutable decision');
select lives_ok($$
  select public.admin_resolve_matchup_administratively(
    gen_random_uuid(), semi_two, reg_two, reg_three, reg_three,
    'administrative_decision', 'Resultado inicial confirmado para a semifinal'
  ) from amendment_context
$$, 'second semifinal receives its original immutable decision');
select lives_ok($$
  update amendment_context set final_game = public.admin_prepare_matchup(
    final_matchup, 0, '2026-03-08T18:00:00-03:00', 'Court 1'
  )
$$, 'dependent final is prepared but not started');
select ok((select
  (public.admin_get_ruleset_amendment_impact(semi_one, reg_four)
    ->>'canAmend')::boolean from amendment_context),
  'impact allows correction before dependent start');
select is((select
  public.admin_get_ruleset_amendment_impact(semi_one, reg_four)
    ->>'cutoff' from amendment_context), 'before_dependent_start',
  'impact returns the explicit pre-start cutoff');
select lives_ok($$
  update amendment_context set
    amendment_id = (
      public.admin_amend_matchup_outcome(
        amendment_request_id, semi_one, reg_one, reg_four,
        'Correção documental confirmada antes do início da final'
      )->>'amendmentId'
    )::bigint
$$, 'correction clones and activates a new revision atomically');
reset role;

update amendment_context context set
  target_revision_id = (select id from public.competition_ruleset_revisions
    where competition_id = context.competition_id and status = 'active'),
  target_semi_one = (select matchup.id from public.matchups matchup
    join public.competition_ruleset_revisions revision
      on revision.id = matchup.ruleset_revision_id
    where matchup.competition_id = context.competition_id
      and revision.status = 'active' and matchup.code = 'semifinal_match_1'),
  target_semi_two = (select matchup.id from public.matchups matchup
    join public.competition_ruleset_revisions revision
      on revision.id = matchup.ruleset_revision_id
    where matchup.competition_id = context.competition_id
      and revision.status = 'active' and matchup.code = 'semifinal_match_2'),
  target_final = (select matchup.id from public.matchups matchup
    join public.competition_ruleset_revisions revision
      on revision.id = matchup.ruleset_revision_id
    where matchup.competition_id = context.competition_id
      and revision.status = 'active' and matchup.code = 'final_match_1');

select is((select status from public.competition_ruleset_revisions
  where id = (select source_revision_id from amendment_context)),
  'superseded', 'source revision is preserved and superseded');
select isnt((select target_revision_id from amendment_context),
  (select source_revision_id from amendment_context),
  'amendment activates a distinct revision');
select is((select count(*) from public.competition_ruleset_revisions
  where competition_id = (select competition_id from amendment_context)
    and status = 'active'), 1::bigint,
  'atomic swap leaves exactly one active revision');
select is((select status from public.games
  where id = (select final_game from amendment_context)), 'cancelled',
  'unstarted dependent game is preserved and cancelled');
select is((select count(*) from public.games
  where matchup_id = (select target_final from amendment_context)), 0::bigint,
  'new revision does not invent a replacement game');
select is((select winner_registration_id
  from public.matchup_administrative_resolutions
  where matchup_id = (select semi_one from amendment_context)),
  (select reg_one from amendment_context),
  'original resolution remains unchanged');
select is((select winner_registration_id from public.matchup_revision_outcomes
  where matchup_id = (select target_semi_one from amendment_context)),
  (select reg_four from amendment_context),
  'new revision carries the corrected winner');
select is((select source_kind from public.matchup_revision_outcomes
  where matchup_id = (select target_semi_one from amendment_context)),
  'amendment', 'corrected outcome is explicitly typed');
select is((select winner_registration_id from public.matchup_revision_outcomes
  where matchup_id = (select target_semi_two from amendment_context)),
  (select reg_three from amendment_context),
  'unrelated resolved outcome is carried forward');
select is((select source_kind from public.matchup_revision_outcomes
  where matchup_id = (select target_semi_two from amendment_context)),
  'administrative_decision', 'first carry retains its original authority kind');
select ok((select home_registration_id in (reg_four, reg_three)
    and away_registration_id in (reg_four, reg_three)
    and home_registration_id <> away_registration_id
  from public.matchups, amendment_context where id = target_final),
  'new final participants derive from corrected and carried outcomes');
select is((select count(*) from public.competition_entry_assignments
  where ruleset_revision_id = (select target_revision_id from amendment_context)
    and carried_from_entry_id is not null), 4::bigint,
  'all seed assignments carry with explicit provenance');
select is((select before_snapshot->>'winnerRegistrationId'
  from public.competition_ruleset_amendments
  where id = (select amendment_id from amendment_context)),
  (select reg_one::text from amendment_context),
  'before snapshot freezes the former winner');
select is((select after_snapshot->>'winnerRegistrationId'
  from public.competition_ruleset_amendments
  where id = (select amendment_id from amendment_context)),
  (select reg_four::text from amendment_context),
  'after snapshot freezes the corrected winner');
select is((select count(*) from public.admin_mutation_audit
  where action = 'ruleset_amended'
    and entity_id = (select target_revision_id from amendment_context)),
  1::bigint, 'one essential audit event records the swap');
select is(private.preset_blueprint(
    (select target_revision_id from amendment_context)),
  private.compile_competition_preset_v1('single_elimination', 4),
  'new active graph still matches the canonical preset');

set local role authenticated;
select is((select public.admin_amend_matchup_outcome(
  amendment_request_id, semi_one, reg_one, reg_four,
  'Correção documental confirmada antes do início da final'
)->>'outcome' from amendment_context), 'unchanged',
  'identical amendment retry is idempotent');
select throws_ok($$
  select public.admin_amend_matchup_outcome(
    amendment_request_id, semi_one, reg_one, reg_four,
    'Outro motivo usando a mesma chave de idempotência'
  ) from amendment_context
$$, 'BR010', 'BDB_IDEMPOTENCY_CONFLICT',
  'changed amendment cannot reuse the request key');
select throws_ok($$
  update public.competition_ruleset_amendments
  set reason = 'Tentativa de reescrever a emenda histórica'
  where id = (select amendment_id from amendment_context)
$$, '42501', null, 'direct amendment mutation is denied');
select lives_ok($$
  update amendment_context set target_final_game =
    public.admin_prepare_matchup(
      target_final, 0, '2026-03-15T18:00:00-03:00', 'Court 2'
    )
$$, 'corrected final may be explicitly prepared');
reset role;
update public.games set status = 'live', started_at = scheduled_at
where id = (select target_final_game from amendment_context);
set local role authenticated;
select ok((select not (
  public.admin_get_ruleset_amendment_impact(target_semi_two, reg_two)
    ->>'canAmend')::boolean from amendment_context),
  'impact blocks a correction after the dependent starts');
select is((select
  public.admin_get_ruleset_amendment_impact(target_semi_two, reg_two)
    ->>'cutoff' from amendment_context), 'dependent_started',
  'impact names the reached cutoff');
select throws_ok($$
  select public.admin_amend_matchup_outcome(
    gen_random_uuid(), target_semi_two, reg_three, reg_two,
    'Correção tentada depois que a final já começou'
  ) from amendment_context
$$, 'BR095', 'BDB_AMENDMENT_CUTOFF_REACHED',
  'started dependent game remains immutable');
select is((select count(*) from public.competition_ruleset_revisions
  where competition_id = (select competition_id from amendment_context)),
  2::bigint, 'blocked correction leaves no partial draft revision');

select set_config('request.jwt.claims', jsonb_set(
  current_setting('request.jwt.claims')::jsonb, '{aal}', '"aal1"'
)::text, true);
select throws_ok($$
  select public.admin_amend_matchup_outcome(null, null, null, null, null)
$$, 'BD401', 'BDB_ADMIN_AAL2_REQUIRED',
  'AAL1 cannot amend a ruleset');
select is((select count(*) from public.competition_ruleset_amendments),
  0::bigint, 'AAL1 cannot read amendments through RLS');
reset role;
set local role anon;
select throws_ok($$
  select public.admin_amend_matchup_outcome(null, null, null, null, null)
$$, '42501', null, 'anon cannot execute the amendment RPC');
reset role;

select * from finish();
rollback;
