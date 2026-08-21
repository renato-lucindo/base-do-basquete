import { redirect } from "react-router";

import type { Route } from "./+types/admin.logout";
import { cloudflareContext, correlationIdContext } from "../context";
import { logAuthEvent, recordAuthAuditEvent } from "../modules/auth/audit.server";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";
import { clearSessionCookie } from "../modules/auth/session.server";

export async function loader() {
  throw redirect("/admin");
}

export async function action({ request, context }: Route.ActionArgs) {
  assertSameOrigin(request);
  const { env } = context.get(cloudflareContext);
  const correlationId = context.get(correlationIdContext);
  const auth = await requireAdminAal2(request, env);
  const formData = await request.formData();
  assertCsrfToken(formData, auth.payload.csrfToken);

  await recordAuthAuditEvent(auth.client, "logout", correlationId);
  await auth.client.auth.signOut({ scope: "global" });
  logAuthEvent(correlationId, "auth.logout", "success");

  throw redirect("/admin/login", {
    headers: { "Set-Cookie": clearSessionCookie() },
  });
}

export default function AdminLogout() {
  return null;
}
