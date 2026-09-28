import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

function fail(message) {
  errors.push(message);
}

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    fail(`Arquivo ausente: ${relativePath}`);
    return "";
  }
  return readFileSync(absolutePath, "utf8");
}

function directories(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    fail(`Diretório ausente: ${relativePath}`);
    return [];
  }
  return readdirSync(absolutePath)
    .filter((entry) => statSync(path.join(absolutePath, entry)).isDirectory())
    .sort();
}

function files(relativePath, extension) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    fail(`Diretório ausente: ${relativePath}`);
    return [];
  }
  return readdirSync(absolutePath)
    .filter((entry) => entry.endsWith(extension))
    .sort();
}

function tomlString(source, key) {
  const match = source.match(new RegExp(`^${key}\\s*=\\s*"([^"]+)"\\s*$`, "mu"));
  return match?.[1] ?? null;
}

const config = read(".codex/config.toml");
if (!/^\[agents\]\s*$/mu.test(config)) fail(".codex/config.toml deve declarar [agents].");
if (!/^enabled\s*=\s*true\s*$/mu.test(config)) fail("Subagents devem estar habilitados.");
if (!/^max_concurrent_threads_per_session\s*=\s*4\s*$/mu.test(config)) {
  fail("A concorrência deve permanecer limitada a quatro subagents.");
}

const reservedAgents = new Set(["default", "worker", "explorer"]);
const agentNames = new Set();
const agentFiles = files(".codex/agents", ".toml");
if (agentFiles.length !== 7)
  fail(`Esperados 7 perfis de subagent; encontrados ${agentFiles.length}.`);

for (const file of agentFiles) {
  const source = read(path.join(".codex/agents", file));
  const name = tomlString(source, "name");
  const description = tomlString(source, "description");
  const sandbox = tomlString(source, "sandbox_mode");

  if (!name) fail(`${file}: name ausente ou inválido.`);
  if (!description) fail(`${file}: description ausente ou inválida.`);
  if (!/^developer_instructions\s*=\s*"""[\s\S]+"""\s*$/mu.test(source)) {
    fail(`${file}: developer_instructions multilinha ausente.`);
  }
  if (sandbox !== "read-only") fail(`${file}: sandbox_mode deve ser read-only.`);
  if (name && reservedAgents.has(name)) fail(`${file}: nome reservado ${name}.`);
  if (name && agentNames.has(name)) fail(`${file}: nome duplicado ${name}.`);
  if (name) agentNames.add(name);
  if (!/Do not .*spawn subagents\./iu.test(source)) {
    fail(`${file}: deve proibir criação de subagents descendentes.`);
  }

  const roleFile = path.join(".agents", file.replace(/\.toml$/u, ".md"));
  if (!existsSync(path.join(root, roleFile)))
    fail(`${file}: definição operacional ausente em ${roleFile}.`);
}

const skillNames = new Set();
const skillDirectories = directories(".codex/skills");
if (skillDirectories.length !== 7)
  fail(`Esperadas 7 skills; encontradas ${skillDirectories.length}.`);

for (const directory of skillDirectories) {
  const relativeSkillPath = path.join(".codex/skills", directory, "SKILL.md");
  const source = read(relativeSkillPath);
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/u)?.[1];
  if (!frontmatter) {
    fail(`${directory}: frontmatter ausente.`);
    continue;
  }

  const name = frontmatter.match(/^name:\s*([a-z0-9-]+)\s*$/mu)?.[1];
  const description = frontmatter.match(/^description:\s*(.+)\s*$/mu)?.[1]?.trim();
  if (name !== directory) fail(`${directory}: name deve corresponder ao diretório.`);
  if (!description) fail(`${directory}: description ausente.`);
  if (description && description.length > 1024)
    fail(`${directory}: description excede 1024 caracteres.`);
  if (name && skillNames.has(name)) fail(`${directory}: nome de skill duplicado.`);
  if (name) skillNames.add(name);
  if (/TODO|TBD|placeholder/iu.test(source)) fail(`${directory}: scaffold incompleto encontrado.`);

  for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/gu)) {
    const target = match[1].split("#", 1)[0];
    if (!target || /^[a-z]+:/iu.test(target)) continue;
    const resolved = path.resolve(path.dirname(path.join(root, relativeSkillPath)), target);
    if (!existsSync(resolved)) fail(`${directory}: referência inexistente ${target}.`);
  }
}

