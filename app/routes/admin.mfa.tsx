import { data, Form, redirect, useNavigation } from "react-router";

import type { Route } from "./+types/admin.mfa";
import { cloudflareContext, correlationIdContext } from "../context";
import { recordAuthAuditEvent } from "../modules/auth/audit.server";
import { requireAdminIdentity } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";
import {
  createSessionCookie,
  sealSession,
  sessionFromSupabase,
} from "../modules/auth/session.server";

function isTotpCode(value: FormDataEntryValue | null): value is string {
  return typeof value === "string" && /^\d{6}$/u.test(value);
}

export function meta() {
  return [{ title: "Segundo fator — Base do Basquete" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const auth = await requireAdminIdentity(request, env);
  const { data: assurance, error: assuranceError } =
    await auth.client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError) throw new Response("Segundo fator indisponível", { status: 503 });
  if (assurance.currentLevel === "aal2") throw redirect("/admin");

  const { data: factors, error: factorsError } = await auth.client.auth.mfa.listFactors();
  if (factorsError) throw new Response("Segundo fator indisponível", { status: 503 });
  const factor = factors.totp.find((candidate) => candidate.status === "verified");
  if (!factor) throw redirect("/admin/mfa/enroll");

  return data(
    { csrfToken: auth.payload.csrfToken, factorId: factor.id },
    { headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
  );
}

export async function action({ request, context }: Route.ActionArgs) {
  assertSameOrigin(request);
  const { env } = context.get(cloudflareContext);
  const correlationId = context.get(correlationIdContext);
  const auth = await requireAdminIdentity(request, env);
  const formData = await request.formData();
  assertCsrfToken(formData, auth.payload.csrfToken);
  const factorId = formData.get("factorId");
  const code = formData.get("code");

  if (typeof factorId !== "string" || factorId.length > 100 || !isTotpCode(code)) {
    return data({ error: "Informe o código de seis dígitos." }, { status: 400 });
  }

  const { error: verifyError } = await auth.client.auth.mfa.challengeAndVerify({ factorId, code });
  if (verifyError) return data({ error: "Código inválido ou expirado." }, { status: 400 });

  const { data: sessionData, error: sessionError } = await auth.client.auth.getSession();
  if (sessionError || !sessionData.session)
    throw new Response("Sessão indisponível", { status: 503 });

  const payload = sessionFromSupabase(sessionData.session, auth.payload.csrfToken);
  const cookie = createSessionCookie(await sealSession(payload, env.SESSION_SECRET));
  await recordAuthAuditEvent(auth.client, "mfa_verified", correlationId);

  throw redirect("/admin", { headers: { "Set-Cookie": cookie } });
}

export default function AdminMfa({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="mfa-title">
        <p className="eyebrow">Segunda etapa</p>
        <h1 id="mfa-title">Confirme o autenticador</h1>
        <p className="auth-intro">Digite o código atual do aplicativo autenticador.</p>
        {actionData?.error ? (
          <p className="form-error" role="alert">
            {actionData.error}
          </p>
        ) : null}
        <Form method="post" className="auth-form">
          <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
          <input type="hidden" name="factorId" value={loaderData.factorId} />
          <label>
            Código de seis dígitos
            <input
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
            />
          </label>
          <button
            className="button button-primary"
            type="submit"
            disabled={navigation.state === "submitting"}
          >
            {navigation.state === "submitting" ? "Confirmando…" : "Confirmar acesso"}
          </button>
        </Form>
      </section>
    </main>
  );
}
