import { spawnSync } from "node:child_process";

function git(args, { optional = false } = {}) {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: false,
  });

  if (result.status !== 0) {
    if (optional) return null;
    const detail = result.stderr.trim() || result.stdout.trim() || `git ${args.join(" ")} failed`;
    throw new Error(detail);
  }

  return result.stdout.trim();
}

function lines(value) {
  return value ? value.split(/\r?\n/u).filter(Boolean) : [];
}

const root = git(["rev-parse", "--show-toplevel"]);
const head = git(["rev-parse", "HEAD"]);
const branch = git(["branch", "--show-current"]) || "DETACHED";
const upstream = git(["rev-parse", "--abbrev-ref", "@{upstream}"], { optional: true });
const base = git(["merge-base", "HEAD", "origin/main"], { optional: true });
const status = lines(git(["status", "--short"]));
const trackedChanges = lines(git(["diff", "--name-only", "HEAD"]));
const untracked = status.filter((entry) => entry.startsWith("?? ")).map((entry) => entry.slice(3));
const changedFiles = [...new Set([...trackedChanges, ...untracked])].sort();
const migrations = changedFiles.filter((file) => file.startsWith("supabase/migrations/"));
const recentCommits = lines(git(["log", "--oneline", "-10"]));

process.stdout.write(
  `${JSON.stringify(
    {
      root,
      branch,
      head,
      upstream,
      baseAgainstOriginMain: base,
      status,
      changedFiles,
      migrations,
      recentCommits,
    },
    null,
    2,
  )}\n`,
);
