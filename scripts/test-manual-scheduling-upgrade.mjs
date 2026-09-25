// Integration regression for the rollout order that already exists in the shared Supabase project.
// Runs only against the disposable Supabase Docker database in CI and never accepts a remote target.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

if (process.env.CI !== "true") throw new Error("Run only in the disposable CI database.");

const container = "supabase_db_base-do-basquete";
const migrationUrl = new URL(
  "../supabase/migrations/20260924194303_admin_manual_schedule_flow.sql",
  import.meta.url,
);
const migration = readFileSync(migrationUrl, "utf8");
const start = migration.indexOf("alter table public.admin_mutation_audit");
const end = migration.indexOf("create table private.manual_matchup_requests", start);
assert.notEqual(start, -1, "manual scheduling migration must update the audit allowlist");
assert.notEqual(end, -1, "manual scheduling audit allowlist block must be identifiable");

const upgradeAlter = migration
  .slice(start, end)
  .replace("public.admin_mutation_audit", "pg_temp.manual_schedule_upgrade_audit");
assert.match(
  upgradeAlter,
  /'boxscore_team_registrations_resolved'/,
  "manual scheduling rollout must preserve the already-applied boxscore team-resolution audit action",
);

function run(sql) {
  return new Promise((resolve, reject) => {
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
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      errors += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(output.trim());
      else reject(new Error(`Local psql failed: ${errors}`));
    });
    child.stdin.end(sql);
  });
}

const result = await run(`
begin;
create temp table manual_schedule_upgrade_audit (
  action text not null,
  constraint admin_mutation_audit_action_check check (
    action in ('registration_created','boxscore_team_registrations_resolved')
  )
);
insert into manual_schedule_upgrade_audit(action)
values ('boxscore_team_registrations_resolved');
${upgradeAlter}
select count(*) from manual_schedule_upgrade_audit
where action = 'boxscore_team_registrations_resolved';
rollback;
`);

assert.equal(
  result,
  "1",
  "the pre-existing team-resolution audit row must survive the manual migration",
);
console.log("manual scheduling upgrade compatibility passed");
