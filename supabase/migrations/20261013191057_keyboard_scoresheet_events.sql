-- Independent keyboard drafts and immutable revisions; canonical tables are projections.
create table public.keyboard_scoresheets (
  game_id bigint primary key references public.games(id) on delete restrict,
  version bigint not null default 0 check(version >= 0),
  document jsonb not null,
  submission_id bigint references public.game_data_submissions(id) on delete restrict,
  updated_at timestamptz not null default now()
);
create table public.keyboard_scoresheet_revisions (
  request_id uuid primary key,
  game_id bigint not null references public.keyboard_scoresheets(game_id) on delete restrict,
  version bigint not null,
  base_version bigint not null,
  document jsonb not null,
  confirmed boolean not null,
  reason text not null default '',
  actor uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(game_id,version)
);
create index keyboard_scoresheets_submission_idx on public.keyboard_scoresheets(submission_id);
create index keyboard_scoresheet_revisions_actor_idx on public.keyboard_scoresheet_revisions(actor);
alter table public.keyboard_scoresheets enable row level security;
alter table public.keyboard_scoresheets force row level security;
alter table public.keyboard_scoresheet_revisions enable row level security;
alter table public.keyboard_scoresheet_revisions force row level security;
revoke all on public.keyboard_scoresheets,public.keyboard_scoresheet_revisions from public,anon,authenticated;
grant select on public.keyboard_scoresheets,public.keyboard_scoresheet_revisions to authenticated;
create policy keyboard_scoresheets_admin on public.keyboard_scoresheets for select to authenticated using ((select public.is_current_admin_aal2()));
create policy keyboard_revisions_admin on public.keyboard_scoresheet_revisions for select to authenticated using ((select public.is_current_admin_aal2()));

-- Unknown attempts remain NULL. Existing import writers still provide measured attempts.
alter table public.player_period_stats alter column two_point_attempted drop not null,
  alter column three_point_attempted drop not null, alter column free_throw_attempted drop not null;
alter table public.game_roster_slots drop constraint game_roster_slots_disqualification_reason_check,
  add constraint game_roster_slots_disqualification_reason_check check(disqualification_reason in ('D','2T','2U','T+U','2C','3BC','PLAYER_COACH'));

create function private.guard_keyboard_revision() returns trigger
language plpgsql set search_path='' as $$ begin
  raise exception 'KEYBOARD_REVISION_IMMUTABLE' using errcode='BD901';
end $$;
revoke all on function private.guard_keyboard_revision() from public,anon,authenticated;
create trigger keyboard_revision_immutable before update or delete on public.keyboard_scoresheet_revisions
for each row execute function private.guard_keyboard_revision();

create function public.admin_save_keyboard_scoresheet(
  p_game_id bigint,p_request_id uuid,p_base_version bigint,p_document jsonb,
  p_confirm boolean default false,p_reason text default ''
) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare
  g public.games; current_sheet public.keyboard_scoresheets;
  receipt public.keyboard_scoresheet_revisions;
  r jsonb; e jsonb; s text; n integer; i integer; total integer;
  kind text; suffix text; target text; reg bigint; rid bigint; slot_id bigint;
  c integer; t integer; u integer; f integer; b integer; dq text;
  new_submission bigint; old_submission bigint; domain_name text;
  home_score integer; away_score integer; made integer; conceded integer;
  previous_swap_setting text:=coalesce(current_setting('bdb.keyboard_replacing_submission',true),'');
