import { useEffect, useMemo, useState } from "react";
import { data, Form, Link, redirect, useNavigation } from "react-router";

import { AdminArea } from "../components/admin/admin-area";
import { cloudflareContext, correlationIdContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";
import { logOperationalEvent } from "../modules/observability/operation.server";
import type { Route } from "./+types/admin.review-queues";

type CompetitionReviewItem = {
  competitionId: number;
  displayName: string;
  year: number;
  genderReviewRequired: boolean;
  profileReviewRequired: boolean;
  gameCount: number;
  manualGameCount: number;
  boxscoreGameCount: number;
  seedGameCount: number;
};

type PlayerReviewItem = {
  playerId: number;
  fullName: string;
  isActive: boolean;
  rosterEntryCount: number;
  activeRosterEntryCount: number;
  competitionCount: number;
};

export type ReviewQueueReport = {
  reportVersion: number;
  enforcementReady: boolean;
  counts: {
    competitionGenderPending: number;
    competitionProfilePending: number;
    playerEligibilityPending: number;
  };
  competitions: CompetitionReviewItem[];
  players: PlayerReviewItem[];
};

type PlayerEligibilitySex = "male" | "female";

type BulkReviewInput = {
  reason: string;
  reviews: Array<{ playerId: number; sex: PlayerEligibilitySex }>;
};

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function integerValue(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function parseCompetition(value: unknown): CompetitionReviewItem | null {
  const item = objectValue(value);
  if (!item) return null;
  const competitionId = integerValue(item.competitionId);
  const displayName = stringValue(item.displayName);
  const year = integerValue(item.year);
  const genderReviewRequired = booleanValue(item.genderReviewRequired);
  const profileReviewRequired = booleanValue(item.profileReviewRequired);
  const gameCount = integerValue(item.gameCount);
  const manualGameCount = integerValue(item.manualGameCount);
  const boxscoreGameCount = integerValue(item.boxscoreGameCount);
  const seedGameCount = integerValue(item.seedGameCount);
  if (
    !competitionId ||
    !displayName ||
    !year ||
    genderReviewRequired === null ||
    profileReviewRequired === null ||
    gameCount === null ||
    manualGameCount === null ||
    boxscoreGameCount === null ||
    seedGameCount === null
  ) {
    return null;
  }
  return {
    competitionId,
    displayName,
    year,
    genderReviewRequired,
    profileReviewRequired,
    gameCount,
    manualGameCount,
    boxscoreGameCount,
    seedGameCount,
  };
}

function parsePlayer(value: unknown): PlayerReviewItem | null {
  const item = objectValue(value);
  if (!item) return null;
  const playerId = integerValue(item.playerId);
  const fullName = stringValue(item.fullName);
  const isActive = booleanValue(item.isActive);
  const rosterEntryCount = integerValue(item.rosterEntryCount);
  const activeRosterEntryCount = integerValue(item.activeRosterEntryCount);
  const competitionCount = integerValue(item.competitionCount);
  if (
    !playerId ||
    !fullName ||
    isActive === null ||
    rosterEntryCount === null ||
    activeRosterEntryCount === null ||
    competitionCount === null
  ) {
    return null;
  }
  return {
    playerId,
    fullName,
    isActive,
    rosterEntryCount,
    activeRosterEntryCount,
    competitionCount,
  };
}

export function parseReviewQueueReport(value: unknown): ReviewQueueReport | null {
  const report = objectValue(value);
  const counts = objectValue(report?.counts);
  const queues = objectValue(report?.queues);
  if (!report || !counts || !queues) return null;

  const competitionValues = Array.isArray(queues.competitions) ? queues.competitions : null;
  const playerValues = Array.isArray(queues.players) ? queues.players : null;
  if (!competitionValues || !playerValues) return null;
  const competitions = competitionValues.map(parseCompetition);
  const players = playerValues.map(parsePlayer);
  if (competitions.some((item) => item === null) || players.some((item) => item === null)) {
    return null;
  }

  const reportVersion = integerValue(report.reportVersion);
  const enforcementReady = booleanValue(report.enforcementReady);
  const competitionGenderPending = integerValue(counts.competitionGenderPending);
  const competitionProfilePending = integerValue(counts.competitionProfilePending);
  const playerEligibilityPending = integerValue(counts.playerEligibilityPending);
  if (
    !reportVersion ||
    enforcementReady === null ||
    competitionGenderPending === null ||
    competitionProfilePending === null ||
    playerEligibilityPending === null
  ) {
    return null;
  }

  return {
    reportVersion,
    enforcementReady,
    counts: {
      competitionGenderPending,
      competitionProfilePending,
      playerEligibilityPending,
    },
    competitions: competitions as CompetitionReviewItem[],
    players: players as PlayerReviewItem[],
  };
}

export function meta() {
  return [{ title: "Pendências — Administração" }];
}

function responseHeaders(cookie: string | null | undefined) {
  return {
    "Cache-Control": "private, no-store",
    ...(cookie ? { "Set-Cookie": cookie } : {}),
  };
}

export function parseBulkReviewInput(form: FormData): BulkReviewInput | null {
  const reason = String(form.get("reason") ?? "").trim();
  if (reason.length < 10 || reason.length > 500 || form.get("confirmed") !== "on") return null;

  const reviews: BulkReviewInput["reviews"] = [];
  const seen = new Set<number>();
  for (const [name, rawValue] of form.entries()) {
    const match = /^player:([1-9][0-9]{0,14})$/u.exec(name);
    if (!match) continue;
    const playerId = Number(match[1]);
    const sex = String(rawValue);
    if (
      !Number.isSafeInteger(playerId) ||
      seen.has(playerId) ||
      (sex !== "male" && sex !== "female")
    ) {
      return null;
    }
    seen.add(playerId);
    reviews.push({ playerId, sex });
  }
  if (reviews.length < 1 || reviews.length > 100) return null;
  return { reason, reviews };
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const auth = await requireAdminAal2(request, env);
  const result = await auth.client.rpc("admin_get_classification_backfill_report");
  const report = result.error ? null : parseReviewQueueReport(result.data);
  if (!report) {
    throw new Response("Relatório de pendências indisponível", { status: 503 });
  }
  return data(
    {
      report,
      csrfToken: auth.payload.csrfToken,
      savedCount: (() => {
        const value = new URL(request.url).searchParams.get("savedPlayers");
        return value && /^[1-9][0-9]{0,2}$/u.test(value) ? Number(value) : null;
      })(),
    },
    {
      headers: responseHeaders(auth.cookie),
    },
  );
}

export async function action({ request, context }: Route.ActionArgs) {
  assertSameOrigin(request);
  const { env } = context.get(cloudflareContext);
  const correlationId = context.get(correlationIdContext);
  const startedAt = Date.now();
  const auth = await requireAdminAal2(request, env);
  const form = await request.formData();
  assertCsrfToken(form, auth.payload.csrfToken);
  const input = parseBulkReviewInput(form);
  const headers = responseHeaders(auth.cookie);
  if (!input) {
    return data(
      {
        error:
          "Selecione ao menos um atleta, confirme as escolhas e informe uma justificativa de 10 a 500 caracteres.",
      },
      { status: 400, headers },
    );
  }

  const result = await auth.client.rpc("admin_bulk_set_player_sex", {
    p_reviews: input.reviews,
    p_reason: input.reason,
  });
  const summary = result.data?.[0];
  if (
    result.error ||
    !summary ||
    summary.reviewed_count !== input.reviews.length ||
    !Number.isSafeInteger(summary.remaining_pending)
  ) {
    const status =
      result.error?.code === "BD401" ? 403 : result.error?.code === "BD404" ? 409 : 400;
    logOperationalEvent({
      correlationId,
      durationMs: Date.now() - startedAt,
      operation: "player.private_profile",
      outcome: status === 403 ? "blocked" : "failure",
      status,
      context: { errorCode: result.error?.code },
    });
    return data(
      {
        error:
          status === 409
            ? "A fila mudou enquanto você revisava. Recarregue antes de tentar novamente."
            : "Não foi possível salvar o lote. Nenhuma escolha foi aplicada.",
      },
      { status, headers },
    );
  }

  logOperationalEvent({
    correlationId,
    durationMs: Date.now() - startedAt,
    operation: "player.private_profile",
    outcome: "success",
    status: 303,
  });
  throw redirect(
    `/admin/review-queues?savedPlayers=${summary.reviewed_count}#player-review-title`,
    { headers },
  );
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function createMalePreselection(playerIds: readonly number[]) {
  return Object.fromEntries(playerIds.map((playerId) => [playerId, "male"])) as Record<
    number,
    PlayerEligibilitySex
  >;
}

export default function ReviewQueues({ loaderData, actionData }: Route.ComponentProps) {
  const { report } = loaderData;
  const [query, setQuery] = useState("");
  const defaultChoices = useMemo(
    () => createMalePreselection(report.players.map((player) => player.playerId)),
    [report.players],
  );
  const [choices, setChoices] = useState<Record<number, PlayerEligibilitySex>>(defaultChoices);
  useEffect(() => setChoices(defaultChoices), [defaultChoices]);
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const selectedCount = Object.keys(choices).length;
  const normalizedQuery = normalizeSearch(query);
  const visiblePlayerIds = useMemo(
    () =>
      new Set(
        report.players
          .filter((player) => normalizeSearch(player.fullName).includes(normalizedQuery))
          .map((player) => player.playerId),
      ),
    [normalizedQuery, report.players],
  );
  const progress = report.players.length
    ? Math.round((selectedCount / report.players.length) * 100)
    : 100;
  return (
    <AdminArea title="Pendências de fechamento">
      <p>
        Esta fila mostra somente contexto público e o estado pendente. Ela não lê o valor privado
        existente; a predefinição masculina é apenas operacional e precisa ser revisada antes do
        envio.
      </p>
      <div className="admin-status-grid">
        <article>
          <span>Naipe pendente</span>
          <strong>{report.counts.competitionGenderPending}</strong>
        </article>
        <article>
          <span>Perfil pendente</span>
          <strong>{report.counts.competitionProfilePending}</strong>
        </article>
        <article>
          <span>Atletas pendentes</span>
          <strong>{report.counts.playerEligibilityPending}</strong>
        </article>
      </div>

      {report.enforcementReady ? (
        <output className="form-success">
          Todas as filas estão zeradas. O enforcement ainda depende do gate técnico final.
        </output>
      ) : (
        <p className="admin-warning">
          O enforcement permanece bloqueado até todas as escolhas serem concluídas.
        </p>
      )}

      <section className="admin-panel" aria-labelledby="competition-review-title">
        <h2 id="competition-review-title">Competições</h2>
        {report.competitions.length ? (
          <ul className="import-history">
            {report.competitions.map((competition) => (
              <li key={competition.competitionId}>
                <span>
                  {competition.displayName} · {competition.year}
                </span>
                <strong>
                  {[
                    competition.genderReviewRequired ? "naipe" : null,
                    competition.profileReviewRequired ? "perfil" : null,
                  ]
                    .filter(Boolean)
                    .join(" + ")}{" "}
                  pendente
                </strong>
                <small>
                  {competition.gameCount} jogo(s): {competition.manualGameCount} súmula,{" "}
                  {competition.boxscoreGameCount} FIBA e {competition.seedGameCount} legado(s)
                </small>
                <Link to={`/admin/competitions/${competition.competitionId}/data-profile`}>
                  Revisar competição
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhuma competição pendente.</p>
        )}
      </section>

      <section className="admin-panel" aria-labelledby="player-review-title">
        <div className="review-section-heading">
          <div>
            <h2 id="player-review-title">Atletas</h2>
            <p>
              Masculino é a predefinição. Revise a lista e troque as exceções para feminino antes de
              confirmar o lote.
            </p>
          </div>
          <strong>{report.players.length} pendente(s)</strong>
        </div>
        {loaderData.savedCount ? (
          <output className="form-success" aria-live="polite">
            {loaderData.savedCount} revisão(ões) salva(s) e auditada(s) em uma única transação.
          </output>
        ) : null}
        {actionData?.error ? (
          <p className="form-error" role="alert">
            {actionData.error}
          </p>
        ) : null}
        {report.players.length ? (
          <Form method="post" className="bulk-private-review-form">
            <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
            <div className="bulk-review-tools">
              <label>
                Buscar atleta
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Digite parte do nome"
                />
              </label>
              <fieldset className="bulk-review-progress">
                <legend className="sr-only">Progresso das escolhas</legend>
                <span>
                  <strong>{selectedCount}</strong> de {report.players.length} selecionado(s)
                </span>
                <progress max={report.players.length} value={selectedCount}>
                  {progress}%
                </progress>
              </fieldset>
            </div>

            <div className="bulk-review-list">
              {report.players.map((player) => (
                <article
                  className="bulk-review-row"
                  key={player.playerId}
                  hidden={!visiblePlayerIds.has(player.playerId)}
                >
                  <div className="bulk-review-player">
                    <strong>{player.fullName}</strong>
                    <span>{player.isActive ? "Ativo" : "Sem vínculo ativo"}</span>
                    <small>
                      {player.rosterEntryCount} inscrição(ões) · {player.activeRosterEntryCount}{" "}
                      ativa(s) · {player.competitionCount} competição(ões)
                    </small>
                    <Link to={`/admin/players/${player.playerId}/private-profile`}>
                      Revisar individualmente
                    </Link>
                  </div>
                  <fieldset className="eligibility-choice">
                    <legend className="sr-only">
                      Sexo para elegibilidade de {player.fullName}
                    </legend>
                    <label>
                      <input
                        type="radio"
                        name={`player:${player.playerId}`}
                        value="female"
                        checked={choices[player.playerId] === "female"}
                        onChange={() =>
                          setChoices((current) => ({ ...current, [player.playerId]: "female" }))
                        }
                      />
                      Feminino
                    </label>
                    <label>
                      <input
                        type="radio"
                        name={`player:${player.playerId}`}
                        value="male"
                        checked={choices[player.playerId] === "male"}
                        onChange={() =>
                          setChoices((current) => ({ ...current, [player.playerId]: "male" }))
                        }
                      />
                      Masculino
                    </label>
                  </fieldset>
                </article>
              ))}
            </div>
            {visiblePlayerIds.size === 0 ? (
              <p className="admin-note">Nenhum atleta corresponde à busca.</p>
            ) : null}

            <div className="bulk-review-submit">
              <label>
                Justificativa comum para este lote
                <textarea
                  name="reason"
                  minLength={10}
                  maxLength={500}
                  required
                  placeholder="Ex.: revisão cadastral realizada pelo administrador responsável"
                />
                <small>
                  A justificativa e o impacto serão auditados individualmente; os valores escolhidos
                  não serão gravados na auditoria.
                </small>
              </label>
              <label className="bulk-review-confirmation">
                <input type="checkbox" name="confirmed" required /> Revisei as {selectedCount}{" "}
                escolha(s) selecionada(s) e confirmo o envio transacional.
              </label>
              <div className="bulk-review-actions">
                <button
                  className="button button-ghost"
                  type="button"
                  disabled={selectedCount === 0 || busy}
                  onClick={() => setChoices({})}
                >
                  Limpar escolhas
                </button>
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={selectedCount === 0 || busy}
                >
                  {busy ? "Salvando lote…" : `Salvar ${selectedCount} revisão(ões)`}
                </button>
              </div>
            </div>
          </Form>
        ) : (
          <p>Nenhum atleta pendente.</p>
        )}
      </section>
      <small>Relatório de reconciliação versão {report.reportVersion}.</small>
    </AdminArea>
  );
}
