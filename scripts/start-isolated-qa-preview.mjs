import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const QA_URL = "https://payumtvegfqfejmowxiy.supabase.co";
export const QA_ORIGIN = "http://127.0.0.1:5173";
export const QA_EXPIRES_AT = "2026-10-14T15:00:00Z";

export function assertQaBindings(contents, now = Date.now()) {
  const values = [...contents.matchAll(/^SUPABASE_URL=(.+)$/gmu)].map((match) => match[1].trim());
  if (values.length !== 1 || values[0] !== QA_URL) {
    throw new Error("Isolated QA project binding required");
  }
  if (now >= Date.parse(QA_EXPIRES_AT)) throw new Error("QA MFA exception expired");
}

const runtimeGuard = `
function assertLocalQa(request: Request, env: Env): void {
  if (new URL(request.url).origin !== ${JSON.stringify(QA_ORIGIN)} ||
      env.SUPABASE_URL !== ${JSON.stringify(QA_URL)} || env.APP_ENV !== "preview" ||
      Date.now() >= Date.parse(${JSON.stringify(QA_EXPIRES_AT)})) {
    throw new Response("Local QA exception unavailable", { status: 403 });
  }
}
`;

function replaceOnce(code, from, to) {
  if (code.split(from).length !== 2) throw new Error("QA overlay source drift");
  return code.replace(from, to);
}

export function transformQaSource(code, id) {
  const path = id.replaceAll("\\", "/").split("?")[0];
  if (path.endsWith("/app/modules/auth/authorization.server.ts")) {
    const marker = "export async function requireAdminAal2(";
    if (code.split(marker).length !== 2) throw new Error("QA authorization source drift");
    const prefix = code.slice(0, code.indexOf(marker));
    return `${prefix}${runtimeGuard}
export async function requireAdminAal2(request: Request, env: Env): Promise<AuthenticatedRequest> {
  assertLocalQa(request, env);
  const auth = await requireAdminIdentity(request, env);
  if (!(await callAuthorizationProbe(auth.client, "is_current_admin_aal2"))) loginRedirect();
  return auth;
}
`;
  }
  if (path.endsWith("/app/routes/admin.login.tsx")) {
    let result = replaceOnce(
      code,
      "const { env } = context.get(cloudflareContext);",
      "const { env } = context.get(cloudflareContext);\n  assertLocalQa(request, env);",
    );
    result = replaceOnce(
      result,
      'throw redirect(hasVerifiedTotp ? "/admin/mfa" : "/admin/mfa/enroll", {',
      'throw redirect("/admin", {',
    );
    return result + runtimeGuard;
  }
  return null;
}

export function qaPreviewPlugin() {
  return {
    name: "isolated-qa-local-aal1-only",
    apply: "serve",
    enforce: "pre",
    configResolved(config) {
      if (config.command !== "serve" || config.mode !== "development") {
        throw new Error("QA overlay is development-only");
      }
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (
          request.headers.host !== "127.0.0.1:5173" ||
          !["127.0.0.1", "::ffff:127.0.0.1"].includes(request.socket.remoteAddress) ||
          Date.now() >= Date.parse(QA_EXPIRES_AT)
        ) {
          response.statusCode = 403;
          response.end("Local QA exception unavailable");
          return;
        }
        response.setHeader("X-BDB-QA-MFA-Exception-Until", QA_EXPIRES_AT);
        next();
      });
    },
    transform(code, id) {
      const result = transformQaSource(code, id);
      return result === null ? null : { code: result, map: null };
    },
  };
}

async function start() {
  if (process.argv.slice(2).join(" ") !== "--allow-qa-aal1") {
    throw new Error("Explicit --allow-qa-aal1 required; no other options accepted");
  }
  if (process.env.CLOUDFLARE_ENV && process.env.CLOUDFLARE_ENV !== "preview") {
    throw new Error("Production environment prohibited");
  }
  const root = fileURLToPath(new URL("../", import.meta.url));
  assertQaBindings(readFileSync(resolve(root, ".dev.vars"), "utf8"));
  process.env.CLOUDFLARE_ENV = "preview";
  const { createServer } = await import("vite");
  const server = await createServer({
    root,
    configFile: resolve(root, "vite.config.ts"),
    mode: "development",
    plugins: [qaPreviewPlugin()],
    server: { host: "127.0.0.1", port: 5173, strictPort: true, cors: { origin: QA_ORIGIN } },
  });
  await server.listen();
  console.log(`QA local only: ${QA_ORIGIN}; MFA exception expires ${QA_EXPIRES_AT}`);
  const expiry = setTimeout(() => server.close(), Date.parse(QA_EXPIRES_AT) - Date.now());
  expiry.unref();
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, async () => {
      clearTimeout(expiry);
      await server.close();
      process.exit(0);
    });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await start();
