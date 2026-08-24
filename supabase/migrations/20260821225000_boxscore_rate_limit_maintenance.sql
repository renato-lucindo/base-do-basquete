alter table private.boxscore_upload_attempts
  add column id bigint generated always as identity primary key;

create or replace function public.admin_claim_boxscore_upload()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_attempts integer;
begin
  if not public.is_current_admin_aal2() then
    raise exception using errcode = 'BD401', message = 'BDB_ADMIN_AAL2_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 901));
  delete from private.boxscore_upload_attempts
  where attempted_at < now() - interval '24 hours';

  select count(*) into recent_attempts
  from private.boxscore_upload_attempts attempt
  where attempt.user_id = auth.uid()
    and attempt.attempted_at >= now() - interval '10 minutes';

  if recent_attempts >= 5 then
    raise exception using errcode = 'BD304', message = 'BDB_PDF_RATE_LIMIT';
  end if;

  insert into private.boxscore_upload_attempts (user_id) values (auth.uid());
end;
$$;

revoke all on function public.admin_claim_boxscore_upload() from public, anon;
grant execute on function public.admin_claim_boxscore_upload() to authenticated;
