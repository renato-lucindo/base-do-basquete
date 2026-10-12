import { data, Link, type ShouldRevalidateFunctionArgs } from "react-router";
import { cloudflareContext, correlationIdContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";
import { logOperationalEvent } from "../modules/observability/operation.server";
import type { ManualScoresheetV2Payload } from "../modules/scoresheet/domain";
import { loadRevisionRegistrations } from "../modules/scoresheet/revision-context.server";
import { SavedScoresheetSnapshot } from "../modules/scoresheet/saved-snapshot";
import { buildSetupRevision, REVISION_REASON_ERROR } from "../modules/scoresheet/setup-revision";
import { parseScoresheetSetup } from "../modules/scoresheet/setup-state";
import { ManualScoresheetSetupWizard } from "../modules/scoresheet/setup-wizard";
import type { Json } from "../types/database.generated";
import type { Route } from "./+types/admin.games.$gameId.scoresheet";

const domains = [
  "official_result",
  "period_scores",
  "participation",
  "player_scoring",
  "player_foul_total",
  "player_foul_timeline",
];
function id(value: unknown): number | null {
  return typeof value === "string" &&
    /^[1-9][0-9]*$/.test(value) &&
    Number.isSafeInteger(Number(value))
    ? Number(value)
    : null;
}
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const gameId = id(params.gameId);
  if (!gameId) throw new Response("Jogo não encontrado", { status: 404 });
  const auth = await requireAdminAal2(request, context.get(cloudflareContext).env);
  const [game, submissions, authority, revisions] = await Promise.all([
    auth.client.from("games").select("id,competition_id,status,source").eq("id", gameId).single(),
    auth.client
      .from("game_data_submissions")
      .select("id,submission_version,status,submitted_at,submitted_by")
      .eq("game_id", gameId)
      .eq("source_type", "manual_scoresheet")
      .order("submission_version", { ascending: false }),
    auth.client
      .from("game_data_domain_authority")
      .select("domain,submission_id")
      .eq("game_id", gameId)
      .in("domain", domains),
    auth.client
      .from("manual_scoresheet_revisions")
      .select("submission_id,reason,revised_by,revised_at")
      .eq("game_id", gameId),
  ]);
  if (game.error || !game.data) throw new Response("Jogo não encontrado", { status: 404 });
  if (submissions.error || authority.error || revisions.error)
    throw new Error("Scoresheet revision history unavailable");
  const active = submissions.data.find((entry) => entry.status === "active");
  if (!active) throw new Response("Súmula manual ativa indisponível", { status: 404 });
  const selectedId = new URL(request.url).searchParams.get("submission");
  const selected = selectedId
    ? submissions.data.find((entry) => entry.id === id(selectedId))
    : active;
  if (!selected) throw new Response("Versão não encontrada", { status: 404 });
  const [snapshot, competition] = await Promise.all([
    auth.client
      .from("manual_scoresheet_submission_payloads")
      .select("payload,payload_hash")
      .eq("game_id", gameId)
      .eq("submission_id", selected.id)
      .single(),
    auth.client
      .from("competitions")
      .select("display_name,status")
      .eq("id", game.data.competition_id)
      .single(),
  ]);
  if (snapshot.error || !snapshot.data)
    throw new Response("Esta súmula não possui snapshot v2 para revisão.", { status: 404 });
  if (competition.error) throw new Error("Scoresheet competition unavailable");
  const savedPayload = snapshot.data.payload as unknown as ManualScoresheetV2Payload;
  const registrations = await loadRevisionRegistrations(
    auth.client,
    game.data.competition_id,
    savedPayload,
  );
  const editable =
    !selectedId &&
    game.data.status === "final" &&
    game.data.source === "manual" &&
    competition.data.status !== "archived" &&
    domains.every((domain) =>
      authority.data.some((entry) => entry.domain === domain && entry.submission_id === active.id),
    );
  return data(
    {
      competitionId: game.data.competition_id,
      competitionName: competition.data.display_name,
      csrfToken: auth.payload.csrfToken,
      registrations,
      editable,
      base: {
        gameId,
        submissionId: selected.id,
        payloadHash: snapshot.data.payload_hash,
        version: selected.submission_version,
        payload: savedPayload,
      },
      history: submissions.data.map((entry) => {
        const revision = revisions.data.find((item) => item.submission_id === entry.id);
        return {
          ...entry,
          reason: revision?.reason ?? "Criação da súmula",
          author: revision?.revised_by ?? entry.submitted_by,
          at: revision?.revised_at ?? entry.submitted_at,
        };
      }),
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        ...(auth.cookie ? { "Set-Cookie": auth.cookie } : {}),
      },
    },
  );
}

