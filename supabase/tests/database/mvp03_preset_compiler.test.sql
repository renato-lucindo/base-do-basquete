begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

select ok(not has_function_privilege('anon',
  'private.compile_competition_preset_v1(text,integer)', 'execute'), 'anon cannot execute internal compiler');
select ok(not has_function_privilege('authenticated',
  'private.compile_competition_preset_v1(text,integer)', 'execute'), 'authenticated cannot bypass administrative RPC');
select throws_ok($$select private.compile_competition_preset_v1(null, 4)$$,
  'BR001', 'BDB_PRESET_INVALID', 'null preset refused');
select throws_ok($$select private.compile_competition_preset_v1('Final', 4)$$,
  'BR001', 'BDB_PRESET_INVALID', 'no inference from names');
select throws_ok($$select private.compile_competition_preset_v1('single_group', null)$$,
  'BR002', 'BDB_PRESET_CAPACITY_INVALID', 'null capacity refused');
select throws_ok($$select private.compile_competition_preset_v1('single_group', 1)$$,
  'BR002', 'BDB_PRESET_CAPACITY_INVALID', 'minimum enforced');
select throws_ok($$select private.compile_competition_preset_v1('single_group', 17)$$,
  'BR002', 'BDB_PRESET_CAPACITY_INVALID', 'bounded compiler enforced');

create temporary table compiled_presets as
select preset_key, entry_count,
  private.compile_competition_preset_v1(preset_key, entry_count) as blueprint
from unnest(array['single_group', 'single_elimination']) preset_key
cross join generate_series(2, 16) entry_count;
create temporary table compiled_rounds as
select p.*, round_item from compiled_presets p,
lateral jsonb_array_elements(blueprint->'rounds') round_item;
create temporary table compiled_matches as
select r.*, match_item from compiled_rounds r,
lateral jsonb_array_elements(round_item->'matchups') match_item;
create temporary table compiled_sources as
select m.*, source_item from compiled_matches m,
lateral (values (match_item->'home'), (match_item->'away')) sides(source_item);

select is((select count(*) from compiled_presets), 30::bigint, 'all thirty configurations compile');
select ok(not exists (
  select 1 from compiled_presets p where
  (select count(*) from compiled_matches m where m.preset_key = p.preset_key and m.entry_count = p.entry_count)
  <> case p.preset_key when 'single_group' then p.entry_count * (p.entry_count - 1) / 2 else p.entry_count - 1 end
), 'correct game count without fictional bye games');
select ok(not exists (
  select 1 from compiled_matches where match_item->>'format' <> 'single_game' or match_item->>'maxGames' <> '1'
), 'all contracts are single game');
select ok(not exists (
  select 1 from compiled_rounds where jsonb_array_length(round_item->'matchups') > (round_item->>'maxMatchups')::integer
    or (round_item->>'role' = 'semifinal' and (round_item->>'maxMatchups')::integer <> 2)
    or (round_item->>'role' = 'final' and (round_item->>'maxMatchups')::integer <> 1)
), 'typed local round capacities enforced');
select ok(not exists (
  select preset_key, entry_count, round_item->>'code', source_item
  from compiled_sources group by 1,2,3,4 having count(*) > 1
), 'no repeated source in the same round');
select ok(not exists (
  select entry_count, source_item from compiled_sources
  where preset_key = 'single_elimination' group by 1,2 having count(*) > 1
), 'each knockout input or winner is consumed at most once');
select ok(not exists (
  select 1 from compiled_sources s where s.source_item->>'kind' = 'winner' and not exists (
    select 1 from compiled_matches origin where origin.preset_key = s.preset_key
      and origin.entry_count = s.entry_count
      and origin.match_item->>'code' = s.source_item->>'matchupCode'
      and (origin.round_item->>'order')::integer < (s.round_item->>'order')::integer
  )
), 'every winner references an earlier round, excluding cycles');
select ok(not exists (
  select entry_count, least(match_item->'home'->>'seed', match_item->'away'->>'seed'),
    greatest(match_item->'home'->>'seed', match_item->'away'->>'seed')
  from compiled_matches where preset_key = 'single_group' group by 1,2,3 having count(*) > 1
), 'group pairs never repeat');
select is(private.compile_competition_preset_v1('single_elimination', 3)#>'{rounds,0,byes}',
  '[1]'::jsonb, 'three entries grant top seed a bye without a matchup');
select is(private.compile_competition_preset_v1('single_elimination', 4)#>'{rounds,1,matchups,0,home}',
  '{"kind":"winner","matchupCode":"semifinal_match_1"}'::jsonb, 'final retains typed unresolved winner origin');
select ok(not exists (
  select 1 from compiled_presets where blueprint is distinct from private.compile_competition_preset_v1(preset_key, entry_count)
), 'compilation is deterministic');

select * from finish();
rollback;
