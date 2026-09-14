begin;

create extension if not exists pgtap with schema extensions;
select plan(35);
set constraints all deferred;

insert into private.admin_accounts (user_id)
select '11111111-1111-4111-8111-111111111111'
where not exists (select 1 from private.admin_accounts);

create temporary table mvp02_context as
select
  competition.id as competition_id,
  competition.year,
  competition.series_id,
  competition.category_id,
  game.id as game_id
from public.competitions competition
join public.competition_series series on series.id = competition.series_id
join public.categories category on category.id = competition.category_id
join public.games game
  on game.competition_id = competition.id
 and game.game_number = 'STATS-01'
where series.slug = 'liga-de-desenvolvimento'
  and category.slug = 'sub-15'
  and competition.year in (2025, 2026);

grant select on mvp02_context to anon;

insert into public.series_category_data_profiles (
  series_id,
  category_id,
  gender_division,
  version,
  primary_source,
  status,
  change_reason,
  created_by,
  activated_by,
  activated_at
)
select distinct
  context.series_id,
  context.category_id,
  'male',
  profile.version,
  profile.primary_source,
  profile.status,
  'Fixture transacional dos read models públicos do MVP-02',
  admin.user_id,
  admin.user_id,
  now()
from mvp02_context context
cross join private.admin_accounts admin
cross join (
  values
    (91, 'manual_scoresheet'::text, 'superseded'::text),
    (92, 'fiba_boxscore'::text, 'active'::text)
) as profile(version, primary_source, status);

update public.competitions competition
set
  gender_division = 'male',
  gender_division_review_required = false,
  data_profile_id = profile.id,
  data_profile_review_required = false,
  data_profile_validated_at = now(),
  data_profile_validated_by = admin.user_id
from mvp02_context context
join public.series_category_data_profiles profile
  on profile.series_id = context.series_id
 and profile.category_id = context.category_id
 and profile.gender_division = 'male'
 and profile.version = case when context.year = 2025 then 91 else 92 end
cross join private.admin_accounts admin
where competition.id = context.competition_id;

insert into storage.objects (id, bucket_id, name)
values (
  '99520000-0000-4000-8000-000000000001',
  'boxscore-pdfs',
  'tests/mvp02-read-model-fixture.pdf'
);

insert into public.game_data_submissions (
  game_id,
  submission_version,
  source_type,
  role,
  status,
  payload_hash,
  idempotency_key,
  submitted_by,
  validated_by,
  validated_at
)
select
  context.game_id,
  1,
  'manual_scoresheet',
  'primary',
  'active',
  repeat('a', 32),
  'mvp02-manual-' || context.game_id,
  admin.user_id,
  admin.user_id,
  now()
from mvp02_context context
cross join private.admin_accounts admin
where context.year = 2025;

insert into public.game_data_submissions (
  game_id,
  submission_version,
  source_type,
  role,
  status,
  parser_version,
  payload_hash,
  storage_object_id,
  idempotency_key,
  submitted_by,
  validated_by,
  validated_at
)
select
  context.game_id,
  1,
  'fiba_boxscore',
  'primary',
  'active',
  'fiba-genius-v2',
  repeat('b', 64),
  '99520000-0000-4000-8000-000000000001',
  'mvp02-fiba-' || context.game_id,
  admin.user_id,
  admin.user_id,
  now()
from mvp02_context context
cross join private.admin_accounts admin
where context.year = 2026;

insert into public.game_data_domain_authority (
  game_id,
  domain,
  submission_id,
  source_type,
  activated_by
)
select
  submission.game_id,
  domain.name,
  submission.id,
  submission.source_type,
  admin.user_id
from public.game_data_submissions submission
join mvp02_context context on context.game_id = submission.game_id
cross join private.admin_accounts admin
cross join lateral (
  select name
  from unnest(
    case submission.source_type
      when 'manual_scoresheet' then
        array['participation', 'player_scoring', 'player_foul_total', 'player_foul_timeline']
      else array['participation', 'player_scoring', 'player_advanced', 'player_foul_total']
    end
  ) as domains(name)
) domain
where submission.status = 'active'
  and submission.source_type in ('manual_scoresheet', 'fiba_boxscore');

