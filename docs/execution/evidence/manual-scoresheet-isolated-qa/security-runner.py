import sys

if sys.flags.optimize:
    raise RuntimeError('Python optimization is forbidden for isolated QA runners')

import hashlib,json,os,pathlib,urllib.parse,psycopg
TARGET='payumtvegfqfejmowxiy'
cli=pathlib.Path(os.environ['TEMP'])/'bdb-pr72-isolated-cli/supabase/.temp'
assert (cli/'project-ref').read_text().strip()==TARGET
url=(cli/'pooler-url').read_text().strip()
assert urllib.parse.urlparse(url).username=='postgres.'+TARGET
kwargs={'password':os.environ['BDB_QA_PASSWORD'],'sslmode':'verify-full','sslrootcert':str(pathlib.Path(os.environ['TEMP'])/'bdb-pr72-supabase-ca.crt'),'autocommit':True,'connect_timeout':10}
queries={
 'relations':"""select n.nspname,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.reloptions, array[has_table_privilege('anon',c.oid,'SELECT'),has_table_privilege('anon',c.oid,'INSERT'),has_table_privilege('anon',c.oid,'UPDATE'),has_table_privilege('anon',c.oid,'DELETE'),has_table_privilege('authenticated',c.oid,'SELECT'),has_table_privilege('authenticated',c.oid,'INSERT'),has_table_privilege('authenticated',c.oid,'UPDATE'),has_table_privilege('authenticated',c.oid,'DELETE'),has_table_privilege('service_role',c.oid,'SELECT')] from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private') and c.relkind in('r','p','v','m') order by 1,2""",
 'functions':"""select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE'),has_function_privilege('authenticated',p.oid,'EXECUTE') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private') order by 1,2,3""",
 'policies':"""select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname in('public','private') order by 1,2,3"""
}
def snapshot(database):
 with psycopg.connect(url,dbname=database,**kwargs) as conn:
  assert conn.execute('select current_database()').fetchone()[0]==database
  conn.execute("set search_path=''")
  return {name:conn.execute(query).fetchall() for name,query in queries.items()}
source=snapshot('postgres')
restored=snapshot('qa_pr72_recovery')
assert source==restored,'Application security metadata differs after restoration'
result={'target':TARGET,'result':'PASS','scope':'public/private current RLS, policies, effective grants and privileged functions; excludes managed role default ACLs','counts':{key:len(value) for key,value in source.items()},'sha256':hashlib.sha256(json.dumps(source,default=str,sort_keys=True).encode()).hexdigest()}
pathlib.Path(os.environ['TEMP'],'bdb-pr72-isolated-security-results.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
print(json.dumps(result))
