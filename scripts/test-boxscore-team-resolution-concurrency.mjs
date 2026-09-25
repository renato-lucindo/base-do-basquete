// Integration test exclusively against the disposable Supabase Docker database in CI.
// No remote database URL, credential, or host argument is accepted.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

if (process.env.CI !== "true") throw new Error("Run only in the disposable CI database.");

const container = "supabase_db_base-do-basquete";
const runId = randomUUID();
const runSlug = runId.replaceAll("-", "");
const application = `boxscore-team-race-${runId}`;
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

async function race(importId, payloads) {
  const barrier = connection(
    `begin; select id from public.boxscore_imports where id=${importId} for update; select 'barrier-ready';\n`,
    true,
  );
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

    for (const payload of payloads) {
      clients.push(
        connection(`set application_name='${application}'; begin; ${authContext}
create function pg_temp.try_resolve(p_payload jsonb) returns text
language plpgsql as $$
declare response jsonb;
begin
  response := public.admin_resolve_boxscore_team_registrations(${importId}, p_payload);
  if coalesce((response ->> 'idempotent')::boolean, false) then
    return 'idempotent';
  end if;
  return 'accepted';
exception when sqlstate 'BD318' then
  return 'conflict';
end;
$$;
set local role authenticated;
select pg_temp.try_resolve($input$${payload}$input$::jsonb);
commit;`),
      );
    }

    let waiting = 0;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      waiting = Number(
        await run(
          `select count(*) from pg_stat_activity where application_name='${application}' and wait_event_type='Lock';`,
        ),
      );
      if (waiting === payloads.length) break;
      await delay(100);
    }
    assert.equal(
      waiting,
      payloads.length,
      "both independent resolution calls must be waiting on the same import lock",
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

await run(`begin;
insert into auth.users(id) values('11111111-1111-4111-8111-111111111111') on conflict do nothing;
insert into private.admin_accounts(user_id) select '11111111-1111-4111-8111-111111111111'
where not exists(select 1 from private.admin_accounts);
commit;`);

const context = JSON.parse(
  await run(`begin;
with series as (
  insert into public.competition_series(name,slug)
  values('Boxscore concurrency ${runId}','boxscore-race-${runSlug}') returning id
), category as (
  insert into public.categories(name,slug)
  values('Boxscore concurrency ${runId}','boxscore-race-${runSlug}') returning id
)
select jsonb_build_object('seriesId',series.id,'categoryId',category.id) from series,category;
commit;`),
);

const competitionPayload = JSON.stringify({
  seriesId: context.seriesId,
  categoryId: context.categoryId,
  year: 2026,
  name: `Boxscore concurrency ${runId}`,
  gender: "male",
  source: "fiba_boxscore",
  preset: "single_elimination",
  entryCount: 2,
  startsOn: null,
  endsOn: null,
  expectedProfileId: null,
  reason: null,
  reviewed: true,
});
const competitionId = Number(
  await run(`begin; ${authContext}
set local role authenticated;
select public.admin_create_competition_from_preset(
  '${randomUUID()}',
  $input$${competitionPayload}$input$::jsonb
);
commit;`),
);
assert.ok(Number.isInteger(competitionId) && competitionId > 0);

const teamA = `Equipe Corrida A ${runId}`;
const teamB = `Equipe Corrida B ${runId}`;
const sha256 = runSlug.repeat(2);
const fixture = JSON.parse(
  await run(`begin;
with team_a as (
  insert into public.teams(name,slug,abbreviation,is_active,is_public)
  values('${teamA}','boxscore-a-${runSlug}','RCA',true,false) returning id
), team_b as (
  insert into public.teams(name,slug,abbreviation,is_active,is_public)
  values('${teamB}','boxscore-b-${runSlug}','RCB',true,false) returning id
), registration_a as (
  insert into public.team_registrations(competition_id,team_id,status,confirmed_at)
  select ${competitionId},id,'confirmed',now() from team_a returning id,team_id
), registration_b as (
  insert into public.team_registrations(competition_id,team_id,status,confirmed_at)
  select ${competitionId},id,'confirmed',now() from team_b returning id,team_id
), imported as (
  insert into public.boxscore_imports(
    competition_id,sha256,storage_path,source_filename,file_size_bytes,
    parser_version,status,parsed_payload,validation_payload,created_by
  ) values (
    ${competitionId},'${sha256}','race/${sha256}.pdf','race.pdf',100,
    'fiba-genius-v2','review',
    jsonb_build_object('teams',jsonb_build_array(
      jsonb_build_object('name','${teamA}','abbreviation','RCA'),
      jsonb_build_object('name','${teamB}','abbreviation','RCB')
    )),
    '{"valid":true}'::jsonb,
    (select user_id from private.admin_accounts limit 1)
  ) returning id
)
select jsonb_build_object(
  'importId',imported.id,
  'registrationA',registration_a.id,
  'registrationB',registration_b.id,
  'teamBId',registration_b.team_id
)
from imported,registration_a,registration_b;
commit;`),
);

const firstPayload = JSON.stringify({
  teams: [
    {
      sourceTeamName: teamA,
      action: "existing_registration",
      registrationId: fixture.registrationA,
    },
    {
      sourceTeamName: teamB,
      action: "existing_registration",
      registrationId: fixture.registrationB,
    },
  ],
});
const divergentPayload = JSON.stringify({
  teams: [
    {
      sourceTeamName: teamA,
      action: "existing_registration",
      registrationId: fixture.registrationA,
    },
    { sourceTeamName: teamB, action: "register_existing_team", teamId: fixture.teamBId },
  ],
});

const outcomes = await race(fixture.importId, [firstPayload, divergentPayload]);
assert.deepEqual(outcomes.sort(), ["accepted", "conflict"]);

const counts = JSON.parse(
  await run(`select jsonb_build_object(
    'resolutions',(select count(*) from public.boxscore_team_resolutions where import_id=${fixture.importId}),
    'audits',(select count(*) from public.admin_mutation_audit where action='boxscore_team_registrations_resolved' and entity_id=${fixture.importId}),
    'registrations',(select count(*) from public.team_registrations where competition_id=${competitionId} and id in(${fixture.registrationA},${fixture.registrationB}))
  )`),
);
assert.deepEqual(counts, { resolutions: 1, audits: 1, registrations: 2 });

console.log(
  "PASS: concurrent divergent team resolutions serialize to one authoritative decision and one conflict",
);
