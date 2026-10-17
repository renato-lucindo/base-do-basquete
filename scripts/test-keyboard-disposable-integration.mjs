// End-to-end keyboard scoresheet integration against only the disposable Supabase CI stack.
// Never accepts a remote URL or credentials from an environment variable.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";

assert.equal(process.env.CI, "true", "This test requires an isolated CI environment");
const container = "supabase_db_base-do-basquete";
let statusText;
try {
  statusText = execFileSync(
    "npx",
    ["--no-install", "supabase", "status", "--output", "env", "--output-format", "text"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
} catch {
  throw new Error("Disposable Supabase status unavailable");
}
const status = {};
for (const line of statusText.split(/\r?\n/)) {
  const match = /^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=(".*")$/.exec(line.trim());
  if (match) status[match[1]] = JSON.parse(match[2]);
}
assert.ok(status.API_URL && status.ANON_KEY && status.SERVICE_ROLE_KEY);
const endpoint = new URL(status.API_URL);
assert.equal(endpoint.hostname, "127.0.0.1");
assert.equal(endpoint.port, "54321");

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
    {
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  let output = "";
  let errors = "";
  let readyResolve;
  const ready = new Promise((resolve) => {
    readyResolve = resolve;
  });
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
    if (output.includes("barrier-ready")) readyResolve();
  });
  child.stderr.on("data", (chunk) => {
    errors += chunk.toString();
  });
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve(output.trim())
        : reject(new Error(`Disposable psql failed: ${errors.slice(-1500)}`)),
    );
  });
  done.catch(() => {});
  child.stdin.on("error", () => {});
  if (keepOpen) child.stdin.write(sql);
  else child.stdin.end(sql);
  return { child, ready, done };
}

async function sql(input) {
  const session = connection(input);
  const watchdog = setTimeout(() => session.child.kill(), 25000);
  try {
    return await session.done;
  } finally {
    clearTimeout(watchdog);
  }
}

const source = readFileSync("supabase/tests/database/keyboard_scoresheet.test.sql", "utf8");
const helpers = readFileSync("supabase/tests/helpers/final_profile_fixtures.inc", "utf8");
const fixture = source
  .slice(0, source.indexOf("create temp table keyboard_docs"))
  .replace("\\ir ../helpers/final_profile_fixtures.inc", () => helpers)
  .replace("select no_plan();", "");
assert.ok(fixture.includes("insert into public.game_participants"), "fixture boundary changed");
await sql(`${fixture}\ncommit;`);
const documentMatch = /insert into keyboard_docs values\('base','(.+?)'::jsonb\);/.exec(source);
assert.ok(documentMatch, "original scoresheet fixture must remain readable");
const document = JSON.parse(documentMatch[1]);
const docLiteral = `'${JSON.stringify(document).replaceAll("'", "''")}'::jsonb`;
const authContext = `do $claims$begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',
    (select user_id from private.admin_accounts limit 1),'role','authenticated','aal','aal2')::text,true);
end$claims$;`;

async function race(gameId, statementA, statementB) {
  const label = `keyboard-ci-${randomUUID()}`;
  const barrier = connection(
    `begin; select id from public.games where id=${gameId} for update; select 'barrier-ready';\n`,
    true,
  );
  const clients = [];
  const watchdog = setTimeout(() => {
    barrier.child.kill();
    for (const client of clients) client.child.kill();
  }, 35000);
  try {
    await Promise.race([
      barrier.ready,
      barrier.done.then(() => {
        throw new Error("Barrier exited before acquiring the row lock");
      }),
    ]);
    for (const statement of [statementA, statementB]) {
      clients.push(
        connection(`set application_name='${label}'; begin; ${authContext}\n${statement}; commit;`),
      );
    }
    let waiting = 0;
    for (let i = 0; i < 50; i += 1) {
      waiting = Number(
        await sql(
          `select count(*) from pg_stat_activity where application_name='${label}' and wait_event_type='Lock'`,
        ),
      );
      if (waiting === 2) break;
      await delay(100);
    }
    assert.equal(waiting, 2, "both writers must wait for the same game row before release");
    barrier.child.stdin.end("commit;\n");
    await barrier.done;
    return await Promise.all(clients.map((client) => client.done));
  } finally {
    clearTimeout(watchdog);
    if (!barrier.child.stdin.destroyed) barrier.child.stdin.end("rollback;\n");
    for (const client of clients) if (client.child.exitCode === null) client.child.kill();
  }
}