begin
  if not private.is_admin_aal2() then raise exception 'BDB_ADMIN_AAL2_REQUIRED' using errcode='BD401'; end if;
  if p_request_id is null or p_base_version is null or p_base_version<0 or p_confirm is null or p_document is null
    or pg_column_size(p_document)>500000 or p_document->>'rulesVersion' is distinct from 'FIBA_2024'
    or jsonb_typeof(p_document->'roster') is distinct from 'array'
    or jsonb_typeof(p_document->'events') is distinct from 'array'
    or jsonb_typeof(p_document->'coachPlayer') is distinct from 'object'
    or not (p_document->'coachPlayer' ?& array['home','away'])
    or jsonb_typeof(p_document->'periods') is distinct from 'number'
    or (p_document->>'periods') !~ '^[0-9]+$'
  then raise exception 'KEYBOARD_INVALID_DOCUMENT' using errcode='BD902'; end if;
  n := (p_document->>'periods')::integer;
  if n not between 4 and 12 or jsonb_array_length(p_document->'events')>2000 then raise exception 'KEYBOARD_INVALID_DOCUMENT' using errcode='BD902'; end if;
  select * into g from public.games where id=p_game_id for update;
  if not found or g.matchup_id is null then raise exception 'KEYBOARD_GAME_UNAVAILABLE' using errcode='BD903'; end if;
  select * into receipt from public.keyboard_scoresheet_revisions where request_id=p_request_id;
  if found then
    if receipt.game_id<>p_game_id or receipt.base_version<>p_base_version or receipt.document<>p_document or receipt.confirmed<>p_confirm or receipt.reason<>coalesce(p_reason,'') then raise exception 'KEYBOARD_IDEMPOTENCY_CONFLICT' using errcode='BD904'; end if;
    return jsonb_build_object('version',receipt.version,'confirmed',receipt.confirmed,'requestId',p_request_id);
  end if;
  select * into current_sheet from public.keyboard_scoresheets where game_id=p_game_id for update;
  if coalesce(current_sheet.version,0)<>p_base_version then raise exception 'KEYBOARD_VERSION_CONFLICT' using errcode='BD905'; end if;
  old_submission:=current_sheet.submission_id;
  if exists(select 1 from public.game_data_submissions where game_id=p_game_id and status='active' and id is distinct from old_submission)
    or exists(select 1 from public.game_data_domain_authority where game_id=p_game_id and submission_id is distinct from old_submission)
    or (old_submission is null and (g.status not in ('scheduled','draft','live') or exists(select 1 from public.game_roster_slots where game_id=p_game_id)))
  then raise exception 'KEYBOARD_OTHER_SOURCE_ACTIVE' using errcode='BD906'; end if;
  if not exists(select 1 from public.competitions competition join public.series_category_data_profiles profile on profile.id=competition.data_profile_id where competition.id=g.competition_id and profile.primary_source='manual_scoresheet')
    or exists(select 1 from public.competitions where id=g.competition_id and status='archived')
  then raise exception 'KEYBOARD_MANUAL_PROFILE_REQUIRED' using errcode='BD903'; end if;
  if old_submission is not null and (select jsonb_agg(value-'played' order by value->>'rosterEntryId') from jsonb_array_elements(current_sheet.document->'roster')) is distinct from (select jsonb_agg(value-'played' order by value->>'rosterEntryId') from jsonb_array_elements(p_document->'roster')) then raise exception 'KEYBOARD_CONFIRMED_ROSTER_IMMUTABLE' using errcode='BD907'; end if;
  if p_confirm and old_submission is not null and char_length(btrim(coalesce(p_reason,''))) not between 10 and 500 then raise exception 'KEYBOARD_REVISION_REASON_REQUIRED' using errcode='BD908'; end if;
  if p_confirm and exists(select 1 from public.matchup_resolutions where matchup_id=g.matchup_id) then raise exception 'KEYBOARD_RESOLVED_MATCHUP' using errcode='BD909'; end if;

  -- Validate each selected jersey against this game's two participants and current roster.
  if (select count(distinct value->>'rosterEntryId') from jsonb_array_elements(p_document->'roster'))<>jsonb_array_length(p_document->'roster') then raise exception 'KEYBOARD_DUPLICATE_ROSTER' using errcode='BD902'; end if;
  foreach s in array array['home','away'] loop
    if jsonb_typeof(p_document->'coachPlayer'->s) not in ('number','null') then raise exception 'KEYBOARD_INVALID_COACH' using errcode='BD902'; end if;
    select count(*) into total from jsonb_array_elements(p_document->'roster') r where r->>'side'=s;
    if total not between 1 and 12 or (select count(distinct r->>'jersey') from jsonb_array_elements(p_document->'roster') r where r->>'side'=s)<>total then raise exception 'KEYBOARD_INVALID_ROSTER' using errcode='BD902'; end if;
    if p_document->'coachPlayer'->>s is not null and not exists(select 1 from jsonb_array_elements(p_document->'roster') r where r->>'side'=s and r->>'rosterEntryId'=p_document->'coachPlayer'->>s) then raise exception 'KEYBOARD_INVALID_COACH' using errcode='BD902'; end if;
  end loop;
  for r in select value from jsonb_array_elements(p_document->'roster') loop
    if jsonb_typeof(r) is distinct from 'object' or jsonb_typeof(r->'rosterEntryId') is distinct from 'number' or jsonb_typeof(r->'registrationId') is distinct from 'number' or jsonb_typeof(r->'jersey') is distinct from 'string'
      or jsonb_typeof(r->'played') is distinct from 'boolean' or r->>'side' is null or r->>'side' not in ('home','away') or r->>'jersey' is null or r->>'jersey' !~ '^(00|0|[1-9][0-9]?)$'
      or not exists(select 1 from public.roster_entries roster join public.team_registrations registration on registration.id=roster.registration_id and registration.status in ('confirmed','completed') join public.game_participants participant on participant.registration_id=roster.registration_id and participant.game_id=p_game_id where roster.id=(r->>'rosterEntryId')::bigint and roster.registration_id=(r->>'registrationId')::bigint and participant.side=r->>'side' and roster.competition_id=g.competition_id and roster.status='active')
    then raise exception 'KEYBOARD_INVALID_ROSTER' using errcode='BD902'; end if;
  end loop;
  if (select count(distinct (value->>'id')::uuid) from jsonb_array_elements(p_document->'events'))<>jsonb_array_length(p_document->'events') then raise exception 'KEYBOARD_DUPLICATE_EVENT' using errcode='BD902'; end if;
  for e in select value from jsonb_array_elements(p_document->'events') loop
    s:=e->>'side'; target:=e->>'target'; kind:=left(e->>'code',1); suffix:=substring(e->>'code' from 2);
    if jsonb_typeof(e) is distinct from 'object' or jsonb_typeof(e->'id') is distinct from 'string' or jsonb_typeof(e->'target') is distinct from 'string' or jsonb_typeof(e->'code') is distinct from 'string' or jsonb_typeof(e->'period') is distinct from 'number'
      or s is null or s not in ('home','away') or e->>'id' is null or target is null or e->>'code' is null
      or (e->>'period') is null or (e->>'period') !~ '^[0-9]+$' or (e->>'period')::integer not between 1 and n
      or (target not in ('B','C') and not exists(select 1 from jsonb_array_elements(p_document->'roster') r where r->>'side'=s and r->>'jersey'=target))
      or exists(select 1 from jsonb_array_elements(p_document->'roster') r where r->>'side'=s and r->>'jersey'=target and not (r->>'played')::boolean)
      or not (case when target='B' then e->>'code' ~ '^B[12C]$' when target='C' then e->>'code' ~ '^(C[1C]|D[123C]?)$' else e->>'code' ~ '^([123]|P[123C]?|T[1C]|[UD][123C]?)$' end)
    then raise exception 'KEYBOARD_INVALID_EVENT' using errcode='BD902'; end if;
  end loop;
  -- Personal/GD and player-coach combinations. Compensation affects penalty, never foul count.
  for r in select value from jsonb_array_elements(p_document->'roster') loop
    f:=0;t:=0;u:=0;c:=0;b:=0;dq:=null;
    for e in select value from jsonb_array_elements(p_document->'events') with ordinality x(value,ord) where value->>'side'=r->>'side' and (value->>'target'=r->>'jersey' or ((r->>'rosterEntryId')=p_document->'coachPlayer'->>(r->>'side') and value->>'target' in ('B','C'))) order by (value->>'period')::integer,ord loop
      kind:=left(e->>'code',1);
      if kind ~ '^[123]$' then continue; end if;
      if e->>'target'=r->>'jersey' then
        if dq is not null or f>=5 then raise exception 'KEYBOARD_FOUL_AFTER_EXCLUSION' using errcode='BD902'; end if;
        f:=f+1; if kind='T' then t:=t+1; end if; if kind='U' then u:=u+1; end if; if kind='D' then dq:='D'; end if;
      else
        if kind='C' then c:=c+1; end if;
        if kind='B' and e->>'code'<>'B2' then b:=b+1; end if;
        if kind='D' then dq:='D'; end if;
      end if;
      if t+u>=2 or c>=2 or c+b>=3 or ((t+u)>0 and (c>0 or b>=2)) then dq:='GD'; end if;
    end loop;
  end loop;

  insert into public.keyboard_scoresheets(game_id,document) values(p_game_id,p_document) on conflict(game_id) do nothing;
  if p_confirm then
    foreach s in array array['home','away'] loop
      select count(*) into made from jsonb_array_elements(p_document->'events') e where e->>'side'=s and e->>'code'='1';
      select coalesce(sum(case when substring(e->>'code' from 2) ~ '^[123]$' then substring(e->>'code' from 2)::integer else 0 end),0) into conceded from jsonb_array_elements(p_document->'events') e where e->>'side'<>s;
      if made>conceded then raise exception 'KEYBOARD_FREE_THROWS_INCONSISTENT' using errcode='BD902'; end if;
    end loop;
    for i in 4..n loop
      select coalesce(sum((e->>'code')::integer) filter(where e->>'side'='home'),0),coalesce(sum((e->>'code')::integer) filter(where e->>'side'='away'),0) into home_score,away_score from jsonb_array_elements(p_document->'events') e where e->>'code' ~ '^[123]$' and (e->>'period')::integer<=i;
      if (i=n and home_score=away_score) or (i<n and home_score<>away_score) then raise exception 'KEYBOARD_SCORE_OR_OVERTIME_INVALID' using errcode='BD902'; end if;
    end loop;
    if old_submission is null then
      foreach s in array array['home','away'] loop
        i:=0;
        for r in select value from jsonb_array_elements(p_document->'roster') r where r->>'side'=s loop
          i:=i+1;
          insert into public.game_roster_slots(game_id,registration_id,slot_number,roster_entry_id,jersey_number,did_not_play) values(p_game_id,(r->>'registrationId')::bigint,i,(r->>'rosterEntryId')::bigint,r->>'jersey',not(r->>'played')::boolean);
        end loop;
      end loop;
    else
      delete from public.foul_events where game_id=p_game_id;
      delete from public.player_period_stats where game_id=p_game_id;
      delete from public.game_period_scores where game_id=p_game_id;
      delete from public.game_periods where game_id=p_game_id;
      update public.game_roster_slots set disqualified_at_period=null,disqualification_reason=null where game_id=p_game_id;
      perform set_config('bdb.keyboard_replacing_submission',old_submission::text,true);
      update public.game_data_submissions set status='superseded' where id=old_submission;
      perform set_config('bdb.keyboard_replacing_submission',previous_swap_setting,true);
    end if;
    insert into public.game_periods(game_id,period_number) select p_game_id,generate_series(1,n);
    for r in select value from jsonb_array_elements(p_document->'roster') loop
      update public.game_roster_slots set did_not_play=not(r->>'played')::boolean where game_id=p_game_id and roster_entry_id=(r->>'rosterEntryId')::bigint;
    end loop;
    insert into public.player_period_stats(game_roster_slot_id,game_id,period_number,two_point_made,three_point_made,free_throw_made,two_point_attempted,three_point_attempted,free_throw_attempted)
    select slot.id,p_game_id,period,
      count(*) filter(where e->>'code'='2'),count(*) filter(where e->>'code'='3'),count(*) filter(where e->>'code'='1'),null,null,null
    from public.game_roster_slots slot cross join generate_series(1,n) period
    left join jsonb_array_elements(p_document->'events') e on e->>'target'=slot.jersey_number and (e->>'period')::integer=period and e->>'side'=(select side from public.game_participants where game_id=p_game_id and registration_id=slot.registration_id)
    where slot.game_id=p_game_id group by slot.id,period;
    insert into public.foul_events(game_roster_slot_id,game_id,period_number,sequence_number,foul_code)
    select slot.id,p_game_id,(e->>'period')::integer,row_number() over(partition by slot.id,e->>'period' order by ord),left(e->>'code',1)
    from jsonb_array_elements(p_document->'events') with ordinality x(e,ord)
    join public.game_participants participant on participant.game_id=p_game_id and participant.side=e->>'side'
    join public.game_roster_slots slot on slot.game_id=p_game_id and slot.registration_id=participant.registration_id and slot.jersey_number=e->>'target'
    where left(e->>'code',1) in ('P','T','U','D');
    insert into public.game_period_scores(game_id,registration_id,period_number,points)
    select p_game_id,slot.registration_id,stat.period_number,sum(stat.points) from public.player_period_stats stat join public.game_roster_slots slot on slot.id=stat.game_roster_slot_id where stat.game_id=p_game_id group by slot.registration_id,stat.period_number;
    for r in select value from jsonb_array_elements(p_document->'roster') loop
      t:=0;u:=0;c:=0;b:=0;dq:=null;
      for e in select value from jsonb_array_elements(p_document->'events') with ordinality x(value,ord) where value->>'side'=r->>'side' and (value->>'target'=r->>'jersey' or ((r->>'rosterEntryId')=p_document->'coachPlayer'->>(r->>'side') and value->>'target' in ('B','C'))) order by (value->>'period')::integer,ord loop
        kind:=left(e->>'code',1);
        if kind ~ '^[123]$' then continue; end if;
        if e->>'target'=r->>'jersey' then
          if kind='T' then t:=t+1; end if; if kind='U' then u:=u+1; end if; if kind='D' then dq:='D'; end if;
        else
          if kind='C' then c:=c+1; end if; if kind='B' and e->>'code'<>'B2' then b:=b+1; end if; if kind='D' then dq:='D'; end if;
        end if;
        if dq is null then
          dq:=case when t>=2 then '2T' when u>=2 then '2U' when t+u>=2 then 'T+U' when c>=2 then '2C' when c+b>=3 then '3BC' when (t+u)>0 and (c>0 or b>=2) then 'PLAYER_COACH' else null end;
        end if;
        if dq is not null then
          update public.game_roster_slots set disqualified_at_period=(e->>'period')::integer,disqualification_reason=dq where game_id=p_game_id and roster_entry_id=(r->>'rosterEntryId')::bigint;
          exit;
        end if;
      end loop;
    end loop;
    update public.games set status='final',source='manual',manual_idempotency_key=p_request_id,manual_payload_hash=md5(p_document::text),created_by=coalesce(created_by,auth.uid()),started_at=coalesce(started_at,scheduled_at,now()),ended_at=coalesce(ended_at,scheduled_at+interval '2 hours',now()) where id=p_game_id;
    insert into public.game_data_submissions(game_id,submission_version,source_type,role,status,payload_hash,idempotency_key,submitted_by,validated_by,validated_at,reason)
    values(p_game_id,coalesce((select max(submission_version)+1 from public.game_data_submissions where game_id=p_game_id and source_type='manual_scoresheet'),1),'manual_scoresheet','primary','active',md5(p_document::text),p_request_id::text,auth.uid(),auth.uid(),now(),nullif(btrim(p_reason),'')) returning id into new_submission;
    foreach domain_name in array array['official_result','period_scores','participation','player_scoring','player_foul_total','player_foul_timeline'] loop
      perform private.activate_game_data_domain_authority(p_game_id,domain_name,new_submission,old_submission,case when old_submission is not null then p_reason else null end);
    end loop;
    update public.keyboard_scoresheets set submission_id=new_submission where game_id=p_game_id;
    if (old_submission is not null and exists(select 1 from public.game_data_domain_authority where submission_id=old_submission))
      or (select count(*) from public.game_data_domain_authority where game_id=p_game_id and submission_id=new_submission and domain in ('official_result','period_scores','participation','player_scoring','player_foul_total','player_foul_timeline'))<>6 then
      raise exception 'KEYBOARD_AUTHORITY_SWAP_INCOMPLETE' using errcode='BD911';
    end if;
    insert into public.admin_mutation_audit(action,entity_type,entity_id,metadata) values('manual_scoresheet_saved','game',p_game_id,jsonb_build_object('editor','keyboard-v1','submissionId',new_submission,'version',p_base_version+1));
  end if;
  update public.keyboard_scoresheets set document=p_document,version=p_base_version+1,updated_at=now() where game_id=p_game_id;
  insert into public.keyboard_scoresheet_revisions(request_id,game_id,version,base_version,document,confirmed,reason,actor) values(p_request_id,p_game_id,p_base_version+1,p_base_version,p_document,p_confirm,coalesce(p_reason,''),auth.uid());
  return jsonb_build_object('version',p_base_version+1,'confirmed',p_confirm,'requestId',p_request_id);
