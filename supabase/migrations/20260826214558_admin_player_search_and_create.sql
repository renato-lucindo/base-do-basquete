-- Secure, limited administrative player discovery and audited inline creation.

alter table public.admin_mutation_audit
  drop constraint admin_mutation_audit_action_check,
  add constraint admin_mutation_audit_action_check check (
    action in (
      'registration_created',
      'registration_transitioned',
      'roster_replaced',
      'manual_scoresheet_saved',
      'boxscore_import_confirmed',
      'boxscore_team_stats_refreshed',
      'final_placement_confirmed',
      'player_created'
    )
  ),
  drop constraint admin_mutation_audit_entity_type_check,
  add constraint admin_mutation_audit_entity_type_check check (
    entity_type in (
      'team_registration',
      'game',
      'boxscore_import',
      'final_placement',
      'player'
    )
  );

create function public.admin_search_players(
  p_competition_id bigint,
  p_query text,
  p_registration_id bigint default null,
  p_limit integer default 12
)
returns table (
  id bigint,
  full_name text,
  nickname text,
  current_team_name text,
  edition_jersey text,
  conflict_registration_id bigint,
  conflict_team_name text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_query text;
  safe_limit integer := least(greatest(coalesce(p_limit, 12), 1), 20);
begin
  if not (select public.is_current_admin_aal2()) then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  if not exists (select 1 from public.competitions where competitions.id = p_competition_id) then
    raise exception using errcode = 'BD404', message = 'BDB_COMPETITION_NOT_FOUND';
  end if;

  normalized_query := btrim(regexp_replace(
    translate(
      lower(coalesce(p_query, '')),
      'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
      'aaaaaaeeeeiiiiooooouuuucnyy'
    ),
    '[^a-z0-9]+',
    ' ',
    'g'
  ));

  if char_length(normalized_query) < 2 or char_length(normalized_query) > 80 then
    return;
  end if;

  return query
  select
    player.id,
    player.full_name,
    player.nickname,
    active_roster.team_name,
    active_roster.jersey_number,
    case
      when active_roster.registration_id is not null
       and active_roster.registration_id is distinct from p_registration_id
      then active_roster.registration_id
      else null
    end,
    case
      when active_roster.registration_id is not null
       and active_roster.registration_id is distinct from p_registration_id
      then active_roster.team_name
      else null
    end
  from public.players player
  left join lateral (
    select
      roster.registration_id,
      roster.jersey_number,
      team.name as team_name
    from public.roster_entries roster
    join public.team_registrations registration
      on registration.id = roster.registration_id
     and registration.competition_id = roster.competition_id
    join public.teams team on team.id = registration.team_id
    where roster.competition_id = p_competition_id
      and roster.player_id = player.id
      and roster.status = 'active'
    order by roster.updated_at desc, roster.id desc
    limit 1
  ) active_roster on true
  where player.is_active
    and (
      btrim(regexp_replace(
        translate(
          lower(player.full_name),
          'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
          'aaaaaaeeeeiiiiooooouuuucnyy'
        ),
        '[^a-z0-9]+',
        ' ',
        'g'
      )) like '%' || normalized_query || '%'
      or btrim(regexp_replace(
        translate(
          lower(coalesce(player.nickname, '')),
          'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
          'aaaaaaeeeeiiiiooooouuuucnyy'
        ),
        '[^a-z0-9]+',
        ' ',
        'g'
      )) like '%' || normalized_query || '%'
    )
  order by
    (active_roster.registration_id is not distinct from p_registration_id) desc,
    (btrim(regexp_replace(
      translate(
        lower(player.full_name),
        'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
        'aaaaaaeeeeiiiiooooouuuucnyy'
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    )) = normalized_query) desc,
    player.full_name,
    player.id
  limit safe_limit;
end;
$$;

create function public.admin_create_player(
  p_full_name text,
  p_nickname text default null,
  p_allow_similar boolean default false
)
returns public.players
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_name text;
  clean_name text := btrim(coalesce(p_full_name, ''));
  clean_nickname text := nullif(btrim(coalesce(p_nickname, '')), '');
  slug_base text;
  candidate_slug text;
  suffix integer := 1;
  result public.players;
begin
  if not (select public.is_current_admin_aal2()) then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  if char_length(clean_name) < 2 or char_length(clean_name) > 160 or
     (clean_nickname is not null and char_length(clean_nickname) > 80) then
    raise exception using errcode = 'BD312', message = 'BDB_PLAYER_INPUT_INVALID';
  end if;

  normalized_name := btrim(regexp_replace(
    translate(
      lower(clean_name),
      'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
      'aaaaaaeeeeiiiiooooouuuucnyy'
    ),
    '[^a-z0-9]+',
    ' ',
    'g'
  ));
  perform pg_advisory_xact_lock(hashtextextended(normalized_name, 915));

  if exists (
    select 1 from public.players player
    where btrim(regexp_replace(
      translate(
        lower(player.full_name),
        'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
        'aaaaaaeeeeiiiiooooouuuucnyy'
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    )) = normalized_name
  ) then
    raise exception using errcode = 'BD308', message = 'BDB_PLAYER_ALREADY_EXISTS';
  end if;

  if not coalesce(p_allow_similar, false) and exists (
    select 1 from public.players player
    where btrim(regexp_replace(
      translate(
        lower(player.full_name),
        'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
        'aaaaaaeeeeiiiiooooouuuucnyy'
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    )) like '%' || normalized_name || '%'
       or normalized_name like '%' || btrim(regexp_replace(
         translate(
           lower(player.full_name),
           'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
           'aaaaaaeeeeiiiiooooouuuucnyy'
         ),
         '[^a-z0-9]+',
         ' ',
         'g'
       )) || '%'
  ) then
    raise exception using errcode = 'BD311', message = 'BDB_PLAYER_SIMILAR_REVIEW_REQUIRED';
  end if;

  slug_base := trim(both '-' from regexp_replace(
    translate(
      lower(clean_name),
      'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
      'aaaaaaeeeeiiiiooooouuuucnyy'
    ),
    '[^a-z0-9]+',
    '-',
    'g'
  ));
  if slug_base = '' then slug_base := 'jogador'; end if;
  candidate_slug := slug_base;
  while exists (select 1 from public.players player where player.slug = candidate_slug) loop
    suffix := suffix + 1;
    candidate_slug := slug_base || '-' || suffix::text;
  end loop;

  insert into public.players (full_name, nickname, slug, is_active, is_public)
  values (clean_name, clean_nickname, candidate_slug, true, false)
  returning * into strict result;

  insert into public.admin_mutation_audit (action, entity_type, entity_id)
  values ('player_created', 'player', result.id);

  return result;
end;
$$;

revoke all on function public.admin_search_players(bigint, text, bigint, integer)
  from public, anon, authenticated;
revoke all on function public.admin_create_player(text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.admin_search_players(bigint, text, bigint, integer)
  to authenticated;
grant execute on function public.admin_create_player(text, text, boolean)
  to authenticated;

comment on function public.admin_search_players(bigint, text, bigint, integer) is
  'AAL2-only accent-insensitive player search returning the minimum roster context.';
comment on function public.admin_create_player(text, text, boolean) is
  'AAL2-only audited player creation with normalized duplicate protection.';
