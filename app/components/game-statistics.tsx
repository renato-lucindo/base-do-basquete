import { useState } from "react";
import { Link } from "react-router";

import { type CompetitionContext, contextPath } from "../modules/competition/context";
import { efficiency, rebounds } from "../modules/statistics/domain";
import type {
  PublicGameDetail,
  PublicGamePlayer,
  PublicGameTeam,
} from "../modules/statistics/public-statistics.server";
import { ResourceState } from "./resource-state";
import { ScrollableTable } from "./scrollable-table";

const advancedColumns = [
  "min",
  "points",
  "two-point",
  "three-point",
  "free-throw",
  "rebounds",
  "offensive-rebounds",
  "defensive-rebounds",
  "assists",
  "turnovers",
  "steals",
  "blocks",
  "efficiency",
  "plus-minus",
] as const;

type PlayerOrder = "official" | "points-desc" | "points-asc";

const gameStatusLabels: Record<string, string> = {
  scheduled: "Agendado",
  live: "Em andamento",
  final: "Finalizado",
};

function available(value: number | null | undefined, suffix = ""): string {
  return value === null || value === undefined
    ? "—"
    : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${suffix}`;
}

function periodLabel(period: number) {
  return period <= 4 ? `Q${period}` : `OT${period - 4}`;
}

function clock(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "—";
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function AdvancedPlayerCells({ player }: { player: PublicGamePlayer }) {
  const totals = player.advancedTotals;
  if (player.didNotPlay || !totals) {
    return (
      <>
        <td>{player.didNotPlay ? "NJ" : "—"}</td>
        {advancedColumns.slice(1).map((column) => (
          <td key={column}>—</td>
        ))}
      </>
    );
  }
  return (
    <>
      <td>{Math.round((totals.secondsPlayed / 60) * 10) / 10}</td>
      <td>{available(player.officialPoints)}</td>
      <td>
        {totals.twoPointMade}/{totals.twoPointAttempted}
      </td>
      <td>
        {totals.threePointMade}/{totals.threePointAttempted}
      </td>
      <td>
        {totals.freeThrowMade}/{totals.freeThrowAttempted}
      </td>
      <td>{rebounds(totals)}</td>
      <td>{totals.offensiveRebounds}</td>
      <td>{totals.defensiveRebounds}</td>
      <td>{totals.assists}</td>
      <td>{totals.turnovers}</td>
      <td>{totals.steals}</td>
      <td>{totals.blocks}</td>
      <td>{efficiency(totals)}</td>
      <td>{totals.plusMinus}</td>
    </>
  );
}

function TeamBoxscore({
  context,
  game,
  order,
  team,
}: {
  context: CompetitionContext;
  game: PublicGameDetail;
  order: PlayerOrder;
  team: PublicGameTeam;
}) {
  const players = game.players
    .filter((player) => player.registrationId === team.registrationId)
    .map((player, index) => ({ player, index }))
    .sort((left, right) => {
      if (order === "official") return left.index - right.index;
      if (left.player.officialPoints === null) return right.player.officialPoints === null ? 0 : 1;
      if (right.player.officialPoints === null) return -1;
      const direction = order === "points-desc" ? -1 : 1;
      const points = left.player.officialPoints - right.player.officialPoints;
      return points === 0
        ? left.player.playerName.localeCompare(right.player.playerName, "pt-BR")
        : points * direction;
    })
    .map(({ player }) => player);
  return (
    <section className="game-team-statistics">
      <h2>
        <Link to={contextPath(context, "equipes", team.teamSlug)}>{team.teamName}</Link>
      </h2>
      <ScrollableTable label={`Boxscore de ${team.teamName}`}>
        <table className="statistics-table game-boxscore-table">
          <caption>Boxscore de {team.teamName}</caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Atleta</th>
              {game.advanced ? (
                <>
                  <th scope="col">MIN</th>
                  <th scope="col">PTS</th>
                  <th scope="col">2P</th>
                  <th scope="col">3P</th>
                  <th scope="col">LL</th>
                  <th scope="col">REB</th>
                  <th scope="col">RO</th>
                  <th scope="col">RD</th>
                  <th scope="col">AST</th>
                  <th scope="col">ER</th>
                  <th scope="col">RB</th>
                  <th scope="col">TC</th>
                  <th scope="col">EF</th>
                  <th scope="col">+/-</th>
                </>
              ) : (
                <th scope="col">PTS</th>
              )}
              <th scope="col">F</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr className={player.isStarter ? "is-starter" : undefined} key={player.playerId}>
                <td>{player.isStarter ? `*${player.jerseyNumber}` : player.jerseyNumber}</td>
                <th scope="row">
                  <Link to={contextPath(context, "jogadores", player.playerSlug)}>
                    {player.playerName}
                  </Link>
                  {player.isCaptain ? <span className="captain-mark"> (C)</span> : null}
                  {player.didNotPlay ? <span className="dnp-mark">Não jogou</span> : null}
                </th>
                {game.advanced ? (
                  <AdvancedPlayerCells player={player} />
                ) : (
                  <td>{player.didNotPlay ? "—" : available(player.officialPoints)}</td>
                )}
                <td>{player.didNotPlay ? "—" : available(player.fouls)}</td>
              </tr>
            ))}
          </tbody>
          {team.totals ? (
            <tfoot>
              <tr>
                <th colSpan={2} scope="row">
                  Totais da equipe
                </th>
                {game.advanced ? (
                  <>
                    <td>{Math.round((team.totals.secondsPlayed / 60) * 10) / 10}</td>
                    <td>{team.totals.points}</td>
                    <td>
                      {team.totals.twoPointMade}/{team.totals.twoPointAttempted}
                    </td>
                    <td>
                      {team.totals.threePointMade}/{team.totals.threePointAttempted}
                    </td>
                    <td>
                      {team.totals.freeThrowMade}/{team.totals.freeThrowAttempted}
                    </td>
                    <td>{rebounds(team.totals)}</td>
                    <td>{team.totals.offensiveRebounds}</td>
                    <td>{team.totals.defensiveRebounds}</td>
                    <td>{team.totals.assists}</td>
                    <td>{team.totals.turnovers}</td>
                    <td>{team.totals.steals}</td>
                    <td>{team.totals.blocks}</td>
                    <td>{efficiency(team.totals)}</td>
                    <td>{team.totals.plusMinus}</td>
                  </>
                ) : (
                  <td>{team.totals.points}</td>
                )}
                <td>
                  {players.some((player) => !player.didNotPlay && player.fouls === null)
                    ? "—"
                    : players.reduce((total, player) => total + (player.fouls ?? 0), 0)}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </ScrollableTable>
      {team.pointsReconciled === false ? (
        <p className="reconciliation-warning" role="alert">
          A soma dos pontos dos atletas não confere com o placar persistido.
        </p>
      ) : null}
    </section>
  );
}

function CollectiveStatistics({ game }: { game: PublicGameDetail }) {
  if (!game.teams.every((team) => team.statistics)) {
    return (
      <ResourceState
        kind="empty"
        title="Estatísticas coletivas indisponíveis"
        detail="O placar está publicado, mas os indicadores coletivos ainda não foram confirmados."
      />
    );
  }
  const essential: Array<[string, (team: PublicGameTeam) => string]> = [
    ["Pontos de erros", (team) => available(team.statistics?.pointsFromTurnovers)],
    [
      "Pontos no garrafão",
      (team) =>
        `${available(team.statistics?.pointsInPaint)} (${available(team.statistics?.pointsInPaintMade)}/${available(team.statistics?.pointsInPaintAttempted)})`,
    ],
    ["Segunda chance", (team) => available(team.statistics?.secondChancePoints)],
    ["Contra-ataque", (team) => available(team.statistics?.fastBreakPoints)],
    ["Pontos do banco", (team) => available(team.statistics?.benchPoints)],
  ];
  const more: Array<[string, (team: PublicGameTeam) => string]> = [
    ["Maior vantagem", (team) => available(team.statistics?.largestLead)],
    ["Maior sequência", (team) => available(team.statistics?.largestScoringRun)],
    ["Pontos por posse", (team) => available(team.statistics?.pointsPerPossession)],
    ["Tempo na liderança", (team) => clock(team.statistics?.timeLeadingSeconds)],
  ];
  const table = (caption: string, rows: Array<[string, (team: PublicGameTeam) => string]>) => (
    <ScrollableTable label={caption}>
      <table className="period-score-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Indicador</th>
            {game.teams.map((team) => (
              <th scope="col" key={team.registrationId}>
                {team.teamName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {game.teams.map((team) => (
                <td key={team.registrationId}>{value(team)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollableTable>
  );
  return (
    <section className="game-team-statistics game-collective-statistics">
      <h2>Resumo da partida</h2>
      {table("Indicadores essenciais por equipe", essential)}
      <details className="more-game-statistics">
        <summary>Mais estatísticas</summary>
        {table("Indicadores ampliados por equipe", more)}
        {game.gameStatistics ? (
          <p className="collective-game-summary">
            <strong>{game.gameStatistics.leadChanges}</strong> mudanças na liderança ·{" "}
            <strong>{game.gameStatistics.timesTied}</strong> vezes empatado
          </p>
        ) : (
          <p className="collective-game-summary">Mudanças de liderança e empates indisponíveis.</p>
        )}
      </details>
    </section>
  );
}

export function GameStatistics({
  context,
  game,
}: {
  context: CompetitionContext;
  game: PublicGameDetail;
}) {
  const [playerOrder, setPlayerOrder] = useState<PlayerOrder>("official");
  const periods = [
    ...new Set(game.teams.flatMap((team) => team.periodScores.map((score) => score.periodNumber))),
  ].sort((left, right) => left - right);
  const scheduled = game.scheduledAt
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(game.scheduledAt))
    : "Horário a definir";
  return (
    <article className="game-detail">
      <header className="game-detail-header">
        <div>
          <p className="eyebrow">{context.displayName}</p>
          <h1>{game.label}</h1>
          <p>
            {scheduled} · {game.venue ?? "Local a definir"}
          </p>
        </div>
        <span className="game-status">{gameStatusLabels[game.status] ?? game.status}</span>
      </header>
      <section className="game-match-summary" aria-label="Placar do jogo">
        {game.teams.map((team) => (
          <div key={team.registrationId}>
            <Link to={contextPath(context, "equipes", team.teamSlug)}>{team.teamName}</Link>
            <strong>{game.status === "scheduled" ? "—" : team.score}</strong>
          </div>
        ))}
      </section>
      {periods.length ? (
        <ScrollableTable label="Placar por período">
          <table className="period-score-table">
            <caption>Placar por período</caption>
            <thead>
              <tr>
                <th scope="col">Equipe</th>
                {periods.map((period) => (
                  <th key={period} scope="col">
                    {periodLabel(period)}
                  </th>
                ))}
                <th scope="col">Final</th>
              </tr>
            </thead>
            <tbody>
              {game.teams.map((team) => (
                <tr key={team.registrationId}>
                  <th scope="row">{team.teamName}</th>
                  {periods.map((period) => (
                    <td key={period}>
                      {team.periodScores.find((item) => item.periodNumber === period)?.points ??
                        "—"}
                    </td>
                  ))}
                  <td>
                    <strong>{game.status === "scheduled" ? "—" : team.score}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      ) : null}
      {game.players.length ? (
        <section className="game-boxscores" aria-labelledby="game-boxscores-title">
          <div className="game-boxscores-header">
            <div>
              <p className="eyebrow">Súmula</p>
              <h2 id="game-boxscores-title">Estatísticas dos atletas</h2>
            </div>
            <label>
              Ordenar atletas
              <select
                value={playerOrder}
                onChange={(event) => setPlayerOrder(event.target.value as PlayerOrder)}
              >
                <option value="official">Ordem oficial</option>
                <option value="points-desc">Mais pontos</option>
                <option value="points-asc">Menos pontos</option>
              </select>
            </label>
          </div>
          <div className="game-boxscores-grid">
            {game.teams.map((team) => (
              <TeamBoxscore
                context={context}
                game={game}
                key={team.registrationId}
                order={playerOrder}
                team={team}
              />
            ))}
          </div>
          <p className="game-boxscore-legend">* Titular · (C) Capitão · NJ Não jogou</p>
        </section>
      ) : (
        <ResourceState
          kind="empty"
          title="Boxscore indisponível"
          detail="Os dados individuais aparecerão após a publicação da súmula."
        />
      )}
      {game.advanced ? (
        <CollectiveStatistics game={game} />
      ) : (
        <p className="simple-statistics-note">
          Esta categoria publica o placar e os pontos; métricas avançadas não se aplicam.
        </p>
      )}
    </article>
  );
}
