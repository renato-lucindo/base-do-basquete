import { Link, useSearchParams } from "react-router";

import type { CompetitionContext, PublicResource } from "../modules/competition/context";
import { contextPath } from "../modules/competition/context";
import {
  gameScoreLabel,
  splitGames,
  type PublicGameSummary,
  type StandingRow,
  type TeamStatisticsRow,
} from "../modules/statistics/sports-domain";
import type { PublicSportsCoreDto } from "../modules/statistics/public-sports.server";
import { ResourceState } from "./resource-state";
import { ScrollableTable } from "./scrollable-table";

function number(value: number | null, suffix = ""): string {
  if (value === null) return "—";
  return `${Number.isInteger(value) ? value : value.toFixed(1).replace(".", ",")}${suffix}`;
}

function dateTime(value: string | null): string {
  if (!value) return "Data e horário a definir";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

const statusLabels = {
  scheduled: "Agendado",
  live: "Ao vivo",
  final: "Finalizado",
} as const;

function GamesSection({
  context,
  games,
  teams,
}: {
  context: CompetitionContext;
  games: PublicGameSummary[];
  teams: PublicSportsCoreDto["teams"];
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const teamId = searchParams.get("team") ?? "";
  const status = searchParams.get("status") ?? "all";
  const filtered = games.filter(
    (game) =>
      (!teamId || game.home.id === Number(teamId) || game.away.id === Number(teamId)) &&
      (status === "all" || game.status === status),
  );
  const groups = splitGames(filtered);
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === "all" || value === "") next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };
  const renderGroup = (title: string, items: PublicGameSummary[]) =>
    items.length > 0 ? (
      <section className="games-group">
        <h2>{title}</h2>
        <ol className="public-game-list">
          {items.map((game) => (
            <li key={game.id}>
              <header>
                <span className="game-status">{statusLabels[game.status]}</span>
                <strong>{game.label}</strong>
              </header>
              <div className="game-list-matchup">
                <span>{game.home.abbreviation ?? game.home.name}</span>
                <strong>{gameScoreLabel(game)}</strong>
                <span>{game.away.abbreviation ?? game.away.name}</span>
              </div>
              <p>
                {dateTime(game.scheduledAt)} · {game.venue ?? "Local a definir"}
              </p>
              <Link to={contextPath(context, "jogos", game.id)}>Abrir partida</Link>
            </li>
          ))}
        </ol>
      </section>
    ) : null;

  return (
    <section className="public-sports-core" aria-label="Jogos da edição">
      <fieldset className="sports-filters">
        <legend>Filtrar jogos</legend>
        <label>
          Equipe
          <select value={teamId} onChange={(event) => update("team", event.target.value)}>
            <option value="">Todas</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={status} onChange={(event) => update("status", event.target.value)}>
            <option value="all">Todos</option>
            <option value="scheduled">Agendados</option>
            <option value="live">Ao vivo</option>
            <option value="final">Finalizados</option>
          </select>
        </label>
      </fieldset>
      {filtered.length > 0 ? (
        <>
          {renderGroup("Próximos jogos", groups.upcoming)}
          {renderGroup("Jogos encerrados", groups.finished)}
        </>
      ) : (
        <ResourceState
          detail="Ajuste os filtros ou aguarde a publicação de novos jogos."
          kind="empty"
          title="Nenhum jogo encontrado"
        />
      )}
    </section>
  );
}

