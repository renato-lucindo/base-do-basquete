#!/usr/bin/env node
// Reconcile CLI migration filenames without changing project schema or history.
// Stage 4 / PR #72: deliberately produces a disposable --workdir.
import { copyFile, mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "supabase", "migrations");
const manifest = JSON.parse(
  await readFile(
    path.join(root, "docs", "execution", "supabase-stage4-remote-migration-history.json"),
    "utf8",
  ),
);

function check(ok, message) {
  if (!ok) throw new Error(message);
}

check(manifest.projectRef === "yjnbemfeyjhxhomprlnm", "Unexpected remote project");
check(manifest.applied.length === 62, "Remote migration history baseline changed");
const files = (await readdir(source)).filter((name) => name.endsWith(".sql"));
const byName = new Map();
for (const file of files) {
  const match = /^(\d{14})_([a-z0-9_]+)\.sql$/.exec(file);
  check(match, "Unexpected local migration filename: " + file);
  check(!byName.has(match[2]), "Duplicate local migration name: " + match[2]);
  byName.set(match[2], file);
}

const remoteNames = new Set(manifest.applied.map((item) => item.name));
check(remoteNames.size === 62, "Duplicate remote migration names");
const expectedRemoteOnly = new Set(manifest.remoteOnly);
const expectedExcluded = new Set(manifest.legacyLocalExcluded);
const expectedPending = new Set(
  manifest.stage4Pending.map((file) => file.replace(/^\d{14}_|\.sql$/g, "")),
);
for (const name of byName.keys()) {
  check(
    remoteNames.has(name) || expectedExcluded.has(name) || expectedPending.has(name),
    "Unrecognized local migration: " + name + ". Audit before regenerating the overlay.",
  );
}
for (const name of expectedExcluded) check(byName.has(name), "Missing legacy source: " + name);
for (const name of expectedPending)
  check(
    byName.has(name) && !remoteNames.has(name),
    "Stage 4 migration missing or already included in remote history: " + name,
  );
for (const name of expectedRemoteOnly)
  check(!byName.has(name), "Previously remote-only migration now exists locally: " + name);

const overlayRoot = await mkdtemp(path.join(tmpdir(), "bdb-stage4-reconcile-"));
const target = path.join(overlayRoot, "supabase", "migrations");
await mkdir(target, { recursive: true });
await copyFile(
  path.join(root, "supabase", "config.toml"),
  path.join(overlayRoot, "supabase", "config.toml"),
);
const versions = new Set();
for (const applied of manifest.applied) {
  check(
    /^\d{14}$/.test(applied.version) && /^[a-z0-9_]+$/.test(applied.name),
    "Invalid remote history entry",
  );
  check(!versions.has(applied.version), "Duplicate remote version: " + applied.version);
  versions.add(applied.version);
  const filename = applied.version + "_" + applied.name + ".sql";
  if (byName.has(applied.name)) {
    await copyFile(path.join(source, byName.get(applied.name)), path.join(target, filename));
  } else {
    check(expectedRemoteOnly.has(applied.name), "Unknown remote-only migration: " + applied.name);
    const guard = [
      "-- Applied remotely; deliberately NOT a replayable migration.",
      "-- Project: " +
        manifest.projectRef +
        ". Historical SQL is stored in the remote schema_migrations table.",
      "do $$ begin raise exception 'Remote-only history placeholder: never execute against a fresh database'; end $$;",
      "",
    ].join("\n");
    await writeFile(path.join(target, filename), guard, "utf8");
  }
}
for (const filename of manifest.stage4Pending) {
  const version = filename.slice(0, 14);
  check(!versions.has(version), "Stage 4 version already exists remotely: " + version);
  versions.add(version);
  check(files.includes(filename), "Missing Stage 4 migration file: " + filename);
  await copyFile(path.join(source, filename), path.join(target, filename));
}
const created = (await readdir(target)).filter((filename) => filename.endsWith(".sql"));
check(created.length === 66, "Unexpected generated migration count: " + created.length);
console.log("Prepared a temporary Supabase migration overlay at: " + overlayRoot);
console.log("Remote applied baseline: 62; Stage 4 pending: 4; excluded legacy local files: 6.");
console.log("No database, history, local migration file, or Git state was modified.");
console.log("Verify current remote migration history before using this baseline.");
console.log("Read-only preview command:");
console.log(
  'npx.cmd supabase --workdir "' +
    overlayRoot +
    '" db push --project-ref ' +
    manifest.projectRef +
    " --dry-run",
);
