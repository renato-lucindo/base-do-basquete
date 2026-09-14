-- Internal, versioned compiler: callers provide only a preset key and bounded capacity.
-- This function does not persist JSON as polymorphic references or create games.
-- The next migration materializes its output as contextual foreign keys.
create function private.compile_competition_preset_v1(p_key text, p_entry_count integer)
returns jsonb
language plpgsql
immutable
parallel safe
security invoker
set search_path = ''
as $$
declare
  positions integer[];
  expanded integer[];
  sources jsonb[];
  next_sources jsonb[];
  rounds jsonb := '[]';
  matches jsonb;
  byes jsonb;
  round_code text;
  round_role text;
  match_code text;
  left_seed integer;
  right_seed integer;
  home_source jsonb;
  away_source jsonb;
  source jsonb;
  bracket_size integer := 2;
  capacity integer;
  round_order integer := 0;
  i integer;
  seed integer;
begin
  if p_key is null or p_key not in ('single_group', 'single_elimination') then
    raise exception using errcode = 'BR001', message = 'BDB_PRESET_INVALID';
  end if;
  if p_entry_count is null or p_entry_count < 2 or p_entry_count > 16 then
    raise exception using errcode = 'BR002', message = 'BDB_PRESET_CAPACITY_INVALID';
  end if;
  if p_key = 'single_group' then
    select array_agg(value order by value) into positions
    from generate_series(1, p_entry_count) value;
    if p_entry_count % 2 = 1 then positions := array_append(positions, 0); end if;
    for round_order in 1..array_length(positions, 1) - 1 loop
      round_code := 'round_' || round_order;
      matches := '[]';
      byes := '[]';
      for i in 1..array_length(positions, 1) / 2 loop
        left_seed := positions[i];
        right_seed := positions[array_length(positions, 1) + 1 - i];
        if left_seed = 0 or right_seed = 0 then
          byes := byes || jsonb_build_array(greatest(left_seed, right_seed));
        else
          matches := matches || jsonb_build_array(jsonb_build_object(
            'code', round_code || '_match_' || i,
            'home', jsonb_build_object('kind', 'entry', 'seed', left_seed),
            'away', jsonb_build_object('kind', 'entry', 'seed', right_seed),
            'format', 'single_game', 'maxGames', 1
          ));
        end if;
      end loop;
      rounds := rounds || jsonb_build_array(jsonb_build_object(
        'code', round_code, 'order', round_order, 'role', 'round_robin',
        'capacity', p_entry_count, 'maxMatchups', p_entry_count / 2,
        'byes', byes, 'matchups', matches
      ));
      positions := positions[1:1] || positions[array_length(positions, 1)]
        || positions[2:array_length(positions, 1) - 1];
    end loop;
  else
    while bracket_size < p_entry_count loop bracket_size := bracket_size * 2; end loop;
    positions := array[1, 2];
    capacity := 4;
    while capacity <= bracket_size loop
      expanded := array[]::integer[];
      foreach seed in array positions loop
        expanded := expanded || array[seed, capacity + 1 - seed];
      end loop;
      positions := expanded;
      capacity := capacity * 2;
    end loop;
    sources := array[]::jsonb[];
    foreach seed in array positions loop
      sources := array_append(sources, case when seed <= p_entry_count
        then jsonb_build_object('kind', 'entry', 'seed', seed) else null end);
    end loop;
    capacity := bracket_size;
    while capacity >= 2 loop
      round_order := round_order + 1;
      round_role := case capacity
        when 16 then 'round_of_16' when 8 then 'quarterfinal'
        when 4 then 'semifinal' when 2 then 'final' end;
      matches := '[]';
      byes := '[]';
      next_sources := array[]::jsonb[];
      for i in 1..array_length(sources, 1) by 2 loop
        home_source := sources[i];
        away_source := sources[i + 1];
        if home_source is not null and away_source is not null then
          match_code := round_role || '_match_' || (i + 1) / 2;
          matches := matches || jsonb_build_array(jsonb_build_object(
            'code', match_code, 'home', home_source, 'away', away_source,
            'format', 'single_game', 'maxGames', 1
          ));
          next_sources := array_append(next_sources,
            jsonb_build_object('kind', 'winner', 'matchupCode', match_code));
        else
          source := coalesce(home_source, away_source);
          if source is null or source->>'kind' <> 'entry' then
            raise exception using errcode = 'BR003', message = 'BDB_PRESET_SOURCE_INVALID';
          end if;
          byes := byes || jsonb_build_array((source->>'seed')::integer);
          next_sources := array_append(next_sources, source);
        end if;
      end loop;
      rounds := rounds || jsonb_build_array(jsonb_build_object(
        'code', round_role, 'order', round_order, 'role', round_role,
        'capacity', capacity, 'maxMatchups', capacity / 2,
        'byes', byes, 'matchups', matches
      ));
      sources := next_sources;
      capacity := capacity / 2;
    end loop;
  end if;
  return jsonb_build_object(
    'key', p_key, 'version', 1, 'entryCount', p_entry_count,
    'track', jsonb_build_object('code', 'main'),
    'stage', jsonb_build_object(
      'code', case when p_key = 'single_group' then 'league' else 'knockout' end,
      'kind', case when p_key = 'single_group' then 'round_robin' else 'knockout' end
    ),
    'group', case when p_key = 'single_group'
      then jsonb_build_object('code', 'single_group') else null end,
    'rounds', rounds
  );
end;
$$;

revoke all on function private.compile_competition_preset_v1(text, integer)
  from public, anon, authenticated;
comment on function private.compile_competition_preset_v1(text, integer) is
  'Immutable v1 blueprint compiler; 2..16 explicit entries, single group or single elimination. Internal only; no free graph input, games, publication or data writes.';
