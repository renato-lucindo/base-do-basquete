import { data, Form } from "react-router";

import type { Route } from "./+types/admin._index";
import { cloudflareContext, correlationIdContext } from "../context";
import { recordAuthAuditEvent } from "../modules/auth/audit.server";
import { requireAdminAal2 } from "../modules/auth/authorization.server";

export function meta() {
  return [{ title: "Administração — Base do Basquete" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const correlationId = context.get(correlationIdContext);
  const auth = await requireAdminAal2(request, env);
  await recordAuthAuditEvent(auth.client, "admin_access", correlationId);

  return data(
    { csrfToken: auth.payload.csrfToken },
    { headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
  );
}

export default function AdminDashboard({ loaderData }: Route.ComponentProps) {
  return (
    <main className="admin-shell">
      <header className="site-header admin-header">
        <a className="brand" href="/" aria-label="Base do Basquete — página inicial">
          <span className="brand-mark" aria-hidden="true">
            BB
          </span>
          <span>Base do Basquete</span>
        </a>
        <span className="environment-pill">
          <span className="status-dot" />
          Sessão aal2
        </span>
      </header>
      <section className="admin-welcome" aria-labelledby="admin-title">
        <p className="eyebrow">Administração segura</p>
        <h1 id="admin-title">Acesso confirmado.</h1>
        <p>
          A identidade da conta única, o segundo fator e a autorização no banco foram validados no
          servidor.
        </p>
        <div className="admin-status-grid">
          <article>
            <span>Identidade</span>
            <strong>Conta única</strong>
          </article>
          <article>
            <span>Garantia</span>
            <strong>AAL2</strong>
          </article>
          <article>
            <span>Persistência</span>
            <strong>RLS ativa</strong>
          </article>
        </div>
        <Form method="post" action="/admin/logout">
          <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
          <button className="button button-ghost" type="submit">
            Encerrar todas as sessões
          </button>
        </Form>
      </section>
    </main>
  );
}
