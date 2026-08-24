import { writeFileSync } from "node:fs";
import { isAbsolute } from "node:path";

const outputPath = process.argv[2];
const names = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SESSION_SECRET"];

if (!outputPath || !isAbsolute(outputPath)) {
  throw new Error("The runtime secret output must be an absolute temporary path.");
}

const missing = names.filter((name) => !process.env[name]);
if (missing.length > 0) {
  throw new Error(`Missing required Worker bindings: ${missing.join(", ")}`);
}

const url = new URL(process.env.SUPABASE_URL);
if (url.protocol !== "https:") {
  throw new Error("SUPABASE_URL must use HTTPS.");
}

if (Buffer.from(process.env.SESSION_SECRET, "base64url").byteLength !== 32) {
  throw new Error("SESSION_SECRET must contain exactly 32 base64url-encoded random bytes.");
}

const values = Object.fromEntries(names.map((name) => [name, process.env[name]]));
writeFileSync(outputPath, JSON.stringify(values), { encoding: "utf8", mode: 0o600 });
console.log(`Prepared ${names.length} encrypted runtime bindings for deployment.`);
