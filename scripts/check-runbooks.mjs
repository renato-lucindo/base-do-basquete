import { readFileSync } from "node:fs";

const requirements = new Map([
  [
    "docs/runbooks/incident-response.md",
    ["correlationId", "Workers Logs", "Supabase", "/health", "MFA"],
  ],
  [
    "docs/runbooks/secret-rotation.md",
    ["SESSION_SECRET", "scan:secrets", "revogue", "service role", "MFA"],
  ],
  [
    "docs/runbooks/backup-restore.md",
    ["PostgreSQL", "Storage", "staging", "migrations", "RLS", "checksum"],
  ],
  [
    "docs/runbooks/rollback.md",
    ["wrangler rollback", "preview", "production", "/health", "migrations"],
  ],
]);

const problems = [];
for (const [file, expected] of requirements) {
  const contents = readFileSync(file, "utf8");
  for (const token of expected) {
    if (!contents.toLocaleLowerCase("pt-BR").includes(token.toLocaleLowerCase("pt-BR"))) {
      problems.push(`${file}: conteúdo obrigatório ausente: ${token}`);
    }
  }
  if (/\b(?:TODO|TBD|FIXME)\b/u.test(contents)) {
    problems.push(`${file}: contém marcador de trabalho incompleto`);
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}

console.log(`Runbook check passed for ${requirements.size} files.`);
