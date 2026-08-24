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

const latest = "/2026/copa-es-ouro/fixture-fiba/classificacao";
const older = "/2025/liga-de-desenvolvimento/sub-15/equipes";
const secondCategory = "/2026/liga-de-desenvolvimento/sub-17/jogadores";

const rootResponse = await request("/");
assert.equal(rootResponse.status, 302, "root must redirect to a valid context");
assert.equal(rootResponse.headers.get("location"), latest);

for (const path of [latest, older, secondCategory]) {
  const response = await request(path);
  assert.equal(response.status, 200, `${path} must render directly`);
  const body = await response.text();
  assert.match(body, /Base do Basquete/);
  assert.match(body, new RegExp(path.split("/").at(-1), "i"));
}

const invalidResponse = await request(
  "/2026/liga-de-desenvolvimento/categoria-inexistente/equipes",
);
assert.equal(invalidResponse.status, 404, "invalid combinations must be not-found");

const gameListResponse = await request("/2026/liga-de-desenvolvimento/sub-15/jogos");
const gameListBody = await gameListResponse.text();
const gameMatch = gameListBody.match(/\/2026\/liga-de-desenvolvimento\/sub-15\/jogos\/(\d+)/);
assert.ok(gameMatch, "the seeded context must expose one contextual game link");
const crossedGameResponse = await request(
  `/2025/liga-de-desenvolvimento/sub-15/jogos/${gameMatch[1]}`,
);
assert.equal(crossedGameResponse.status, 404, "a game cannot cross competition contexts");

const olderResponse = await request(older);
const preference = olderResponse.headers.get("set-cookie");
assert.ok(preference, "a valid context must persist a navigation preference");
const preferredRoot = await request("/", {
  headers: { Cookie: preference.split(";")[0] },
});
assert.equal(preferredRoot.status, 302);
assert.equal(
  preferredRoot.headers.get("location"),
  "/2025/liga-de-desenvolvimento/sub-15/classificacao",
);

const adminResponse = await request("/admin");
assert.ok(
  [302, 303].includes(adminResponse.status),
  "/admin must keep its authenticated route precedence",
);

console.log("Public context smoke passed");
