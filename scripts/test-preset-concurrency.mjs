// Integration test exclusively against the disposable Supabase Docker database in CI.
// No remote database URL, credential, or host argument is accepted.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

if (process.env.CI !== "true") throw new Error("Run only in the disposable CI database.");
const container = "supabase_db_base-do-basquete";
const runId = randomUUID();
const application = `mvp03-race-${runId}`;
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

const fixture = JSON.parse(
  await run(`begin;
insert into auth.users(id) values('11111111-1111-4111-8111-111111111111') on conflict do nothing;
insert into private.admin_accounts(user_id) select '11111111-1111-4111-8111-111111111111'
where not exists(select 1 from private.admin_accounts);
with s as (insert into public.competition_series(name,slug) values('Concurrency fixture','race-${runId}') returning id),
c as (insert into public.categories(name,slug) values('Concurrency fixture','race-${runId}') returning id)
select jsonb_build_object('series',s.id,'category',c.id) from s,c;
commit;`),
);
const requestId = randomUUID();
const payload = JSON.stringify({
  seriesId: fixture.series,
  categoryId: fixture.category,
  year: 2026,
  name: "Concurrent private edition",
  gender: "male",
  source: "manual_scoresheet",
  preset: "single_elimination",
  entryCount: 4,
  startsOn: null,
  endsOn: null,
  expectedProfileId: null,
  reason: null,
  reviewed: true,
});
const create = `set local role authenticated; select public.admin_create_competition_from_preset('${requestId}',$input$${payload}$input$::jsonb)`;
const created = await race(`select pg_advisory_xact_lock(hashtextextended('${requestId}',310))`, [
  create,
  create,
]);
assert.match(created[0], /^\d+$/);
assert.equal(created[0], created[1], "simultaneous first writes return the same committed edition");
const counts = JSON.parse(
  await run(`select jsonb_build_object(
'editions',(select count(*) from public.competitions where series_id=${fixture.series}),
'audits',(select count(*) from public.admin_mutation_audit where action='competition_created_from_preset' and entity_id=${created[0]}),
'revisions',(select count(*) from public.competition_ruleset_revisions where competition_id=${created[0]}))`),
);
assert.deepEqual(counts, { editions: 1, audits: 1, revisions: 1 });
console.log("PASS: concurrent first-write idempotency, exactly one edition/revision/audit");

const draft = JSON.parse(
  await run(`begin; ${authContext}
create temporary table race_context(value jsonb);
do $$declare c bigint; rev bigint; st bigint; rnd bigint; e bigint; sl bigint; slots bigint[] := '{}'; i integer;
begin
  insert into public.competitions(series_id,category_id,year,display_name)
  values(${fixture.series},${fixture.category},2000,'Concurrent semifinal fixture') returning id into c;
  insert into public.competition_ruleset_revisions(competition_id,revision_number,structure_kind,preset_key,preset_version,entry_count,created_by)
  values(c,1,'regulated','single_elimination',1,6,auth.uid()) returning id into rev;
  insert into public.competition_stages(competition_id,ruleset_revision_id,code,name,stage_order,structure_kind)
  values(c,rev,'test','Teste',1,'regulated') returning id into st;
  insert into public.competition_rounds(competition_id,stage_id,ruleset_revision_id,code,name,round_order,structure_kind,round_role,capacity,max_matchups)
  values(c,st,rev,'semifinal','Semifinal',1,'regulated','semifinal',4,2) returning id into rnd;
  for i in 1..6 loop
    insert into public.competition_entries(competition_id,ruleset_revision_id,seed) values(c,rev,i) returning id into e;
    insert into public.competition_slots(competition_id,ruleset_revision_id,round_id,origin_kind,entry_id)
    values(c,rev,rnd,'entry',e) returning id into sl;
    slots:=array_append(slots,sl);
  end loop;
  insert into public.matchups(competition_id,round_id,ruleset_revision_id,code,home_slot_id,away_slot_id,matchup_order,structure_kind,match_format,max_games)
  values(c,rnd,rev,'initial',slots[1],slots[2],1,'regulated','single_game',1);
  insert into race_context values(jsonb_build_object('competition',c,'revision',rev,'round',rnd,'slots',slots));
end$$;
select value from race_context; commit;`),
);
function contender(order) {
  return `create function pg_temp.contender() returns text language plpgsql as $$begin
    insert into public.matchups(competition_id,round_id,ruleset_revision_id,code,home_slot_id,away_slot_id,matchup_order,structure_kind,match_format,max_games)
    values(${draft.competition},${draft.round},${draft.revision},'candidate_${order}',${draft.slots[2 * order - 2]},${draft.slots[2 * order - 1]},${order},'regulated','single_game',1);
    return 'accepted';
    exception when sqlstate 'BR006' then return 'capacity-rejected';
  end$$; select pg_temp.contender()`;
}
// Owner-role writes intentionally exercise the trigger beyond the normal denial of direct writes.
const outcomes = await race(
  `select id from public.competition_ruleset_revisions where id=${draft.revision} for update`,
  [contender(2), contender(3)],
);
assert.deepEqual(outcomes.sort(), ["accepted", "capacity-rejected"]);
assert.equal(
  Number(await run(`select count(*) from public.matchups where round_id=${draft.round}`)),
  2,
);
console.log("PASS: competing semifinal writes serialize; third matchup rejected");
