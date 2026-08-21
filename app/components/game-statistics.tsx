import { Link } from "react-router";

import type { CompetitionContext } from "../modules/competition/context";
import { contextPath } from "../modules/competition/context";
import { efficiency, percentage, rebounds } from "../modules/statistics/domain";
import type {
  PublicGameDetail,
  PublicGameTeam,
} from "../modules/statistics/public-statistics.server";

function percent(made: number, attempted: number) {
  const value = percentage(made, attempted);
  return value === null ? "—" : `${String(value).replace(".", ",")}%`;
}

function periodLabel(period: number) {
  return period <= 4 ? `Q${period}` : `OT${period - 4}`;
}

function TeamScore({ context, team }: { context: CompetitionContext; team: PublicGameTeam }) {
  return (
    <div>
      <Link to={contextPath(context, "equipes", team.teamSlug)}>{team.teamName}</Link>
      <strong>{team.score}</strong>
    </div>
  );
}

export function GameStatistics({
  context,
  game,
}: {
  context: CompetitionContext;
  game: PublicGameDetail;
}) {
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
        <span className="game-status">{game.status}</span>
      </header>

      <section className="public-scoreboard" aria-label="Placar do jogo">
        <TeamScore context={context} team={game.teams[0]} />
        <span>×</span>
        <TeamScore context={context} team={game.teams[1]} />
      </section>

      {periods.length > 0 ? (
        <div className="statistics-table-wrap">
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
                      {team.periodScores.find((item) => item.periodNumber === period)?.points ?? 0}
                    </td>
                  ))}
                  <td>
                    <strong>{team.score}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {game.players.length > 0 ? (
        game.teams.map((team) => (
          <section className="game-team-statistics" key={team.registrationId}>
            <h2>{team.teamName}</h2>
            <div className="statistics-table-wrap">
              <table className="statistics-table">
                <caption>Boxscore de {team.teamName}</caption>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Atleta</th>
                    {game.advanced ? (
                      <>
                        <th scope="col">MIN</th>
                        <th scope="col">PTS</th>
                        <th scope="col">REB</th>
                        <th scope="col">AST</th>
                        <th scope="col">FG%</th>
                        <th scope="col">3P%</th>
                        <th scope="col">LL%</th>
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
                  {game.players
                    .filter((player) => player.teamId === team.teamId)
                    .map((player) => {
                      const fieldMade = player.totals.twoPointMade + player.totals.threePointMade;
                      const fieldAttempted =
                        player.totals.twoPointAttempted + player.totals.threePointAttempted;
                      return (
                        <tr key={player.playerId}>
                          <td>{player.jerseyNumber}</td>
                          <th scope="row">
                            <Link to={contextPath(context, "jogadores", player.playerSlug)}>
                              {player.playerName}
                            </Link>
                            {player.didNotPlay ? " · N/J" : ""}
                          </th>
                          {game.advanced ? (
                            <>
                              <td>{Math.round((player.totals.secondsPlayed / 60) * 10) / 10}</td>
                              <td>{player.totals.points}</td>
                              <td>{rebounds(player.totals)}</td>
                              <td>{player.totals.assists}</td>
                              <td>{percent(fieldMade, fieldAttempted)}</td>
                              <td>
                                {percent(
                                  player.totals.threePointMade,
                                  player.totals.threePointAttempted,
                                )}
                              </td>
                              <td>
                                {percent(
                                  player.totals.freeThrowMade,
                                  player.totals.freeThrowAttempted,
                                )}
                              </td>
                              <td>{efficiency(player.totals)}</td>
                              <td>{player.totals.plusMinus}</td>
                            </>
                          ) : (
                            <td>{player.totals.points}</td>
                          )}
                          <td>{player.fouls}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>
        ))
      ) : (
        <p className="empty-resource">O boxscore ainda não está disponível.</p>
      )}
    </article>
  );
}
