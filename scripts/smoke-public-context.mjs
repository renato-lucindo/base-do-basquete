import assert from "node:assert/strict";

const baseUrl = process.argv[2];
if (!baseUrl || !baseUrl.startsWith("https://")) {
  throw new Error("Usage: node scripts/smoke-public-context.mjs https://preview.example");
}

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

const rootResponse = await request("/");
assert.equal(rootResponse.status, 302, "root must redirect to a valid context");
const rootLocation = locationPath(rootResponse);
assert.match(
  rootLocation,
  /^\/2026\/copa-es-ouro\/fixture-fiba\/(?:masculino\/|feminino\/)?visao-geral$/,
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
const crossedGameResponse = await request(
  `/2025/liga-de-desenvolvimento/sub-15/jogos/${gameMatch[1]}`,
);
assert.equal(crossedGameResponse.status, 404, "a game cannot cross competition contexts");

const olderContext = await resolveContext(older);
const olderResponse = olderContext.response;
const preference = olderResponse.headers.get("set-cookie");
assert.ok(preference, "a valid context must persist a navigation preference");
const preferredRoot = await request("/", {
  headers: { Cookie: preference.split(";")[0] },
});
assert.equal(preferredRoot.status, 302);
assert.equal(locationPath(preferredRoot), olderContext.path.replace(/\/equipes$/, "/visao-geral"));

const adminResponse = await request("/admin");
assert.ok(
  [302, 303].includes(adminResponse.status),
  "/admin must keep its authenticated route precedence",
);

console.log("Public context smoke passed");
