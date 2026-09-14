-- ADM-REF-01F: keep private eligibility inside the existing atomic FIBA
-- confirmation without exposing the stored value or persisting it in review data.

alter function private.admin_commit_boxscore_import_impl(bigint, jsonb)
  rename to admin_commit_boxscore_import_without_eligibility;

revoke all on function private.admin_commit_boxscore_import_without_eligibility(bigint, jsonb)
  from public, anon, authenticated;

create function private.admin_commit_boxscore_import_impl(
  p_import_id bigint,
  p_resolution jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  import_record public.boxscore_imports;
  competition_gender text;
  competition_review_required boolean;
  player_resolution jsonb;
  resolution_action text;
  resolved_player_id bigint;
  private_sex text;
  private_review_required boolean;
  pending_players jsonb := '[]'::jsonb;
  incompatible_players jsonb := '[]'::jsonb;
  sanitized_teams jsonb;
  sanitized_players jsonb;
  sanitized_resolution jsonb;
  created_game_id bigint;
  created_player_id bigint;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  if jsonb_typeof(p_resolution) <> 'object' or
    jsonb_typeof(p_resolution -> 'teams') <> 'array' or
    jsonb_typeof(p_resolution -> 'players') <> 'array'
  then
    raise exception using errcode = 'BD305', message = 'BDB_PDF_RESOLUTION_INVALID';
  end if;

  select * into import_record
  from public.boxscore_imports
  where id = p_import_id
  for update;
  if not found or import_record.created_by <> auth.uid() then
    raise exception using errcode = 'BD404', message = 'BDB_PDF_IMPORT_NOT_FOUND';
  end if;
  if import_record.status = 'confirmed' then
    return import_record.game_id;
  end if;
  if import_record.status <> 'review' then
    raise exception using errcode = 'BD305', message = 'BDB_PDF_IMPORT_NOT_REVIEWABLE';
  end if;

  select competition.gender_division, competition.gender_division_review_required
  into competition_gender, competition_review_required
  from public.competitions competition
  where competition.id = import_record.competition_id
  for share;
  if competition_gender is null or competition_review_required then
    raise exception using errcode = 'BD505', message = 'BDB_COMPETITION_GENDER_REVIEW_REQUIRED';
  end if;

  for player_resolution in
    select value from jsonb_array_elements(p_resolution -> 'players')
  loop
    resolution_action := player_resolution ->> 'action';
    if resolution_action is null and player_resolution ? 'rosterEntryId' then
      resolution_action := 'existing_roster';
    end if;

    if resolution_action = 'add_existing' then
      if coalesce(player_resolution ->> 'playerId', '') !~ '^[1-9][0-9]*$' then
        continue;
      end if;
      resolved_player_id := (player_resolution ->> 'playerId')::bigint;

      -- Invalid and already-associated resolutions retain the established
      -- domain precedence in the original transaction.
      if not exists (
        select 1 from public.players player
        where player.id = resolved_player_id and player.is_active
      ) or exists (
        select 1 from public.roster_entries roster
        where roster.competition_id = import_record.competition_id
          and roster.player_id = resolved_player_id
          and roster.status = 'active'
      ) then
        continue;
      end if;

      private_sex := null;
      private_review_required := true;
      select private_data.sex, private_data.sex_review_required
      into private_sex, private_review_required
      from private.player_private private_data
      where private_data.player_id = resolved_player_id
      for share;

      if not found or private_sex is null or private_review_required then
        pending_players := pending_players || jsonb_build_array(jsonb_build_object(
          'sourceTeamName', player_resolution ->> 'sourceTeamName',
          'sourcePlayerName', player_resolution ->> 'sourcePlayerName'
        ));
      elsif private_sex <> competition_gender then
        incompatible_players := incompatible_players || jsonb_build_array(jsonb_build_object(
          'sourceTeamName', player_resolution ->> 'sourceTeamName',
          'sourcePlayerName', player_resolution ->> 'sourcePlayerName'
        ));
      end if;
    elsif resolution_action = 'create_new' then
      private_sex := player_resolution ->> 'eligibilitySex';
      if private_sex is null or private_sex not in ('male', 'female') then
        pending_players := pending_players || jsonb_build_array(jsonb_build_object(
          'sourceTeamName', player_resolution ->> 'sourceTeamName',
          'sourcePlayerName', player_resolution ->> 'sourcePlayerName'
        ));
      elsif private_sex <> competition_gender then
        incompatible_players := incompatible_players || jsonb_build_array(jsonb_build_object(
          'sourceTeamName', player_resolution ->> 'sourceTeamName',
          'sourcePlayerName', player_resolution ->> 'sourcePlayerName'
        ));
      end if;
    end if;
  end loop;

  if jsonb_array_length(pending_players) > 0 then
    raise exception using
      errcode = 'BD601',
      message = 'BDB_PLAYER_ELIGIBILITY_PENDING',
      detail = jsonb_build_object('players', pending_players)::text;
  end if;
  if jsonb_array_length(incompatible_players) > 0 then
    raise exception using
      errcode = 'BD602',
      message = 'BDB_PLAYER_NOT_ELIGIBLE_FOR_DIVISION',
      detail = jsonb_build_object('players', incompatible_players)::text;
  end if;

  -- Persist only the public association decision. The transient private value
  -- is deliberately removed from the confirmed import payload.
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'sourceTeamName', item.value ->> 'sourceTeamName',
      'registrationId', item.value -> 'registrationId'
    ) order by item.ordinality
  ), '[]'::jsonb)
  into sanitized_teams
  from jsonb_array_elements(p_resolution -> 'teams') with ordinality as item(value, ordinality);

  select coalesce(jsonb_agg(
    jsonb_strip_nulls(
      jsonb_build_object(
        'sourceTeamName', item.value ->> 'sourceTeamName',
        'sourcePlayerName', item.value ->> 'sourcePlayerName',
        'action', case
          when item.value ->> 'action' is null and item.value ? 'rosterEntryId'
            then 'existing_roster'
          else item.value ->> 'action'
        end,
        'rosterEntryId', case
          when coalesce(item.value ->> 'action', 'existing_roster') = 'existing_roster'
            then item.value -> 'rosterEntryId'
          else null
        end,
        'playerId', case
          when item.value ->> 'action' = 'add_existing'
            then item.value -> 'playerId'
          else null
        end
      )
    ) order by item.ordinality
  ), '[]'::jsonb)
  into sanitized_players
  from jsonb_array_elements(p_resolution -> 'players') with ordinality as item(value, ordinality);

  sanitized_resolution := jsonb_build_object(
    'teams', sanitized_teams,
    'players', sanitized_players
  );

  created_game_id := private.admin_commit_boxscore_import_without_eligibility(
    p_import_id,
    sanitized_resolution
  );

  -- The original transaction creates the player and roster entry. Complete
  -- its private row before this outer transaction can commit.
  for player_resolution in
    select value
    from jsonb_array_elements(p_resolution -> 'players')
    where value ->> 'action' = 'create_new'
  loop
    select roster.player_id into created_player_id
    from public.boxscore_import_player_matches match
    join public.roster_entries roster on roster.id = match.roster_entry_id
    where match.import_id = p_import_id
      and match.source_team_name = player_resolution ->> 'sourceTeamName'
      and match.source_player_name = player_resolution ->> 'sourcePlayerName'
      and match.resolution_kind = 'created_new';
    if not found then
      raise exception using errcode = 'BD305', message = 'BDB_PDF_PLAYER_RESOLUTION_INVALID';
    end if;

    insert into private.player_private (player_id, sex, sex_review_required)
    values (created_player_id, player_resolution ->> 'eligibilitySex', false)
    on conflict on constraint player_private_pkey do update
    set
      sex = excluded.sex,
      sex_review_required = false;

    insert into public.admin_mutation_audit (
      action,
      entity_type,
      entity_id,
      metadata
    ) values (
      'player_sex_reviewed',
      'player',
      created_player_id,
      jsonb_build_object(
        'reason', 'Cadastro inicial pela confirmação do boxscore',
        'impact', jsonb_build_object(
          'rosterEntries', 1,
          'activeRosterEntries', 1,
          'competitions', 1
        )
      )
    );
  end loop;

  return created_game_id;
end;
$$;

revoke all on function private.admin_commit_boxscore_import_impl(bigint, jsonb)
  from public, anon, authenticated;
grant execute on function private.admin_commit_boxscore_import_impl(bigint, jsonb)
  to authenticated;

comment on function private.admin_commit_boxscore_import_without_eligibility(bigint, jsonb) is
  'Internal legacy FIBA commit body; callable only by the eligibility wrapper.';
comment on function private.admin_commit_boxscore_import_impl(bigint, jsonb) is
  'AAL2-only atomic FIBA commit with private eligibility preflight and value-free decisions.';
