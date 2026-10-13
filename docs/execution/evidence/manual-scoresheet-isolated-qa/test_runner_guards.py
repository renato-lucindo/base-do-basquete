"""Offline regressions: never loads real credentials or connects to a service."""
import ast
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent
RUNNERS = tuple(ROOT / (name + '-runner.py') for name in
                ('pgtap', 'auth', 'recovery', 'security'))
GUARD = 'Python optimization is forbidden for isolated QA runners'


class RunnerGuards(unittest.TestCase):
    def test_optimized_execution_stops_before_imports_and_credentials(self):
        for runner in RUNNERS:
            for flags, optimize in ((['-O'], ''), (['-OO'], ''), ([], '1'), ([], '2')):
                with self.subTest(runner=runner.name, flags=flags, optimize=optimize):
                    env = os.environ.copy()
                    for key in tuple(env):
                        if key.startswith('BDB_QA_'):
                            del env[key]
                    env['PYTHONOPTIMIZE'] = optimize
                    result = subprocess.run(
                        [sys.executable, *flags, '-S', str(runner)],
                        env=env, capture_output=True, text=True, timeout=10)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn(GUARD, result.stderr)
                    self.assertNotIn('ModuleNotFoundError', result.stderr)
                    self.assertNotIn('KeyError', result.stderr)

    def test_normal_mode_rejects_wrong_project_before_network(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            cli = base / 'bdb-pr72-isolated-cli/supabase/.temp'
            cli.mkdir(parents=True)
            (cli / 'project-ref').write_text('wrong-project', encoding='utf8')
            keys = base / 'BaseDoBasquete/qa-pr72'
            keys.mkdir(parents=True)
            (keys / 'api-keys.json').write_text(
                '[{"name":"service_role","type":"legacy","api_key":"dummy"},'
                '{"type":"publishable","api_key":"dummy"}]', encoding='utf8')
            env = os.environ.copy()
            env.update(TEMP=directory, LOCALAPPDATA=directory,
                       BDB_QA_WORKTREE=directory, PYTHONOPTIMIZE='')
            env.pop('BDB_QA_PASSWORD', None)
            bootstrap = """
import runpy, sys, types
def forbidden(*args, **kwargs):
    raise RuntimeError('NETWORK_FORBIDDEN')
driver = types.ModuleType('psycopg')
driver.connect = forbidden
driver.sql = types.SimpleNamespace()
http = types.ModuleType('requests')
http.request = forbidden
sys.modules.update(psycopg=driver, requests=http)
runpy.run_path(sys.argv[1], run_name='__main__')
"""
            for runner in RUNNERS:
                with self.subTest(runner=runner.name):
                    result = subprocess.run(
                        [sys.executable, '-S', '-c', bootstrap, str(runner)],
                        env=env, capture_output=True, text=True, timeout=10)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn('AssertionError', result.stderr)
                    self.assertNotIn('NETWORK_FORBIDDEN', result.stderr)
                    self.assertNotIn('KeyError', result.stderr)

    def test_actual_tap_validation(self):
        tree = ast.parse(RUNNERS[0].read_text(encoding='utf8'))
        block = next(node for node in ast.walk(tree) if isinstance(node, ast.Try))
        start = next(i for i, node in enumerate(block.body)
                     if isinstance(node, ast.Assign) and
                     isinstance(node.targets[0], ast.Name) and
                     node.targets[0].id == 'plans')
        end = next(i for i in range(start, len(block.body))
                   if isinstance(block.body[i], ast.Expr))
        validation = ast.Module(body=block.body[start:end], type_ignores=[])
        code = compile(validation, str(RUNNERS[0]), 'exec', optimize=0)
        import re
        exec(code, {'output': ['1..2', 'ok 1', 'ok 2'], 're': re})
        for output in (['1..2', 'ok 1'], ['1..1', 'not ok 1'],
                       ['ok 1'], ['1..1', '1..1', 'ok 1'],
                       ['1..2', 'ok 2', 'ok 1']):
            with self.subTest(output=output), self.assertRaises(AssertionError):
                exec(code, {'output': output, 're': re})


if __name__ == '__main__':
    if sys.flags.optimize:
        raise RuntimeError('Run the regression suite without Python optimization')
    unittest.main(verbosity=2)
