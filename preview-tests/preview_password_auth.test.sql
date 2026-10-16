-- Run only after applying scripts/preview-password-auth.sql to a disposable
-- local database with project reference abcdefghijklmnopqrst substituted.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
set constraints all deferred;
insert into private.admin_accounts(user_id) values ('11111111-1111-4111-8111-111111111111');
insert into public.auth_audit_events(user_id,event_type,correlation_id)
values ('11111111-1111-4111-8111-111111111111','admin_access','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1","iss":"https://abcdefghijklmnopqrst.supabase.co/auth/v1","amr":[{"method":"password"}]}',true);
set local role authenticated;
select ok(public.is_current_admin_aal2(), 'registered password admin is authorized in pinned preview');
select is(auth.jwt()->>'aal','aal1','actual assurance level remains AAL1');
select is((select count(*) from public.auth_audit_events),1::bigint,'preview admin can read protected rows');
select lives_ok($$insert into public.auth_audit_events(event_type,correlation_id) values ('admin_access','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')$$,'preview admin can write through RLS');
select ok(not has_function_privilege(current_user,'private.is_admin_aal2()','execute') or (select proowner <> (select oid from pg_roles where rolname=current_user) from pg_proc where oid='private.is_admin_aal2()'::regprocedure),'API role does not own the authorization function');
select throws_ok($$alter function private.is_admin_aal2() rename to bypass$$,'42501',null,'API role cannot rewrite authorization');

reset role;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1","iss":"https://abcdefghijklmnopqrst.supabase.co/auth/v1","amr":[{"method":"password"}],"user_metadata":{"admin":true}}',true);
set local role authenticated;
select is(public.is_current_admin_aal2(),false,'another identity cannot become administrator');
select is((select count(*) from public.auth_audit_events),0::bigint,'other identity cannot read protected rows');
select throws_ok($$insert into public.auth_audit_events(event_type,correlation_id) values ('admin_access','cccccccc-cccc-4ccc-8ccc-cccccccccccc')$$,'42501',null,'other identity cannot write protected rows');

reset role;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1","iss":"https://yjnbemfeyjhxhomprlnm.supabase.co/auth/v1","amr":[{"method":"password"}],"user_metadata":{"preview_password_auth":true}}',true);
select set_config('bdb.preview_project_ref','yjnbemfeyjhxhomprlnm',true);
set local role authenticated;
select is(public.is_current_admin_aal2(),false,'shared issuer cannot enable exception using metadata or settings');
select is((select count(*) from public.auth_audit_events),0::bigint,'shared issuer AAL1 remains blocked by RLS');

reset role;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1","iss":"https://abcdefghijklmnopqrst.supabase.co/auth/v1","amr":[{"method":"otp"}]}',true);
set local role authenticated;
select is(public.is_current_admin_aal2(),false,'OTP cannot use password exception');
reset role;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","iss":"https://abcdefghijklmnopqrst.supabase.co/auth/v1","amr":[{"method":"password"}]}',true);
set local role authenticated;
select is(public.is_current_admin_aal2(),false,'missing assurance level fails closed');
reset role;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select ok(public.is_current_admin_aal2(),'existing AAL2 behavior remains unchanged');
reset role;
set local role anon;
select ok(not has_function_privilege(current_user,'public.is_current_admin_aal2()','execute'),'anonymous has no authorization probe access');
select ok(not has_table_privilege(current_user,'public.auth_audit_events','select,insert'),'anonymous has no protected table access');
reset role;
select * from finish();
rollback;
