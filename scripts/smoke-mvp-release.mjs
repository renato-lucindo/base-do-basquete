import assert from "node:assert/strict";

const rawBaseUrl = process.argv[2];
const expectedEnvironment = process.argv[3];

if (!rawBaseUrl || !["preview", "production"].includes(expectedEnvironment)) {
  throw new Error(
    "Usage: node scripts/smoke-mvp-release.mjs https://worker.example preview|production",
  );
}

const baseUrl = new URL(rawBaseUrl);
assert.equal(baseUrl.protocol, "https:", "MVP smoke accepts HTTPS only");

const allowedHost =
  expectedEnvironment === "preview"
    ? /^(?:pr-\d+-)?base-do-basquete-preview\.[a-z0-9-]+\.workers\.dev$/u
    : /^base-do-basquete-prod\.[a-z0-9-]+\.workers\.dev$/u;
assert.match(baseUrl.hostname, allowedHost, `unexpected ${expectedEnvironment} Worker host`);

async function request(path) {
  return fetch(new URL(path, baseUrl), { redirect: "manual" });
}

function assertSecurityHeaders(response, label) {
  assert.equal(response.headers.get("x-content-type-options"), "nosniff", `${label}: nosniff`);
  assert.equal(response.headers.get("x-frame-options"), "DENY", `${label}: frame denied`);
  assert.match(
    response.headers.get("content-security-policy") ?? "",
    /frame-ancestors 'none'/u,
    `${label}: CSP frame ancestors`,
  );
}

const health = await request("/health");
assert.equal(health.status, 200, "health must return HTTP 200");
assert.deepEqual(await health.json(), {
  environment: expectedEnvironment,
  service: "base-do-basquete",
  status: "ok",
});
assert.equal(health.headers.get("cache-control"), "no-store");
assertSecurityHeaders(health, "health");

const admin = await request("/admin");
assert.ok([302, 303].includes(admin.status), "anonymous admin access must redirect");
assert.equal(new URL(admin.headers.get("location"), baseUrl).pathname, "/admin/login");

const login = await request("/admin/login");
assert.equal(login.status, 200, "admin login entry must render");
assert.equal(login.headers.get("cache-control"), "no-store");
assertSecurityHeaders(login, "admin login");

const classification = await request("/2026/copa-es-ouro/fixture-fiba/masculino/classificacao");
assert.equal(classification.status, 200, "published classification must render");
assertSecurityHeaders(classification, "published classification");
const classificationBody = await classification.text();
for (const expected of ["Classificação", "Instituto Viva Vida", "AVABES", "93", "39"]) {
  assert.match(classificationBody, new RegExp(expected, "u"));
}
for (const privateMarker of ["boxscore-pdfs", "birth_date", "Validação MVP-03 — não publicar"]) {
  assert.doesNotMatch(classificationBody, new RegExp(privateMarker, "u"));
}

const privateSearch = await request(
  "/api/public-search?competitionId=20&scope=global&q=Validacao%20MVP",
);
assert.equal(privateSearch.status, 200, "public search must remain available");
assert.deepEqual((await privateSearch.json()).groups, [], "private fixture must not enter search");

console.log(`MVP ${expectedEnvironment} security and privacy smoke passed.`);
