"""Replay migrations and pgTAP on a disposable loopback PostgreSQL database.

Requires an already running PostgreSQL instance, PG_BIN, and a real pgTAP extension.
Auth/Storage compatibility stand-ins do not replace the CI Supabase integration gate.
Only creates uniquely named keyboard_mvp_* databases; never touches a remote database.
"""
import argparse
import os
from pathlib import Path
import re
import subprocess
import time

parser = argparse.ArgumentParser()
parser.add_argument("--port", default="55477")
parser.add_argument("--all", action="store_true")
args = parser.parse_args()
psql = str(Path(os.environ["PG_BIN"]) / ("psql.exe" if os.name == "nt" else "psql"))
database = "keyboard_mvp_" + str(int(time.time()))
base = [psql, "-X", "-h", "127.0.0.1", "-p", args.port, "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-A", "-t"]
outdir = Path("tmp/keyboard-native-results")
outdir.mkdir(parents=True, exist_ok=True)


def run(arguments, name):
    result = subprocess.run(base + arguments, capture_output=True, text=True, encoding="utf-8", errors="replace")
    (outdir / (name + ".log")).write_text(result.stdout + "\n" + result.stderr, encoding="utf-8")
    if result.returncode:
        raise RuntimeError(name + " failed:\n" + result.stderr[-2500:])
    return result.stdout


for role, options in [("anon", ""), ("authenticated", ""), ("service_role", "bypassrls"), ("supabase_admin", "superuser")]:
    run(["-d", "postgres", "-c", f"do $$ begin if not exists(select 1 from pg_roles where rolname='{role}') then create role {role} {options}; end if; end $$;"], "role-" + role)
run(["-d", "postgres", "-c", f"create database {database} template template0 locale_provider icu icu_locale 'und';"], "create")
print("Disposable loopback database:", database, flush=True)
db = ["-d", database]
run(db + ["-f", "scripts/fixtures/keyboard-native-bootstrap.sql"], "bootstrap")
run(db + ["-c", f"alter database {database} set search_path=public,extensions;"], "search-path")
for migration in sorted(Path("supabase/migrations").glob("*.sql")):
    run(db + ["-f", str(migration)], migration.stem)
print("All migrations applied from zero.", flush=True)
run(db + ["-1", "-f", "supabase/seed.sql"], "seed")
tests = sorted(Path("supabase/tests/database").glob("*.sql")) if args.all else [Path("supabase/tests/database/keyboard_scoresheet.test.sql")]
failures = []
assertions = 0
for test in tests:
    try:
        output = run(db + ["-f", str(test)], test.stem)
        assertions += len(re.findall(r"^ok \d+", output, re.MULTILINE))
        failed = re.findall(r"^not ok .+", output, re.MULTILINE)
        if failed:
            failures.append((test.name, failed))
        print(test.name + ": " + ("FAIL" if failed else "PASS"), flush=True)
    except RuntimeError as error:
        failures.append((test.name, str(error)))
        print(test.name + ": ERROR", flush=True)
print("Assertions passed:", assertions, "; files:", len(tests), "; failures:", len(failures))
for failure in failures:
    print(failure)
raise SystemExit(bool(failures))
