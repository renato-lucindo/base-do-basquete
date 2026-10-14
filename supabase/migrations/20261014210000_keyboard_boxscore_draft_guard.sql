-- Block PDF writers from taking over any game reserved by the keyboard editor.
-- Additive correction: preserve the existing import RPC signatures and parser dispatch.
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

  -- Both the legacy import RPC and commit_v2 delegate here. All keyboard
  -- revisions (including unconfirmed drafts) reserve the game for this source.
  if jsonb_typeof(p_resolution) = 'object'
    and coalesce(p_resolution ->> 'gameId', '') ~ '^[1-9][0-9]*$'
  then
    begin
      target_game_id := (p_resolution ->> 'gameId')::bigint;
    exception when numeric_value_out_of_range then
      target_game_id := null; -- Delegate invalid ids to the existing validator.
    end;

    if target_game_id is not null then
      -- Keyboard writes also lock public.games first. This serializes
      -- ownership checks against a concurrent first draft or confirmation.
      perform 1 from public.games game
      where game.id = target_game_id
      for update;

      if exists (
        select 1
        from public.keyboard_scoresheets keyboard
        where keyboard.game_id = target_game_id
      ) then
        raise exception using
          errcode = 'BD906',
          message = 'KEYBOARD_OTHER_SOURCE_ACTIVE';
      end if;
    end if;
  end if;

  if selected_parser_version = 'basketball-site-v1' then
    return private.admin_commit_basketball_site_import_impl(p_import_id, p_resolution);
  end if;
  return private.admin_commit_boxscore_import_impl(p_import_id, p_resolution);
end;
$$;

-- Keep the original authenticated execution contract unchanged. The private
-- function still enforces administrator MFA AAL2 and import ownership itself.
revoke all on function private.admin_commit_supported_boxscore_import_impl(bigint, jsonb)
from public, anon, authenticated;
grant execute on function private.admin_commit_supported_boxscore_import_impl(bigint, jsonb)
to authenticated;
