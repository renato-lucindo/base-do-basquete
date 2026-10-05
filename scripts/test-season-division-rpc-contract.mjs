// Only the disposable CI stack is accepted; no remote URL or credentials are read.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";

if (process.env.CI !== "true") throw new Error("Run only in the disposable CI stack.");
let rawStatus;
try {
  rawStatus = execFileSync(
    "npx",
    ["--no-install", "supabase", "status", "--output", "env", "--output-format", "text"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
} catch {
  // Never dump subprocess stdout/stderr: status includes disposable credentials.
  throw new Error("Cannot read the disposable Supabase stack status.");
}
const status = {};
for (const line of rawStatus.split(/\r?\n/)) {
  const match = /^(API_URL|ANON_KEY|JWT_SECRET)=(".*")$/.exec(line.trim());
  if (match) status[match[1]] = JSON.parse(match[2]);
}
assert.ok(status.API_URL, "Disposable API_URL must be available from status --output env.");
assert.ok(status.ANON_KEY, "Disposable ANON_KEY must be available from status --output env.");
assert.ok(status.JWT_SECRET, "Disposable JWT_SECRET must be available from status --output env.");
const endpoint = new URL(status.API_URL);
assert.equal(endpoint.hostname, "127.0.0.1");
assert.equal(endpoint.port, "54321");
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const header = encode({ alg: "HS256", typ: "JWT" });
const payload = encode({
  sub: randomUUID(),
  role: "authenticated",
  aal: "aal2",
  exp: Math.floor(Date.now() / 1000) + 300,
});
const signature = createHmac("sha256", status.JWT_SECRET)
  .update(`${header}.${payload}`)
  .digest("base64url");
const token = `${header}.${payload}.${signature}`;
const calls = [
  ["admin_create_competition_edition", { p_request_id: randomUUID(), p_input: {} }],
  ["admin_add_competition_dispute", { p_request_id: randomUUID(), p_input: {} }],
  [
    "admin_create_competition_season",
    {
      p_request_id: randomUUID(),
      p_series_id: 1,
      p_year: 2026,
      p_gender_division: "male",
      p_name: "RPC contract",
      p_description: null,
      p_suggested_starts_on: null,
      p_suggested_ends_on: null,
    },
  ],
  [
    "admin_assign_competition_competitive_division",
    {
      p_competition_id: 1,
      p_expected_competitive_division_value_id: null,
      p_competitive_division_value_id: null,
    },
  ],
  ["admin_review_competition_gender", { p_competition_id: 1, p_gender_division: "female" }],
  [
    "admin_update_competition_season",
    {
      p_season_id: 1,
      p_expected_revision: 1,
      p_name: "RPC contract",
      p_description: null,
      p_suggested_starts_on: null,
      p_suggested_ends_on: null,
    },
  ],
  [
    "admin_add_competitive_division_value",
    {
      p_request_id: randomUUID(),
      p_season_id: 1,
      p_type_name: "Série",
      p_type_slug: "serie",
      p_value_name: "Ouro",
      p_value_slug: "ouro",
      p_sort_order: 1,
    },
  ],
];
for (const [name, args] of calls) {
  const response = await fetch(new URL(`/rest/v1/rpc/${name}`, endpoint), {
    method: "POST",
    headers: {
      apikey: status.ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(15000),
  });
  const error = await response.json();
  assert.equal(error.code, "BD401", `${name}: exact named arguments must reach the AAL2 guard`);
  assert.equal(error.message, "BDB_ADMIN_AAL2_REQUIRED");
  console.log(`PASS: ${name} resolves through PostgREST and denies non-admin AAL2`);
}
