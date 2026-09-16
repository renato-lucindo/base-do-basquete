import { data, Link } from "react-router";

import { AdminArea } from "../components/admin/admin-area";
import { cloudflareContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
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

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const auth = await requireAdminAal2(request, env);
  const result = await auth.client.rpc("admin_get_classification_backfill_report");
  const report = result.error ? null : parseReviewQueueReport(result.data);
  if (!report) {
    throw new Response("Relatório de pendências indisponível", { status: 503 });
  }
  return data(
    { report },
    {
      headers: {
        "Cache-Control": "private, no-store",
        ...(auth.cookie ? { "Set-Cookie": auth.cookie } : {}),
      },
    },
  );
}

export default function ReviewQueues({ loaderData }: Route.ComponentProps) {
  const { report } = loaderData;
  return (
    <AdminArea title="Pendências de fechamento">
      <p>
        Esta fila mostra somente contexto público e o estado pendente. O valor privado de
        elegibilidade nunca é transportado para esta tela nem sugerido pelo sistema.
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
        <h2 id="player-review-title">Atletas</h2>
        {report.players.length ? (
          <ol className="import-history">
            {report.players.map((player) => (
              <li key={player.playerId}>
                <span>{player.fullName}</span>
                <strong>{player.isActive ? "ativo" : "sem vínculo ativo"}</strong>
                <small>
                  {player.rosterEntryCount} inscrição(ões), {player.activeRosterEntryCount}{" "}
                  ativa(s), {player.competitionCount} competição(ões)
                </small>
                <Link to={`/admin/players/${player.playerId}/private-profile`}>
                  Abrir formulário protegido
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p>Nenhum atleta pendente.</p>
        )}
      </section>
      <small>Relatório de reconciliação versão {report.reportVersion}.</small>
    </AdminArea>
  );
}