function writer(gameId, requestId, baseVersion) {
  return `create function pg_temp.try_keyboard() returns text language plpgsql as $test$
  begin
    perform public.admin_save_keyboard_scoresheet(${gameId},'${requestId}',${baseVersion},${docLiteral});
    return 'accepted';
  exception when sqlstate 'BD905' then return 'version-conflict';
            when sqlstate 'BD906' then return 'other-source';
  end $test$; set local role authenticated; select pg_temp.try_keyboard()`;
}

const cas = await race(93003, writer(93003, randomUUID(), 0), writer(93003, randomUUID(), 0));
assert.deepEqual(cas.sort(), ["accepted", "version-conflict"]);
assert.equal(
  Number(
    await sql("select count(*) from public.keyboard_scoresheet_revisions where game_id=93003"),
  ),
  1,
);
console.log("PASS: independent CAS writers produce one accepted revision");

const retryId = randomUUID();
const retries = await race(93002, writer(93002, retryId, 0), writer(93002, retryId, 0));
assert.deepEqual(retries, ["accepted", "accepted"]);
assert.equal(
  Number(
    await sql("select count(*) from public.keyboard_scoresheet_revisions where game_id=93002"),
  ),
  1,
);
console.log("PASS: simultaneous identical retries produce one receipt");

const teams = ["home", "away"].map((side) => {
  const slots = document.roster.filter((entry) => entry.side === side);
  return {
    side,
    registrationId: slots[0].registrationId,
    slots: slots.map((entry, index) => ({
      slotNumber: index + 1,
      rosterEntryId: entry.rosterEntryId,
      jerseyNumber: entry.jersey,
    })),
  };
});
const periods = Array.from({ length: 4 }, (_, index) => ({
  periodNumber: index + 1,
  stats: document.roster.map((slot) => {
    const events = document.events.filter(
      (event) =>
        event.side === slot.side && event.target === slot.jersey && event.period === index + 1,
    );
    return {
      rosterEntryId: slot.rosterEntryId,
      twoPointMade: events.filter((event) => event.code === "2").length,
      threePointMade: events.filter((event) => event.code === "3").length,
      freeThrowMade: events.filter((event) => event.code === "1").length,
      fouls: events.filter((event) => !/^\d$/.test(event.code)).map((event) => event.code[0]),
    };
  }),
}));
const legacyInput = {
  idempotencyKey: randomUUID(),
  gameId: 93004,
  competitionId: 9301,
  teams,
  periods,
};
const legacyLiteral = `'${JSON.stringify(legacyInput).replaceAll("'", "''")}'::jsonb`;
const legacy = `create function pg_temp.try_legacy() returns text language plpgsql as $test$
  begin perform public.admin_create_manual_scoresheet(${legacyLiteral}); return 'accepted';
  exception when sqlstate 'BD906' then return 'other-source'; end $test$;
  set local role authenticated; select pg_temp.try_legacy()`;
const mixed = await race(93004, writer(93004, randomUUID(), 0), legacy);
assert.deepEqual(mixed.sort(), ["accepted", "other-source"]);
console.log("PASS: legacy and keyboard cannot both own one game");

// A reserved keyboard draft and a PDF importer must contend for the same
// game-row lock, irrespective of which writer acquires it first.
await sql(`begin; ${authContext}
set local role authenticated;
select public.admin_save_keyboard_scoresheet(
  93005, '${randomUUID()}', 0, ${docLiteral}
);
commit;`);
const reservedImportId = Number(
  await sql(`insert into public.boxscore_imports (
  competition_id, sha256, storage_path, parser_version, status, created_by
) values (
  9301, repeat('d',64), '9301/'||repeat('d',64)||'.pdf',
  'basketball-site-v1', 'review',
  (select user_id from private.admin_accounts limit 1)
) returning id`),
);
assert.ok(Number.isSafeInteger(reservedImportId));
const blockedPdfWriter = `create function pg_temp.try_pdf() returns text language plpgsql as $test$
  begin
    perform public.admin_commit_boxscore_import(
      ${reservedImportId}, '{"gameId":93005}'::jsonb
    );
    return 'unexpected-pdf-commit';
  exception when sqlstate 'BD906' then return 'other-source';
  end $test$;
  set local role authenticated; select pg_temp.try_pdf()`;
const draftAndPdf = await race(93005, writer(93005, randomUUID(), 1), blockedPdfWriter);
assert.deepEqual(draftAndPdf.sort(), ["accepted", "other-source"]);
assert.equal(
  Number(await sql("select version from public.keyboard_scoresheets where game_id=93005")),
  2,
);
assert.equal(
  Number(
    await sql("select count(*) from public.keyboard_scoresheet_revisions where game_id=93005"),
  ),
  2,
);
assert.equal(
  await sql("select status from public.boxscore_imports where id=" + reservedImportId),
  "review",
);
assert.equal(await sql("select status from public.games where id=93005"), "scheduled");
console.log("PASS: concurrent PDF import cannot steal a keyboard-reserved game");