const evalSource = read(".codex/evals/skill-triggers.tsv");
const evalLines = evalSource.split(/\r?\n/u).filter(Boolean);
if (evalLines[0] !== "id\tskill\tshould_trigger\tprompt") {
  fail("skill-triggers.tsv possui cabeçalho inválido.");
}

const coverage = new Map([...skillNames].map((name) => [name, { positive: 0, negative: 0 }]));
for (const [index, line] of evalLines.slice(1).entries()) {
  const fields = line.split("\t");
  if (fields.length !== 4) {
    fail(`skill-triggers.tsv linha ${index + 2}: esperados quatro campos.`);
    continue;
  }
  const [, skill, shouldTrigger, prompt] = fields;
  if (!coverage.has(skill)) {
    fail(`skill-triggers.tsv linha ${index + 2}: skill desconhecida ${skill}.`);
    continue;
  }
  if (!prompt.trim()) fail(`skill-triggers.tsv linha ${index + 2}: prompt vazio.`);
  if (shouldTrigger === "true") coverage.get(skill).positive += 1;
  else if (shouldTrigger === "false") coverage.get(skill).negative += 1;
  else fail(`skill-triggers.tsv linha ${index + 2}: should_trigger inválido.`);
}

for (const [skill, counts] of coverage) {
  if (counts.positive < 2) fail(`${skill}: requer caso explícito e implícito positivos.`);
  if (counts.negative < 1) fail(`${skill}: requer ao menos um controle negativo.`);
}

const agentEvalSource = read(".codex/evals/subagent-routing.tsv");
const agentEvalLines = agentEvalSource.split(/\r?\n/u).filter(Boolean);
if (agentEvalLines[0] !== "id\tagent\tshould_route\tprompt") {
  fail("subagent-routing.tsv possui cabeçalho inválido.");
}

const agentCoverage = new Map([...agentNames].map((name) => [name, { positive: 0, negative: 0 }]));
for (const [index, line] of agentEvalLines.slice(1).entries()) {
  const fields = line.split("\t");
  if (fields.length !== 4) {
    fail(`subagent-routing.tsv linha ${index + 2}: esperados quatro campos.`);
    continue;
  }
  const [, agent, shouldRoute, prompt] = fields;
  if (!agentCoverage.has(agent)) {
    fail(`subagent-routing.tsv linha ${index + 2}: subagent desconhecido ${agent}.`);
    continue;
  }
  if (!prompt.trim()) fail(`subagent-routing.tsv linha ${index + 2}: prompt vazio.`);
  if (shouldRoute === "true") agentCoverage.get(agent).positive += 1;
  else if (shouldRoute === "false") agentCoverage.get(agent).negative += 1;
  else fail(`subagent-routing.tsv linha ${index + 2}: should_route inválido.`);
}

for (const [agent, counts] of agentCoverage) {
  if (counts.positive < 2) fail(`${agent}: requer caso explícito e implícito positivos.`);
  if (counts.negative < 1) fail(`${agent}: requer ao menos um controle negativo.`);
}

if (errors.length > 0) {
  process.stderr.write(`${errors.map((error) => `- ${error}`).join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(
  `Configuração de agentes aprovada: ${agentFiles.length} subagents, ${skillDirectories.length} skills, ${evalLines.length - 1} cenários de skills e ${agentEvalLines.length - 1} cenários de roteamento.\n`,
);
