import sys

if sys.flags.optimize:
    raise RuntimeError('Python optimization is forbidden for isolated QA runners')

import base64, hashlib, hmac, json, os, pathlib, secrets, struct, time, urllib.parse
import psycopg, requests
TARGET = 'payumtvegfqfejmowxiy'
BASE = 'https://' + TARGET + '.supabase.co'
keys_path = pathlib.Path(os.environ['LOCALAPPDATA']) / 'BaseDoBasquete/qa-pr72/api-keys.json'
keys = json.loads(keys_path.read_text(encoding='utf-8-sig'))
service = next(key['api_key'] for key in keys if key['name'] == 'service_role')
public = next(key['api_key'] for key in keys if key['type'] == 'publishable')
cli = pathlib.Path(os.environ['TEMP']) / 'bdb-pr72-isolated-cli/supabase/.temp'
assert (cli / 'project-ref').read_text().strip() == TARGET
url = (cli / 'pooler-url').read_text().strip()
assert urllib.parse.urlparse(url).username == 'postgres.' + TARGET
ca = pathlib.Path(os.environ['TEMP']) / 'bdb-pr72-supabase-ca.crt'
conn = psycopg.connect(url, password=os.environ['BDB_QA_PASSWORD'], sslmode='verify-full', sslrootcert=str(ca), connect_timeout=10, autocommit=True)

def request(method, endpoint, body=None, token=None, admin=False):
    key = service if admin else public
    headers = {'apikey': key, 'Content-Type': 'application/json'}
    if token or admin:
        headers['Authorization'] = 'Bearer ' + (token or service)
    return requests.request(method, BASE + endpoint, headers=headers, json=body, timeout=30)

def ok(response, step):
    assert response.ok, step + ' HTTP ' + str(response.status_code)
    return response.json()

user_id = None
try:
    anonymous = request('POST', '/rest/v1/rpc/is_current_admin', {})
    assert anonymous.status_code in (401,403), 'Anonymous probe should be denied'
    print('PASS anonymous authorization denied', flush=True)
    email = 'qa-pr72-' + secrets.token_hex(6) + '@example.invalid'
    password = 'Aa1x' + secrets.token_hex(32)
    user = ok(request('POST', '/auth/v1/admin/users', {'email':email,'password':password,'email_confirm':True}, admin=True), 'create synthetic user')
    user_id = user['id']
    with conn.cursor() as cur:
        cur.execute('select count(*) from private.admin_accounts')
        assert cur.fetchone()[0] == 0, 'Isolated administrator already exists; stop instead of overwriting'
    login = ok(request('POST','/auth/v1/token?grant_type=password',{'email':email,'password':password}), 'login')
    aal1 = login['access_token']
    assert ok(request('POST','/rest/v1/rpc/is_current_admin',{},token=aal1),'nonadmin probe') is False
    print('PASS authenticated nonadministrator denied', flush=True)
    with conn.cursor() as cur:
        cur.execute('insert into private.admin_accounts(user_id) values(%s)', (user_id,))
    assert ok(request('POST','/rest/v1/rpc/is_current_admin',{},token=aal1),'admin probe') is True
    assert ok(request('POST','/rest/v1/rpc/is_current_admin_aal2',{},token=aal1),'AAL1 probe') is False
    denied = request('POST','/rest/v1/rpc/admin_create_manual_scoresheet_v2',{'p_payload':{}},token=aal1)
    assert not denied.ok and denied.json().get('code') == 'BD401' and denied.json().get('message') == 'BDB_ADMIN_AAL2_REQUIRED', 'AAL1 critical write must return the authoritative BD401 denial'
    print('PASS AAL1 administrator cannot perform critical write', flush=True)
    factor = ok(request('POST','/auth/v1/factors',{'factor_type':'totp','friendly_name':'QA PR72'},token=aal1),'MFA enrollment')
    challenge = ok(request('POST','/auth/v1/factors/'+factor['id']+'/challenge',{},token=aal1),'MFA challenge')
    secret = factor['totp']['secret']
    secret += '=' * ((8-len(secret)%8)%8)
    digest = hmac.new(base64.b32decode(secret, casefold=True),struct.pack('>Q',int(time.time())//30),hashlib.sha1).digest()
    offset = digest[-1] & 15
    code = str((struct.unpack('>I',digest[offset:offset+4])[0] & 0x7fffffff)%1000000).zfill(6)
    verified = ok(request('POST','/auth/v1/factors/'+factor['id']+'/verify',{'challenge_id':challenge['id'],'code':code},token=aal1),'MFA verification')
    aal2 = verified['access_token']
    assert ok(request('POST','/rest/v1/rpc/is_current_admin_aal2',{},token=aal2),'AAL2 probe') is True
    print('PASS real GoTrue login, TOTP challenge and AAL2 authorization', flush=True)
    invalid = request('POST','/rest/v1/rpc/admin_create_manual_scoresheet_v2',{'p_payload':{}},token=aal2)
    assert not invalid.ok and invalid.json().get('code') in ('BD201','BD203'), 'AAL2 must reach domain validation without creating invalid data'
    print('PASS AAL2 reaches critical RPC domain validation; invalid payload rejected', flush=True)
finally:
    if user_id:
        with conn.cursor() as cur:
            cur.execute('delete from private.admin_accounts where user_id=%s', (user_id,))
        deleted = request('DELETE','/auth/v1/admin/users/'+user_id,admin=True)
        assert deleted.ok, 'Synthetic auth account cleanup failed'
        print('PASS synthetic administrator and Auth account removed', flush=True)
    conn.close()
