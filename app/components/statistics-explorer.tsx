import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";

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
import {
  advancedColumnPresets,
  compareValues,
  matchesStatisticsSearch,
  nextSort,
  parseColumns,
  parseColumnPreset,
  parseSortDirection,
  parseSortKey,
  serializeColumns,
  type AdvancedColumn,
  type ColumnPreset,
  type SortDirection,
  type StatisticsSortKey,
} from "../modules/statistics/table-controls";
import { ResourceState } from "./resource-state";
import { ScrollableTable } from "./scrollable-table";

const metricLabels: Record<FilterMetric, string> = {
  points: "PTS",
  rebounds: "REB",
  assists: "AST",
  steals: "STL",
  blocks: "BLK",
  efficiency: "EF",
};

const columnLabels: Record<AdvancedColumn, string> = {
  games: "J",
  minutes: "MIN",
  points: "PTS",
  rebounds: "REB",
  offensiveRebounds: "RO",
  defensiveRebounds: "RD",
  assists: "AST",
  fieldGoals: "AC/AT",
  fieldGoalPercentage: "FG%",
  threePointers: "3PC/3PT",
  threePointPercentage: "3P%",
  freeThrows: "LLC/LLT",
  freeThrowPercentage: "LL%",
  efficiency: "EF",
  plusMinus: "+/-",
};

const columnSortKeys: Partial<Record<AdvancedColumn, StatisticsSortKey>> = {
  games: "games",
  minutes: "minutes",
  points: "points",
  rebounds: "rebounds",
  assists: "assists",
  efficiency: "efficiency",
  plusMinus: "plusMinus",
};

