import { useEffect, useRef } from "react";
import { data, Form, Link, redirect } from "react-router";

import {
  PlayerEligibilitySexField,
  type PlayerEligibilitySex,
} from "../components/admin/player-private-fields";
import { cloudflareContext, correlationIdContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";
import { logOperationalEvent } from "../modules/observability/operation.server";
import type { Route } from "./+types/admin.players.$playerId.private-profile";

function parseId(value: string | null | undefined): number | null {
  return value && /^[1-9][0-9]*$/.test(value) ? Number(value) : null;
}

function headers(cookie: string | null | undefined) {
  return {
    "Cache-Control": "private, no-store",
    ...(cookie ? { "Set-Cookie": cookie } : {}),
  };
}

export function meta() {
  return [{ title: "Cadastro privado do atleta — Base do Basquete" }];
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const playerId = parseId(params.playerId);
  if (!playerId) throw new Response("Atleta não encontrado", { status: 404 });
  const { env } = context.get(cloudflareContext);
  const auth = await requireAdminAal2(request, env);
  const result = await auth.client.rpc("admin_get_player_private_profile", {
    p_player_id: playerId,
  });
  if (result.error) {
    if (result.error.code === "BD404") {
      throw new Response("Atleta não encontrado", { status: 404 });
    }
    throw new Error("Private player profile query failed");
  }
  const profile = result.data[0];
  if (!profile) throw new Response("Atleta não encontrado", { status: 404 });
  const privateValue: PlayerEligibilitySex | null =
    profile.sex === "male" || profile.sex === "female" ? profile.sex : null;
  if (profile.sex !== null && privateValue === null) {
    throw new Error("Private player profile has an invalid eligibility value");
  }

  return data(
    {
      csrfToken: auth.payload.csrfToken,
      saved: new URL(request.url).searchParams.get("saved") === "profile",
      profile: {
        playerId: profile.player_id,
        fullName: profile.full_name,
        sex: privateValue,
        eligibilityPending: profile.eligibility_pending,
        impact: {
          rosterEntries: profile.roster_entries,
          activeRosterEntries: profile.active_roster_entries,
          competitions: profile.affected_competitions,
        },
      },
    },
    { headers: headers(auth.cookie) },
  );
}

export async function action({ request, params, context }: Route.ActionArgs) {
  assertSameOrigin(request);
  const playerId = parseId(params.playerId);
  if (!playerId) throw new Response("Atleta não encontrado", { status: 404 });
  const { env } = context.get(cloudflareContext);
  const correlationId = context.get(correlationIdContext);
  const startedAt = Date.now();
  const auth = await requireAdminAal2(request, env);
  const formData = await request.formData();
  assertCsrfToken(formData, auth.payload.csrfToken);
  const sex = String(formData.get("sex") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if ((sex !== "male" && sex !== "female") || reason.length < 10 || reason.length > 500) {
    return data(
      {
        error:
          "Selecione explicitamente o valor e informe uma justificativa de 10 a 500 caracteres.",
      },
      { status: 400, headers: headers(auth.cookie) },
    );
  }

  const result = await auth.client.rpc("admin_set_player_sex", {
    p_player_id: playerId,
    p_sex: sex,
    p_reason: reason,
  });
  if (result.error) {
    const status = result.error.code === "BD401" ? 403 : result.error.code === "BD404" ? 404 : 400;
    logOperationalEvent({
      correlationId,
      durationMs: Date.now() - startedAt,
      operation: "player.private_profile",
      outcome: status === 403 ? "blocked" : "failure",
      status,
      context: { entityId: playerId, errorCode: result.error.code },
    });
    return data(
      {
        error:
          status === 404 ? "Atleta não encontrado." : "Não foi possível salvar o cadastro privado.",
      },
      { status, headers: headers(auth.cookie) },
    );
  }

  logOperationalEvent({
    correlationId,
    durationMs: Date.now() - startedAt,
    operation: "player.private_profile",
    outcome: "success",
    status: 303,
    context: { entityId: playerId },
  });
  throw redirect(`/admin/players/${playerId}/private-profile?saved=profile`, {
    headers: headers(auth.cookie),
  });
}

export default function PlayerPrivateProfile({ loaderData, actionData }: Route.ComponentProps) {
  const { profile } = loaderData;
  const privateValueRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (actionData?.error) privateValueRef.current?.focus();
  }, [actionData?.error]);
  return (
    <main className="admin-shell">
      <header className="site-header admin-header">
        <Link className="brand" to="/admin">
          <span className="brand-mark">B</span>
          <span>Administração</span>
        </Link>
        <span className="environment-pill">
          <span className="status-dot" />
          AAL2
        </span>
      </header>
      <section className="admin-welcome admin-private-profile" aria-labelledby="private-title">
        <p className="eyebrow">Formulário administrativo protegido</p>
        <h1 id="private-title">{profile.fullName}</h1>
        <p>
          Este valor é usado somente para elegibilidade esportiva. Não será publicado, sugerido ou
          incluído em buscas e rascunhos.
        </p>
        {loaderData.saved ? (
          <output className="form-success">Cadastro privado atualizado e auditado.</output>
        ) : null}
        {actionData?.error ? (
          <p className="form-error" id="private-profile-error" role="alert">
            {actionData.error}
          </p>
        ) : null}

        <section className="admin-panel private-impact" aria-labelledby="impact-title">
          <h2 id="impact-title">Prévia do impacto</h2>
          <p>O histórico não será removido nem reescrito.</p>
          <dl>
            <div>
              <dt>Inscrições no histórico</dt>
              <dd>{profile.impact.rosterEntries}</dd>
            </div>
            <div>
              <dt>Inscrições ativas</dt>
              <dd>{profile.impact.activeRosterEntries}</dd>
            </div>
            <div>
              <dt>Edições afetadas</dt>
              <dd>{profile.impact.competitions}</dd>
            </div>
          </dl>
        </section>

        <Form method="post" className="compact-admin-form private-profile-form">
          <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
          <PlayerEligibilitySexField
            currentValue={profile.sex}
            errorId={actionData?.error ? "private-profile-error" : undefined}
            inputRef={privateValueRef}
          />
          <label>
            Justificativa da revisão
            <textarea
              name="reason"
              minLength={10}
              maxLength={500}
              required
              aria-describedby="reason-help"
            />
            <small id="reason-help">
              A justificativa e a prévia de impacto serão auditadas; os valores anterior e novo não.
            </small>
          </label>
          <button className="button button-primary" type="submit">
            Salvar cadastro privado
          </button>
        </Form>
      </section>
    </main>
  );
}