export async function action({ request, params, context }: Route.ActionArgs) {
  assertSameOrigin(request);
  const gameId = id(params.gameId);
  if (!gameId) throw new Response("Jogo não encontrado", { status: 404 });
  const auth = await requireAdminAal2(request, context.get(cloudflareContext).env);
  const form = await request.formData();
  assertCsrfToken(form, auth.payload.csrfToken);
  const fail = (error: string, status = 400) =>
    data({ error }, { status, headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined });
  if (form.get("intent") !== "revise-manual-v2" || form.get("revisionConfirmed") !== "true")
    return fail("Confirme que revisou as alterações antes de gravar.");
  const raw = form.get("setup");
  let decoded: unknown;
  if (typeof raw !== "string" || raw.length > 150_000) return fail("Rascunho inválido.");
  try {
    decoded = JSON.parse(raw);
  } catch {
    return fail("Rascunho inválido.");
  }
  const setup = parseScoresheetSetup(decoded);
  if (!setup) return fail("Rascunho inválido.");
  const reason = setup.revisionReason.trim();
  if (reason.length < 10 || reason.length > 500) return fail(REVISION_REASON_ERROR);
  const submissionId = id(form.get("baseSubmissionId"));
  const hash = form.get("basePayloadHash");
  if (!submissionId || typeof hash !== "string" || !/^[0-9a-f]{32}$/.test(hash))
    return fail("Versão de origem inválida.");
  // Read the posted base, including superseded snapshots, so an identical retry can
  // reach the RPC's idempotency check after a successful response was lost.
  const snapshot = await auth.client
    .from("manual_scoresheet_submission_payloads")
    .select("payload,payload_hash")
    .eq("game_id", gameId)
    .eq("submission_id", submissionId)
    .single();
  if (snapshot.error || !snapshot.data || snapshot.data.payload_hash !== hash)
    return fail("A versão de origem não corresponde ao jogo.", 409);
  const result = buildSetupRevision(setup, {
    gameId,
    submissionId,
    payloadHash: hash,
    version: 0,
    payload: snapshot.data.payload as unknown as ManualScoresheetV2Payload,
  });
  if (!result.payload) return fail(result.issues.join(" "));
  const startedAt = Date.now();
  const saved = await auth.client.rpc("admin_revise_manual_scoresheet_v2", {
    p_payload: {
      ...result.payload,
      gameId,
      revisionKey: setup.submissionKey,
      baseSubmissionId: submissionId,
      basePayloadHash: hash,
      revisionReason: reason,
    } as unknown as Json,
  });
  const status = saved.error
    ? saved.error.code === "BD221" || saved.error.code === "BD704"
      ? 409
      : saved.error.code === "BD401"
        ? 403
        : 400
    : 200;
  logOperationalEvent({
    correlationId: context.get(correlationIdContext),
    operation: "scoresheet.v2.revise",
    outcome: saved.error ? "failure" : "success",
    status,
    durationMs: Date.now() - startedAt,
    context: { entityId: gameId, errorCode: saved.error?.code },
  });
  if (saved.error) {
    const messages: Record<string, string> = {
      BD221:
        "Outra versão foi salva. Seu rascunho foi preservado. Abra a versão ativa em outra aba, compare e reaplique suas alterações antes de tentar novamente.",
      BD704:
        "A autoridade dos dados mudou. Seu rascunho foi preservado; revise a fonte ativa antes de prosseguir.",
      BD209:
        "A chave desta revisão já foi usada com outro conteúdo. Revise os dados antes de reenviar.",
      BD223: "Altere ao menos um dado antes de gravar uma revisão.",
      BD401: "Confirme o segundo fator antes de salvar.",
      BD712: "Mandante, visitante e estrutura da edição devem permanecer os mesmos.",
    };
    return fail(
      messages[saved.error.code] ??
        "Não foi possível gravar. Revise os elencos, períodos, faltas e dados da súmula; seu rascunho foi preservado.",
      status,
    );
  }
  return data(
    { confirmedGameId: saved.data },
    { headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
  );
}

export function shouldRevalidate({
  actionResult,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  // Keep the operator's base and draft mounted for success, retry and CAS conflict.
  return actionResult ? false : defaultShouldRevalidate;
}

export default function SavedScoresheetRoute({ loaderData }: Route.ComponentProps) {
  const { base } = loaderData;
  return (
    <>
      <nav className="admin-shell" aria-label="Navegação da súmula">
        <Link to={`/admin/competitions/${loaderData.competitionId}`}>Voltar à edição</Link>
        {" · "}
        <Link to={`/admin/games/${base.gameId}/scoresheet`}>Abrir versão ativa</Link>
        {" · "}
        <a href={`/admin/games/${base.gameId}/scoresheet`} target="_blank" rel="noreferrer">
          Consultar versão ativa em outra aba
        </a>
      </nav>
      {loaderData.editable ? (
        <ManualScoresheetSetupWizard
          competitionId={loaderData.competitionId}
          competitionName={loaderData.competitionName}
          registrations={loaderData.registrations}
          hasExistingGames={false}
          csrfToken={loaderData.csrfToken}
          revision={base}
        />
      ) : (
        <main className="admin-shell">
          <h1>
            Súmula do jogo #{base.gameId} — versão {base.version}
          </h1>
          <p>
            Consulta somente. Para editar, abra a versão ativa com todos os domínios sob autoridade
            da súmula manual.
          </p>
          <SavedScoresheetSnapshot
            payload={base.payload}
            registrations={loaderData.registrations}
          />
        </main>
      )}
      <section className="admin-shell" aria-labelledby="scoresheet-history-heading">
        <h2 id="scoresheet-history-heading">Histórico de versões</h2>
        <ol>
          {loaderData.history.map((entry) => (
            <li key={entry.id}>
              <Link to={`?submission=${entry.id}`}>Versão {entry.submission_version}</Link> —{" "}
              {entry.status === "active" ? "Ativa" : "Anterior"}. {entry.reason}. Autor:{" "}
              {entry.author}. Data: {entry.at}.
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
