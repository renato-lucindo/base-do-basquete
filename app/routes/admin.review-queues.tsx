import { useEffect, useMemo, useRef, useState } from "react";
import { data, Form, Link, redirect, useNavigation, useSearchParams } from "react-router";

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

type TeamContext = { teamId: number; name: string };
type CompetitionContext = { competitionId: number; displayName: string; year: number };

export type PlayerReviewItem = {
  playerId: number;
  fullName: string;
  isActive: boolean;
  reviewRevision: number;
  rosterEntryCount: number;
  activeRosterEntryCount: number;
  competitionCount: number;
  teams: TeamContext[];
  competitions: CompetitionContext[];
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
type ReviewStatus = "all" | "active" | "inactive" | "multiple";
type ReviewSort = "name" | "team" | "competition" | "impact";

type BulkReviewInput = {
  reason: string;
  reviews: Array<{
    playerId: number;
    sex: PlayerEligibilitySex;
    expectedRevision: number;
  }>;
};

const reasonPresets = [
  "Revisão cadastral em lote pelo organizador responsável.",
  "Validação do elenco da competição pelo organizador responsável.",
  "Correção cadastral após conferência documental.",
] as const;

const filterKeys = ["q", "competition", "team", "status", "sort"] as const;

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

function parseTeamContext(value: unknown): TeamContext | null {
  const item = objectValue(value);
  const teamId = integerValue(item?.teamId);
  const name = stringValue(item?.name);
  return teamId && name ? { teamId, name } : null;
}

function parseCompetitionContext(value: unknown): CompetitionContext | null {
  const item = objectValue(value);
  const competitionId = integerValue(item?.competitionId);
  const displayName = stringValue(item?.displayName);
  const year = integerValue(item?.year);
  return competitionId && displayName && year ? { competitionId, displayName, year } : null;
}

function parsePlayer(value: unknown): PlayerReviewItem | null {
  const item = objectValue(value);
  if (!item) return null;
  const playerId = integerValue(item.playerId);
  const fullName = stringValue(item.fullName);
  const isActive = booleanValue(item.isActive);
  const reviewRevision = integerValue(item.reviewRevision);
  const rosterEntryCount = integerValue(item.rosterEntryCount);
  const activeRosterEntryCount = integerValue(item.activeRosterEntryCount);
  const competitionCount = integerValue(item.competitionCount);
  const teamValues = Array.isArray(item.teams) ? item.teams.map(parseTeamContext) : null;
  const competitionValues = Array.isArray(item.competitions)
    ? item.competitions.map(parseCompetitionContext)
    : null;
  if (
    !playerId ||
    !fullName ||
    isActive === null ||
    !reviewRevision ||
    rosterEntryCount === null ||
    activeRosterEntryCount === null ||
    competitionCount === null ||
    !teamValues ||
    teamValues.some((team) => team === null) ||
    !competitionValues ||
    competitionValues.some((competition) => competition === null)
  ) {
    return null;
  }
  return {
    playerId,
    fullName,
    isActive,
    reviewRevision,
    rosterEntryCount,
    activeRosterEntryCount,
    competitionCount,
    teams: teamValues as TeamContext[],
    competitions: competitionValues as CompetitionContext[],
  };
}

export function parsePlayerReviewQueue(value: unknown): PlayerReviewItem[] | null {
  const queue = objectValue(value);
  const queueVersion = integerValue(queue?.queueVersion);
  const playerValues = Array.isArray(queue?.players) ? queue.players : null;
  if (!queueVersion || !playerValues) return null;
  const players = playerValues.map(parsePlayer);
  return players.some((player) => player === null) ? null : (players as PlayerReviewItem[]);
}

export function parseReviewQueueReport(value: unknown): Omit<ReviewQueueReport, "players"> | null {
  const report = objectValue(value);
  const counts = objectValue(report?.counts);
  const queues = objectValue(report?.queues);
  if (!report || !counts || !queues) return null;

  const competitionValues = Array.isArray(queues.competitions) ? queues.competitions : null;
  if (!competitionValues) return null;
  const competitions = competitionValues.map(parseCompetition);
  if (competitions.some((item) => item === null)) return null;

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
    const match = /^selected:([1-9][0-9]{0,14})$/u.exec(name);
    if (!match) continue;
    const playerId = Number(match[1]);
    const sexValues = form.getAll(`player:${playerId}`);
    const revisionValues = form.getAll(`revision:${playerId}`);
    const sex = String(sexValues[0] ?? "");
    const expectedRevision = Number(revisionValues[0]);
    if (
      rawValue !== "on" ||
      !Number.isSafeInteger(playerId) ||
      seen.has(playerId) ||
      sexValues.length !== 1 ||
      revisionValues.length !== 1 ||
      (sex !== "male" && sex !== "female") ||
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 1
    ) {
      return null;
    }
    seen.add(playerId);
    reviews.push({ playerId, sex, expectedRevision });
  }
  if (reviews.length < 1 || reviews.length > 100) return null;
  return { reason, reviews };
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const auth = await requireAdminAal2(request, env);
  const [reportResult, playerResult] = await Promise.all([
    auth.client.rpc("admin_get_classification_backfill_report"),
    auth.client.rpc("admin_get_player_review_queue"),
  ]);
  const reportBase = reportResult.error ? null : parseReviewQueueReport(reportResult.data);
  const players = playerResult.error ? null : parsePlayerReviewQueue(playerResult.data);
  if (!reportBase || !players || reportBase.counts.playerEligibilityPending !== players.length) {
    throw new Response("Relatório de pendências indisponível", { status: 503 });
  }
  return data(
    {
      report: { ...reportBase, players },
      csrfToken: auth.payload.csrfToken,
      savedCount: (() => {
        const value = new URL(request.url).searchParams.get("savedPlayers");
        return value && /^[1-9][0-9]{0,2}$/u.test(value) ? Number(value) : null;
      })(),
    },
    { headers: responseHeaders(auth.cookie) },
  );
}