const presetLabels: Record<ColumnPreset, string> = {
  summary: "Resumo",
  shooting: "Arremessos",
  complete: "Completo",
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

function SortButton({
  active,
  direction,
  label,
  onClick,
}: {
  active: boolean;
  direction: SortDirection;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="statistics-sort"
      onClick={onClick}
      title={`Ordenar por ${label}`}
      type="button"
    >
      <span>{label}</span>
      <span aria-hidden="true">{active ? (direction === "asc" ? "↑" : "↓") : "↕"}</span>
      <span className="sr-only">
        {active
          ? `Ordenação ${direction === "asc" ? "crescente" : "decrescente"}`
          : "Sem ordenação"}
      </span>
    </button>
  );
}

function headerSort(
  key: StatisticsSortKey,
  label: string,
  sortKey: StatisticsSortKey,
  direction: SortDirection,
  onSort: (key: StatisticsSortKey) => void,
) {
  return (
    <th
      aria-sort={sortKey === key ? (direction === "asc" ? "ascending" : "descending") : "none"}
      scope="col"
    >
      <SortButton
        active={sortKey === key}
        direction={direction}
        label={label}
        onClick={() => onSort(key)}
      />
    </th>
  );
}

function SimpleStatisticsTable({
  context,
  direction,
  onSort,
  players,
  sortKey,
}: {
  context: CompetitionContext;
  direction: SortDirection;
  onSort: (key: StatisticsSortKey) => void;
  players: SimplePlayerStatistics[];
  sortKey: StatisticsSortKey;
}) {
  return (
    <ScrollableTable label="Estatísticas simplificadas da edição">
      <table className="statistics-table">
        <caption>Estatísticas simplificadas da edição</caption>
        <thead>
          <tr>
            {headerSort("player", "Atleta", sortKey, direction, onSort)}
            {headerSort("team", "Equipe", sortKey, direction, onSort)}
            {headerSort("games", "J", sortKey, direction, onSort)}
            {headerSort("pointsPerGame", "PTS/J", sortKey, direction, onSort)}
            {headerSort("points", "PTS", sortKey, direction, onSort)}
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.playerId}>
              <th scope="row">
                <Link to={playerPath(context, player)}>{player.playerName}</Link>
              </th>
              <td>{player.teamName ?? "—"}</td>
              <td>{player.gamesPlayed}</td>
              <td>{displayNumber(player.pointsPerGame)}</td>
              <td>{player.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollableTable>
  );
}

function advancedCell(
  player: PlayerStatistics,
  column: AdvancedColumn,
  mode: StatisticsMode,
): ReactNode {
  const { totals } = player;
  const fieldMade = totals.twoPointMade + totals.threePointMade;
  const fieldAttempted = totals.twoPointAttempted + totals.threePointAttempted;
  switch (column) {
    case "games":
      return player.gamesPlayed;
    case "minutes":
      return displayNumber(modeValue(totals.secondsPlayed / 60, player.gamesPlayed, mode));
    case "points":
      return displayNumber(modeValue(totals.points, player.gamesPlayed, mode));
    case "rebounds":
      return displayNumber(modeValue(rebounds(totals), player.gamesPlayed, mode));
    case "offensiveRebounds":
      return displayNumber(modeValue(totals.offensiveRebounds, player.gamesPlayed, mode));
    case "defensiveRebounds":
      return displayNumber(modeValue(totals.defensiveRebounds, player.gamesPlayed, mode));
    case "assists":
      return displayNumber(modeValue(totals.assists, player.gamesPlayed, mode));
    case "fieldGoals":
      return madeAttempted(fieldMade, fieldAttempted, player.gamesPlayed, mode);
    case "fieldGoalPercentage":
      return displayPercent(fieldMade, fieldAttempted);
    case "threePointers":
      return madeAttempted(
        totals.threePointMade,
        totals.threePointAttempted,
        player.gamesPlayed,
        mode,
      );
    case "threePointPercentage":
      return displayPercent(totals.threePointMade, totals.threePointAttempted);
    case "freeThrows":
      return madeAttempted(
        totals.freeThrowMade,
        totals.freeThrowAttempted,
        player.gamesPlayed,
        mode,
      );
    case "freeThrowPercentage":
      return displayPercent(totals.freeThrowMade, totals.freeThrowAttempted);
    case "efficiency":
      return displayNumber(modeValue(efficiency(totals), player.gamesPlayed, mode));
    case "plusMinus":
      return displayNumber(modeValue(totals.plusMinus, player.gamesPlayed, mode));
  }
}

function advancedSortValue(
  player: PlayerStatistics,
  key: StatisticsSortKey,
  mode: StatisticsMode,
): number | string | null {
  switch (key) {
    case "player":
      return player.playerName;
    case "team":
      return player.teamName;
    case "games":
      return player.gamesPlayed;
    case "minutes":
      return modeValue(player.totals.secondsPlayed, player.gamesPlayed, mode);
    case "points":
      return modeValue(player.totals.points, player.gamesPlayed, mode);
    case "pointsPerGame":
      return perGame(player.totals.points, player.gamesPlayed);
    case "rebounds":
      return modeValue(rebounds(player.totals), player.gamesPlayed, mode);
    case "assists":
      return modeValue(player.totals.assists, player.gamesPlayed, mode);
    case "efficiency":
      return modeValue(efficiency(player.totals), player.gamesPlayed, mode);
    case "plusMinus":
      return modeValue(player.totals.plusMinus, player.gamesPlayed, mode);
  }
}

function AdvancedStatisticsTable({
  columns,
  context,
  direction,
  mode,
  onSort,
  players,
  sortKey,
}: {
  columns: AdvancedColumn[];
  context: CompetitionContext;
  direction: SortDirection;
  mode: StatisticsMode;
  onSort: (key: StatisticsSortKey) => void;
  players: PlayerStatistics[];
  sortKey: StatisticsSortKey;
}) {
  return (
    <ScrollableTable label="Estatísticas avançadas da edição">
      <table className="statistics-table statistics-table-advanced">
        <caption>
          Estatísticas avançadas — {mode === "totals" ? "totais" : "média por jogo"}
        </caption>
        <thead>
          <tr>
            {headerSort("player", "Atleta", sortKey, direction, onSort)}
            {headerSort("team", "Equipe", sortKey, direction, onSort)}
            {columns.map((column) => {
              const sortableKey = columnSortKeys[column];
              return sortableKey ? (
                <th
                  aria-sort={
                    sortKey === sortableKey
                      ? direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  key={column}
                  scope="col"
                >
                  <SortButton
                    active={sortKey === sortableKey}
                    direction={direction}
                    label={columnLabels[column]}
                    onClick={() => onSort(sortableKey)}
                  />
                </th>
              ) : (
                <th key={column} scope="col">
                  {columnLabels[column]}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.playerId}>
              <th scope="row">
                <Link to={playerPath(context, player)}>{player.playerName}</Link>
              </th>
              <td>{player.teamName ?? "—"}</td>
              {columns.map((column) => (
                <td key={column}>{advancedCell(player, column, mode)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollableTable>
  );
}

const comparisonLabels = {
  better: "Melhor",
  worse: "Menor",
  equal: "Empate",
  unavailable: "Indisponível",
} as const;

function filterFromUrl(searchParams: URLSearchParams): StatisticFilter[] {
  return searchParams
    .getAll("filter")
    .map((value, index): StatisticFilter | null => {
      const [metric, operator, rawValue] = value.split(":");
      const numericValue = Number(rawValue);
      if (
        !(metric in metricLabels) ||
        ![">=", "<=", ">", "<"].includes(operator) ||
        !Number.isFinite(numericValue)
      ) {
        return null;
      }
      return {
        id: `url-${index}-${metric}`,
        metric: metric as FilterMetric,
        operator: operator as FilterOperator,
        value: numericValue,
      };
    })
    .filter((filter): filter is StatisticFilter => filter !== null);
}

export function StatisticsExplorer({
  context,
  statistics,
}: {
  context: CompetitionContext;
  statistics: CompetitionStatisticsDto;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const preset = parseColumnPreset(searchParams.get("preset"));
  const [columns, setColumns] = useState<AdvancedColumn[]>(() =>
    parseColumns(searchParams.get("cols"), preset),
  );
  const [filters, setFilters] = useState<StatisticFilter[]>(() => filterFromUrl(searchParams));
  const [metric, setMetric] = useState<FilterMetric>("points");
  const [operator, setOperator] = useState<FilterOperator>(">=");
  const [filterValue, setFilterValue] = useState("");
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const mode: StatisticsMode = searchParams.get("scale") === "totals" ? "totals" : "averages";
  const query = searchParams.get("q") ?? "";
  const sortKey = parseSortKey(
    searchParams.get("sort"),
    statistics.kind === "simple" ? "pointsPerGame" : "points",
  );
  const direction = parseSortDirection(searchParams.get("dir"));
  const storageKey = `bask.statistics.columns.${context.competitionId}`;

  const replaceParams = (change: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams);
    change(next);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (searchParams.has("cols")) return;
    const saved = window.localStorage.getItem(storageKey);
    if (saved) setColumns(parseColumns(saved, preset));
  }, [preset, searchParams, storageKey]);

  const setVisibleColumns = (nextColumns: AdvancedColumn[], nextPreset?: ColumnPreset) => {
    setColumns(nextColumns);
    window.localStorage.setItem(storageKey, serializeColumns(nextColumns));
    replaceParams((next) => {
      next.set("cols", serializeColumns(nextColumns));
      if (nextPreset) next.set("preset", nextPreset);
      else next.delete("preset");
    });
  };

  const sort = (key: StatisticsSortKey) => {
    const nextSortState = nextSort(sortKey, direction, key);
    replaceParams((next) => {
      next.set("sort", nextSortState.key);
      next.set("dir", nextSortState.direction);
    });
  };

  const searchedPlayers = useMemo(
    () => statistics.players.filter((player) => matchesStatisticsSearch(player, query)),
    [query, statistics.players],
  );

  const sortedSimplePlayers = useMemo(() => {
    if (statistics.kind !== "simple") return [];
    return [...searchedPlayers].sort((left, right) => {
      const value = (player: SimplePlayerStatistics): number | string | null => {
        if (sortKey === "player") return player.playerName;
        if (sortKey === "team") return player.teamName;
        if (sortKey === "games") return player.gamesPlayed;
        if (sortKey === "points") return player.points;
        return player.pointsPerGame;
      };
      return (
        compareValues(value(left), value(right), direction) ||
        left.playerName.localeCompare(right.playerName, "pt-BR")
      );
    }) as SimplePlayerStatistics[];
  }, [direction, searchedPlayers, sortKey, statistics.kind]);

  const advancedPlayers = useMemo(() => {
    if (statistics.kind !== "advanced") return [];
    const filtered = applyStatisticFilters(searchedPlayers as PlayerStatistics[], filters, mode);
    return [...filtered].sort(
      (left, right) =>
        compareValues(
          advancedSortValue(left, sortKey, mode),
          advancedSortValue(right, sortKey, mode),
          direction,
        ) || left.playerName.localeCompare(right.playerName, "pt-BR"),
    );
  }, [direction, filters, mode, searchedPlayers, sortKey, statistics.kind]);

  const updateFilters = (nextFilters: StatisticFilter[]) => {
    setFilters(nextFilters);
    replaceParams((next) => {
      next.delete("filter");
      for (const filter of nextFilters) {
        next.append("filter", `${filter.metric}:${filter.operator}:${filter.value}`);
      }
    });
  };

  return (
    <section className="statistics-explorer" aria-label="Estatísticas da edição">
      <div className="statistics-controls">
        <label className="statistics-search">
          Buscar atleta ou equipe
          <input
            onChange={(event) =>
              replaceParams((next) => {
                if (event.target.value) next.set("q", event.target.value);
                else next.delete("q");
              })
            }
            placeholder="Digite um nome"
            type="search"
            value={query}
          />
        </label>
        <p aria-live="polite" className="statistics-result-count">
          {statistics.kind === "simple" ? sortedSimplePlayers.length : advancedPlayers.length}{" "}
          resultado(s)
        </p>
      </div>

      {statistics.kind === "advanced" ? (
        <>
          <div className="statistics-toolbar">
            <fieldset>
              <legend>Escala dos dados</legend>
              {(["averages", "totals"] as const).map((value) => (
                <label key={value}>
                  <input
                    checked={mode === value}
                    name="statisticsMode"
                    onChange={() => replaceParams((next) => next.set("scale", value))}
                    type="radio"
                  />
                  {value === "averages" ? "Média por jogo" : "Totais"}
                </label>
              ))}
            </fieldset>

            <form
              className="statistics-filter-form"
              onSubmit={(event) => {
                event.preventDefault();
                const value = Number(filterValue.replace(",", "."));
                if (!Number.isFinite(value) || filterValue.trim() === "") return;
                updateFilters([...filters, { id: crypto.randomUUID(), metric, operator, value }]);
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

          <fieldset className="statistics-columns">
            <legend>Colunas visíveis</legend>
            <div className="column-presets">
              {(Object.keys(advancedColumnPresets) as ColumnPreset[]).map((item) => (
                <button
                  aria-pressed={preset === item}
                  key={item}
                  onClick={() => setVisibleColumns(advancedColumnPresets[item], item)}
                  type="button"
                >
                  {presetLabels[item]}
                </button>
              ))}
            </div>
            <details>
              <summary>Personalizar</summary>
              <div className="column-options">
                {advancedColumnPresets.complete.map((column) => (
                  <label key={column}>
                    <input
                      checked={columns.includes(column)}
                      onChange={(event) => {
                        const nextColumns = event.target.checked
                          ? [...columns, column]
                          : columns.filter((item) => item !== column);
                        if (nextColumns.length > 0) setVisibleColumns(nextColumns);
                      }}
                      type="checkbox"
                    />
                    {columnLabels[column]}
                  </label>
                ))}
              </div>
            </details>
          </fieldset>

          {filters.length > 0 ? (
            <ul className="active-filters" aria-label="Filtros ativos">
              {filters.map((filter) => (
                <li key={filter.id}>
                  {metricLabels[filter.metric]} {filter.operator} {displayNumber(filter.value)}
                  <button
                    aria-label={`Remover filtro ${metricLabels[filter.metric]}`}
                    onClick={() => updateFilters(filters.filter((item) => item.id !== filter.id))}
                    type="button"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}

      {(statistics.kind === "simple" ? sortedSimplePlayers : advancedPlayers).length > 0 ? (
        statistics.kind === "simple" ? (
          <SimpleStatisticsTable
            context={context}
            direction={direction}
            onSort={sort}
            players={sortedSimplePlayers}
            sortKey={sortKey}
          />
        ) : (
          <>
            <AdvancedStatisticsTable
              columns={columns}
              context={context}
              direction={direction}
              mode={mode}
              onSort={sort}
              players={advancedPlayers}
              sortKey={sortKey}
            />
            <ol className="statistics-mobile-summary">
              {advancedPlayers.slice(0, 3).map((player) => (
                <li key={player.playerId}>
                  <Link to={playerPath(context, player)}>{player.playerName}</Link>
                  <span>{player.teamName ?? "Sem equipe"}</span>
                  <strong>
                    {displayNumber(perGame(player.totals.points, player.gamesPlayed))} PTS/J
                  </strong>
                </li>
              ))}
            </ol>
          </>
        )
      ) : (
        <ResourceState
          detail={
            query || filters.length > 0
              ? "Remova ou ajuste a busca e os filtros para ver outros resultados."
              : "As estatísticas aparecerão após a publicação do primeiro jogo finalizado."
          }
          kind="empty"
          title={query || filters.length > 0 ? "Nenhum resultado encontrado" : undefined}
        />
      )}

      {statistics.kind === "advanced" ? (
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
          {(() => {
            const left = statistics.players.find((player) => String(player.playerId) === leftId);
            const right = statistics.players.find((player) => String(player.playerId) === rightId);
            return left && right ? (
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
            );
          })()}
        </section>
      ) : null}
    </section>
  );
}