exception when invalid_text_representation or numeric_value_out_of_range or not_null_violation then
  raise exception 'KEYBOARD_INVALID_DOCUMENT' using errcode='BD902';
end $$;
revoke all on function public.admin_save_keyboard_scoresheet(bigint,uuid,bigint,jsonb,boolean,text) from public,anon,authenticated;
grant execute on function public.admin_save_keyboard_scoresheet(bigint,uuid,bigint,jsonb,boolean,text) to authenticated;

-- The legacy editor cannot confirm a game reserved by this editor.
alter function public.admin_create_manual_scoresheet(jsonb) rename to admin_create_manual_scoresheet_before_keyboard;
alter function public.admin_create_manual_scoresheet_before_keyboard(jsonb) set schema private;
revoke all on function private.admin_create_manual_scoresheet_before_keyboard(jsonb) from public,anon,authenticated;
create function public.admin_create_manual_scoresheet(p_payload jsonb) returns bigint
language plpgsql security definer set search_path='' as $$ begin
  if not private.is_admin_aal2() then raise exception 'BDB_ADMIN_AAL2_REQUIRED' using errcode='BD401'; end if;
  perform 1 from public.games where id=(p_payload->>'gameId')::bigint for update;
  if exists(select 1 from public.keyboard_scoresheets where game_id=(p_payload->>'gameId')::bigint) then raise exception 'KEYBOARD_OTHER_SOURCE_ACTIVE' using errcode='BD906'; end if;
  return private.admin_create_manual_scoresheet_before_keyboard(p_payload);
