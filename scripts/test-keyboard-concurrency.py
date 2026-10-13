"""Race the actual RPCs on a disposable native database prepared by the replay runner."""
import concurrent.futures
import json
import os
from pathlib import Path
import re
import subprocess
import threading
import uuid

database=os.environ["PGDATABASE"]
if not database.startswith("keyboard_mvp_"): raise RuntimeError("Only disposable keyboard_mvp_* databases are allowed")
binary=str(Path(os.environ["PG_BIN"])/("psql.exe" if os.name=="nt" else "psql"))
base=[binary,"-X","-h","127.0.0.1","-p","55477","-U","postgres","-d",database,"-v","ON_ERROR_STOP=1","-A","-t"]
source=Path("supabase/tests/database/keyboard_scoresheet.test.sql").read_text(encoding="utf-8")
header=source[:source.index("create temp table keyboard_docs")].replace("select no_plan();","")
header=header.replace("\\ir ../helpers/final_profile_fixtures.inc", "\\ir '"+Path("supabase/tests/helpers/final_profile_fixtures.inc").resolve().as_posix()+"'")
fixture=Path("tmp/keyboard-concurrency-setup.sql")
fixture.write_text(header+"\ncommit;\n",encoding="utf-8")
subprocess.run(base+["-f",str(fixture)],check=True,capture_output=True,text=True)
document=json.loads(re.search(r"insert into keyboard_docs values\('base','(.+?)'::jsonb\);",source).group(1))
literal="'"+json.dumps(document).replace("'","''")+"'::jsonb"
jwt=json.dumps({"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"})


def race(statements):
    barrier=threading.Barrier(2)
    def run(statement):
        barrier.wait()
        sql="begin; select set_config('request.jwt.claims','"+jwt+"',true);set local role authenticated;"+statement+";commit;"
        return subprocess.run(base+["-c",sql],capture_output=True,text=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        return list(pool.map(run,statements))


def save(game,key,version):
    return f"select public.admin_save_keyboard_scoresheet({game},'{key}',{version},{literal})"


results=race([save(93001,uuid.uuid4(),0),save(93001,uuid.uuid4(),0)])
assert sum(r.returncode==0 for r in results)==1 and any("KEYBOARD_VERSION_CONFLICT" in r.stderr for r in results),[r.stderr for r in results]
print("PASS: concurrent CAS has exactly one winner")
key=uuid.uuid4()
results=race([save(93001,key,1),save(93001,key,1)])
assert all(r.returncode==0 for r in results),[r.stderr for r in results]
print("PASS: simultaneous identical retries reuse the same receipt")
teams=[]
for side in ["home","away"]:
    slots=[s for s in document["roster"] if s["side"]==side]
    teams.append({"side":side,"registrationId":slots[0]["registrationId"],"slots":[{"slotNumber":i+1,"rosterEntryId":s["rosterEntryId"],"jerseyNumber":s["jersey"]} for i,s in enumerate(slots)]})
periods=[]
for period in range(1,5):
    stats=[]
    for slot in document["roster"]:
        events=[e for e in document["events"] if e["side"]==slot["side"] and e["target"]==slot["jersey"] and e["period"]==period]
        stats.append({"rosterEntryId":slot["rosterEntryId"],"twoPointMade":sum(e["code"]=="2" for e in events),"threePointMade":sum(e["code"]=="3" for e in events),"freeThrowMade":sum(e["code"]=="1" for e in events),"fouls":[e["code"][0] for e in events if not e["code"].isdigit()]})
    periods.append({"periodNumber":period,"stats":stats})
payload={"idempotencyKey":str(uuid.uuid4()),"gameId":93002,"competitionId":9301,"teams":teams,"periods":periods}
legacy="select public.admin_create_manual_scoresheet('"+json.dumps(payload).replace("'","''")+"'::jsonb)"
results=race([save(93002,uuid.uuid4(),0),legacy])
assert sum(r.returncode==0 for r in results)==1 and any("KEYBOARD_OTHER_SOURCE_ACTIVE" in r.stderr for r in results),[r.stderr for r in results]
print("PASS: legacy/new writers cannot consume the same game")
