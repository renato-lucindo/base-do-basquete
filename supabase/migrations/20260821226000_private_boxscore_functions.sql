-- Keep privileged implementations outside the Data API schema. Public RPCs remain
-- SECURITY INVOKER wrappers, while the private functions enforce singleton admin + aal2.

alter function public.admin_claim_boxscore_upload()
  rename to admin_claim_boxscore_upload_impl;
alter function public.admin_claim_boxscore_upload_impl()
  set schema private;

alter function public.admin_create_boxscore_import_draft(
  bigint, text, text, text, integer, text, jsonb, jsonb, jsonb
) rename to admin_create_boxscore_import_draft_impl;
alter function public.admin_create_boxscore_import_draft_impl(
  bigint, text, text, text, integer, text, jsonb, jsonb, jsonb
) set schema private;

alter function public.admin_fail_boxscore_import(bigint, text)
  rename to admin_fail_boxscore_import_impl;
alter function public.admin_fail_boxscore_import_impl(bigint, text)
  set schema private;

alter function public.admin_commit_boxscore_import(bigint, jsonb)
  rename to admin_commit_boxscore_import_impl;
alter function public.admin_commit_boxscore_import_impl(bigint, jsonb)
  set schema private;

create function public.admin_claim_boxscore_upload()
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.admin_claim_boxscore_upload_impl();
$$;

create function public.admin_create_boxscore_import_draft(
  p_competition_id bigint,
  p_sha256 text,
  p_storage_path text,
  p_source_filename text,
  p_file_size_bytes integer,
  p_parser_version text,
  p_parsed_payload jsonb,
  p_validation_payload jsonb,
  p_matches jsonb
)
returns bigint
language sql
security invoker
set search_path = ''
as $$
  select private.admin_create_boxscore_import_draft_impl(
    p_competition_id,
    p_sha256,
    p_storage_path,
    p_source_filename,
    p_file_size_bytes,
    p_parser_version,
    p_parsed_payload,
    p_validation_payload,
    p_matches
  );
$$;

create function public.admin_fail_boxscore_import(
  p_import_id bigint,
  p_error_code text
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.admin_fail_boxscore_import_impl(p_import_id, p_error_code);
$$;

create function public.admin_commit_boxscore_import(
  p_import_id bigint,
  p_resolution jsonb
)
returns bigint
language sql
security invoker
set search_path = ''
as $$
  select private.admin_commit_boxscore_import_impl(p_import_id, p_resolution);
$$;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

revoke all on function private.admin_claim_boxscore_upload_impl() from public, anon;
revoke all on function private.admin_create_boxscore_import_draft_impl(
  bigint, text, text, text, integer, text, jsonb, jsonb, jsonb
) from public, anon;
revoke all on function private.admin_fail_boxscore_import_impl(bigint, text) from public, anon;
revoke all on function private.admin_commit_boxscore_import_impl(bigint, jsonb) from public, anon;

grant execute on function private.admin_claim_boxscore_upload_impl() to authenticated;
grant execute on function private.admin_create_boxscore_import_draft_impl(
  bigint, text, text, text, integer, text, jsonb, jsonb, jsonb
) to authenticated;
grant execute on function private.admin_fail_boxscore_import_impl(bigint, text) to authenticated;
grant execute on function private.admin_commit_boxscore_import_impl(bigint, jsonb) to authenticated;

revoke all on function public.admin_claim_boxscore_upload() from public, anon;
revoke all on function public.admin_create_boxscore_import_draft(
  bigint, text, text, text, integer, text, jsonb, jsonb, jsonb
) from public, anon;
revoke all on function public.admin_fail_boxscore_import(bigint, text) from public, anon;
revoke all on function public.admin_commit_boxscore_import(bigint, jsonb) from public, anon;

grant execute on function public.admin_claim_boxscore_upload() to authenticated;
grant execute on function public.admin_create_boxscore_import_draft(
  bigint, text, text, text, integer, text, jsonb, jsonb, jsonb
) to authenticated;
grant execute on function public.admin_fail_boxscore_import(bigint, text) to authenticated;
grant execute on function public.admin_commit_boxscore_import(bigint, jsonb) to authenticated;