end $$;
revoke all on function public.admin_create_manual_scoresheet(jsonb) from public,anon,authenticated;
grant execute on function public.admin_create_manual_scoresheet(jsonb) to authenticated;

-- Same-total corrections must also require explicit editorial republication.
alter function private.competition_publication_snapshot(bigint) rename to competition_publication_snapshot_before_keyboard;
create function private.competition_publication_snapshot(p_competition_id bigint) returns jsonb
language sql stable security definer set search_path='' as $$
  select private.competition_publication_snapshot_before_keyboard(p_competition_id) ||
    case when exists(select 1 from public.keyboard_scoresheets k join public.games g on g.id=k.game_id where g.competition_id=p_competition_id and k.submission_id is not null)
    then jsonb_build_object('keyboardSubmissions',(select jsonb_agg(jsonb_build_object('gameId',k.game_id,'submissionId',k.submission_id) order by k.game_id) from public.keyboard_scoresheets k join public.games g on g.id=k.game_id where g.competition_id=p_competition_id and k.submission_id is not null)) else '{}'::jsonb end;
$$;
revoke all on function private.competition_publication_snapshot_before_keyboard(bigint),private.competition_publication_snapshot(bigint) from public,anon,authenticated;

create function private.guard_keyboard_projection() returns trigger language plpgsql set search_path='' as $$
begin
  if current_user in ('authenticated','anon') and exists(select 1 from public.keyboard_scoresheets where (tg_op<>'DELETE' and game_id=new.game_id) or (tg_op<>'INSERT' and game_id=old.game_id)) then raise exception 'KEYBOARD_USE_EVENT_WRITER' using errcode='BD910'; end if;
  return coalesce(new,old);
