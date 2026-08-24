import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [expectedEnvironment, expectedName] = process.argv.slice(2);

assert.ok(expectedEnvironment, "expected Cloudflare environment is required");
assert.ok(expectedName, "expected Worker name is required");

const buildConfig = JSON.parse(
  await readFile(new URL("../build/server/wrangler.json", import.meta.url), "utf8"),
);

assert.equal(
  buildConfig.targetEnvironment,
  expectedEnvironment,
  "build did not select the expected Cloudflare environment",
);
assert.equal(buildConfig.name, expectedName, "build selected the wrong Worker");
assert.equal(
  buildConfig.vars?.APP_ENV,
  expectedEnvironment,
  "build selected the wrong runtime APP_ENV",
);

console.log(`Worker build targets ${expectedName} (${expectedEnvironment}) as expected.`);
