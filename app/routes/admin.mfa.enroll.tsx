import { data, Form, redirect, useNavigation } from "react-router";

import type { Route } from "./+types/admin.mfa.enroll";
import { cloudflareContext, correlationIdContext } from "../context";
import { recordAuthAuditEvent } from "../modules/auth/audit.server";
import { requireAdminIdentity } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";
import {
  createSessionCookie,
  sealSession,
  sessionFromSupabase,
} from "../modules/auth/session.server";

type EnrollmentActionData = {
  csrfToken?: string;
  error?: string;
  factorId?: string;
  qrCode?: string;
  secret?: string;
};

function isTotpCode(value: FormDataEntryValue | null): value is string {
  return typeof value === "string" && /^\d{6}$/u.test(value);
}

export function meta() {
  return [{ title: "Configurar MFA — Base do Basquete" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const auth = await requireAdminIdentity(request, env);
  const { data: assurance } = await auth.client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel === "aal2") throw redirect("/admin");

  const { data: factors, error } = await auth.client.auth.mfa.listFactors();
  if (error) throw new Response("Segundo fator indisponível", { status: 503 });
  if (factors.totp.some((factor) => factor.status === "verified")) throw redirect("/admin/mfa");

  return data(
    { csrfToken: auth.payload.csrfToken },
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
  const intent = formData.get("intent");

  if (intent === "start") {
    const { data: enrollment, error } = await auth.client.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Base do Basquete",
    });
    if (error || enrollment.type !== "totp") {
      return data({ error: "Não foi possível iniciar a configuração." }, { status: 503 });
    }

    return data<EnrollmentActionData>({
      csrfToken: auth.payload.csrfToken,
      factorId: enrollment.id,
      qrCode: enrollment.totp.qr_code,
      secret: enrollment.totp.secret,
    });
  }

  if (intent !== "verify") return data({ error: "Ação inválida." }, { status: 400 });
  const factorId = formData.get("factorId");
  const code = formData.get("code");
  if (typeof factorId !== "string" || factorId.length > 100 || !isTotpCode(code)) {
    return data<EnrollmentActionData>(
      {
        csrfToken: auth.payload.csrfToken,
        error: "Informe o código de seis dígitos.",
        factorId: typeof factorId === "string" ? factorId : undefined,
      },
      { status: 400 },
    );
  }

  const { error: verifyError } = await auth.client.auth.mfa.challengeAndVerify({ factorId, code });
  if (verifyError) {
    return data<EnrollmentActionData>(
      {
        csrfToken: auth.payload.csrfToken,
        error: "Código inválido ou expirado.",
        factorId,
      },
      { status: 400 },
    );
  }

  const { data: sessionData, error: sessionError } = await auth.client.auth.getSession();
  if (sessionError || !sessionData.session)
    throw new Response("Sessão indisponível", { status: 503 });
  const payload = sessionFromSupabase(sessionData.session, auth.payload.csrfToken);
  const cookie = createSessionCookie(await sealSession(payload, env.SESSION_SECRET));
  await recordAuthAuditEvent(auth.client, "mfa_verified", correlationId);

  throw redirect("/admin", { headers: { "Set-Cookie": cookie } });
}

export default function AdminMfaEnroll({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const enrollment = actionData as EnrollmentActionData | undefined;
  const csrfToken = enrollment?.csrfToken ?? loaderData.csrfToken;
  const canVerify = Boolean(enrollment?.factorId);

  return (
    <main className="auth-shell">
      <section className="auth-card auth-card-wide" aria-labelledby="enroll-title">
        <p className="eyebrow">Proteção obrigatória</p>
        <h1 id="enroll-title">Configure o segundo fator</h1>
        <p className="auth-intro">
          Use um aplicativo autenticador. A área administrativa permanecerá bloqueada até a
          confirmação.
        </p>
        {enrollment?.error ? (
          <p className="form-error" role="alert">
            {enrollment.error}
          </p>
        ) : null}

        {!canVerify ? (
          <Form method="post" className="auth-form">
            <input type="hidden" name="csrfToken" value={csrfToken} />
            <input type="hidden" name="intent" value="start" />
            <button
              className="button button-primary"
              type="submit"
              disabled={navigation.state === "submitting"}
            >
              {navigation.state === "submitting" ? "Preparando…" : "Gerar código de configuração"}
            </button>
          </Form>
        ) : (
          <div className="mfa-enrollment">
            {enrollment?.qrCode ? (
              <img
                className="mfa-qr"
                src={enrollment.qrCode}
                alt="QR code para configurar o autenticador"
              />
            ) : null}
            {enrollment?.secret ? (
              <p className="mfa-secret">
                Chave manual: <code>{enrollment.secret}</code>
              </p>
            ) : (
              <p className="auth-note">Use a configuração já salva no aplicativo autenticador.</p>
            )}
            <Form method="post" className="auth-form">
              <input type="hidden" name="csrfToken" value={csrfToken} />
              <input type="hidden" name="intent" value="verify" />
              <input type="hidden" name="factorId" value={enrollment?.factorId} />
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
                {navigation.state === "submitting" ? "Confirmando…" : "Ativar MFA"}
              </button>
            </Form>
          </div>
        )}
      </section>
    </main>
  );
}