// Exercise actual GoTrue-issued sessions and TOTP MFA, not forged JWT claims.
const authOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};
const privileged = createClient(status.API_URL, status.SERVICE_ROLE_KEY, authOptions);
const admin = createClient(status.API_URL, status.ANON_KEY, authOptions);
const outsider = createClient(status.API_URL, status.ANON_KEY, authOptions);
const password = `${randomBytes(24).toString("base64url")}Aa1!`;
async function createLocalUser(kind) {
  const email = `keyboard-${kind}-${randomUUID()}@example.invalid`;
  const { data, error } = await privileged.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user)
    throw new Error(`GoTrue ${kind} fixture creation failed: ${error?.message}`);
  return { id: data.user.id, email };
}
const adminUser = await createLocalUser("admin");
const outsiderUser = await createLocalUser("outsider");
await sql(`update private.admin_accounts set user_id='${adminUser.id}'`);
for (const [client, user] of [
  [admin, adminUser],
  [outsider, outsiderUser],
]) {
  const { error } = await client.auth.signInWithPassword({ email: user.email, password });
  assert.ifError(error);
}

async function rpc(client, requestId, baseVersion, confirm = false) {
  return client.rpc("admin_save_keyboard_scoresheet", {
    p_game_id: 93001,
    p_request_id: requestId,
    p_base_version: baseVersion,
    p_document: document,
    p_confirm: confirm,
    p_reason: "",
  });
}
const beforeMfa = await rpc(admin, randomUUID(), 0);
assert.equal(beforeMfa.error?.code, "BD401", "GoTrue AAL1 administrator must be denied");
const unauthorized = await rpc(outsider, randomUUID(), 0);
assert.equal(unauthorized.error?.code, "BD401", "GoTrue non-admin must be denied");
console.log("PASS: GoTrue authenticated AAL1 and non-admin are denied");

const { data: enrollment, error: enrollmentError } = await admin.auth.mfa.enroll({
  factorType: "totp",
  friendlyName: "keyboard-ci",
});
assert.ifError(enrollmentError);
assert.ok(enrollment?.id && enrollment?.totp?.secret);
const { data: challenge, error: challengeError } = await admin.auth.mfa.challenge({
  factorId: enrollment.id,
});
assert.ifError(challengeError);
assert.ok(challenge?.id);
function totp(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret.toUpperCase().replace(/=|\s/g, "")) {
    const value = alphabet.indexOf(char);
    assert.ok(value >= 0, "TOTP secret must use base32");
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes = Buffer.from(
    Array.from({ length: Math.floor(bits.length / 8) }, (_, i) =>
      Number.parseInt(bits.slice(i * 8, i * 8 + 8), 2),
    ),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac("sha1", bytes).update(counter).digest();
  const offset = digest.at(-1) & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, "0");
}
const { error: verifyError } = await admin.auth.mfa.verify({
  factorId: enrollment.id,
  challengeId: challenge.id,
  code: totp(enrollment.totp.secret),
});
assert.ifError(verifyError);
const { data: assurance, error: assuranceError } =
  await admin.auth.mfa.getAuthenticatorAssuranceLevel();
assert.ifError(assuranceError);
assert.equal(assurance.currentLevel, "aal2");
const requestId = randomUUID();
const saved = await rpc(admin, requestId, 0);
assert.ifError(saved.error);
assert.equal(saved.data?.version, 1);
const repeated = await rpc(admin, requestId, 0);
assert.ifError(repeated.error);
assert.deepEqual(repeated.data, saved.data);
const confirmed = await rpc(admin, randomUUID(), 1, true);
assert.ifError(confirmed.error);
assert.equal(confirmed.data?.confirmed, true);
assert.equal(
  Number(
    await sql("select count(*) from public.keyboard_scoresheet_revisions where game_id=93001"),
  ),
  2,
);
assert.equal(
  Number(
    await sql("select coalesce(sum(points),0) from public.game_period_scores where game_id=93001"),
  ),
  3,
);
console.log(
  "PASS: real GoTrue MFA AAL2 saves, retries idempotently, confirms and persists canonical score",
);

if (process.env.KEYBOARD_BROWSER_INTEGRATION === "true") {
  const { verifyDisposableBrowser } = await import("./test-keyboard-disposable-browser.mjs");
  await verifyDisposableBrowser({
    sql,
    status,
    adminUser,
    password,
    totp: () => totp(enrollment.totp.secret),
    helpers,
  });
}
