begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

select has_view('public', 'game_player_statistics', 'game statistic view exists');
select has_view(
  'public',
  'competition_player_statistics',
  'competition statistic view exists'
);
select ok(
  (select 'security_invoker=true' = any(reloptions)
   from pg_class where oid = 'public.game_player_statistics'::regclass),
  'game view executes as security invoker'
);
select ok(
  (select 'security_invoker=true' = any(reloptions)
   from pg_class where oid = 'public.competition_player_statistics'::regclass),
  'competition view executes as security invoker'
);
select ok(
  has_table_privilege('anon', 'public.game_player_statistics', 'select'),
  'anon can select the public game view'
);
select ok(
  has_table_privilege('anon', 'public.competition_player_statistics', 'select'),
  'anon can select the public competition view'
);
select ok(
  not has_table_privilege('anon', 'public.game_player_statistics', 'insert'),
  'anon cannot write through the game view'
);

select is(
  (select stats.points
   from public.game_player_statistics stats
   join public.games game on game.id = stats.game_id
   join public.competitions competition on competition.id = stats.competition_id
   join public.players player on player.id = stats.player_id
   where game.game_number = 'STATS-01'
     and competition.year = 2025
     and player.slug = 'atleta-demonstracao-um'),
  2::bigint,
  'the 2025 fixture retains its own player points'
);
select is(
  (select stats.points
   from public.game_player_statistics stats
   join public.games game on game.id = stats.game_id
   join public.competitions competition on competition.id = stats.competition_id
   join public.players player on player.id = stats.player_id
   where game.game_number = 'STATS-01'
     and competition.year = 2026
     and player.slug = 'atleta-demonstracao-um'),
  8::bigint,
  'the 2026 fixture retains its own player points'
);
select is(
  (select count(*)
   from public.game_player_statistics stats
   join public.games game on game.id = stats.game_id
   where game.game_number = 'STATS-01'),
  4::bigint,
  'two editions expose exactly two fixture players each'
);
select is(
  (select count(*)
   from public.competition_player_statistics stats
   join public.competitions competition on competition.id = stats.competition_id
   join public.categories category on category.id = competition.category_id
   where competition.year = 2025 and category.slug = 'sub-15'),
  2::bigint,
  'the 2025 aggregate contains only its two players'
);
select ok(
  not exists (
    select 1
    from public.game_player_statistics stats
    join public.games game on game.id = stats.game_id
    where stats.competition_id <> game.competition_id
  ),
  'every game statistic row carries the owning competition'
);
select ok(
  not exists (
    select 1
    from public.competition_player_statistics aggregate
    where aggregate.games_played <> (
      select count(distinct slot.game_id)
      from public.game_roster_slots slot
      join public.games game on game.id = slot.game_id
      join public.roster_entries roster
        on roster.id = slot.roster_entry_id
       and roster.registration_id = slot.registration_id
      where game.competition_id = aggregate.competition_id
        and roster.player_id = aggregate.player_id
        and game.status = 'final'
        and slot.is_applicable
        and not slot.did_not_play
    )
  ),
  'games played is distinct and isolated before grouping'
);

set local role anon;
select is(
  (select count(*)
   from public.game_player_statistics stats
   join public.games game on game.id = stats.game_id
   where game.game_number = 'STATS-01'),
  4::bigint,
  'anon reads published fixture statistics through underlying RLS'
);

reset role;
select * from finish();
rollback;
