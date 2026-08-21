import { useState } from "react";
import { Link } from "react-router";

import type { CompetitionContext } from "../modules/competition/context";
import { contextPath } from "../modules/competition/context";
import {
  applyStatisticFilters,
  compareStatistic,
  efficiency,
  perGame,
  percentage,
  rebounds,
  statisticValue,
  type FilterMetric,
  type FilterOperator,
  type PlayerStatistics,
  type StatisticFilter,
  type StatisticsMode,
} from "../modules/statistics/domain";
import type {
  CompetitionStatisticsDto,
  SimplePlayerStatistics,
} from "../modules/statistics/public-statistics.server";

const metricLabels: Record<FilterMetric, string> = {
  points: "PTS",
  rebounds: "REB",
  assists: "AST",
  steals: "STL",
  blocks: "BLK",
  efficiency: "EF",
};

function displayNumber(value: number | null, digits = 1): string {
  if (value === null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(digits).replace(".", ",");
}

function displayPercent(made: number, attempted: number): string {
  const value = percentage(made, attempted);
  return value === null ? "—" : `${displayNumber(value)}%`;
}

function playerPath(context: CompetitionContext, player: { playerSlug: string }) {
  return contextPath(context, "jogadores", player.playerSlug);
}

function SimpleStatisticsTable({
  context,
  players,
}: {
  context: CompetitionContext;
  players: SimplePlayerStatistics[];
}) {
  return (
    <div className="statistics-table-wrap">
      <table className="statistics-table">
        <caption>Estatísticas simplificadas da edição</caption>
        <thead>
          <tr>
            <th scope="col">Atleta</th>
            <th scope="col">J</th>
            <th scope="col">PTS/J</th>
            <th scope="col">PTS</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.playerId}>
              <th scope="row">
                <Link to={playerPath(context, player)}>{player.playerName}</Link>
              </th>
              <td>{player.gamesPlayed}</td>
              <td>{displayNumber(player.pointsPerGame)}</td>
              <td>{player.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function modeValue(total: number, games: number, mode: StatisticsMode) {
  return mode === "totals" ? total : perGame(total, games);
}

function madeAttempted(
  made: number,
  attempted: number,
  games: number,
  mode: StatisticsMode,
): string {
  return `${displayNumber(modeValue(made, games, mode))}/${displayNumber(
    modeValue(attempted, games, mode),
  )}`;
}

function AdvancedStatisticsTable({
  context,
  players,
  mode,
}: {
  context: CompetitionContext;
  players: PlayerStatistics[];
  mode: StatisticsMode;
}) {
  return (
    <div className="statistics-table-wrap">
      <table className="statistics-table statistics-table-advanced">
        <caption>
          Estatísticas avançadas — {mode === "totals" ? "totais" : "média por jogo"}
        </caption>
        <thead>
          <tr>
            {[
              "Atleta",
              "J",
              "MIN",
              "PTS",
              "REB",
              "RO",
              "RD",
              "AST",
              "AC/AT",
              "FG%",
              "3PC/3PT",
              "3P%",
              "LLC/LLT",
              "LL%",
              "EF",
              "+/-",
            ].map((label) => (
              <th key={label} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((player) => {
            const { totals } = player;
            const fieldMade = totals.twoPointMade + totals.threePointMade;
            const fieldAttempted = totals.twoPointAttempted + totals.threePointAttempted;
            return (
              <tr key={player.playerId}>
                <th scope="row">
                  <Link to={playerPath(context, player)}>{player.playerName}</Link>
                </th>
                <td>{player.gamesPlayed}</td>
                <td>
                  {displayNumber(modeValue(totals.secondsPlayed / 60, player.gamesPlayed, mode))}
                </td>
                <td>{displayNumber(modeValue(totals.points, player.gamesPlayed, mode))}</td>
                <td>{displayNumber(modeValue(rebounds(totals), player.gamesPlayed, mode))}</td>
                <td>
                  {displayNumber(modeValue(totals.offensiveRebounds, player.gamesPlayed, mode))}
                </td>
                <td>
                  {displayNumber(modeValue(totals.defensiveRebounds, player.gamesPlayed, mode))}
                </td>
                <td>{displayNumber(modeValue(totals.assists, player.gamesPlayed, mode))}</td>
                <td>{madeAttempted(fieldMade, fieldAttempted, player.gamesPlayed, mode)}</td>
                <td>{displayPercent(fieldMade, fieldAttempted)}</td>
                <td>
                  {madeAttempted(
                    totals.threePointMade,
                    totals.threePointAttempted,
                    player.gamesPlayed,
                    mode,
                  )}
                </td>
                <td>{displayPercent(totals.threePointMade, totals.threePointAttempted)}</td>
                <td>
                  {madeAttempted(
                    totals.freeThrowMade,
                    totals.freeThrowAttempted,
                    player.gamesPlayed,
                    mode,
                  )}
                </td>
                <td>{displayPercent(totals.freeThrowMade, totals.freeThrowAttempted)}</td>
                <td>{displayNumber(modeValue(efficiency(totals), player.gamesPlayed, mode))}</td>
                <td>{displayNumber(modeValue(totals.plusMinus, player.gamesPlayed, mode))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const comparisonLabels = {
  better: "Melhor",
  worse: "Menor",
  equal: "Empate",
  unavailable: "Indisponível",
} as const;

export function StatisticsExplorer({
  context,
  statistics,
}: {
  context: CompetitionContext;
  statistics: CompetitionStatisticsDto;
}) {
  const [mode, setMode] = useState<StatisticsMode>("averages");
  const [filters, setFilters] = useState<StatisticFilter[]>([]);
  const [metric, setMetric] = useState<FilterMetric>("points");
  const [operator, setOperator] = useState<FilterOperator>(">=");
  const [filterValue, setFilterValue] = useState("");
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");

  if (statistics.kind === "simple") {
    return statistics.players.length > 0 ? (
      <SimpleStatisticsTable context={context} players={statistics.players} />
    ) : (
      <p className="empty-resource">Ainda não há jogos finalizados com estatísticas.</p>
    );
  }

  const filteredPlayers = applyStatisticFilters(statistics.players, filters, mode);
  const left = statistics.players.find((player) => String(player.playerId) === leftId);
  const right = statistics.players.find((player) => String(player.playerId) === rightId);

  return (
    <section className="statistics-explorer" aria-label="Estatísticas da edição">
      <div className="statistics-toolbar">
        <fieldset>
          <legend>Escala dos dados</legend>
          <label>
            <input
              checked={mode === "averages"}
              name="statisticsMode"
              onChange={() => setMode("averages")}
              type="radio"
            />
            Média por jogo
          </label>
          <label>
            <input
              checked={mode === "totals"}
              name="statisticsMode"
              onChange={() => setMode("totals")}
              type="radio"
            />
            Totais
          </label>
        </fieldset>

        <form
          className="statistics-filter-form"
          onSubmit={(event) => {
            event.preventDefault();
            const value = Number(filterValue.replace(",", "."));
            if (!Number.isFinite(value) || filterValue.trim() === "") return;
            setFilters((current) => [
              ...current,
              { id: crypto.randomUUID(), metric, operator, value },
            ]);
            setFilterValue("");
          }}
        >
          <strong>Adicionar filtro</strong>
          <label>
            Métrica
            <select
              value={metric}
              onChange={(event) => setMetric(event.target.value as FilterMetric)}
            >
              {Object.entries(metricLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Operador
            <select
              value={operator}
              onChange={(event) => setOperator(event.target.value as FilterOperator)}
            >
              {[">=", "<=", ">", "<"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Valor
            <input
              inputMode="decimal"
              onChange={(event) => setFilterValue(event.target.value)}
              required
              value={filterValue}
            />
          </label>
          <button type="submit">Aplicar</button>
        </form>
      </div>

      {filters.length > 0 ? (
        <ul className="active-filters" aria-label="Filtros ativos">
          {filters.map((filter) => (
            <li key={filter.id}>
              {metricLabels[filter.metric]} {filter.operator} {displayNumber(filter.value)}
              <button
                aria-label={`Remover filtro ${metricLabels[filter.metric]}`}
                onClick={() =>
                  setFilters((current) => current.filter((item) => item.id !== filter.id))
                }
                type="button"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {filteredPlayers.length > 0 ? (
        <AdvancedStatisticsTable context={context} mode={mode} players={filteredPlayers} />
      ) : (
        <p className="empty-resource">Nenhum atleta atende aos filtros ativos.</p>
      )}

      <section className="comparison-panel" aria-labelledby="comparison-title">
        <div>
          <p className="eyebrow">Comparação acessível</p>
          <h2 id="comparison-title">Comparar dois atletas</h2>
        </div>
        <div className="comparison-selectors">
          <label>
            Primeiro atleta
            <select value={leftId} onChange={(event) => setLeftId(event.target.value)}>
              <option value="">Selecione</option>
              {statistics.players.map((player) => (
                <option
                  disabled={String(player.playerId) === rightId}
                  key={player.playerId}
                  value={player.playerId}
                >
                  {player.playerName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Segundo atleta
            <select value={rightId} onChange={(event) => setRightId(event.target.value)}>
              <option value="">Selecione</option>
              {statistics.players.map((player) => (
                <option
                  disabled={String(player.playerId) === leftId}
                  key={player.playerId}
                  value={player.playerId}
                >
                  {player.playerName}
                </option>
              ))}
            </select>
          </label>
        </div>
        {left && right ? (
          <ul className="comparison-grid">
            {(["points", "rebounds", "assists", "efficiency"] as const).map((item) => {
              const states = compareStatistic(left, right, item, mode);
              return (
                <li key={item}>
                  <strong>{metricLabels[item]}</strong>
                  <p data-comparison={states.left}>
                    {left.playerName}: {displayNumber(statisticValue(left, item, mode))} —{" "}
                    {comparisonLabels[states.left]}
                  </p>
                  <p data-comparison={states.right}>
                    {right.playerName}: {displayNumber(statisticValue(right, item, mode))} —{" "}
                    {comparisonLabels[states.right]}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p>Selecione dois atletas desta edição para iniciar.</p>
        )}
      </section>
    </section>
  );
}
