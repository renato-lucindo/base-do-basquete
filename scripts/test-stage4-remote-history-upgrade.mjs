#!/usr/bin/env node
// GitHub Actions-only, offline, schema-only remote-history reconstruction.
// The five local-only prerequisite migrations are required for bootstrap;
// historical remote SQL is preferred where it differs from the Git repository.
import { cp, copyFile, mkdir, mkdtemp, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  await readFile(
    path.join(root, "docs", "execution", "supabase-stage4-remote-migration-history.json"),
    "utf8",
  ),
);
const original = path.join(root, "supabase", "migrations");
const fixtureDir = path.join(root, "supabase", "tests", "fixtures", "remote-baseline");
const filenames = (await readdir(original)).filter((item) => item.endsWith(".sql"));
const byName = new Map(
  filenames.map((filename) => [filename.replace(/^\d{14}_|\.sql$/g, ""), filename]),
);
const exceptions = new Set([
  "canonical_model",
  "basketball_site_boxscore",
  "player_profile_foundation_compat",
  "season_division_model",
  "edition_creation_workflow",
]);
const prerequisiteNames = [
  "single_admin_auth",
  "mvp01_structural_foundation",
  "mvp01_existing_game_ingestion",
  "mvp01_matchup_enforcement",
  "mvp02_public_player_read_models",
];
function check(condition, message) {
  if (!condition) throw new Error(message);
}
check(manifest.projectRef === "yjnbemfeyjhxhomprlnm", "Unexpected project baseline");
check(manifest.applied.length === 62, "Remote baseline version count changed");
for (const name of prerequisiteNames)
  check(byName.has(name), "Missing bootstrap prerequisite: " + name);
for (const name of exceptions) {
  const record = manifest.applied.find((item) => item.name === name);
  check(Boolean(record), "Missing recorded historical exception: " + name);
}
const overlay = await mkdtemp(path.join(tmpdir(), "bdb-remote-history-stage4-"));
const overlaySupabase = path.join(overlay, "supabase");
const migrations = path.join(overlaySupabase, "migrations");
await mkdir(migrations, { recursive: true });
let config = await readFile(path.join(root, "supabase", "config.toml"), "utf8");
const independentSettings = [
  ['project_id = "base-do-basquete"', 'project_id = "base-do-basquete-remote-history"'],
  ["port = 54321", "port = 55321"],
  ["port = 54322", "port = 55322"],
  ["shadow_port = 54320", "shadow_port = 55320"],
  ["port = 54329", "port = 55329"],
  ["port = 54323", "port = 55323"],
  ["port = 54324", "port = 55324"],
  ["port = 54327", "port = 55327"],
];
for (const [before, after] of independentSettings) {
  check(config.includes(before), "Missing expected Supabase test setting");
  config = config.replace(before, after);
}
await writeFile(path.join(overlaySupabase, "config.toml"), config, "utf8");
await writeFile(
  path.join(overlaySupabase, "seed.sql"),
  "-- Deliberately empty: no demo or personal data in the schema-only upgrade test.\\n",
  "utf8",
);
await cp(path.join(root, "supabase", "tests"), path.join(overlaySupabase, "tests"), {
  recursive: true,
});
// The normal CI runs all 45 pgTAP suites. This schema-only upgrade fixture has
// no demo seed, so only stage 4 plus compatible FIBA/read-model regressions
// are run here. Older suites require seed data or superseded uniqueness rules.
const focalTests = new Set([
  "manual_scoresheet_v2_atomic_create.test.sql",
  "manual_scoresheet_v2_collective_ft_public_projection.test.sql",
  "manual_scoresheet_v2_persistence.test.sql",
  "manual_scoresheet_v2_revisions.test.sql",
  "manual_scoresheet_transactions.test.sql",
  "fiba_boxscore_import.test.sql",
  "basketball_site_boxscore.test.sql",
  "game_data_domain_authority.test.sql",
  "stats_public_player_snapshot.test.sql",
]);
const testDir = path.join(overlaySupabase, "tests", "database");
const availableTests = await readdir(testDir);
for (const filename of focalTests) {
  check(availableTests.includes(filename), "Missing required regression test: " + filename);
}
for (const filename of availableTests) {
  if (filename.endsWith(".sql") && !focalTests.has(filename)) {
    await unlink(path.join(testDir, filename));
  }
}

const migrationVersions = new Set();
for (const item of manifest.applied) {
  const name = item.version + "_" + item.name + ".sql";
  check(/^\d{14}$/.test(item.version) && /^[a-z0-9_]+$/.test(item.name), "Invalid history row");
  check(!migrationVersions.has(item.version), "Duplicate baseline version: " + item.version);
  migrationVersions.add(item.version);
  const from = exceptions.has(item.name)
    ? path.join(fixtureDir, name + ".fixture")
    : path.join(original, byName.get(item.name) ?? "MISSING_" + name);
  await copyFile(from, path.join(migrations, name));
}
for (const extra of prerequisiteNames) {
  const file = byName.get(extra);
  const version = file.slice(0, 14);
  check(!migrationVersions.has(version), "Historical bootstrap prerequisite has version collision");
  migrationVersions.add(version);
  await copyFile(path.join(original, file), path.join(migrations, file));
}
check(migrationVersions.size === 67, "Unexpected baseline migration count");
for (const pending of manifest.stage4Pending) {
  check(
    !migrationVersions.has(pending.slice(0, 14)),
    "Stage 4 version already applied in baseline",
  );
  check(filenames.includes(pending), "Missing pending Stage 4 migration");
}
// The CI workflow adds only the four pending migrations *after* bootstrapping.
console.log(overlay);
