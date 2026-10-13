import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assertQaBindings,
  QA_EXPIRES_AT,
  QA_URL,
  qaPreviewPlugin,
  transformQaSource,
} from "./start-isolated-qa-preview.mjs";

test("reject shared, missing, duplicate and expired bindings", () => {
  const now = Date.parse(QA_EXPIRES_AT) - 1000;
  assert.doesNotThrow(() => assertQaBindings(`SUPABASE_URL=${QA_URL}\n`, now));
  for (const contents of [
    "",
    "SUPABASE_URL=https://yjnbemfeyjhxhomprlnm.supabase.co\n",
    `SUPABASE_URL=${QA_URL}\nSUPABASE_URL=${QA_URL}\n`,
  ])
    assert.throws(() => assertQaBindings(contents, now));
  assert.throws(() => assertQaBindings(`SUPABASE_URL=${QA_URL}\n`, Date.parse(QA_EXPIRES_AT)));
});

test("only two source modules change; identity, DB probe and scope guards remain", () => {
  for (const relative of [
    "app/modules/auth/authorization.server.ts",
    "app/routes/admin.login.tsx",
  ]) {
    const original = readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");
    const transformed = transformQaSource(original, `/repo/${relative}`);
    assert.match(transformed, /assertLocalQa\(request, env\)/u);
    assert.match(transformed, /env\.APP_ENV !== "preview"/u);
    assert.match(transformed, /Date\.now\(\) >= Date\.parse/u);
    if (relative.includes("authorization")) {
      assert.match(transformed, /await requireAdminIdentity\(request, env\)/u);
      assert.match(transformed, /callAuthorizationProbe\(auth.client, "is_current_admin_aal2"\)/u);
    } else {
      assert.match(transformed, /signInWithPassword/u);
      assert.match(transformed, /assertSameOrigin\(request\)/u);
      assert.match(transformed, /client.rpc\("is_current_admin"\)/u);
    }
    assert.equal(readFileSync(new URL(`../${relative}`, import.meta.url), "utf8"), original);
  }
  assert.equal(transformQaSource("unchanged", "/repo/app/routes/public.tsx"), null);
  assert.throws(() => transformQaSource("drift", "/repo/app/routes/admin.login.tsx"));
});

test("request middleware refuses remote hosts, remote clients and expired leases", () => {
  let middleware;
  const plugin = qaPreviewPlugin();
  plugin.configureServer({
    middlewares: {
      use(handler) {
        middleware = handler;
      },
    },
  });
  for (const [host, remoteAddress, permitted] of [
    ["127.0.0.1:5173", "127.0.0.1", true],
    ["127.0.0.1:5173", "::ffff:127.0.0.1", true],
    ["remote.example:5173", "127.0.0.1", false],
    ["127.0.0.1:5173", "192.168.0.1", false],
  ]) {
    let next = false;
    let ended = false;
    const response = {
      setHeader() {},
      end() {
        ended = true;
      },
      statusCode: 200,
    };
    middleware({ headers: { host }, socket: { remoteAddress } }, response, () => {
      next = true;
    });
    assert.equal(next, permitted);
    assert.equal(ended, !permitted);
  }
  assert.equal(plugin.apply, "serve");
  assert.throws(() => plugin.configResolved({ command: "build", mode: "production" }));
  const originalNow = Date.now;
  try {
    Date.now = () => Date.parse(QA_EXPIRES_AT);
    let passed = false;
    const response = { setHeader() {}, end() {}, statusCode: 200 };
    middleware(
      { headers: { host: "127.0.0.1:5173" }, socket: { remoteAddress: "127.0.0.1" } },
      response,
      () => {
        passed = true;
      },
    );
    assert.equal(passed, false);
    assert.equal(response.statusCode, 403);
  } finally {
    Date.now = originalNow;
  }
});
