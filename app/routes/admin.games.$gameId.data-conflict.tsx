import { data, Form, Link, redirect } from "react-router";
import { cloudflareContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";
import type { Route } from "./+types/admin.games.$gameId.data-conflict";

interface ConflictDomain {
  comparisonId: number;
  domain: string;
  result: "conflict" | "matching";
  status: "matching" | "pending" | "resolved";
  baseSubmissionId: number;
  candidateSubmissionId: number;
  base: unknown;
  candidate: unknown;
}

interface ConflictPayload {
  gameId: number;
  pendingCount: number;
  domains: ConflictDomain[];
  resolvedDecision?: "keep_fallback" | "use_fiba" | null;
}

const domainLabels: Record<string, string> = {
  official_result: "Resultado oficial",
  participation: "Participação",
  period_scores: "Parciais por período",
  player_foul_total: "Total de faltas",
  player_scoring: "Pontuação dos atletas",
};

function parseId(value: string | FormDataEntryValue | null): number | null {
  const text = typeof value === "string" ? value : "";
  return /^[1-9][0-9]*$/.test(text) ? Number(text) : null;
}

function parseConflictPayload(value: unknown): ConflictPayload {
  if (!value || typeof value !== "object") {
    return { gameId: 0, pendingCount: 0, domains: [] };
  }
  const candidate = value as Partial<ConflictPayload>;
  return {
    gameId: typeof candidate.gameId === "number" ? candidate.gameId : 0,
    pendingCount: typeof candidate.pendingCount === "number" ? candidate.pendingCount : 0,
    domains: Array.isArray(candidate.domains) ? candidate.domains : [],
    resolvedDecision: candidate.resolvedDecision ?? null,
  };
}

function mapResolutionError(code: string | undefined): { message: string; status: number } {
  switch (code) {
    case "BD401":
      return { message: "Confirme novamente o segundo fator.", status: 403 };
    case "BD704":
      return { message: "A autoridade mudou. Recarregue antes de decidir.", status: 409 };
    case "BD705":
    case "BD715":
      return { message: "Informe um motivo entre 10 e 500 caracteres.", status: 400 };
    case "BD719":
      return {
        message: "Os elencos divergem e não permitem promoção automática. Mantenha o fallback.",
        status: 409,
      };
    case "BD720":
      return { message: "Selecione uma decisão válida.", status: 400 };
    default:
      return { message: "Não foi possível registrar a decisão de fonte.", status: 400 };
  }
}

export function meta() {
  return [{ title: "Conciliação de fontes — Base do Basquete" }];
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const gameId = parseId(params.gameId);
  if (!gameId) throw new Response("Jogo não encontrado", { status: 404 });
  const { env } = context.get(cloudflareContext);
  const auth = await requireAdminAal2(request, env);
  const [gameResult, conflictResult, fallbackResult] = await Promise.all([
    auth.client.from("games").select("id,game_number,competition_id").eq("id", gameId).single(),
    auth.client.rpc("admin_get_game_data_conflict", { p_game_id: gameId }),
    auth.client
      .from("game_data_submissions")
      .select("id,fallback_finalized_at")
      .eq("game_id", gameId)
      .eq("source_type", "manual_scoresheet")
      .eq("role", "fallback")
      .eq("status", "active")
      .order("submission_version", { ascending: false })
      .limit(1),
  ]);
  if (gameResult.error) throw new Response("Jogo não encontrado", { status: 404 });
  if (conflictResult.error || fallbackResult.error) {
    throw new Error("Game data conflict query failed");
  }
  const competition = await auth.client
    .from("competitions")
    .select("id,display_name")
    .eq("id", gameResult.data.competition_id)
    .single();
  if (competition.error) throw new Error("Competition query failed");

  return data(
    {
      competition: competition.data,
      csrfToken: auth.payload.csrfToken,
      game: gameResult.data,
      conflict: parseConflictPayload(conflictResult.data),
      fallback: fallbackResult.data[0] ?? null,
      resolved: new URL(request.url).searchParams.get("resolved"),
    },
    { headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
  );
}

export async function action({ request, params, context }: Route.ActionArgs) {
  assertSameOrigin(request);
  const gameId = parseId(params.gameId);
  if (!gameId) throw new Response("Jogo não encontrado", { status: 404 });
  const { env } = context.get(cloudflareContext);
  const auth = await requireAdminAal2(request, env);
  const formData = await request.formData();
  assertCsrfToken(formData, auth.payload.csrfToken);
  const intent = String(formData.get("intent") ?? "resolveConflict");
  const reason = String(formData.get("reason") ?? "").trim();
  if (intent === "finalizeFallback") {
    const submissionId = parseId(formData.get("submissionId"));
    if (!submissionId || formData.get("confirmDecision") !== "yes") {
      return data({ error: "Confirme explicitamente a decisão." }, { status: 400 });
    }
    const finalized = await auth.client.rpc("admin_finalize_manual_fallback", {
      p_game_id: gameId,
      p_submission_id: submissionId,
      p_reason: reason,
    });
    if (finalized.error) {
      const mapped = mapResolutionError(finalized.error.code);
      return data({ error: mapped.message }, { status: mapped.status });
    }
    throw redirect(`/admin/games/${gameId}/data-conflict?resolved=finalized`, {
      headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined,
    });
  }
  const candidateSubmissionId = parseId(formData.get("candidateSubmissionId"));
  const decision = String(formData.get("decision") ?? "");
  if (!candidateSubmissionId || formData.get("confirmDecision") !== "yes") {
    return data({ error: "Confirme explicitamente a decisão." }, { status: 400 });
  }

  const result = await auth.client.rpc("admin_resolve_game_data_conflict", {
    p_game_id: gameId,
    p_candidate_submission_id: candidateSubmissionId,
    p_decision: decision,
    p_reason: reason,
  });
  if (result.error) {
    const mapped = mapResolutionError(result.error.code);
    return data({ error: mapped.message }, { status: mapped.status });
  }
  throw redirect(`/admin/games/${gameId}/data-conflict?resolved=${decision}`, {
    headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined,
  });
}

export default function GameDataConflict({ loaderData, actionData }: Route.ComponentProps) {
  const { conflict } = loaderData;
  const candidateSubmissionId = conflict.domains[0]?.candidateSubmissionId ?? null;
  const conflicts = conflict.domains.filter((item) => item.result === "conflict");
  const matching = conflict.domains.filter((item) => item.result === "matching");
  const hasResolution = Boolean(loaderData.resolved || conflict.resolvedDecision);

  return (
    <main className="admin-shell">
      <header className="site-header admin-header">
        <Link className="brand" to={`/admin/competitions/${loaderData.competition.id}`}>
          <span className="brand-mark">B</span>
          <span>Administração</span>
        </Link>
        <span className="environment-pill">
          <span className="status-dot" />
          AAL2
        </span>
      </header>

      <section className="admin-welcome admin-hub">
        <p className="eyebrow">Conciliação de fontes</p>
        <h1>Jogo {loaderData.game.game_number ?? `#${loaderData.game.id}`}</h1>
        <p>
          {loaderData.competition.display_name}. Compare a súmula emergencial com o boxscore PDF
          posterior antes de alterar a autoridade dos dados.
        </p>

        {actionData?.error ? (
          <p className="form-error" role="alert">
            {actionData.error}
          </p>
        ) : null}
        {hasResolution ? (
          <output className="form-success">Decisão registrada e auditada.</output>
        ) : null}

        <section className="admin-panel">
          <h2>Resumo da comparação</h2>
          <p>
            {matching.length} domínio(s) coincidente(s) e {conflicts.length} divergente(s). Nenhum
            dado público muda até uma nova publicação da edição.
          </p>
        </section>

        {!conflict.domains.length && loaderData.fallback ? (
          <section className="admin-panel">
            <p className="eyebrow">Fonte principal pendente</p>
            <h2>Fallback manual ativo</h2>
            {loaderData.fallback.fallback_finalized_at ? (
              <p>O fallback já foi encerrado por decisão administrativa auditada.</p>
            ) : (
              <Form method="post" className="admin-form">
                <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
                <input type="hidden" name="intent" value="finalizeFallback" />
                <input type="hidden" name="submissionId" value={loaderData.fallback.id} />
                <p>
                  Use somente quando o boxscore PDF definitivo não chegar. A cobertura avançada
                  continuará explicitamente indisponível.
                </p>
                <label>
                  Motivo do encerramento
                  <textarea name="reason" minLength={10} maxLength={500} required rows={4} />
                </label>
                <label>
                  <input type="checkbox" name="confirmDecision" value="yes" required />
                  Confirmo o encerramento definitivo deste fallback.
                </label>
                <button className="button button-primary" type="submit">
                  Encerrar com fallback
                </button>
              </Form>
            )}
          </section>
        ) : null}

        {conflict.domains.map((item) => (
          <section className="admin-panel" key={item.comparisonId}>
            <p className="eyebrow">{item.result === "matching" ? "Coincidente" : "Divergente"}</p>
            <h2>{domainLabels[item.domain] ?? item.domain}</h2>
            <div className="stats-grid">
              <article>
                <h3>Súmula emergencial atual</h3>
                <pre>{JSON.stringify(item.base, null, 2)}</pre>
              </article>
              <article>
                <h3>Boxscore PDF candidato</h3>
                <pre>{JSON.stringify(item.candidate, null, 2)}</pre>
              </article>
              <article>
                <h3>Impacto</h3>
                <p>
                  {item.result === "matching"
                    ? "A promoção mantém os valores e adiciona a proveniência do boxscore."
                    : "A escolha altera este domínio; a decisão ficará no histórico de auditoria."}
                </p>
              </article>
            </div>
          </section>
        ))}

        {candidateSubmissionId && !hasResolution ? (
          <section className="admin-panel">
            <h2>Decisão administrativa</h2>
            <Form method="post" className="admin-form">
              <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
              <input type="hidden" name="intent" value="resolveConflict" />
              <input type="hidden" name="candidateSubmissionId" value={candidateSubmissionId} />
              <fieldset>
                <legend>Fonte escolhida</legend>
                <label>
                  <input type="radio" name="decision" value="keep_fallback" required />
                  Manter a súmula emergencial
                </label>
                <label>
                  <input type="radio" name="decision" value="use_fiba" required />
                  Promover o boxscore PDF nos domínios compatíveis
                </label>
              </fieldset>
              <label>
                Motivo da decisão
                <textarea name="reason" minLength={10} maxLength={500} required rows={4} />
              </label>
              <label>
                <input type="checkbox" name="confirmDecision" value="yes" required />
                Confirmo o impacto e a preservação das duas evidências no histórico.
              </label>
              <button className="button button-primary" type="submit">
                Registrar decisão
              </button>
            </Form>
          </section>
        ) : null}
      </section>
    </main>
  );
}
