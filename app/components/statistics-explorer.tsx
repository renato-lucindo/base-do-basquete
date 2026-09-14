import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
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
  ScoresheetPlayerStatistics,
} from "../modules/statistics/public-statistics.server";
import {
  advancedColumnPresets,
  compareValues,
  matchesStatisticsSearch,
  nextSort,
  parseColumns,
  parseColumnPreset,
  parsePage,
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

const PAGE_SIZE = 20;
const filterOperators: FilterOperator[] = [">=", ">", "<=", "<", "="];

const metricLabels: Record<FilterMetric, string> = {
  games: "J",
  minutes: "MIN",
  points: "PTS",
  rebounds: "REB",
  offensiveRebounds: "RO",
  defensiveRebounds: "RD",
  assists: "AST",
  steals: "BR",
  blocks: "TO",
  turnovers: "ER",
  fouls: "FC",
  fieldGoalPercentage: "AP%",
  threePointPercentage: "3P%",
  freeThrowPercentage: "LL%",
  efficiency: "EF",
  plusMinus: "+/-",
};

const columnLabels: Record<AdvancedColumn, string> = {
  games: "J",
  minutes: "MIN",
  points: "PTS",
  rebounds: "REB",
  offensiveRebounds: "RO",
  defensiveRebounds: "RD",
  assists: "AST",
  steals: "BR",
  blocks: "TO",
  turnovers: "ER",
  fouls: "FC",
  fieldGoals: "AC/AT",
  fieldGoalPercentage: "AP%",
  threePointers: "3PC/3PT",
  threePointPercentage: "3P%",
  freeThrows: "LLC/LLT",
  freeThrowPercentage: "LL%",
  efficiency: "EF",
  plusMinus: "+/-",
};

const legendLabels: Record<AdvancedColumn, string> = {
  games: "Jogos disputados",
  minutes: "Minutos",
  points: "Pontos",
  rebounds: "Rebotes totais",
  offensiveRebounds: "Rebotes ofensivos",
  defensiveRebounds: "Rebotes defensivos",
  assists: "Assistências",
  steals: "Bolas roubadas",
  blocks: "Tocos",
  turnovers: "Erros",
  fouls: "Faltas cometidas",
  fieldGoals: "Arremessos convertidos/tentados",
  fieldGoalPercentage: "Aproveitamento de arremessos",
  threePointers: "Arremessos de três convertidos/tentados",
  threePointPercentage: "Aproveitamento de três pontos",
  freeThrows: "Lances livres convertidos/tentados",
  freeThrowPercentage: "Aproveitamento de lances livres",
  efficiency: "Eficiência",
  plusMinus: "Mais/menos",
};

const presetLabels: Record<ColumnPreset, string> = {
  essentials: "Essenciais",
  all: "Todas",
  custom: "Personalizadas",
};

const columnSortKeys: Record<AdvancedColumn, StatisticsSortKey> = {
  games: "games",
  minutes: "minutes",
  points: "points",
  rebounds: "rebounds",
  offensiveRebounds: "offensiveRebounds",
  defensiveRebounds: "defensiveRebounds",
  assists: "assists",
  steals: "steals",
  blocks: "blocks",
  turnovers: "turnovers",
  fouls: "fouls",
  fieldGoals: "fieldGoals",
  fieldGoalPercentage: "fieldGoalPercentage",
  threePointers: "threePointers",
  threePointPercentage: "threePointPercentage",
  freeThrows: "freeThrows",
  freeThrowPercentage: "freeThrowPercentage",
  efficiency: "efficiency",
  plusMinus: "plusMinus",
};

const comparisonMetrics: FilterMetric[] = [
  "points",
  "rebounds",
  "assists",
  "fieldGoalPercentage",
  "threePointPercentage",
  "freeThrowPercentage",
  "efficiency",
  "plusMinus",
  "turnovers",
  "fouls",
];

interface DraftFilter {
  id: string;
  metric: FilterMetric;
  operator: FilterOperator;
  value: string;
}

function newDraftFilter(index = 0): DraftFilter {
  return { id: `draft-${Date.now()}-${index}`, metric: "points", operator: ">=", value: "" };
}

function displayNumber(value: number | null, digits = 1): string {
  if (value === null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(digits).replace(".", ",");
}

function displayPercent(made: number, attempted: number): string {
  const value = percentage(made, attempted);
  return value === null ? "—" : `${displayNumber(value)}%`;
}

function playerPath(
  context: CompetitionContext,
  player: { playerSlug: string },
  searchParams?: URLSearchParams,
): string {
  const pathname = contextPath(context, "jogadores", player.playerSlug);
  if (!searchParams || searchParams.size === 0) return pathname;
  return `${pathname}?${searchParams.toString()}`;
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
    <button className="statistics-sort" onClick={onClick} type="button">
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

function SortHeader({
  activeKey,
  direction,
  label,
  onSort,
  sortKey,
}: {
  activeKey: StatisticsSortKey;
  direction: SortDirection;
  label: string;
  onSort: (key: StatisticsSortKey) => void;
  sortKey: StatisticsSortKey;
}) {
  return (
    <th
      aria-sort={
        activeKey === sortKey ? (direction === "asc" ? "ascending" : "descending") : "none"
      }
      scope="col"
    >
      <SortButton
        active={activeKey === sortKey}
        direction={direction}
        label={label}
        onClick={() => onSort(sortKey)}
      />
    </th>
  );
}

function advancedCell(
  player: PlayerStatistics,
  column: AdvancedColumn,
  mode: StatisticsMode,
): ReactNode {
  const totals = player.advancedTotals;
  if (column === "games") return player.gamesPlayed;
  if (column === "points") {
    return displayNumber(modeValue(player.officialPoints, player.gamesPlayed, mode));
  }
  if (column === "fouls") {
    return displayNumber(
      player.fouls === null ? null : modeValue(player.fouls, player.gamesPlayed, mode),
    );
  }
  if (totals === null) return "—";
  const fieldMade = totals.twoPointMade + totals.threePointMade;
  const fieldAttempted = totals.twoPointAttempted + totals.threePointAttempted;
  switch (column) {
    case "minutes":
      return displayNumber(modeValue(totals.secondsPlayed / 60, player.advancedGamesPlayed, mode));
    case "rebounds":
      return displayNumber(modeValue(rebounds(totals), player.advancedGamesPlayed, mode));
    case "offensiveRebounds":
      return displayNumber(modeValue(totals.offensiveRebounds, player.advancedGamesPlayed, mode));
    case "defensiveRebounds":
      return displayNumber(modeValue(totals.defensiveRebounds, player.advancedGamesPlayed, mode));
    case "assists":
      return displayNumber(modeValue(totals.assists, player.advancedGamesPlayed, mode));
    case "steals":
      return displayNumber(modeValue(totals.steals, player.advancedGamesPlayed, mode));
    case "blocks":
      return displayNumber(modeValue(totals.blocks, player.advancedGamesPlayed, mode));
    case "turnovers":
      return displayNumber(modeValue(totals.turnovers, player.advancedGamesPlayed, mode));
    case "fieldGoals":
      return madeAttempted(fieldMade, fieldAttempted, player.advancedGamesPlayed, mode);
    case "fieldGoalPercentage":
      return displayPercent(fieldMade, fieldAttempted);
    case "threePointers":
      return madeAttempted(
        totals.threePointMade,
        totals.threePointAttempted,
        player.advancedGamesPlayed,
        mode,
      );
    case "threePointPercentage":
      return displayPercent(totals.threePointMade, totals.threePointAttempted);
    case "freeThrows":
      return madeAttempted(
        totals.freeThrowMade,
        totals.freeThrowAttempted,
        player.advancedGamesPlayed,
        mode,
      );
    case "freeThrowPercentage":
      return displayPercent(totals.freeThrowMade, totals.freeThrowAttempted);
    case "efficiency":
      return displayNumber(modeValue(efficiency(totals), player.advancedGamesPlayed, mode));
    case "plusMinus":
      return displayNumber(modeValue(totals.plusMinus, player.advancedGamesPlayed, mode));
  }
}

function advancedSortValue(
  player: PlayerStatistics,
  key: StatisticsSortKey,
  mode: StatisticsMode,
): number | string | null {
  if (key === "player") return player.playerName;
  if (key === "team") return player.teamName;
  if (key === "pointsPerGame") return perGame(player.officialPoints, player.gamesPlayed);
  if (player.advancedTotals === null) return statisticValue(player, key as FilterMetric, mode);
  if (key === "fieldGoals") {
    return modeValue(
      player.advancedTotals.twoPointMade + player.advancedTotals.threePointMade,
      player.advancedGamesPlayed,
      mode,
    );
  }
  if (key === "threePointers") {
    return modeValue(player.advancedTotals.threePointMade, player.advancedGamesPlayed, mode);
  }
  if (key === "freeThrows") {
    return modeValue(player.advancedTotals.freeThrowMade, player.advancedGamesPlayed, mode);
  }
  return statisticValue(player, key as FilterMetric, mode);
}

function TeamCell({ player }: { player: PlayerStatistics | ScoresheetPlayerStatistics }) {
  if (!player.teamName) return <>—</>;
  return (
    <abbr aria-label={player.teamName} title={player.teamName}>
      {player.teamAbbreviation ?? player.teamName}
    </abbr>
  );
}

function AdvancedStatisticsTable({
  columns,
  context,
  direction,
  mode,
  onSort,
  players,
  searchParams,
  sortKey,
}: {
  columns: AdvancedColumn[];
  context: CompetitionContext;
  direction: SortDirection;
  mode: StatisticsMode;
  onSort: (key: StatisticsSortKey) => void;
  players: PlayerStatistics[];
  searchParams: URLSearchParams;
  sortKey: StatisticsSortKey;
}) {
  return (
    <ScrollableTable label="Estatísticas dos jogadores">
      <table className="statistics-table statistics-table-advanced">
        <caption>Estatísticas — {mode === "totals" ? "Total" : "Por jogo"}</caption>
        <colgroup>
          <col className="column-player" />
          <col className="column-team" />
          {columns.map((column) => (
            <col
              className={
                ["fieldGoals", "threePointers", "freeThrows"].includes(column)
                  ? "column-composite"
                  : "column-metric"
              }
              key={column}
            />
          ))}
        </colgroup>
        <thead>
          <tr>
            <SortHeader
              activeKey={sortKey}
              direction={direction}
              label="Atleta"
              onSort={onSort}
              sortKey="player"
            />
            <SortHeader
              activeKey={sortKey}
              direction={direction}
              label="Equipe"
              onSort={onSort}
              sortKey="team"
            />
            {columns.map((column) => (
              <SortHeader
                activeKey={sortKey}
                direction={direction}
                key={column}
                label={columnLabels[column]}
                onSort={onSort}
                sortKey={columnSortKeys[column]}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.playerId}>
              <th scope="row">
                <Link to={playerPath(context, player, searchParams)}>{player.playerName}</Link>
              </th>
              <td>
                <TeamCell player={player} />
              </td>
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

function ScoresheetStatisticsTable({
  context,
  direction,
  onSort,
  players,
  positionOffset,
  searchParams,
  showDisqualifications,
  sortKey,
}: {
  context: CompetitionContext;
  direction: SortDirection;
  onSort: (key: StatisticsSortKey) => void;
  players: ScoresheetPlayerStatistics[];
  positionOffset: number;
  searchParams: URLSearchParams;
  showDisqualifications: boolean;
  sortKey: StatisticsSortKey;
}) {
  return (
    <ScrollableTable label="Estatísticas de súmula dos jogadores">
      <table className="statistics-table statistics-table-scoresheet">
        <caption>Dados registrados por súmula</caption>
        <colgroup>
          <col className="column-position" />
          <col className="column-player" />
          <col className="column-team" />
          <col span={7} className="column-metric" />
          {showDisqualifications ? <col className="column-metric" /> : null}
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Pos.</th>
            <SortHeader
              activeKey={sortKey}
              direction={direction}
              label="Atleta"
              onSort={onSort}
              sortKey="player"
            />
            <SortHeader
              activeKey={sortKey}
              direction={direction}
              label="Equipe"
              onSort={onSort}
              sortKey="team"
            />
            <SortHeader
              activeKey={sortKey}
              direction={direction}
              label="J"
              onSort={onSort}
              sortKey="games"
            />
            <SortHeader
              activeKey={sortKey}
              direction={direction}
              label="PTS"
              onSort={onSort}
              sortKey="points"
            />
            <SortHeader
              activeKey={sortKey}
              direction={direction}
              label="PTS/J"
              onSort={onSort}
              sortKey="pointsPerGame"
            />
            <SortHeader
              activeKey={sortKey}
              direction={direction}
              label="2PC"
              onSort={onSort}
              sortKey="twoPointMade"
            />
            <SortHeader
              activeKey={sortKey}
              direction={direction}
              label="3PC"
              onSort={onSort}
              sortKey="threePointMade"
            />
            <SortHeader
              activeKey={sortKey}
              direction={direction}
              label="LLC"
              onSort={onSort}
              sortKey="freeThrowMade"
            />
            <SortHeader
              activeKey={sortKey}
              direction={direction}
              label="F"
              onSort={onSort}
              sortKey="fouls"
            />
            {showDisqualifications ? (
              <SortHeader
                activeKey={sortKey}
                direction={direction}
                label="GD"
                onSort={onSort}
                sortKey="disqualifications"
              />
            ) : null}
          </tr>
        </thead>
        <tbody>
          {players.map((player, index) => (
            <tr key={player.playerId}>
              <td>{positionOffset + index + 1}</td>
              <th scope="row">
                <Link to={playerPath(context, player, searchParams)}>{player.playerName}</Link>
              </th>
              <td>
                <TeamCell player={player} />
              </td>
              <td>{player.gamesPlayed}</td>
              <td>{displayNumber(player.points)}</td>
              <td>{displayNumber(player.pointsPerGame)}</td>
              <td className="scoresheet-extra-metric">{displayNumber(player.twoPointMade)}</td>
              <td className="scoresheet-extra-metric">{displayNumber(player.threePointMade)}</td>
              <td className="scoresheet-extra-metric">{displayNumber(player.freeThrowMade)}</td>
              <td className="scoresheet-extra-metric">{displayNumber(player.fouls)}</td>
              {showDisqualifications ? (
                <td className="scoresheet-extra-metric">
                  {displayNumber(player.disqualifications)}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollableTable>
  );
}

function filtersFromUrl(searchParams: URLSearchParams): StatisticFilter[] {
  const serialized = searchParams.get("filters")?.split(";") ?? searchParams.getAll("filter");
  return serialized.flatMap((value, index): StatisticFilter[] => {
    const [metric, operator, rawValue] = value.split(":");
    const numericValue = Number(rawValue);
    if (
      !metric ||
      !operator ||
      !(metric in metricLabels) ||
      !filterOperators.includes(operator as FilterOperator) ||
      !Number.isFinite(numericValue)
    )
      return [];
    return [
      {
        id: `url-${index}-${metric}`,
        metric: metric as FilterMetric,
        operator: operator as FilterOperator,
        value: numericValue,
      },
    ];
  });
}

function comparisonIds(searchParams: URLSearchParams): [string, string] {
  const [left = "", right = ""] = (searchParams.get("compare") ?? "").split(",");
  return [/^[1-9][0-9]*$/.test(left) ? left : "", /^[1-9][0-9]*$/.test(right) ? right : ""];
}

function Pagination({
  current,
  onPage,
  total,
}: {
  current: number;
  onPage: (page: number) => void;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const first = total === 0 ? 0 : (current - 1) * PAGE_SIZE + 1;
  const last = Math.min(current * PAGE_SIZE, total);
  return (
    <nav aria-label="Paginação dos jogadores" className="statistics-pagination">
      <span>
        {first}–{last} de {total} atletas
      </span>
      <div>
        <span>20 por página</span>
        <button disabled={current <= 1} onClick={() => onPage(current - 1)} type="button">
          Anterior
        </button>
        <span>
          Página {current} de {pages}
        </span>
        <button disabled={current >= pages} onClick={() => onPage(current + 1)} type="button">
          Próxima
        </button>
      </div>
    </nav>
  );
}

function ComparisonDialog({
  context,
  mode,
  onClose,
  onSelect,
  open,
  players,
  searchParams,
  selected,
}: {
  context: CompetitionContext;
  mode: StatisticsMode;
  onClose: () => void;
  onSelect: (side: 0 | 1, id: string) => void;
  open: boolean;
  players: PlayerStatistics[];
  searchParams: URLSearchParams;
  selected: [string, string];
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [queries, setQueries] = useState<[string, string]>(["", ""]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input, select, a[href]",
        ),
      ];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      returnFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;
  const selectedPlayers = selected.map((id) =>
    players.find((player) => String(player.playerId) === id),
  );
  const options = (side: 0 | 1) =>
    players.filter((player) => matchesStatisticsSearch(player, queries[side]));
  return (
    <div className="comparison-backdrop" role="presentation">
      <div
        aria-labelledby="comparison-title"
        aria-modal="true"
        className="comparison-dialog"
        ref={dialogRef}
        role="dialog"
      >
        <header>
          <div>
            <p className="eyebrow">Comparação acessível</p>
            <h2 id="comparison-title">Comparar jogadores</h2>
          </div>
          <button
            aria-label="Fechar comparação"
            className="dialog-close"
            onClick={onClose}
            ref={closeRef}
            type="button"
          >
            ×
          </button>
        </header>
        <div className="comparison-selectors">
          {([0, 1] as const).map((side) => (
            <fieldset key={side}>
              <legend>{side === 0 ? "Primeiro atleta" : "Segundo atleta"}</legend>
              <label>
                Buscar por nome
                <input
                  onChange={(event) =>
                    setQueries((current) =>
                      side === 0
                        ? [event.target.value, current[1]]
                        : [current[0], event.target.value],
                    )
                  }
                  placeholder="Nome ou equipe"
                  type="search"
                  value={queries[side]}
                />
              </label>
              <label>
                Atleta
                <select
                  onChange={(event) => onSelect(side, event.target.value)}
                  value={selected[side]}
                >
                  <option value="">Selecione</option>
                  {options(side).map((player) => (
                    <option
                      disabled={String(player.playerId) === selected[side === 0 ? 1 : 0]}
                      key={player.playerId}
                      value={player.playerId}
                    >
                      {player.playerName} · {player.teamName ?? "Sem equipe"}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          ))}
        </div>
        {selectedPlayers[0] && selectedPlayers[1] ? (
          <ul className="comparison-grid">
            {comparisonMetrics.map((metric) => {
              const states = compareStatistic(
                selectedPlayers[0] as PlayerStatistics,
                selectedPlayers[1] as PlayerStatistics,
                metric,
                mode,
              );
              return (
                <li key={metric}>
                  <strong>{metricLabels[metric]}</strong>
                  {([0, 1] as const).map((side) => {
                    const player = selectedPlayers[side] as PlayerStatistics;
                    const state = side === 0 ? states.left : states.right;
                    return (
                      <p data-comparison={state} key={player.playerId}>
                        <Link to={playerPath(context, player, searchParams)}>
                          {player.playerName}
                        </Link>
                        : {displayNumber(statisticValue(player, metric, mode))} —{" "}
                        <span>
                          {state === "better"
                            ? "Melhor"
                            : state === "worse"
                              ? "Pior"
                              : state === "equal"
                                ? "Empate"
                                : "Indisponível"}
                        </span>
                      </p>
                    );
                  })}
                </li>
              );
            })}
          </ul>
        ) : (
          <p>Selecione dois atletas diferentes para iniciar a comparação.</p>
        )}
      </div>
    </div>
  );
}

export function StatisticsExplorer({
  context,
  statistics,
}: {
  context: CompetitionContext;
  statistics: CompetitionStatisticsDto;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const preset = parseColumnPreset(searchParams.get("columns") ?? searchParams.get("preset"));
  const [columns, setColumns] = useState<AdvancedColumn[]>(() =>
    parseColumns(searchParams.get("visible") ?? searchParams.get("cols"), preset),
  );
  const [filters, setFilters] = useState<StatisticFilter[]>(() => filtersFromUrl(searchParams));
  const [draftFilters, setDraftFilters] = useState<DraftFilter[]>(() =>
    filters.length
      ? filters.map((filter) => ({ ...filter, value: String(filter.value) }))
      : [newDraftFilter()],
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const selectedRef = useRef<[string, string]>(comparisonIds(searchParams));
  const [selected, setSelected] = useState<[string, string]>(selectedRef.current);
  const [comparisonOpen, setComparisonOpen] = useState(Boolean(selected[0] || selected[1]));
  const [customOpen, setCustomOpen] = useState(false);
  const [filterError, setFilterError] = useState("");
  const mode: StatisticsMode =
    (searchParams.get("mode") ?? searchParams.get("scale")) === "total" ||
    searchParams.get("scale") === "totals"
      ? "totals"
      : "averages";
  const query = searchParams.get("q") ?? "";
  const selectedTeam = searchParams.get("team") ?? "";
  const parsedSort = parseSortKey(searchParams.get("sort"), "points");
  const visibleSorts = new Set<StatisticsSortKey>([
    "player",
    "team",
    ...columns.map((column) => columnSortKeys[column]),
  ]);
  const sortKey =
    statistics.kind === "boxscore" && !visibleSorts.has(parsedSort) ? "player" : parsedSort;
  const direction = parseSortDirection(searchParams.get("dir"));

  useEffect(() => {
    const next = comparisonIds(searchParams);
    if (next[0] === selectedRef.current[0] && next[1] === selectedRef.current[1]) return;
    selectedRef.current = next;
    setSelected(next);
    setComparisonOpen(Boolean(next[0] || next[1]));
  }, [searchParams]);

  const replaceParams = (change: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams);
    change(next);
    setSearchParams(next, { replace: true });
  };
  const resetPage = (next: URLSearchParams) => next.delete("page");
  const sort = (key: StatisticsSortKey) => {
    const state = nextSort(sortKey, direction, key);
    replaceParams((next) => {
      next.set("sort", state.key);
      next.set("dir", state.direction);
      resetPage(next);
    });
  };
  const setVisibleColumns = (nextColumns: AdvancedColumn[], nextPreset: ColumnPreset) => {
    const safeColumns = nextColumns.length ? nextColumns : advancedColumnPresets.essentials;
    setColumns(safeColumns);
    replaceParams((next) => {
      next.set("columns", nextPreset);
      next.delete("preset");
      next.delete("cols");
      if (nextPreset === "custom") next.set("visible", serializeColumns(safeColumns));
      else next.delete("visible");
      if (
        sortKey !== "player" &&
        sortKey !== "team" &&
        !safeColumns.some((column) => columnSortKeys[column] === sortKey)
      ) {
        next.set("sort", "player");
        next.set("dir", "asc");
      }
      resetPage(next);
    });
  };
  const updateFilters = (nextFilters: StatisticFilter[]) => {
    setFilters(nextFilters);
    replaceParams((next) => {
      next.delete("filter");
      if (nextFilters.length)
        next.set(
          "filters",
          nextFilters
            .map((filter) => `${filter.metric}:${filter.operator}:${filter.value}`)
            .join(";"),
        );
      else next.delete("filters");
      resetPage(next);
    });
  };

  const teamOptions = useMemo(
    () =>
      [
        ...new Map(
          statistics.players.flatMap((player) =>
            player.teamSlug && player.teamName ? [[player.teamSlug, player.teamName] as const] : [],
          ),
        ),
      ]
        .map(([slug, name]) => ({ slug, name }))
        .sort((left, right) => left.name.localeCompare(right.name, "pt-BR")),
    [statistics.players],
  );
  const searchedPlayers = useMemo(
    () =>
      statistics.players.filter(
        (player) =>
          matchesStatisticsSearch(player, query) &&
          (!selectedTeam || player.teamSlug === selectedTeam),
      ),
    [query, selectedTeam, statistics.players],
  );
  const sortedScoresheetPlayers = useMemo(() => {
    if (statistics.kind !== "scoresheet") return [];
    const value = (player: ScoresheetPlayerStatistics): number | string | null =>
      sortKey === "player"
        ? player.playerName
        : sortKey === "team"
          ? player.teamName
          : sortKey === "games"
            ? player.gamesPlayed
            : sortKey === "points"
              ? player.points
              : sortKey === "pointsPerGame"
                ? player.pointsPerGame
                : sortKey === "twoPointMade"
                  ? player.twoPointMade
                  : sortKey === "threePointMade"
                    ? player.threePointMade
                    : sortKey === "freeThrowMade"
                      ? player.freeThrowMade
                      : sortKey === "fouls"
                        ? player.fouls
                        : sortKey === "disqualifications"
                          ? player.disqualifications
                          : null;
    return [...(searchedPlayers as ScoresheetPlayerStatistics[])].sort((left, right) => {
      const primary = compareValues(value(left), value(right), direction);
      if (primary !== 0) return primary;
      if (sortKey === "points") {
        return (
          compareValues(left.pointsPerGame, right.pointsPerGame, "desc") ||
          compareValues(left.gamesPlayed, right.gamesPlayed, "desc") ||
          left.playerName.localeCompare(right.playerName, "pt-BR")
        );
      }
      return left.playerName.localeCompare(right.playerName, "pt-BR");
    });
  }, [direction, searchedPlayers, sortKey, statistics.kind]);
  const advancedPlayers = useMemo(() => {
    if (statistics.kind !== "boxscore") return [];
    return [...applyStatisticFilters(searchedPlayers as PlayerStatistics[], filters, mode)].sort(
      (left, right) =>
        compareValues(
          advancedSortValue(left, sortKey, mode),
          advancedSortValue(right, sortKey, mode),
          direction,
        ) || left.playerName.localeCompare(right.playerName, "pt-BR"),
    );
  }, [direction, filters, mode, searchedPlayers, sortKey, statistics.kind]);
  const allPlayers = statistics.kind === "scoresheet" ? sortedScoresheetPlayers : advancedPlayers;
  const totalPages = Math.max(1, Math.ceil(allPlayers.length / PAGE_SIZE));
  const page = Math.min(parsePage(searchParams.get("page")), totalPages);
  const paginatedPlayers = allPlayers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const setPage = (value: number) =>
    replaceParams((next) => {
      if (value <= 1) next.delete("page");
      else next.set("page", String(value));
    });
  const setComparedPlayer = (side: 0 | 1, id: string) => {
    const nextSelected: [string, string] = [...selectedRef.current] as [string, string];
    nextSelected[side] = id;
    if (nextSelected[0] && nextSelected[0] === nextSelected[1]) return;
    selectedRef.current = nextSelected;
    setSelected(nextSelected);
    replaceParams((next) => {
      if (nextSelected[0] || nextSelected[1]) next.set("compare", nextSelected.join(","));
      else next.delete("compare");
    });
  };
  const closeComparison = () => {
    selectedRef.current = ["", ""];
    setSelected(["", ""]);
    setComparisonOpen(false);
    replaceParams((next) => next.delete("compare"));
  };

  return (
    <section aria-label="Jogadores da edição" className="statistics-explorer">
      {statistics.kind === "scoresheet" ? (
        <>
          <header className="scoresheet-players-header">
            <div>
              <p className="eyebrow">{context.displayName}</p>
              <h1>Jogadores</h1>
              <p>Dados registrados por súmula</p>
            </div>
            <strong>{statistics.players.length} atletas com participação</strong>
          </header>
          <div className="scoresheet-controls">
            <label>
              Equipe
              <select
                value={selectedTeam}
                onChange={(event) =>
                  replaceParams((next) => {
                    if (event.target.value) next.set("team", event.target.value);
                    else next.delete("team");
                    resetPage(next);
                  })
                }
              >
                <option value="">Todas as equipes</option>
                {teamOptions.map((team) => (
                  <option key={team.slug} value={team.slug}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      ) : null}

      {statistics.kind === "boxscore" ? (
        <>
          <div className="statistics-toolbar">
            <button
              aria-expanded={filterOpen}
              className="toolbar-button"
              onClick={() => setFilterOpen((open) => !open)}
              type="button"
            >
              Filtro avançado{filters.length ? ` (${filters.length})` : ""}
            </button>
            <button
              className="toolbar-button"
              onClick={() => setComparisonOpen(true)}
              type="button"
            >
              Comparar jogadores
            </button>
            <fieldset className="segmented-control">
              <legend className="sr-only">Modo</legend>
              {(["averages", "totals"] as const).map((value) => (
                <label key={value}>
                  <input
                    checked={mode === value}
                    name="statistics-mode"
                    onChange={() =>
                      replaceParams((next) => {
                        next.set("mode", value === "averages" ? "per-game" : "total");
                        next.delete("scale");
                        resetPage(next);
                      })
                    }
                    type="radio"
                  />
                  <span>{value === "averages" ? "Por jogo" : "Total"}</span>
                </label>
              ))}
            </fieldset>
            <label className="column-presets">
              <span className="sr-only">Exibir colunas</span>
              <select
                aria-label="Exibir colunas"
                onChange={(event) => {
                  const item = event.currentTarget.value as ColumnPreset;
                  if (item === "custom") {
                    setCustomOpen(true);
                    setVisibleColumns(columns, "custom");
                  } else {
                    setCustomOpen(false);
                    setVisibleColumns(advancedColumnPresets[item], item);
                  }
                }}
                value={preset}
              >
                {(["essentials", "all", "custom"] as const).map((item) => (
                  <option key={item} value={item}>
                    {presetLabels[item]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {filterOpen ? (
            <form
              className="advanced-filter-panel"
              onSubmit={(event) => {
                event.preventDefault();
                const parsed = draftFilters.flatMap((filter): StatisticFilter[] => {
                  const value = Number(filter.value.replace(",", "."));
                  return filter.value.trim() && Number.isFinite(value)
                    ? [{ id: filter.id, metric: filter.metric, operator: filter.operator, value }]
                    : [];
                });
                if (parsed.length !== draftFilters.length) {
                  setFilterError("Preencha estatística, operador e valor em todas as condições.");
                  return;
                }
                setFilterError("");
                updateFilters(parsed);
              }}
            >
              <header>
                <div>
                  <strong>Filtro avançado</strong>
                  <p>As condições são combinadas por E.</p>
                </div>
                <button onClick={() => setFilterOpen(false)} type="button">
                  Fechar
                </button>
              </header>
              {draftFilters.map((filter, index) => (
                <div className="filter-condition" key={filter.id}>
                  <span aria-hidden="true">{index ? "E" : "Onde"}</span>
                  <label>
                    Estatística
                    <select
                      value={filter.metric}
                      onChange={(event) =>
                        setDraftFilters((current) =>
                          current.map((item) =>
                            item.id === filter.id
                              ? { ...item, metric: event.target.value as FilterMetric }
                              : item,
                          ),
                        )
                      }
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
                      value={filter.operator}
                      onChange={(event) =>
                        setDraftFilters((current) =>
                          current.map((item) =>
                            item.id === filter.id
                              ? { ...item, operator: event.target.value as FilterOperator }
                              : item,
                          ),
                        )
                      }
                    >
                      {filterOperators.map((operator) => (
                        <option key={operator}>{operator}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Valor
                    <input
                      inputMode="decimal"
                      value={filter.value}
                      onChange={(event) =>
                        setDraftFilters((current) =>
                          current.map((item) =>
                            item.id === filter.id ? { ...item, value: event.target.value } : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <button
                    aria-label={`Remover condição ${index + 1}`}
                    disabled={draftFilters.length === 1}
                    onClick={() =>
                      setDraftFilters((current) => current.filter((item) => item.id !== filter.id))
                    }
                    type="button"
                  >
                    Remover
                  </button>
                </div>
              ))}
              {filterError ? (
                <p className="form-error" role="alert">
                  {filterError}
                </p>
              ) : null}
              <footer>
                <button
                  onClick={() =>
                    setDraftFilters((current) => [...current, newDraftFilter(current.length)])
                  }
                  type="button"
                >
                  Adicionar condição
                </button>
                <button
                  onClick={() => {
                    setDraftFilters([newDraftFilter()]);
                    setFilterError("");
                    updateFilters([]);
                  }}
                  type="button"
                >
                  Limpar
                </button>
                <button className="button-primary" type="submit">
                  Aplicar filtros
                </button>
              </footer>
            </form>
          ) : null}

          {customOpen ? (
            <fieldset className="statistics-columns">
              <legend>Personalizar colunas</legend>
              <p>Atleta e Equipe permanecem sempre visíveis.</p>
              <div className="column-options">
                {advancedColumnPresets.all.map((column) => (
                  <label key={column}>
                    <input
                      checked={columns.includes(column)}
                      onChange={(event) => {
                        const nextColumns = event.target.checked
                          ? advancedColumnPresets.all.filter(
                              (item) => item === column || columns.includes(item),
                            )
                          : columns.filter((item) => item !== column);
                        setVisibleColumns(nextColumns, "custom");
                      }}
                      type="checkbox"
                    />
                    {columnLabels[column]}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          {filters.length ? (
            <div className="active-filter-row">
              <ul aria-label="Filtros ativos" className="active-filters">
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
              <button
                onClick={() => {
                  setDraftFilters([newDraftFilter()]);
                  updateFilters([]);
                }}
                type="button"
              >
                Limpar todos
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {statistics.kind === "boxscore" &&
      statistics.coverage.advancedGames < statistics.coverage.totalGames ? (
        <output className="statistics-coverage-notice">
          Estatísticas avançadas disponíveis em {statistics.coverage.advancedGames} de{" "}
          {statistics.coverage.totalGames} jogos. Os demais jogos preservam somente os dados básicos
          confirmados.
        </output>
      ) : null}

      <header className="statistics-table-heading">
        <div>
          <h2 aria-live="polite">{allPlayers.length} atletas</h2>
          <p>
            {statistics.kind === "scoresheet"
              ? "Totais e média por participação"
              : mode === "totals"
                ? "Total"
                : "Por jogo"}{" "}
            · somente jogos finalizados
          </p>
        </div>
        <span className="statistics-scroll-hint">↔ Deslize para ver mais</span>
      </header>

      {allPlayers.length ? (
        statistics.kind === "scoresheet" ? (
          <ScoresheetStatisticsTable
            context={context}
            direction={direction}
            onSort={sort}
            players={paginatedPlayers as ScoresheetPlayerStatistics[]}
            positionOffset={(page - 1) * PAGE_SIZE}
            searchParams={searchParams}
            showDisqualifications={statistics.players.some(
              (player) => (player.disqualifications ?? 0) > 0,
            )}
            sortKey={sortKey}
          />
        ) : (
          <AdvancedStatisticsTable
            columns={columns}
            context={context}
            direction={direction}
            mode={mode}
            onSort={sort}
            players={paginatedPlayers as PlayerStatistics[]}
            searchParams={searchParams}
            sortKey={sortKey}
          />
        )
      ) : (
        <ResourceState
          detail={
            query || selectedTeam || filters.length
              ? "Remova ou ajuste a busca e os filtros para ver outros resultados."
              : "As estatísticas aparecerão após a publicação do primeiro jogo finalizado."
          }
          kind="empty"
          title={
            query || selectedTeam || filters.length ? "Nenhum resultado encontrado" : undefined
          }
        />
      )}
      <Pagination current={page} onPage={setPage} total={allPlayers.length} />
      {statistics.kind === "boxscore" ? (
        <details className="statistics-legend">
          <summary>Legenda das métricas</summary>
          <dl>
            {columns.map((column) => (
              <div key={column}>
                <dt>{columnLabels[column]}</dt>
                <dd>{legendLabels[column]}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
      {statistics.kind === "boxscore" ? (
        <ComparisonDialog
          context={context}
          mode={mode}
          onClose={closeComparison}
          onSelect={setComparedPlayer}
          open={comparisonOpen}
          players={statistics.players}
          searchParams={searchParams}
          selected={selected}
        />
      ) : null}
    </section>
  );
}
