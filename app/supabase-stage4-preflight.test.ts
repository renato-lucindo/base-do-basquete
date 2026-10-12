import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const root = process.cwd();
const manifestPath = "docs/execution/supabase-stage4-remote-migration-history.json";
const scriptPath = "scripts/supabase-stage4-reconcile-overlay.mjs";
const ownedDirectories: string[] = [];

async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), "bdb-preflight-test-"));
  ownedDirectories.push(directory);
  for (const file of [manifestPath, scriptPath, "supabase/config.toml"]) {
    await mkdir(path.dirname(path.join(directory, file)), { recursive: true });
    await cp(path.join(root, file), path.join(directory, file));
  }
  await cp(path.join(root, "supabase/migrations"), path.join(directory, "supabase/migrations"), {
    recursive: true,
  });
  return directory;
}

function run(directory: string) {
  return spawnSync(process.execPath, [path.join(directory, scriptPath)], {
    cwd: directory,
    encoding: "utf8",
  });
}

afterEach(async () => {
  for (const directory of ownedDirectories.splice(0)) {
    // Only directories created by this test or returned by its own generator.
    expect(path.dirname(directory)).toBe(path.resolve(tmpdir()));
    expect(path.basename(directory)).toMatch(/^bdb-(preflight-test|stage4-reconcile)-/);
    await rm(directory, { recursive: true, force: true });
  }
});

describe("read-only Stage4 preflight overlay", () => {
  it("generates the exact remote filenames and six unchanged pending migrations", async () => {
    const directory = await fixture();
    const manifest = JSON.parse(await readFile(path.join(directory, manifestPath), "utf8"));
    const result = run(directory);
    expect(result.status, result.stderr).toBe(0);
    const overlay = result.stdout.match(
      /Prepared a temporary Supabase migration overlay at: (.+)/,
    )?.[1];
    expect(overlay).toBeDefined();
    if (!overlay) throw new Error("Missing generated overlay path");
    ownedDirectories.push(overlay.trim());
    const migrations = path.join(overlay.trim(), "supabase/migrations");
    const filenames = await readdir(migrations);
    expect(filenames.sort()).toEqual(
      [
        ...manifest.applied.map(
          (item: { version: string; name: string }) => `${item.version}_${item.name}.sql`,
        ),
        ...manifest.stage4Pending,
      ].sort(),
    );
    expect(filenames).toHaveLength(68);
    expect(result.stdout).toContain("Remote applied baseline: 62; Stage 4 pending: 6;");
    expect(result.stdout).toContain("--dry-run --skip-vault");
    for (const filename of manifest.stage4Pending) {
      expect(await readFile(path.join(migrations, filename), "utf8")).toBe(
        await readFile(path.join(root, "supabase/migrations", filename), "utf8"),
      );
    }
    for (const name of manifest.remoteOnly) {
      const filename = filenames.find((item) => item.endsWith(`_${name}.sql`));
      expect(filename).toBeDefined();
      expect(await readFile(path.join(migrations, filename as string), "utf8")).toContain(
        "Remote-only history placeholder: never execute against a fresh database",
      );
    }
  });

  it("rejects an unaudited local migration instead of offering to push it", async () => {
    const directory = await fixture();
    await writeFile(
      path.join(directory, "supabase/migrations/20990101000000_unaudited.sql"),
      "select 1;\n",
    );
    const result = run(directory);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Unrecognized local migration: unaudited");
    expect(result.stdout).not.toContain("Read-only preview command");
  });

  it("rejects a missing pending migration", async () => {
    const directory = await fixture();
    const manifest = JSON.parse(await readFile(path.join(directory, manifestPath), "utf8"));
    const missing = path.join(directory, "supabase/migrations", manifest.stage4Pending[0]);
    expect(path.dirname(missing)).toBe(path.join(directory, "supabase/migrations"));
    await rm(missing);
    const result = run(directory);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Stage 4 migration missing or already included in remote history",
    );
    expect(result.stdout).not.toContain("Read-only preview command");
  });

  it("rejects a historical migration alias whose local version changed", async () => {
    const directory = await fixture();
    const manifest = JSON.parse(await readFile(path.join(directory, manifestPath), "utf8"));
    const original = manifest.localVersionAliases.season_division_model;
    const source = path.join(directory, "supabase/migrations", original);
    const target = path.join(
      directory,
      "supabase/migrations/20990101000000_season_division_model.sql",
    );
    await cp(source, target);
    expect(path.dirname(source)).toBe(path.join(directory, "supabase/migrations"));
    await rm(source);
    const result = run(directory);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Historical local migration alias changed: season_division_model",
    );
    expect(result.stdout).not.toContain("Read-only preview command");
  });
});