function Standings({ context, rows }: { context: CompetitionContext; rows: StandingRow[] }) {
  return rows.length > 0 ? (
    <section className="public-sports-core" aria-labelledby="standings-title">
      <h2 id="standings-title">Classificação da edição</h2>
      <ScrollableTable label="Classificação esportiva">
        <table className="statistics-table">
          <caption>Somente partidas finalizadas com placar válido</caption>
          <thead>
            <tr>
              <th scope="col">Pos.</th>
              <th scope="col">Equipe</th>
              <th scope="col">J</th>
              <th scope="col">V</th>
              <th scope="col">D</th>
              <th scope="col">Aprov.</th>
              <th scope="col">PP</th>
              <th scope="col">PC</th>
              <th scope="col">SLD</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.position}</th>
                <td>
                  <Link to={contextPath(context, "equipes", row.slug)}>{row.name}</Link>
                </td>
                <td>{row.games}</td>
                <td>{row.wins}</td>
                <td>{row.losses}</td>
                <td>{number(row.winPercentage, "%")}</td>
                <td>{row.pointsFor}</td>
                <td>{row.pointsAgainst}</td>
                <td>{row.pointDifference}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollableTable>
      <details className="standings-legend">
        <summary>Siglas e critérios de desempate</summary>
        <p>
          J: jogos; V: vitórias; D: derrotas; PP/PC: pontos pró/contra; SLD: saldo. Desempates:
          vitórias, confronto direto, saldo, pontos pró e nome.
        </p>
      </details>
    </section>
  ) : (
    <ResourceState
      detail="As equipes aparecerão após a publicação das inscrições."
      kind="empty"
      title="Classificação ainda indisponível"
    />
  );
}

function TeamStatistics({
  context,
  rows,
}: {
  context: CompetitionContext;
  rows: TeamStatisticsRow[];
}) {
  return rows.length > 0 ? (
    <section className="public-sports-core" aria-labelledby="team-statistics-title">
      <h2 id="team-statistics-title">Desempenho das equipes</h2>
      <ScrollableTable label="Estatísticas de equipes">
        <table className="statistics-table">
          <caption>Médias derivadas somente de jogos finalizados</caption>
          <thead>
            <tr>
              <th scope="col">Equipe</th>
              <th scope="col">J</th>
              <th scope="col">PTS/J</th>
              <th scope="col">REB/J</th>
              <th scope="col">AST/J</th>
              <th scope="col">FG%</th>
              <th scope="col">3P%</th>
              <th scope="col">LL%</th>
              <th scope="col">EF/J</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">
                  <Link to={contextPath(context, "equipes", row.slug)}>{row.name}</Link>
                </th>
                <td>{row.games}</td>
                <td>{number(row.pointsPerGame)}</td>
                <td>{number(row.reboundsPerGame)}</td>
                <td>{number(row.assistsPerGame)}</td>
                <td>{number(row.fieldGoalPercentage, "%")}</td>
                <td>{number(row.threePointPercentage, "%")}</td>
                <td>{number(row.freeThrowPercentage, "%")}</td>
                <td>{number(row.efficiencyPerGame)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollableTable>
    </section>
  ) : (
    <ResourceState
      detail="As estatísticas serão calculadas após os primeiros jogos finalizados."
      kind="empty"
      title="Sem estatísticas de equipes"
    />
  );
}

export function PublicSportsCore({
  context,
  data,
  resource,
}: {
  context: CompetitionContext;
  data: PublicSportsCoreDto;
  resource: PublicResource;
}) {
  if (resource === "visao-geral") {
    const nextGame = data.games.find((game) => game.status !== "final");
    return (
      <section aria-label="Visão geral da edição" className="public-overview">
        <article>
          <span>Equipes</span>
          <strong>{data.teams.length}</strong>
          <Link to={contextPath(context, "equipes")}>Ver equipes</Link>
        </article>
        <article>
          <span>Jogos publicados</span>
          <strong>{data.games.length}</strong>
          <Link to={contextPath(context, "jogos")}>Ver jogos</Link>
        </article>
        <article>
          <span>Próxima partida</span>
          <strong>
            {nextGame
              ? `${nextGame.home.abbreviation ?? nextGame.home.name} × ${nextGame.away.abbreviation ?? nextGame.away.name}`
              : "A definir"}
          </strong>
          <Link to={contextPath(context, "classificacao")}>Ver classificação</Link>
        </article>
      </section>
    );
  }
  if (resource === "jogos") {
    return <GamesSection context={context} games={data.games} teams={data.teams} />;
  }
  if (resource === "classificacao") {
    return <Standings context={context} rows={data.standings} />;
  }
  return <TeamStatistics context={context} rows={data.teamStatistics} />;
}