select has_view('public', 'game_active_data_sources', 'the public source view exists');
select has_view(
  'public',
  'game_scoresheet_player_statistics',
  'the scoresheet game view exists'
);
select has_view(
  'public',
  'competition_scoresheet_player_statistics',
  'the scoresheet competition view exists'
);
select has_view(
  'public',
  'game_boxscore_player_statistics',
  'the boxscore game view exists'
);
select has_view(
  'public',
  'competition_boxscore_player_statistics',
  'the boxscore competition view exists'
);
select has_view('public', 'competition_data_coverage', 'the coverage view exists');

select ok(
  (select 'security_invoker=true' = any(reloptions)
   from pg_class where oid = 'public.game_active_data_sources'::regclass),
  'the public source view runs with invoker rights'
);
select ok(
  (select 'security_invoker=true' = any(reloptions)
   from pg_class where oid = 'public.game_scoresheet_player_statistics'::regclass),
  'the scoresheet game view runs with invoker rights'
);
select ok(
  (select 'security_invoker=true' = any(reloptions)
   from pg_class where oid = 'public.competition_scoresheet_player_statistics'::regclass),
  'the scoresheet aggregate runs with invoker rights'
);
select ok(
  (select 'security_invoker=true' = any(reloptions)
   from pg_class where oid = 'public.game_boxscore_player_statistics'::regclass),
  'the boxscore game view runs with invoker rights'
);
select ok(
  (select 'security_invoker=true' = any(reloptions)
   from pg_class where oid = 'public.competition_boxscore_player_statistics'::regclass),
  'the boxscore aggregate runs with invoker rights'
);
select ok(
  (select 'security_invoker=true' = any(reloptions)
   from pg_class where oid = 'public.competition_data_coverage'::regclass),
  'the coverage view runs with invoker rights'
);

select ok(
  has_column_privilege('anon', 'public.game_data_domain_authority', 'source_type', 'select'),
  'anon can resolve the public source type'
);
select ok(
  not has_column_privilege('anon', 'public.game_data_domain_authority', 'activated_by', 'select'),
  'anon cannot read the authority actor'
);
select ok(
  not has_table_privilege('anon', 'public.game_data_domain_authority', 'insert'),
  'anon cannot write authority rows'
);

select is(
  (select count(*) from public.game_active_data_sources source
   join mvp02_context context on context.game_id = source.game_id),
  8::bigint,
  'one source is active per asserted game and domain'
);
select is(
  (select count(*) from public.competition_scoresheet_player_statistics stats
   join mvp02_context context on context.competition_id = stats.competition_id
   where context.year = 2025),
  2::bigint,
  'the manual edition exposes both participating players'
);
select is(
  (select stats.points from public.competition_scoresheet_player_statistics stats
   join mvp02_context context on context.competition_id = stats.competition_id
   join public.players player on player.id = stats.player_id
   where context.year = 2025 and player.slug = 'atleta-demonstracao-um'),
  2::bigint,
  'manual points come from the scoresheet scoring domain'
);
select is(
  (select stats.games_played from public.competition_scoresheet_player_statistics stats
   join mvp02_context context on context.competition_id = stats.competition_id
   join public.players player on player.id = stats.player_id
   where context.year = 2025 and player.slug = 'atleta-demonstracao-um'),
  1::bigint,
  'a confirmed manual participation counts exactly one game'
);
select is(
  (select stats.two_point_made from public.competition_scoresheet_player_statistics stats
   join mvp02_context context on context.competition_id = stats.competition_id
   join public.players player on player.id = stats.player_id
   where context.year = 2025 and player.slug = 'atleta-demonstracao-um'),
  1::bigint,
  'manual converted shots are exposed without attempts'
);
select is(
  (select stats.fouls from public.competition_scoresheet_player_statistics stats
   join mvp02_context context on context.competition_id = stats.competition_id
   join public.players player on player.id = stats.player_id
   where context.year = 2025 and player.slug = 'atleta-demonstracao-um'),
  0::bigint,
  'an authoritative empty foul timeline is zero rather than unavailable'
);