function reviewQueueRedirect(request: Request, savedCount: number) {
  const current = new URL(request.url).searchParams;
  const next = new URLSearchParams({ savedPlayers: String(savedCount) });
  for (const key of filterKeys) {
    const value = current.get(key);
    if (value && value.length <= 160) next.set(key, value);
  }
  return `/admin/review-queues?${next.toString()}#player-review-title`;
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
      result.error?.code === "BD401"
        ? 403
        : result.error?.code === "BD404" || result.error?.code === "BD409"
          ? 409
          : 400;
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
            ? "A fila mudou enquanto você revisava. Nenhuma escolha foi aplicada; recarregue antes de tentar novamente."
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
  throw redirect(reviewQueueRedirect(request, summary.reviewed_count), { headers });
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

export function filterAndSortPlayers(
  players: readonly PlayerReviewItem[],
  filters: {
    query: string;
    competitionId: string;
    teamId: string;
    status: ReviewStatus;
    sort: ReviewSort;
  },
) {
  const query = normalizeSearch(filters.query);
  return players
    .filter((player) => {
      if (query && !normalizeSearch(player.fullName).includes(query)) return false;
      if (
        filters.competitionId &&
        !player.competitions.some(
          (competition) => String(competition.competitionId) === filters.competitionId,
        )
      ) {
        return false;
      }
      if (filters.teamId && !player.teams.some((team) => String(team.teamId) === filters.teamId)) {
        return false;
      }
      if (filters.status === "active" && player.activeRosterEntryCount === 0) return false;
      if (filters.status === "inactive" && player.activeRosterEntryCount > 0) return false;
      if (
        filters.status === "multiple" &&
        player.teams.length <= 1 &&
        player.competitions.length <= 1
      ) {
        return false;
      }
      return true;
    })
    .sort((left, right) => {
      if (filters.sort === "impact") {
        return (
          right.activeRosterEntryCount +
          right.competitionCount -
          (left.activeRosterEntryCount + left.competitionCount)
        );
      }
      if (filters.sort === "team") {
        return (left.teams[0]?.name ?? "").localeCompare(right.teams[0]?.name ?? "", "pt-BR");
      }
      if (filters.sort === "competition") {
        return (left.competitions[0]?.displayName ?? "").localeCompare(
          right.competitions[0]?.displayName ?? "",
          "pt-BR",
        );
      }
      return left.fullName.localeCompare(right.fullName, "pt-BR");
    });
}

function joinContext(values: readonly string[]) {
  return values.length ? values.join(", ") : "Sem vínculo";
}

export default function ReviewQueues({ loaderData, actionData }: Route.ComponentProps) {
  const { report } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const [choices, setChoices] = useState<Record<number, PlayerEligibilitySex>>({});
  const [reason, setReason] = useState<string>(reasonPresets[0]);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  const query = searchParams.get("q") ?? "";
  const competitionId = searchParams.get("competition") ?? "";
  const teamId = searchParams.get("team") ?? "";
  const statusValue = searchParams.get("status");
  const status: ReviewStatus = ["active", "inactive", "multiple"].includes(statusValue ?? "")
    ? (statusValue as ReviewStatus)
    : "all";
  const sortValue = searchParams.get("sort");
  const sort: ReviewSort = ["team", "competition", "impact"].includes(sortValue ?? "")
    ? (sortValue as ReviewSort)
    : "name";

  const teams = useMemo(() => {
    const values = new Map<number, string>();
    for (const player of report.players) {
      for (const team of player.teams) values.set(team.teamId, team.name);
    }
    return [...values].sort((left, right) => left[1].localeCompare(right[1], "pt-BR"));
  }, [report.players]);
  const competitions = useMemo(() => {
    const values = new Map<number, CompetitionContext>();
    for (const player of report.players) {
      for (const competition of player.competitions) {
        values.set(competition.competitionId, competition);
      }
    }
    return [...values.values()].sort(
      (left, right) => right.year - left.year || left.displayName.localeCompare(right.displayName),
    );
  }, [report.players]);
  const visiblePlayers = useMemo(
    () => filterAndSortPlayers(report.players, { query, competitionId, teamId, status, sort }),
    [competitionId, query, report.players, sort, status, teamId],
  );
  const selectedPlayers = useMemo(
    () => report.players.filter((player) => choices[player.playerId]),
    [choices, report.players],
  );
  const selectedCount = selectedPlayers.length;
  const selectedVisibleCount = visiblePlayers.filter((player) => choices[player.playerId]).length;
  const allVisibleSelected =
    visiblePlayers.length > 0 && selectedVisibleCount === visiblePlayers.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedVisibleCount > 0 && selectedVisibleCount < visiblePlayers.length;
    }
  }, [selectedVisibleCount, visiblePlayers.length]);

  const selectionSummary = useMemo(() => {
    const teamCounts = new Map<string, number>();
    const competitionCounts = new Map<string, number>();
    for (const player of selectedPlayers) {
      for (const team of player.teams)
        teamCounts.set(team.name, (teamCounts.get(team.name) ?? 0) + 1);
      for (const competition of player.competitions) {
        const label = `${competition.displayName} · ${competition.year}`;
        competitionCounts.set(label, (competitionCounts.get(label) ?? 0) + 1);
      }
    }
    const order = (values: Map<string, number>) =>
      [...values].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
    return { teams: order(teamCounts), competitions: order(competitionCounts) };
  }, [selectedPlayers]);

  const setFilter = (key: (typeof filterKeys)[number], value: string) => {
    const next = new URLSearchParams(searchParams);
    next.delete("savedPlayers");
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };
  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    for (const key of filterKeys) next.delete(key);
    next.delete("savedPlayers");
    setSearchParams(next, { replace: true });
  };
  const setPlayerSelected = (playerId: number, selected: boolean) => {
    setChoices((current) => {
      const next = { ...current };
      if (selected) next[playerId] = current[playerId] ?? "male";
      else delete next[playerId];
      return next;
    });
  };
  const setVisibleSelected = (selected: boolean) => {
    setChoices((current) => {
      const next = { ...current };
      for (const player of visiblePlayers) {
        if (selected) next[player.playerId] = current[player.playerId] ?? "male";
        else delete next[player.playerId];
      }
      return next;
    });
  };
  const setSelectedSex = (sex: PlayerEligibilitySex) => {
    setChoices((current) =>
      Object.fromEntries(Object.keys(current).map((playerId) => [Number(playerId), sex])),
    );
  };

  return (
    <AdminArea title="Pendências de fechamento">
      <p>
        Esta fila mostra somente contexto público e o estado pendente. O valor privado atual nunca é
        lido; masculino é aplicado apenas quando você marca um atleta.
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
              Marque os atletas, filtre pelo contexto de trabalho e ajuste somente as exceções para
              feminino.
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
            <div className="bulk-review-filters">
              <label>
                Buscar atleta
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setFilter("q", event.target.value)}
                  placeholder="Digite parte do nome"
                />
              </label>
              <label>
                Competição
                <select
                  value={competitionId}
                  onChange={(event) => setFilter("competition", event.target.value)}
                >
                  <option value="">Todas</option>
                  {competitions.map((competition) => (
                    <option value={competition.competitionId} key={competition.competitionId}>
                      {competition.displayName} · {competition.year}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Time
                <select value={teamId} onChange={(event) => setFilter("team", event.target.value)}>
                  <option value="">Todos</option>
                  {teams.map(([id, name]) => (
                    <option value={id} key={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Situação
                <select
                  value={status}
                  onChange={(event) =>
                    setFilter("status", event.target.value === "all" ? "" : event.target.value)
                  }
                >
                  <option value="all">Todas</option>
                  <option value="active">Com inscrição ativa</option>
                  <option value="inactive">Sem inscrição ativa</option>
                  <option value="multiple">Múltiplos contextos</option>
                </select>
              </label>
              <label>
                Ordenar
                <select
                  value={sort}
                  onChange={(event) =>
                    setFilter("sort", event.target.value === "name" ? "" : event.target.value)
                  }
                >
                  <option value="name">Nome</option>
                  <option value="team">Time</option>
                  <option value="competition">Competição</option>
                  <option value="impact">Maior impacto</option>
                </select>
              </label>
              <button className="button button-ghost" type="button" onClick={clearFilters}>
                Limpar filtros
              </button>
            </div>

            <div className="bulk-review-result-bar">
              <label className="bulk-select-all">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allVisibleSelected}
                  disabled={visiblePlayers.length === 0 || busy}
                  onChange={(event) => setVisibleSelected(event.target.checked)}
                />
                Selecionar todos os {visiblePlayers.length} visíveis
              </label>
              <span>
                <strong>{selectedCount}</strong> selecionado(s) no total ·{" "}
                <strong>{visiblePlayers.length}</strong> resultado(s)
              </span>
            </div>

            {visiblePlayers.length ? (
              <div className="bulk-review-table-wrap">
                <table className="bulk-review-table">
                  <thead>
                    <tr>
                      <th scope="col">Selecionar</th>
                      <th scope="col">Atleta</th>
                      <th scope="col">Time</th>
                      <th scope="col">Competição</th>
                      <th scope="col">Impacto</th>
                      <th scope="col">Classificação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePlayers.map((player) => {
                      const selected = Boolean(choices[player.playerId]);
                      const multipleContexts =
                        player.teams.length > 1 || player.competitions.length > 1;
                      return (
                        <tr key={player.playerId} className={selected ? "is-selected" : undefined}>
                          <td data-label="Selecionar">
                            <input
                              type="checkbox"
                              name={`selected:${player.playerId}`}
                              checked={selected}
                              value="on"
                              aria-label={`Selecionar ${player.fullName}`}
                              onChange={(event) =>
                                setPlayerSelected(player.playerId, event.target.checked)
                              }
                            />
                          </td>
                          <td data-label="Atleta">
                            <strong>{player.fullName}</strong>
                            <small>{player.isActive ? "Cadastro ativo" : "Cadastro inativo"}</small>
                            <Link to={`/admin/players/${player.playerId}/private-profile`}>
                              Revisar individualmente
                            </Link>
                          </td>
                          <td data-label="Time">
                            <span>{joinContext(player.teams.map((team) => team.name))}</span>
                            {multipleContexts ? (
                              <small className="context-warning">
                                Atenção: vínculos em múltiplos contextos
                              </small>
                            ) : null}
                          </td>
                          <td data-label="Competição">
                            {joinContext(
                              player.competitions.map(
                                (competition) => `${competition.displayName} · ${competition.year}`,
                              ),
                            )}
                          </td>
                          <td data-label="Impacto">
                            <strong>{player.activeRosterEntryCount} ativa(s)</strong>
                            <small>
                              {player.rosterEntryCount} inscrição(ões) · {player.competitionCount}{" "}
                              competição(ões)
                            </small>
                          </td>
                          <td data-label="Classificação">
                            {selected ? (
                              <>
                                <input
                                  type="hidden"
                                  name={`revision:${player.playerId}`}
                                  value={player.reviewRevision}
                                />
                                <select
                                  name={`player:${player.playerId}`}
                                  value={choices[player.playerId]}
                                  aria-label={`Classificação de ${player.fullName}`}
                                  onChange={(event) =>
                                    setChoices((current) => ({
                                      ...current,
                                      [player.playerId]: event.target.value as PlayerEligibilitySex,
                                    }))
                                  }
                                >
                                  <option value="male">Masculino</option>
                                  <option value="female">Feminino</option>
                                </select>
                              </>
                            ) : (
                              <span className="muted-choice">Não incluído</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bulk-review-empty">
                <strong>Nenhum atleta encontrado.</strong>
                <p>Ajuste os filtros ou limpe todos para voltar à fila completa.</p>
                <button className="button button-ghost" type="button" onClick={clearFilters}>
                  Limpar filtros
                </button>
              </div>
            )}

            <div className="bulk-review-submit">
              <div className="bulk-review-summary" aria-live="polite">
                <h3>Resumo antes do envio</h3>
                {selectedCount ? (
                  <div className="bulk-review-summary-grid">
                    <div>
                      <strong>Por competição</strong>
                      <ul>
                        {selectionSummary.competitions.map(([label, count]) => (
                          <li key={label}>
                            {label}: {count}
                          </li>
                        ))}
                        {selectionSummary.competitions.length === 0 ? <li>Sem vínculo</li> : null}
                      </ul>
                    </div>
                    <div>
                      <strong>Por time</strong>
                      <ul>
                        {selectionSummary.teams.map(([label, count]) => (
                          <li key={label}>
                            {label}: {count}
                          </li>
                        ))}
                        {selectionSummary.teams.length === 0 ? <li>Sem vínculo</li> : null}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <p>Selecione ao menos um atleta para ver o impacto por competição e time.</p>
                )}
              </div>
              <label>
                Motivo predefinido
                <select
                  value={
                    reasonPresets.includes(reason as (typeof reasonPresets)[number]) ? reason : ""
                  }
                  onChange={(event) => event.target.value && setReason(event.target.value)}
                >
                  <option value="">Personalizado</option>
                  {reasonPresets.map((preset) => (
                    <option key={preset} value={preset}>
                      {preset}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Justificativa comum para este lote
                <textarea
                  name="reason"
                  minLength={10}
                  maxLength={500}
                  required
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
                <small>
                  A justificativa e o impacto serão auditados individualmente; os valores escolhidos
                  não serão gravados na auditoria.
                </small>
              </label>
              <label className="bulk-review-confirmation">
                <input type="checkbox" name="confirmed" required /> Revisei as {selectedCount}{" "}
                escolha(s) e confirmo o envio transacional.
              </label>
            </div>

            <div className="bulk-review-action-bar">
              <span>
                <strong>{selectedCount}</strong> selecionado(s)
              </span>
              <button
                className="button button-ghost"
                type="button"
                disabled={selectedCount === 0 || busy}
                onClick={() => setSelectedSex("male")}
              >
                Definir masculino
              </button>
              <button
                className="button button-ghost"
                type="button"
                disabled={selectedCount === 0 || busy}
                onClick={() => setSelectedSex("female")}
              >
                Definir feminino
              </button>
              <button
                className="button button-ghost"
                type="button"
                disabled={selectedCount === 0 || busy}
                onClick={() => setChoices({})}
              >
                Limpar seleção
              </button>
              <button
                className="button button-primary"
                type="submit"
                disabled={selectedCount === 0 || busy}
              >
                {busy ? "Salvando lote…" : `Salvar ${selectedCount} revisão(ões)`}
              </button>
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
