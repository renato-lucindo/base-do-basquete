import assert from "node:assert/strict";

const baseUrl = process.argv[2];
if (!baseUrl || !baseUrl.startsWith("https://")) {
  throw new Error("Usage: node scripts/smoke-public-context.mjs https://preview.example");
}

const isProductionWorker = new URL(baseUrl).hostname.startsWith("base-do-basquete-prod.");
const propagationAttempts = Number.parseInt(
  process.env.RELEASE_SMOKE_PROPAGATION_ATTEMPTS ?? (isProductionWorker ? "12" : "1"),
  10,
);
const propagationDelayMs = Number.parseInt(
  process.env.RELEASE_SMOKE_PROPAGATION_DELAY_MS ?? "5000",
  10,
);
assert.ok(
  Number.isSafeInteger(propagationAttempts) && propagationAttempts >= 1,
  "propagation attempts must be a positive integer",
);
assert.ok(
  Number.isSafeInteger(propagationDelayMs) && propagationDelayMs >= 0,
  "propagation delay must be a non-negative integer",
);

async function request(path, init = {}) {
  return fetch(new URL(path, baseUrl), {
    redirect: "manual",
    ...init,
  });
}

function locationPath(response) {
  const location = response.headers.get("location");
  assert.ok(location, "redirect must include a location");
  return new URL(location, baseUrl).pathname;
}

async function resolveContext(path) {
  const initial = await request(path);
  if (![302, 303, 307, 308].includes(initial.status)) return { path, response: initial };
  const canonicalPath = locationPath(initial);
  assert.match(
    canonicalPath,
    /^\/\d{4}\/[^/]+\/[^/]+\/(?:masculino|feminino)\/[^/]+$/,
    "a classified legacy context must redirect to its gender-specific canonical path",
  );
  return { path: canonicalPath, response: await request(canonicalPath) };
}

const older = "/2025/liga-de-desenvolvimento/sub-15/equipes";
const secondCategory = "/2026/liga-de-desenvolvimento/sub-17/jogadores";

const expectedRoot =
  /^\/2026\/copa-es-ouro\/fixture-fiba\/(?:masculino\/|feminino\/)?classificacao$/;
let rootResponse;
let rootLocation;
for (let attempt = 1; attempt <= propagationAttempts; attempt += 1) {
  rootResponse = await request("/");
  if ([302, 303, 307, 308].includes(rootResponse.status)) {
    rootLocation = locationPath(rootResponse);
    if (expectedRoot.test(rootLocation)) break;
  }
  if (attempt < propagationAttempts) {
    await rootResponse.arrayBuffer();
    console.log(
      `Public root not propagated yet (attempt ${attempt}/${propagationAttempts}); retrying.`,
    );
    await new Promise((resolve) => setTimeout(resolve, propagationDelayMs));
  }
}
assert.ok(rootResponse, "root request must run");
assert.equal(rootResponse.status, 302, "root must redirect to a valid context");
assert.ok(rootLocation, "root redirect must include a location");
assert.match(
  rootLocation,
  expectedRoot,
  "root must select the latest compatible canonical context",
);

for (const path of [rootLocation, older, secondCategory]) {
  const resolved = await resolveContext(path);
  const { response } = resolved;
  assert.equal(response.status, 200, `${path} must render directly`);
  const body = await response.text();
  assert.match(body, /Base do Basquete/);
  assert.match(body, new RegExp(resolved.path.split("/").at(-1), "i"));
}

const invalidResponse = await request(
  "/2026/liga-de-desenvolvimento/categoria-inexistente/equipes",
);
assert.equal(invalidResponse.status, 404, "invalid combinations must be not-found");

const gameList = await resolveContext("/2026/liga-de-desenvolvimento/sub-15/jogos");
const gameListResponse = gameList.response;
const gameListBody = await gameListResponse.text();
const gameMatch = gameListBody.match(
  /\/2026\/liga-de-desenvolvimento\/sub-15\/(?:masculino\/|feminino\/)?jogos\/(\d+)/,
);
assert.ok(gameMatch, "the seeded context must expose one contextual game link");
const crossedGamePath = `/2025/liga-de-desenvolvimento/sub-15/jogos/${gameMatch[1]}`;
const crossedGameInitial = await request(crossedGamePath);
assert.equal(crossedGameInitial.status, 308, "legacy game paths must canonicalize the gender");
const crossedGameCanonicalPath = locationPath(crossedGameInitial);
assert.match(
  crossedGameCanonicalPath,
  new RegExp(`^/2025/liga-de-desenvolvimento/sub-15/(?:masculino|feminino)/jogos/${gameMatch[1]}$`),
  "the canonical redirect must preserve the requested competition and game",
);
const crossedGameResponse = await request(crossedGameCanonicalPath);
assert.equal(crossedGameResponse.status, 404, "a game cannot cross competition contexts");

const olderContext = await resolveContext(older);
const olderResponse = olderContext.response;
const preference = olderResponse.headers.get("set-cookie");
assert.ok(preference, "a valid context must persist a navigation preference");
const preferredRoot = await request("/", {
  headers: { Cookie: preference.split(";")[0] },
});
assert.equal(preferredRoot.status, 302);
assert.equal(
  locationPath(preferredRoot),
  olderContext.path.replace(/\/equipes$/, "/classificacao"),
);

const adminResponse = await request("/admin");
assert.ok(
  [302, 303].includes(adminResponse.status),
  "/admin must keep its authenticated route precedence",
);

console.log("Public context smoke passed");
