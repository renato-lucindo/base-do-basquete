// Integration test exclusively against the disposable Supabase Docker database in CI.
// No remote database URL, credential, or host argument is accepted.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

if (process.env.CI !== "true") throw new Error("Run only in the disposable CI database.");
const container = "supabase_db_base-do-basquete";
const runId = randomUUID();
const application = `manual-v2-race-${runId}`;
const authContext = `do $$begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',
    (select user_id from private.admin_accounts limit 1),'role','authenticated','aal','aal2')::text,true);
end$$;`;

function connection(sql, keepOpen = false) {
  const child = spawn(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-X",
      "-qAt",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  let output = "";
  let errors = "";
  let markReady;
  const ready = new Promise((resolve) => {
    markReady = resolve;
  });
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
    if (output.includes("barrier-ready")) markReady();
  });
  child.stderr.on("data", (chunk) => {
    errors += chunk.toString();
  });
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(output.trim()) : reject(new Error(`Local psql failed: ${errors}`)),
    );
  });
  // Attach a rejection handler immediately, including while a lock barrier is being prepared.
  done.catch(() => {});
  child.stdin.on("error", () => {});
  if (keepOpen) child.stdin.write(sql);
  else child.stdin.end(sql);
  return { child, done, ready };
}
async function run(sql) {
  const session = connection(sql);
  const timer = setTimeout(() => session.child.kill(), 20000);
  try {
    return await session.done;
  } finally {
    clearTimeout(timer);
  }
}
async function race(lock, statements) {
  const barrier = connection(`begin; ${lock}; select 'barrier-ready';\n`, true);
  const clients = [];
  const watchdog = setTimeout(() => {
    barrier.child.kill();
    for (const client of clients) client.child.kill();
  }, 30000);
  try {
    await Promise.race([
      barrier.ready,
      barrier.done.then(() => {
        throw new Error("Barrier closed early");
      }),
    ]);
    for (const statement of statements) {
      clients.push(
        connection(
          `set application_name='${application}'; begin; ${authContext} ${statement}; commit;`,
        ),
      );
    }
    let waiting = 0;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      waiting = Number(
        await run(
          `select count(*) from pg_stat_activity where application_name='${application}' and wait_event_type='Lock';`,
        ),
      );
      if (waiting === 2) break;
      await delay(100);
    }
    assert.equal(
      waiting,
      2,
      "both independent connections must be blocked before releasing the barrier",
    );
    barrier.child.stdin.end("commit;\n");
    await barrier.done;
    return await Promise.all(clients.map((client) => client.done));
  } finally {
    clearTimeout(watchdog);
    if (!barrier.child.stdin.destroyed) barrier.child.stdin.end("rollback;\n");
    for (const client of clients) if (client.child.exitCode === null) client.child.kill();
  }
}

// Reuse the canonical pgTAP fixture without its assertions or rollback.
const fixtureSql = await readFile(
  new URL("../supabase/tests/database/manual_scoresheet_v2_revisions.test.sql", import.meta.url),
  "utf8",
);
const builders = await readFile(
  new URL("../supabase/tests/helpers/final_profile_fixtures.inc", import.meta.url),
  "utf8",
);
const setup = fixtureSql
  .slice(
    fixtureSql.indexOf("insert into public.competition_series"),
    fixtureSql.indexOf("create function pg_temp.v2_revision("),
  )
  .replace(/\b983([1-4])\b/g, "1983$1")
  // Keep stdout reserved for the JSON result consumed by this harness.
  .replace(
    /select pg_temp\.create_final_competition\(([\s\S]*?)\);/,
    "do $$begin perform pg_temp.create_final_competition($1); end$$;",
  );
const fixture = JSON.parse(
  await run(`begin; set constraints all deferred;
do $$begin perform set_config('bdb.allow_internal_ingestion_game','on',true); end$$;
${builders}
${setup}
${authContext}
set local role authenticated;
insert into manual_v2_result select public.admin_create_manual_scoresheet_v2(
  (select payload from manual_v2_payloads where name='base'));
reset role;
select jsonb_build_object('gameId', s.game_id, 'baseSubmissionId', s.id,
  'basePayloadHash', s.payload_hash, 'payload', p.payload)
from public.game_data_submissions s
join public.manual_scoresheet_submission_payloads p on p.submission_id=s.id
where s.game_id=(select game_id from manual_v2_result) and s.status='active';
commit;`),
);

function revision(base, key, notes) {
  return {
    ...base.payload,
    game: { ...base.payload.game, notes },
    gameId: base.gameId,
    baseSubmissionId: base.baseSubmissionId,
    basePayloadHash: base.basePayloadHash,
    revisionKey: key,
    revisionReason: "CorreÃ§Ã£o concorrente conferida apÃ³s o jogo",
  };
}
function call(payload) {
  return `create function pg_temp.try_revise() returns text language plpgsql as $$
  begin return public.admin_revise_manual_scoresheet_v2($input$${JSON.stringify(payload)}$input$::jsonb)::text;
  exception when sqlstate 'BD221' then return 'conflict'; end; $$;
  set local role authenticated; select pg_temp.try_revise()`;
}
const lock = `select pg_advisory_xact_lock(hashtextextended('manual-v2-game:${fixture.gameId}',2001))`;
const same = revision(fixture, randomUUID(), "RevisÃ£o idÃªntica em duas conexÃµes");
const retries = await race(lock, [call(same), call(same)]);
assert.deepEqual(retries, [String(fixture.gameId), String(fixture.gameId)]);

async function state() {
  return JSON.parse(
    await run(`select jsonb_build_object(
    'gameId',s.game_id,'baseSubmissionId',s.id,'basePayloadHash',s.payload_hash,'payload',p.payload,
    'submissions',(select count(*) from public.game_data_submissions where game_id=s.game_id),
    'audits',(select count(*) from public.manual_scoresheet_revisions where game_id=s.game_id),
    'authorities',(select count(*) from public.game_data_domain_authority where game_id=s.game_id and submission_id=s.id),
    'liveNotes',(select notes from public.manual_scoresheet_game_details where game_id=s.game_id))
  from public.game_data_submissions s join public.manual_scoresheet_submission_payloads p on p.submission_id=s.id
  where s.game_id=${fixture.gameId} and s.status='active' and s.source_type='manual_scoresheet';`),
  );
}
const afterRetry = await state();
assert.equal(afterRetry.submissions, 2);
assert.equal(afterRetry.audits, 1);
assert.equal(afterRetry.authorities, 6);
assert.equal(afterRetry.liveNotes, same.game.notes);
console.log(
  "PASS: concurrent identical revision retries create one version and one audit with six authorities",
);

const first = revision(afterRetry, randomUUID(), "Primeira correÃ§Ã£o concorrente");
const second = revision(afterRetry, randomUUID(), "Segunda correÃ§Ã£o concorrente");
const outcomes = await race(lock, [call(first), call(second)]);
assert.deepEqual([...outcomes].sort(), [String(fixture.gameId), "conflict"].sort());
const winner = outcomes[0] === "conflict" ? second : first;
const afterConflict = await state();
assert.equal(afterConflict.submissions, 3);
assert.equal(afterConflict.audits, 2);
assert.equal(afterConflict.authorities, 6);
assert.equal(afterConflict.liveNotes, winner.game.notes);
assert.equal(afterConflict.payload.game.notes, winner.game.notes);
console.log(
  "PASS: concurrent divergent revisions yield one winner and one CAS conflict without overwriting history",
);
