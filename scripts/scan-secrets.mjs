import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const patterns = [
  ["GitHub token", /(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}/g],
  ["OpenAI key", /sk-[A-Za-z0-9_-]{20,}/g],
  ["Supabase secret key", /sb_secret_[A-Za-z0-9_-]{20,}/g],
  ["Private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
];

const excluded = new Set(["package-lock.json", "scripts/scan-secrets.mjs"]);
const trackedFiles = [
  ...new Set(
    execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"])
      .toString("utf8")
      .split("\0")
      .filter(Boolean),
  ),
].filter((file) => !excluded.has(file) && existsSync(file));

const findings = [];

for (const file of trackedFiles) {
  const contents = readFileSync(file);
  if (contents.includes(0)) continue;

  const text = contents.toString("utf8");
  for (const [label, pattern] of patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) findings.push(`${file}: ${label}`);
  }
}

if (findings.length > 0) {
  console.error("Potential secrets found:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Secret scan passed for ${trackedFiles.length} tracked files.`);