end $$;
revoke all on function private.guard_keyboard_projection() from public,anon,authenticated;
create trigger keyboard_guard_stats before insert or update or delete on public.player_period_stats for each row execute function private.guard_keyboard_projection();
create trigger keyboard_guard_fouls before insert or update or delete on public.foul_events for each row execute function private.guard_keyboard_projection();
create trigger keyboard_guard_scores before insert or update or delete on public.game_period_scores for each row execute function private.guard_keyboard_projection();
create trigger keyboard_guard_roster before insert or update or delete on public.game_roster_slots for each row execute function private.guard_keyboard_projection();
create trigger keyboard_guard_periods before insert or update or delete on public.game_periods for each row execute function private.guard_keyboard_projection();

-- Permit only this trusted writer's short transactional source swap. Unprivileged
-- users cannot bypass the existing active-authority guard by spoofing a setting.
create or replace function private.prevent_referenced_submission_deactivation()
returns trigger language plpgsql set search_path='' as $$ begin
  if tg_op='DELETE' then
    if exists(select 1 from public.game_data_domain_authority where submission_id=old.id) then raise exception 'BDB_SUBMISSION_HAS_ACTIVE_AUTHORITY' using errcode='BD707'; end if;
    return old;
  end if;
  if new.status<>'active' and exists(select 1 from public.game_data_domain_authority where submission_id=old.id) then
    if not coalesce((current_user not in ('anon','authenticated','service_role') and private.is_admin_aal2()
      and old.status='active' and new.status='superseded' and old.source_type='manual_scoresheet' and old.role='primary'
      and coalesce(current_setting('bdb.keyboard_replacing_submission',true),'')=old.id::text
      and exists(select 1 from public.keyboard_scoresheets where game_id=old.game_id and submission_id=old.id)),false) then
      raise exception 'BDB_SUBMISSION_HAS_ACTIVE_AUTHORITY' using errcode='BD707';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.prevent_referenced_submission_deactivation() from public,anon,authenticated;

create function private.check_keyboard_authority_swap() returns trigger
language plpgsql set search_path='' as $$ begin
  if exists(select 1 from public.game_data_domain_authority a join public.game_data_submissions s on s.id=a.submission_id where s.id=new.id and s.status<>'active') then
    raise exception 'KEYBOARD_AUTHORITY_SWAP_INCOMPLETE' using errcode='BD911';
  end if;
  return null;
end $$;
revoke all on function private.check_keyboard_authority_swap() from public,anon,authenticated;
create constraint trigger keyboard_authority_swap_complete after update of status on public.game_data_submissions
deferrable initially deferred for each row execute function private.check_keyboard_authority_swap();
