-- Strict AAL2 keyboard-authorized replacement of a FIBA-profile fallback.
create or replace function private.prevent_referenced_submission_deactivation()
returns trigger language plpgsql set search_path='' as $$ begin
  if tg_op='DELETE' then
    if exists(select 1 from public.game_data_domain_authority where submission_id=old.id) then raise exception 'BDB_SUBMISSION_HAS_ACTIVE_AUTHORITY' using errcode='BD707'; end if;
    return old;
  end if;
  if new.status<>'active' and exists(select 1 from public.game_data_domain_authority where submission_id=old.id) then
    if not coalesce((current_user not in ('anon','authenticated','service_role') and private.is_admin_aal2()
      and old.status='active' and new.status='superseded'
      and new.id=old.id and new.game_id=old.game_id and new.source_type=old.source_type and new.role=old.role
      and old.source_type='manual_scoresheet'
      and (old.role='primary' or (
        old.role='fallback' and exists(
          select 1 from public.games g
          join public.competitions c on c.id=g.competition_id
          join public.series_category_data_profiles profile on profile.id=c.data_profile_id
          where g.id=old.game_id and profile.primary_source='fiba_boxscore'
        )
      ))
      and coalesce(current_setting('bdb.keyboard_replacing_submission',true),'')=old.id::text
      and exists(select 1 from public.keyboard_scoresheets where game_id=old.game_id and submission_id=old.id)),false) then
      raise exception 'BDB_SUBMISSION_HAS_ACTIVE_AUTHORITY' using errcode='BD707';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.prevent_referenced_submission_deactivation() from public,anon,authenticated;
