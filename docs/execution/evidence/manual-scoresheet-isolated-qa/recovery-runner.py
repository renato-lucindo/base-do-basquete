import hashlib, json, os, pathlib, subprocess, urllib.parse
import psycopg
from psycopg import sql
TARGET='payumtvegfqfejmowxiy'
RESTORE='qa_pr72_recovery'
cli=pathlib.Path(os.environ['TEMP'])/'bdb-pr72-isolated-cli/supabase/.temp'
assert (cli/'project-ref').read_text().strip()==TARGET
url=(cli/'pooler-url').read_text().strip()
p=urllib.parse.urlparse(url)
assert p.username=='postgres.'+TARGET
ca=pathlib.Path(os.environ['TEMP'])/'bdb-pr72-supabase-ca.crt'
kwargs={'password':os.environ['BDB_QA_PASSWORD'],'sslmode':'verify-full','sslrootcert':str(ca),'autocommit':True,'connect_timeout':10}
tools=pathlib.Path(os.environ['TEMP'])/'bdb-pr72-postgres-tools/pgsql/bin'
backup=pathlib.Path(os.environ['LOCALAPPDATA'])/'BaseDoBasquete/qa-pr72/qa-app-auth-history.dump'
env={**os.environ,'PGHOST':p.hostname,'PGPORT':str(p.port or 5432),'PGUSER':p.username,'PGPASSWORD':os.environ['BDB_QA_PASSWORD'],'PGDATABASE':'postgres','PGSSLMODE':'verify-full','PGSSLROOTCERT':str(ca)}

def snapshot(conn):
    conn.execute("set timezone='UTC'")
    tables=conn.execute("select schemaname,tablename from pg_tables where schemaname in('public','private','auth','storage','supabase_migrations') order by 1,2").fetchall()
    rows=[]
    for schema,table in tables:
        query=sql.SQL("select count(*),coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]')::text from {} t").format(sql.Identifier(schema,table))
        count,data=conn.execute(query).fetchone()
        rows.append({'schema':schema,'table':table,'count':count,'sha256':hashlib.sha256(data.encode()).hexdigest()})
    return rows

with psycopg.connect(url,**kwargs) as source:
    assert source.execute('select current_database()').fetchone()[0]=='postgres'
    resume=os.environ.get('BDB_QA_RECOVERY_RESUME')=='1'
    exists=bool(source.execute('select 1 from pg_database where datname=%s',(RESTORE,)).fetchone())
    assert exists==resume, 'Recovery target state differs; refuse overwrite'
    before=snapshot(source)
    command=[str(tools/'pg_dump.exe'),'--format=custom','--no-owner','--file',str(backup)]
    for schema in ['public','private','auth','storage','extensions','supabase_migrations']:
        command+=['--schema',schema]
    subprocess.run(command,env=env,check=True)
    after=snapshot(source)
    assert before==after,'Source changed during backup'
    if not resume:
        source.execute(sql.SQL('create database {}').format(sql.Identifier(RESTORE)))
    print('PASS logical backup captured; source fingerprints unchanged',flush=True)
if not resume:
    with psycopg.connect(url,dbname=RESTORE,**kwargs) as empty:
        assert empty.execute('select current_database()').fetchone()[0]==RESTORE
        assert empty.execute("select count(*) from pg_tables where schemaname='public'").fetchone()[0]==0
        empty.execute('drop schema public')
toc=subprocess.check_output([str(tools/'pg_restore.exe'),'--list',str(backup)],env=env).decode('utf8')
omitted=[]
lines=[]
for line in toc.splitlines():
    managed='DEFAULT ACL' in line and line.rsplit(' ',1)[-1].startswith('supabase_')
    if managed:
        omitted.append(line)
    selected=not managed and (not resume or 'DEFAULT ACL' in line)
    lines.append(line if selected or line.startswith(';') else ';'+line)
toc_path=backup.with_suffix('.restore-list')
toc_path.write_text('\n'.join(lines)+'\n',encoding='utf8')
subprocess.run([str(tools/'pg_restore.exe'),'--dbname',RESTORE,'--no-owner','--use-list',str(toc_path),'--exit-on-error',str(backup)],env={**env,'PGDATABASE':RESTORE},check=True)
with psycopg.connect(url,dbname=RESTORE,**kwargs) as restored:
    assert restored.execute('select current_database()').fetchone()[0]==RESTORE
    recovered=snapshot(restored)
    assert recovered==before,'Restored table inventory, counts or contents differ'
    assert restored.execute("select count(*) from supabase_migrations.schema_migrations").fetchone()[0]==73
summary={'target':TARGET,'source_database':'postgres','restored_database':RESTORE,'schemas':['public','private','auth','storage','extensions','supabase_migrations'],'tables_verified':len(before),'rows_verified':sum(row['count'] for row in before),'backup_sha256':hashlib.sha256(backup.read_bytes()).hexdigest(),'backup_bytes':backup.stat().st_size,'result':'PASS','omitted_managed_default_acls':omitted,'data_fingerprints':before}
pathlib.Path(os.environ['TEMP'],'bdb-pr72-isolated-recovery-results.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf8')
print('PASS logical restoration: '+str(len(before))+' table inventories/counts/SHA256 fingerprints identical; 73 migration records',flush=True)
print(json.dumps({key:value for key,value in summary.items() if key!='data_fingerprints'}),flush=True)
