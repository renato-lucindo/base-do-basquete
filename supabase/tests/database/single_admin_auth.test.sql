begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

set constraints all deferred;
insert into private.admin_accounts (user_id)
values ('11111111-1111-4111-8111-111111111111');
insert into public.auth_audit_events (user_id, event_type, correlation_id)
values (
  '11111111-1111-4111-8111-111111111111',
  'admin_access',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;

select ok(public.is_current_admin(), 'the registered identity is recognized');
select isnt(public.is_current_admin_aal2(), true, 'aal1 is not authorized');
select is(count(*), 0::bigint, 'aal1 cannot read audit rows')
from public.auth_audit_events;
select throws_ok(
  $$insert into public.auth_audit_events (event_type, correlation_id)
    values ('admin_access', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')$$,
  '42501',
  'new row violates row-level security policy for table "auth_audit_events"',
  'aal1 cannot write audit rows'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;

select isnt(public.is_current_admin(), true, 'another identity is not administrator');
select isnt(public.is_current_admin_aal2(), true, 'another identity at aal2 is not authorized');
select is(count(*), 0::bigint, 'another identity cannot read audit rows')
from public.auth_audit_events;

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;

select ok(public.is_current_admin_aal2(), 'registered administrator at aal2 is authorized');
insert into public.auth_audit_events (event_type, correlation_id)
values ('admin_access', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
select is(count(*), 2::bigint, 'registered administrator at aal2 can read and write')
from public.auth_audit_events;

reset role;
set local role anon;
select ok(
  not has_table_privilege(current_user, 'public.auth_audit_events', 'select,insert'),
  'anonymous role has no table privileges'
);

select * from finish();
rollback;
