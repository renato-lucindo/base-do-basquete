import json, os, pathlib, re, sys, urllib.parse
import psycopg

TARGET = 'payumtvegfqfejmowxiy'
root = pathlib.Path(os.environ['BDB_QA_WORKTREE']).resolve()
cli_temp = pathlib.Path(os.environ['TEMP']) / 'bdb-pr72-isolated-cli' / 'supabase' / '.temp'
assert (cli_temp / 'project-ref').read_text().strip() == TARGET
url = (cli_temp / 'pooler-url').read_text().strip()
assert urllib.parse.urlparse(url).username == 'postgres.' + TARGET
ca = pathlib.Path(os.environ['TEMP']) / 'bdb-pr72-supabase-ca.crt'
database = os.environ.get('BDB_QA_DATABASE', 'postgres')
assert database in ('postgres', 'qa_pr72_recovery'), 'Unexpected database target'

def expand(file):
    file = file.resolve()
    assert file.is_relative_to(root / 'supabase' / 'tests'), 'Unexpected fixture include'
    text = file.read_text(encoding='utf-8')
    def include(match):
        return expand(file.parent / match.group(1).strip())
    text = re.sub(r'^\\ir\s+([^\r\n]+)$', include, text, flags=re.M)
    assert not re.search(r'^\\', text, re.M), 'Unsupported psql metacommand'
    return text

results = []
for file in sorted((root / 'supabase' / 'tests' / 'database').glob('*.test.sql')):
    output = []
    try:
        with psycopg.connect(url, dbname=database, password=os.environ['BDB_QA_PASSWORD'], sslmode='verify-full', sslrootcert=str(ca), connect_timeout=10, autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute('select current_database()')
                assert cur.fetchone()[0] == database
                cur.execute('set search_path = public, extensions')
                cur.execute("set statement_timeout = '60s'")
                cur.execute(expand(file), prepare=False)
                while True:
                    if cur.description:
                        for row in cur.fetchall():
                            if len(row) == 1 and isinstance(row[0], str):
                                output.extend(row[0].splitlines())
                    if not cur.nextset():
                        break
                cur.execute('rollback')
        plans = [int(match.group(1)) for line in output if (match := re.match(r'^1\.\.(\d+)', line))]
        assertions = [line for line in output if re.match(r'^(?:not )?ok\s+\d+', line)]
        failures = [line for line in assertions if line.startswith('not ok')]
        assert len(plans) == 1, 'Missing or duplicate TAP plan'
        assert len(assertions) == plans[0], f'Incomplete TAP: expected {plans[0]}, received {len(assertions)}'
        assert [int(re.search(r'ok\s+(\d+)', line).group(1)) for line in assertions] == list(range(1, plans[0] + 1)), 'Nonsequential TAP'
        assert not failures, '\n'.join(failures)
        results.append({'file': file.name, 'result': 'PASS', 'assertions': len(assertions)})
        print(f'PASS {file.name}: {len(assertions)} assertions', flush=True)
    except Exception as error:
        results.append({'file': file.name, 'result': 'FAIL', 'error': str(error)})
        print(f'FAIL {file.name}: {error}', flush=True)
        for line in output:
            if line.startswith(('not ok', '#')):
                print(line, flush=True)
summary = {'target': TARGET, 'database': database, 'files': len(results), 'passed': sum(item['result'] == 'PASS' for item in results), 'assertions': sum(item.get('assertions', 0) for item in results), 'tls': 'verify-full', 'results': results}
print(json.dumps(summary), flush=True)
filename = 'bdb-pr72-isolated-pgtap-restored-results.json' if database != 'postgres' else 'bdb-pr72-isolated-pgtap-results.json'
pathlib.Path(os.environ['TEMP'], filename).write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8')
sys.exit(0 if results and summary['passed'] == summary['files'] else 1)
