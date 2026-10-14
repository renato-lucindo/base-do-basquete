-- Permit a later official FIBA PDF only through the existing POST01
-- comparison flow. Keyboard drafts and unrelated PDF sources stay reserved.
create or replace function private.admin_commit_supported_boxscore_import_impl(
  p_import_id bigint,
  p_resolution jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_parser_version text;
  target_game_id bigint;
  keyboard_present boolean;
  confirmed_fiba_fallback boolean;
begin
  if not private.is_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  select import_item.parser_version into selected_parser_version
  from public.boxscore_imports import_item
  where import_item.id = p_import_id
    and import_item.created_by = auth.uid();
  if not found then
    raise exception using errcode = 'BD404', message = 'BDB_PDF_IMPORT_NOT_FOUND';
  end if;

  if jsonb_typeof(p_resolution) = 'object'
    and coalesce(p_resolution ->> 'gameId', '') ~ '^[1-9][0-9]*$'
  then
    begin
      target_game_id := (p_resolution ->> 'gameId')::bigint;
    exception when numeric_value_out_of_range then
      target_game_id := null; -- Let the original import validator report invalid IDs.
    end;

    if target_game_id is not null then
      -- Same first lock as the keyboard writer. Its confirmed submission
      -- cannot change between this check and the delegated transaction.
      perform 1
      from public.games game
      where game.id = target_game_id
      for update;

      select exists(
        select 1 from public.keyboard_scoresheets keyboard
        where keyboard.game_id = target_game_id
      ) into keyboard_present;

      if keyboard_present then
        -- Only the exact active fallback owning the official-result domain
        -- qualifies for staging; no draft or unrelated source is admitted.
        select exists(
          select 1
          from public.keyboard_scoresheets keyboard
          join public.games game on game.id = keyboard.game_id
          join public.competitions competition
            on competition.id = game.competition_id
          join public.series_category_data_profiles profile
            on profile.id = competition.data_profile_id
          join public.game_data_submissions submission
            on submission.id = keyboard.submission_id
           and submission.game_id = game.id
          join public.game_data_domain_authority authority
            on authority.game_id = game.id
           and authority.submission_id = submission.id
           and authority.domain = 'official_result'
          join public.boxscore_imports import_item
            on import_item.id = p_import_id
           and import_item.competition_id = competition.id
          where keyboard.game_id = target_game_id
            and game.status = 'final'
            and profile.primary_source = 'fiba_boxscore'
            and submission.source_type = 'manual_scoresheet'
            and submission.role = 'fallback'
            and submission.status = 'active'
        ) into confirmed_fiba_fallback;

        if selected_parser_version not in ('fiba-genius-v1', 'fiba-genius-v2')
          or not confirmed_fiba_fallback
        then
          raise exception using
            errcode = 'BD906',
            message = 'KEYBOARD_OTHER_SOURCE_ACTIVE';
        end if;

        -- The FIBA delegate stages a comparison candidate without promoting
        -- it over the six keyboard authorities or deleting their evidence.
        return private.admin_commit_boxscore_import_impl(p_import_id, p_resolution);
      end if;
    end if;
  end if;

  if selected_parser_version = 'basketball-site-v1' then
    return private.admin_commit_basketball_site_import_impl(p_import_id, p_resolution);
  end if;
  return private.admin_commit_boxscore_import_impl(p_import_id, p_resolution);
end;
$$;

revoke all on function private.admin_commit_supported_boxscore_import_impl(bigint, jsonb)
from public, anon, authenticated;
grant execute on function private.admin_commit_supported_boxscore_import_impl(bigint, jsonb)
to authenticated;

comment on function private.admin_commit_supported_boxscore_import_impl(bigint, jsonb) is
  'Restricts keyboard-reserved games to an AAL2-authorized, matching, confirmed FIBA fallback, delegating late PDFs to the existing auditable POST01 comparison stage.';