select is(
  (select count(*) from public.competition_boxscore_player_statistics stats
   join mvp02_context context on context.competition_id = stats.competition_id
   where context.year = 2026),
  2::bigint,
  'the FIBA edition exposes both participating players'
);
select is(
  (select stats.official_points from public.competition_boxscore_player_statistics stats
   join mvp02_context context on context.competition_id = stats.competition_id
   join public.players player on player.id = stats.player_id
   where context.year = 2026 and player.slug = 'atleta-demonstracao-um'),
  8::bigint,
  'boxscore official points preserve the complete-game denominator'
);
select is(
  (select stats.advanced_games_played from public.competition_boxscore_player_statistics stats
   join mvp02_context context on context.competition_id = stats.competition_id
   join public.players player on player.id = stats.player_id
   where context.year = 2026 and player.slug = 'atleta-demonstracao-um'),
  1::bigint,
  'advanced coverage has its own game denominator'
);
select is(
  (select stats.advanced_points from public.competition_boxscore_player_statistics stats
   join mvp02_context context on context.competition_id = stats.competition_id
   join public.players player on player.id = stats.player_id
   where context.year = 2026 and player.slug = 'atleta-demonstracao-um'),
  8::bigint,
  'advanced totals use only games with advanced authority'
);
select is(
  (select coverage.final_games from public.competition_data_coverage coverage
   join mvp02_context context on context.competition_id = coverage.competition_id
   where context.year = 2026),
  1::bigint,
  'coverage counts final games independently'
);
select is(
  (select coverage.advanced_games from public.competition_data_coverage coverage
   join mvp02_context context on context.competition_id = coverage.competition_id
   where context.year = 2026),
  1::bigint,
  'coverage counts only authoritative advanced games'
);

update public.game_roster_slots slot
set did_not_play = true
from mvp02_context context
join public.roster_entries roster
  on roster.competition_id = context.competition_id
join public.players player
  on player.id = roster.player_id
 and player.slug = 'atleta-demonstracao-um'
where context.year = 2025
  and slot.game_id = context.game_id
  and slot.roster_entry_id = roster.id;

select is(
  (select count(*) from public.competition_scoresheet_player_statistics stats
   join mvp02_context context on context.competition_id = stats.competition_id
   where context.year = 2025),
  1::bigint,
  'DNP never enters the games-played aggregate'
);
select is(
  (select stats.points from public.game_scoresheet_player_statistics stats
   join mvp02_context context on context.game_id = stats.game_id
   join public.players player on player.id = stats.player_id
   where context.year = 2025 and player.slug = 'atleta-demonstracao-um'),
  null::bigint,
  'DNP keeps unavailable game statistics null'
);

set local role anon;
select is(
  (select count(*) from public.game_active_data_sources source
   join mvp02_context context on context.game_id = source.game_id),
  8::bigint,
  'anon can resolve only the safe public source projection'
);
select is(
  (select count(*) from public.game_scoresheet_player_statistics stats
   join mvp02_context context on context.game_id = stats.game_id
   where context.year = 2025),
  2::bigint,
  'anon reads the scoresheet game projection through underlying RLS'
);
select is(
  (select count(*) from public.game_boxscore_player_statistics stats
   join mvp02_context context on context.game_id = stats.game_id
   where context.year = 2026),
  2::bigint,
  'anon reads the boxscore game projection through underlying RLS'
);
reset role;

delete from public.game_data_domain_authority authority
using mvp02_context context
where authority.game_id = context.game_id
  and context.year = 2026
  and authority.domain = 'player_advanced';

select is(
  (select stats.games_played from public.competition_boxscore_player_statistics stats
   join mvp02_context context on context.competition_id = stats.competition_id
   join public.players player on player.id = stats.player_id
   where context.year = 2026 and player.slug = 'atleta-demonstracao-um'),
  1::bigint,
  'removing advanced authority does not erase official participation'
);
select is(
  (select stats.advanced_games_played from public.competition_boxscore_player_statistics stats
   join mvp02_context context on context.competition_id = stats.competition_id
   join public.players player on player.id = stats.player_id
   where context.year = 2026 and player.slug = 'atleta-demonstracao-um'),
  0::bigint,
  'advanced denominator falls to zero without advanced authority'
);
select is(
  (select stats.assists from public.competition_boxscore_player_statistics stats
   join mvp02_context context on context.competition_id = stats.competition_id
   join public.players player on player.id = stats.player_id
   where context.year = 2026 and player.slug = 'atleta-demonstracao-um'),
  null::bigint,
  'advanced values remain unavailable instead of becoming false zeros'
);

select * from finish();
rollback;
