import { data, Form, redirect, useNavigation } from "react-router";

import type { Route } from "./+types/admin.login";
import { cloudflareContext, correlationIdContext } from "../context";
import { logAuthEvent } from "../modules/auth/audit.server";
import { assertSameOrigin } from "../modules/auth/csrf.server";
import { usesPreviewPasswordAuth } from "../modules/auth/preview-password.server";
import {
  createSessionCookie,
  sealSession,
  sessionFromSupabase,
} from "../modules/auth/session.server";
import { createAnonymousSupabaseClient } from "../modules/auth/supabase.server";

const genericLoginError = "Não foi possível autenticar com as credenciais informadas.";

export function meta() {
  return [{ title: "Acesso administrativo — Base do Basquete" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  return data(
    { passwordOnlyPreview: usesPreviewPasswordAuth(env) },
    {
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

export async function action({ request, context }: Route.ActionArgs) {
  assertSameOrigin(request);
  const { env } = context.get(cloudflareContext);
  const passwordOnlyPreview = usesPreviewPasswordAuth(env);
  const correlationId = context.get(correlationIdContext);
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    email.length > 254 ||
    password.length > 1024 ||
    !email.includes("@") ||
    password.length < 8
  ) {
    logAuthEvent(correlationId, "auth.login", "blocked");
    return data({ error: genericLoginError }, { status: 400 });
  }

  const client = createAnonymousSupabaseClient(env);
  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !signInData.session) {
    logAuthEvent(correlationId, "auth.login", "failure");
    return data({ error: genericLoginError }, { status: 400 });
  }

  const { data: isAdmin, error: authorizationError } = await client.rpc("is_current_admin");
  if (authorizationError || isAdmin !== true) {
    await client.auth.signOut({ scope: "global" });
    logAuthEvent(correlationId, "auth.login", "blocked");
    return data({ error: genericLoginError }, { status: 400 });
  }

  let destination = "/admin";
  if (passwordOnlyPreview) {
    const { data: allowed, error } = await client.rpc("is_current_admin_aal2");
    if (error || allowed !== true) {
      await client.auth.signOut({ scope: "global" });
      logAuthEvent(correlationId, "auth.login", "blocked");
      return data(
        { error: "O acesso por senha não está habilitado neste preview." },
        { status: 503 },
      );
    }
  } else {
    const { data: factors, error: factorsError } = await client.auth.mfa.listFactors();
    if (factorsError) {
      await client.auth.signOut({ scope: "global" });
      logAuthEvent(correlationId, "auth.login", "failure");
      return data({ error: "O segundo fator não pôde ser consultado." }, { status: 503 });
    }

    const hasVerifiedTotp = factors.totp.some((factor) => factor.status === "verified");
    destination = hasVerifiedTotp ? "/admin/mfa" : "/admin/mfa/enroll";
  }

  const payload = sessionFromSupabase(signInData.session);
  const cookie = createSessionCookie(await sealSession(payload, env.SESSION_SECRET));

  logAuthEvent(correlationId, "auth.login", "success");
  throw redirect(destination, {
    headers: { "Set-Cookie": cookie },
  });
}

export default function AdminLogin({ actionData, loaderData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="login-title">
        <a className="brand auth-brand" href="/" aria-label="Base do Basquete — página inicial">
          <span className="brand-mark" aria-hidden="true">
            B
          </span>
          <span>Base do Basquete</span>
        </a>
        <p className="eyebrow">Área restrita</p>
        <h1 id="login-title">Acesso administrativo</h1>
        <p className="auth-intro">
          {loaderData.passwordOnlyPreview
            ? "Entre com a conta única autorizada usando e-mail e senha."
            : "Entre com a conta única autorizada. O segundo fator será exigido antes de qualquer acesso."}
        </p>
        {actionData?.error ? (
          <p className="form-error" role="alert">
            {actionData.error}
          </p>
        ) : null}
        <Form method="post" className="auth-form">
          <label>
            E-mail
            <input name="email" type="email" autoComplete="username" maxLength={254} required />
          </label>
          <label>
            Senha
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              minLength={8}
              maxLength={1024}
              required
            />
          </label>
          <button className="button button-primary" type="submit" disabled={submitting}>
            {submitting ? "Verificando…" : "Continuar"}
          </button>
        </Form>
        <p className="auth-note">Cadastro público e recuperação autônoma não estão disponíveis.</p>
      </section>
    </main>
  );
}
