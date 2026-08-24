import assert from "node:assert/strict";

const rawBaseUrl = process.argv[2];
if (!rawBaseUrl)
  throw new Error("Usage: node scripts/smoke-release.mjs https://production.example");

const baseUrl = new URL(rawBaseUrl);
assert.equal(baseUrl.protocol, "https:", "production must use HTTPS");
assert.match(
  baseUrl.hostname,
  /^base-do-basquete-prod\.[a-z0-9-]+\.workers\.dev$/u,
  "release smoke refuses non-production Workers",
);

const propagationAttempts = Number.parseInt(
  process.env.RELEASE_SMOKE_PROPAGATION_ATTEMPTS ?? "12",
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

let health;
for (let attempt = 1; attempt <= propagationAttempts; attempt += 1) {
  health = await fetch(new URL("/health", baseUrl), { redirect: "manual" });
  if (health.status === 200) break;

  const canBePropagation = [404, 502, 503, 504].includes(health.status);
  if (!canBePropagation || attempt === propagationAttempts) break;

  await health.arrayBuffer();
  console.log(
    `Production route not propagated yet (HTTP ${health.status}); retry ${attempt}/${propagationAttempts}.`,
  );
  await new Promise((resolve) => setTimeout(resolve, propagationDelayMs));
}

assert.ok(health, "health request must run");
assert.equal(health.status, 200, "health must return HTTP 200");
assert.deepEqual(await health.json(), {
  environment: "production",
  service: "base-do-basquete",
  status: "ok",
});
assert.match(
  health.headers.get("x-correlation-id") ?? "",
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
  "health must expose a valid correlation ID",
);
assert.equal(health.headers.get("cache-control"), "no-store");
assert.equal(health.headers.get("x-content-type-options"), "nosniff");
assert.equal(health.headers.get("x-frame-options"), "DENY");
assert.match(health.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/u);

const login = await fetch(new URL("/admin/login", baseUrl), { redirect: "manual" });
assert.equal(login.status, 200, "admin login must render without exposing a session");
assert.match(await login.text(), /Base do Basquete/u);
assert.equal(login.headers.get("cache-control"), "no-store");

console.log("Production health, security headers and admin entry smoke passed.");
