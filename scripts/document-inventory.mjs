import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename, dirname, sep } from "node:path";

function gitLines(args) {
  const output = execFileSync("git", args, { encoding: "utf8" });
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalize(path) {
  return path.split(sep).join("/");
}

function unique(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "pt-BR"));
}

function groupBy(values, keyFor) {
  const groups = new Map();
  for (const value of values) {
    const key = keyFor(value);
    const group = groups.get(key) ?? [];
    group.push(value);
    groups.set(key, group);
  }
  return groups;
}

const tracked = gitLines(["ls-files", "--", "*.md"]);
const untracked = gitLines(["ls-files", "--others", "--exclude-standard", "--", "*.md"]);
const paths = unique([...tracked, ...untracked]).map(normalize);

const records = paths.map((path) => {
  const content = readFileSync(path);
  return {
    path,
    basename: basename(path),
    directory: normalize(dirname(path)),
    bytes: content.byteLength,
    lines: content.toString("utf8").split(/\r?\n/u).length,
    sha256: createHash("sha256").update(content).digest("hex"),
    tracked: tracked.includes(path),
  };
});

const exactDuplicates = [...groupBy(records, (record) => record.sha256).entries()]
  .filter(([, group]) => group.length > 1)
  .map(([sha256, group]) => ({
    sha256,
    paths: group.map((record) => record.path).sort(),
  }));

const basenameCollisions = [...groupBy(records, (record) => record.basename).entries()]
  .filter(([, group]) => group.length > 1)
  .map(([name, group]) => ({
    name,
    paths: group.map((record) => record.path).sort(),
  }))
  .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));

const byArea = Object.fromEntries(
  [
    ...groupBy(records, (record) =>
      record.path.includes("/") ? record.path.split("/")[0] : "(root)",
    ).entries(),
  ]
    .map(([area, group]) => [area, group.length])
    .sort(([left], [right]) => left.localeCompare(right, "pt-BR")),
);

const inventory = {
  schemaVersion: 1,
  markdownFiles: records.length,
  trackedMarkdownFiles: records.filter((record) => record.tracked).length,
  untrackedMarkdownFiles: records.filter((record) => !record.tracked).length,
  byArea,
  exactDuplicates,
  basenameCollisions,
  largestFiles: records
    .toSorted((left, right) => right.bytes - left.bytes)
    .slice(0, 20)
    .map(({ path, bytes, lines, tracked: isTracked }) => ({
      path,
      bytes,
      lines,
      tracked: isTracked,
    })),
};

process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`);
