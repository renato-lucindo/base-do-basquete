-- Read contract for the AAL2 secondary-action UI. Mutations remain in their
-- narrow RPCs; this document contains no secret or public write surface.
create function public.admin_get_sports_exceptions_dashboard(p_competition_id bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  revision public.competition_ruleset_revisions;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;
  select ruleset.* into revision
  from public.competition_ruleset_revisions ruleset
  where ruleset.competition_id = p_competition_id and ruleset.status = 'active';
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_ACTIVE_RULESET_NOT_FOUND';
  end if;
  return jsonb_build_object(
    'competitionId', p_competition_id,
    'rulesetRevisionId', revision.id,
    'preset', revision.preset_key,
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', group_item.id,
        'code', group_item.code,
        'closed', closure.id is not null,
        'closureId', closure.id
      ) order by group_item.id)
      from public.competition_groups group_item
      left join public.competition_group_closures closure
        on closure.group_id = group_item.id
      where group_item.ruleset_revision_id = revision.id
    ), '[]'::jsonb),
    'matchups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', matchup.id,
        'code', matchup.code,
        'round', round_item.name,
        'roundOrder', round_item.round_order,
        'groupId', round_item.group_id,
        'homeRegistrationId', matchup.home_registration_id,
        'awayRegistrationId', matchup.away_registration_id,
        'game', case when game.id is null then null else jsonb_build_object(
          'id', game.id, 'status', game.status, 'startedAt', game.started_at
        ) end,
        'outcome', private.matchup_outcome_document(matchup.id)
      ) order by round_item.round_order, matchup.matchup_order, matchup.id)
      from public.matchups matchup
      join public.competition_rounds round_item on round_item.id = matchup.round_id
      left join public.games game
        on game.matchup_id = matchup.id and game.matchup_game_number = 1
      where matchup.ruleset_revision_id = revision.id
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.admin_get_sports_exceptions_dashboard(bigint)
  from public, anon, authenticated;
grant execute on function public.admin_get_sports_exceptions_dashboard(bigint)
  to authenticated;
comment on function public.admin_get_sports_exceptions_dashboard(bigint) is
  'Returns the active private graph and immutable outcome state for the AAL2 sports-exceptions UI.';
