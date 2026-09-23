import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";

import type { CompetitionContext } from "../modules/competition/context";
import { contextPath } from "../modules/competition/context";
import {
  BOXSCORE_METRICS,
  type BoxscoreMetric,
  isBoxscoreMetric,
} from "../modules/statistics/boxscore-metrics";
import type {
  BoxscoreMetricCell,
  BoxscoreStatisticsPageDto,
  BoxscoreStatisticsPlayerRow,
} from "../modules/statistics/boxscore-statistics-domain";
import { ResourceState } from "./resource-state";
import { ScrollableTable } from "./scrollable-table";
import "./boxscore-statistics.css";

const defaultColumns: BoxscoreMetric[] = [
  "games",
  "minutes",
  "points",
  "rebounds",
  "assists",
  "blocks",
  "steals",
  "fieldGoalsMade",
  "fieldGoalsAttempted",
  "fieldGoalPercentage",
  "threePointersMade",
  "threePointersAttempted",
  "threePointPercentage",
  "freeThrowsMade",
  "freeThrowsAttempted",
  "freeThrowPercentage",
  "efficiency",
  "plusMinus",
];

const pairedMetrics: Partial<Record<BoxscoreMetric, BoxscoreMetric>> = {
  fieldGoalsMade: "fieldGoalsAttempted",
  threePointersMade: "threePointersAttempted",
  freeThrowsMade: "freeThrowsAttempted",
};

const columnGroups: Array<{
  label: string;
  metrics: BoxscoreMetric[];
}> = [
  {
    label: "Principais",
    metrics: ["games", "minutes", "points", "rebounds", "assists"],
  },
  {
    label: "Defesa e controle",
    metrics: [
      "offensiveRebounds",
      "defensiveRebounds",
      "turnovers",
      "blocks",
      "steals",
      "foulsCommitted",
      "foulsReceived",
    ],
  },
  {
    label: "Arremessos",
    metrics: [
      "fieldGoalsMade",
      "fieldGoalsAttempted",
      "fieldGoalPercentage",
      "threePointersMade",
      "threePointersAttempted",
      "threePointPercentage",
      "freeThrowsMade",
      "freeThrowsAttempted",
      "freeThrowPercentage",
    ],
  },
  { label: "Avançadas", metrics: ["efficiency", "plusMinus"] },
];

const highlightedLeaderMetrics = new Set<BoxscoreMetric>([
  "points",
  "rebounds",
  "assists",
  "steals",
  "blocks",
  "efficiency",
]);

const nameConnectors = new Set(["da", "das", "de", "do", "dos", "e"]);

function meaningfulNameParts(name: string): string[] {
  return name
    .trim()
    .split(/\s+/)
    .filter((part, index) => index === 0 || !nameConnectors.has(part.toLocaleLowerCase("pt-BR")));
}

function compactPlayerNames(
  players: BoxscoreStatisticsPageDto["playerOptions"],
): Map<number, string> {
  const entries = players.map((player) => {
    const parts = meaningfulNameParts(player.name);
    const short = parts.length > 2 ? `${parts[0]} ${parts.at(-1)}` : player.name;
    return { ...player, parts, short };
  });
  const shortCounts = new Map<string, number>();
  for (const entry of entries) {
    const key = entry.short.toLocaleLowerCase("pt-BR");
    shortCounts.set(key, (shortCounts.get(key) ?? 0) + 1);
  }
  const expanded = entries.map((entry) => {
    const duplicate = (shortCounts.get(entry.short.toLocaleLowerCase("pt-BR")) ?? 0) > 1;
    const display =
      duplicate && entry.parts.length > 2
        ? `${entry.parts[0]} ${entry.parts[1]} ${entry.parts.at(-1)}`
        : entry.short;
    return { ...entry, display };
  });
  const displayCounts = new Map<string, number>();
  for (const entry of expanded) {
    const key = entry.display.toLocaleLowerCase("pt-BR");
    displayCounts.set(key, (displayCounts.get(key) ?? 0) + 1);
  }
  return new Map(
    expanded.map((entry) => [
      entry.id,
      (displayCounts.get(entry.display.toLocaleLowerCase("pt-BR")) ?? 0) > 1
        ? entry.name
        : entry.display,
    ]),
  );
}

function metricLabel(metric: BoxscoreMetric, columns: BoxscoreMetric[]) {
  if (metric === "fieldGoalPercentage") return "FG%";
  const pair = pairedMetrics[metric];
  return pair && columns.includes(pair)
    ? `${BOXSCORE_METRICS[metric].label}/${BOXSCORE_METRICS[pair].label}`
    : BOXSCORE_METRICS[metric].label;
}

// Lucide paths used by the reference site; decorative icons retain native control labels.
function StatsIcon({
  name,
}: {
  name: "search" | "filter" | "users" | "columns" | "sort" | "up" | "down";
}) {
  const paths = {
    search: ["m21 21-4.34-4.34"],
    filter: [
      "M10 5H3",
      "M12 19H3",
      "M14 3v4",
      "M16 17v4",
      "M21 12h-9",
      "M21 19h-5",
      "M21 5h-7",
      "M8 10v4",
      "M8 12H3",
    ],
    users: [
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
      "M16 3.128a4 4 0 0 1 0 7.744",
      "M22 21v-2a4 4 0 0 0-3-3.87",
    ],
    columns: [
      "M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z",
    ],
    sort: ["m21 16-4 4-4-4", "M17 20V4", "m3 8 4-4 4 4", "M7 4v16"],
    up: ["m5 12 7-7 7 7", "M12 19V5"],
    down: ["M12 5v14", "m19 12-7 7-7-7"],
  };
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name].map((path) => (
        <path d={path} key={path} />
      ))}
      {name === "search" ? (
        <circle cx="11" cy="11" r="8" />
      ) : name === "users" ? (
        <circle cx="9" cy="7" r="4" />
      ) : null}
    </svg>
  );
}

function displayMetric(
  cell: BoxscoreMetricCell,
  metric: BoxscoreMetric,
  mode: BoxscoreStatisticsPageDto["mode"],
) {
  if (cell.status !== "available") return display(cell);
  const decimal =
    metric !== "games" &&
    (mode !== "total" || metric.endsWith("Percentage") || metric === "minutes");
  return `${metric === "plusMinus" && cell.value > 0 ? "+" : ""}${decimal ? cell.value.toFixed(1) : display(cell)}`;
}

function display(cell: BoxscoreMetricCell): string {
  if (cell.status === "insufficient-sample") return "-";
  if (cell.status === "unavailable") return "—";
  return Number.isInteger(cell.value)
    ? String(cell.value)
    : cell.value.toFixed(1).replace(".", ",");
}

function cellTitle(cell: BoxscoreMetricCell): string | undefined {
  if (cell.status === "insufficient-sample") return "Amostra insuficiente";
  if (cell.status === "unavailable") return "Dado não fornecido pela fonte";
  return undefined;
}

function visibleColumns(searchParams: URLSearchParams, per30: boolean): BoxscoreMetric[] {
  const requested = (searchParams.get("visible") ?? "").split(",").filter(isBoxscoreMetric);
  const selected = requested.length ? [...new Set(requested)] : defaultColumns;
  return per30 ? selected.filter((metric) => metric !== "minutes") : selected;
}

function serializedFilter(metric: string, operator: string, value: string): string | null {
  const numeric = Number(value.replace(",", "."));
  if (!isBoxscoreMetric(metric) || ![">=", ">", "<=", "<", "="].includes(operator)) return null;
  return Number.isFinite(numeric) ? `${metric}:${operator}:${numeric}` : null;
}

function filterLabel(serialized: string): string {
  const [metric, operator, value] = serialized.split(":");
  if (!metric || !isBoxscoreMetric(metric) || !operator || value === undefined) return serialized;
  return `${BOXSCORE_METRICS[metric].label} ${operator} ${value.replace(".", ",")}`;
}

function comparisonTone(
  metric: BoxscoreMetric,
  cells: [BoxscoreMetricCell, BoxscoreMetricCell],
  side: 0 | 1,
): "better" | "worse" | undefined {
  const [left, right] = cells;
  if (left.status !== "available" || right.status !== "available" || left.value === right.value) {
    return undefined;
  }
  const sideIsGreater = side === 0 ? left.value > right.value : right.value > left.value;
  const better = BOXSCORE_METRICS[metric].lowerIsBetter ? !sideIsGreater : sideIsGreater;
  return better ? "better" : "worse";
}

function playerPath(context: CompetitionContext, row: BoxscoreStatisticsPlayerRow): string {
  return contextPath(context, "jogadores", row.playerSlug);
}

export function BoxscoreStatisticsExplorer({
  context,
  data,
}: {
  context: CompetitionContext;
  data: BoxscoreStatisticsPageDto;
}) {
  const pageTitle =
    context.series.name === "Copa ES Ouro" ? "Copa ES - Série Ouro" : context.series.name;
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterMetric, setFilterMetric] = useState<BoxscoreMetric>("points");
  const [filterOperator, setFilterOperator] = useState(">=");
  const [filterValue, setFilterValue] = useState("");
  const filterDetails = useRef<HTMLDetailsElement>(null);
  const columnDetails = useRef<HTMLDetailsElement>(null);
  const comparisonDialog = useRef<HTMLDialogElement>(null);
  const [comparisonSearch, setComparisonSearch] = useState(["", ""]);
  const [currentCompare, setCurrentCompare] = useState(() =>
    (searchParams.get("compare") ?? "").split(","),
  );
  const selectedColumns = visibleColumns(searchParams, false);
  const availableColumns =
    data.mode === "per-30"
      ? selectedColumns.filter((metric) => metric !== "minutes")
      : selectedColumns;
  const columns = availableColumns.filter(
    (metric) =>
      !Object.entries(pairedMetrics).some(
        ([made, attempted]) =>
          attempted === metric && availableColumns.includes(made as BoxscoreMetric),
      ),
  );
  const update = (change: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams);
    change(next);
    setSearchParams(next, { replace: true });
  };
  const resetPage = (next: URLSearchParams) => next.delete("page");
  const setMode = (mode: BoxscoreStatisticsPageDto["mode"]) =>
    update((next) => {
      if (mode === "per-game") next.delete("mode");
      else next.set("mode", mode);
      if (mode === "per-30" && next.get("sort") === "minutes") {
        next.set("sort", "points");
        next.set("dir", "desc");
      }
      resetPage(next);
    });
  const setScope = (scope: BoxscoreStatisticsPageDto["scope"]) =>
    update((next) => {
      if (scope === "regular") next.delete("scope");
      else next.set("scope", scope);
      resetPage(next);
    });
  const sort = (metric: BoxscoreMetric | "player" | "team") =>
    update((next) => {
      const direction = data.sort === metric && data.direction === "desc" ? "asc" : "desc";
      next.set("sort", metric);
      next.set("dir", metric === "player" || metric === "team" ? "asc" : direction);
      resetPage(next);
    });
  const sortState = (metric: BoxscoreMetric | "player" | "team") =>
    data.rows.length && data.sort === metric
      ? data.direction === "asc"
        ? "ascending"
        : "descending"
      : undefined;
  const setComparison = (side: number, value: string) => {
    const ids = [...currentCompare];
    ids[side] = value;
    setCurrentCompare(ids);
    update((next) => {
      const unique = ids.filter((id, index) => id && ids.indexOf(id) === index);
      if (unique.length) next.set("compare", unique.join(","));
      else next.delete("compare");
    });
  };
  const activeFilters = [
    ...new Set((searchParams.get("filters") ?? "").split(";").filter(Boolean)),
  ];
  const playerDisplayNames = compactPlayerNames(data.playerOptions);

  useEffect(() => {
    const details = [filterDetails.current, columnDetails.current];
    const closeOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      for (const detail of details) {
        if (detail?.open && !detail.contains(event.target)) detail.open = false;
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const openDetail = details.find((detail) => detail?.open);
      if (!openDetail) return;
      openDetail.open = false;
      openDetail.querySelector<HTMLElement>("summary")?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <section
      aria-label="Estatísticas dos jogadores"
      className="statistics-explorer reference-explorer"
    >
      <header className="reference-heading">
        <h1>{pageTitle}</h1>
        <p>
          Estatísticas dos jogadores{" "}
          {data.scope === "regular"
            ? "da fase regular"
            : data.scope === "playoffs"
              ? "das eliminatórias"
              : "de todos os jogos"}
        </p>
        <p className="reference-count" aria-live="polite">
          {data.total} atletas · ao menos 1 jogo · página {data.page} de {data.totalPages}
        </p>
      </header>
      <div className="reference-toolbar">
        <label className="statistics-search">
          <span className="sr-only">Buscar atleta ou equipe</span>
          <StatsIcon name="search" />
          <input
            placeholder="Buscar jogador ou time…"
            onChange={(event) =>
              update((next) => {
                if (event.target.value) next.set("q", event.target.value);
                else next.delete("q");
                resetPage(next);
              })
            }
            type="search"
            value={searchParams.get("q") ?? ""}
          />
        </label>
        <details className="reference-filters" ref={filterDetails}>
          <summary>
            <StatsIcon name="filter" />
            Filtrar{activeFilters.length ? ` (${activeFilters.length})` : ""}
          </summary>
          <div className="reference-panel">
            <h2>Filtrar jogadores</h2>
            <p>Combine condições. Todas precisam ser atendidas.</p>
            <div className="reference-context-filters">
              <label>
                Equipe
                <select
                  onChange={(event) =>
                    update((next) => {
                      if (event.target.value) next.set("team", event.target.value);
                      else next.delete("team");
                      resetPage(next);
                    })
                  }
                  value={searchParams.get("team") ?? ""}
                >
                  <option value="">Todas</option>
                  {data.teams.map((team) => (
                    <option key={team.id} value={team.slug}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="segmented-control">
                <legend>Jogos</legend>
                {(
                  [
                    ["regular", "Fase regular"],
                    ["playoffs", "Eliminatórias"],
                    ["all", "Todos"],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value}>
                    <input
                      checked={data.scope === value}
                      name="statistics-scope"
                      onChange={() => setScope(value)}
                      type="radio"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </fieldset>
            </div>
            <div className="statistics-filter-editor">
              <label>
                Métrica
                <select
                  onChange={(event) => setFilterMetric(event.target.value as BoxscoreMetric)}
                  value={filterMetric}
                >
                  {Object.entries(BOXSCORE_METRICS)
                    .filter(([metric]) => data.mode !== "per-30" || metric !== "minutes")
                    .map(([metric, definition]) => (
                      <option key={metric} value={metric}>
                        {definition.label}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Operador
                <select
                  onChange={(event) => setFilterOperator(event.target.value)}
                  value={filterOperator}
                >
                  {[">=", ">", "<=", "<", "="].map((operator) => (
                    <option key={operator}>{operator}</option>
                  ))}
                </select>
              </label>
              <label>
                Valor
                <input
                  inputMode="decimal"
                  onChange={(event) => setFilterValue(event.target.value)}
                  value={filterValue}
                />
              </label>
              <button
                onClick={() => {
                  const filter = serializedFilter(filterMetric, filterOperator, filterValue);
                  if (!filter) return;
                  update((next) => {
                    const existing = (next.get("filters") ?? "").split(";").filter(Boolean);
                    next.set("filters", [...new Set([...existing, filter])].slice(0, 5).join(";"));
                    resetPage(next);
                  });
                  setFilterValue("");
                }}
                type="button"
              >
                Adicionar
              </button>
            </div>
          </div>
        </details>
        <button
          className="reference-compare-button"
          type="button"
          onClick={() => comparisonDialog.current?.showModal()}
        >
          <StatsIcon name="users" />
          Comparar jogadores
        </button>
        <fieldset className="segmented-control reference-mode">
          <legend className="sr-only">Modo</legend>
          {(
            [
              ["per-game", "Por jogo"],
              ["total", "Total"],
              ["per-30", "Por 30 min."],
            ] as const
          ).map(([value, label]) => (
            <label key={value}>
              <input
                checked={data.mode === value}
                name="statistics-mode"
                onChange={() => setMode(value)}
                type="radio"
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
      </div>
      {activeFilters.length ? (
        <div className="active-filters">
          <span>Filtros:</span>
          <ul aria-label="Filtros ativos">
            {activeFilters.map((filter) => (
              <li key={filter}>
                {filterLabel(filter)}
                <button
                  aria-label={`Remover filtro ${filterLabel(filter)}`}
                  onClick={() =>
                    update((next) => {
                      const remaining = activeFilters.filter((item) => item !== filter);
                      if (remaining.length) next.set("filters", remaining.join(";"));
                      else next.delete("filters");
                      resetPage(next);
                    })
                  }
                  type="button"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <button
            className="active-filters-clear"
            onClick={() =>
              update((next) => {
                next.delete("filters");
                resetPage(next);
              })
            }
            type="button"
          >
            Limpar todos
          </button>
        </div>
      ) : null}
      <div className="reference-column-toolbar">
        <details ref={columnDetails}>
          <summary>
            <StatsIcon name="columns" />
            Colunas · {availableColumns.length}
          </summary>
          <div className="reference-panel">
            <h2>Colunas da tabela</h2>
            <button type="button" onClick={() => update((next) => next.delete("visible"))}>
              Restaurar padrão
            </button>
            <div className="column-options">
              {columnGroups.map((group) => (
                <fieldset key={group.label}>
                  <legend>{group.label}</legend>
                  <div className="column-group-options">
                    {group.metrics.map((metric) => (
                      <label key={metric}>
                        <input
                          checked={selectedColumns.includes(metric)}
                          disabled={data.mode === "per-30" && metric === "minutes"}
                          onChange={(event) =>
                            update((next) => {
                              const stored = visibleColumns(next, false);
                              const selected = event.target.checked
                                ? [...new Set([...stored, metric])]
                                : stored.filter((item) => item !== metric);
                              next.set("visible", selected.join(","));
                            })
                          }
                          type="checkbox"
                        />
                        {BOXSCORE_METRICS[metric].label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          </div>
        </details>
      </div>
      <dialog
        ref={comparisonDialog}
        className="reference-comparison"
        aria-labelledby="comparison-title"
      >
        <header>
          <h2 id="comparison-title">Comparar jogadores</h2>
          <button
            aria-label="Fechar comparação"
            type="button"
            onClick={() => comparisonDialog.current?.close()}
          >
            ×
          </button>
        </header>
        <div className="statistics-comparison-controls">
          {([0, 1] as const).map((side) => {
            const selectedId = currentCompare[side];
            const selected = data.playerOptions.find((player) => String(player.id) === selectedId);
            const selectedRow = data.compared.find(
              (player) => String(player.playerId) === selectedId,
            );
            return (
              <div className="reference-player-picker" key={side}>
                <p className="reference-player-picker-label">Jogador {side === 0 ? "A" : "B"}</p>
                {selected ? (
                  <div className="reference-player-selected">
                    <div>
                      <strong>{selected.name}</strong>
                      <small>
                        {selected.teamName}
                        {selectedRow?.jersey ? ` · #${selectedRow.jersey}` : ""}
                        {selectedRow?.metrics.games.status === "available"
                          ? ` · ${display(selectedRow.metrics.games)} J`
                          : ""}
                      </small>
                    </div>
                    <button type="button" onClick={() => setComparison(side, "")}>
                      Trocar
                    </button>
                  </div>
                ) : (
                  <>
                    <label className="reference-player-search">
                      <span className="sr-only">Buscar jogador {side === 0 ? "A" : "B"}</span>
                      <StatsIcon name="search" />
                      <input
                        type="search"
                        placeholder="Buscar jogador ou time…"
                        value={comparisonSearch[side]}
                        onChange={(event) =>
                          setComparisonSearch((current) =>
                            current.map((value, index) =>
                              index === side ? event.target.value : value,
                            ),
                          )
                        }
                      />
                    </label>
                    <div className="reference-player-options">
                      {data.playerOptions
                        .filter((player) =>
                          `${player.name} ${player.teamName}`
                            .toLocaleLowerCase("pt-BR")
                            .includes((comparisonSearch[side] ?? "").toLocaleLowerCase("pt-BR")),
                        )
                        .slice(0, 30)
                        .map((player) => (
                          <button
                            type="button"
                            key={player.id}
                            disabled={currentCompare[1 - side] === String(player.id)}
                            onClick={() => setComparison(side, String(player.id))}
                          >
                            <span>{player.name}</span>
                            <small>{player.teamName}</small>
                          </button>
                        ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
        {data.compared.length === 2 ? (
          <div className="reference-comparison-results">
            <div className="reference-comparison-matchup" aria-hidden="true">
              <strong>{data.compared[0]?.playerName}</strong>
              <span>×</span>
              <strong>{data.compared[1]?.playerName}</strong>
            </div>
            <table>
              <caption>Comparação no modo e escopo atuais</caption>
              <tbody>
                {columns.map((metric) => {
                  const leftPlayer = data.compared[0];
                  const rightPlayer = data.compared[1];
                  if (!leftPlayer || !rightPlayer) return null;
                  const cells = [leftPlayer.metrics[metric], rightPlayer.metrics[metric]] as [
                    BoxscoreMetricCell,
                    BoxscoreMetricCell,
                  ];
                  const pair = pairedMetrics[metric];
                  return (
                    <tr key={metric}>
                      <td data-tone={comparisonTone(metric, cells, 0)}>
                        {displayMetric(cells[0], metric, data.mode)}
                        {pair && availableColumns.includes(pair)
                          ? `/${displayMetric(leftPlayer.metrics[pair], pair, data.mode)}`
                          : ""}
                      </td>
                      <th scope="row">{metricLabel(metric, availableColumns)}</th>
                      <td data-tone={comparisonTone(metric, cells, 1)}>
                        {displayMetric(cells[1], metric, data.mode)}
                        {pair && availableColumns.includes(pair)
                          ? `/${displayMetric(rightPlayer.metrics[pair], pair, data.mode)}`
                          : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p>
              Valores no modo e escopo atuais. Verde = melhor, vermelho = pior. Para ER e FC, quanto
              menor, melhor.
            </p>
          </div>
        ) : (
          <p>Escolha dois jogadores para ver a comparação.</p>
        )}
      </dialog>

      {data.mode === "per-30" ? (
        <p className="statistics-coverage-notice">
          Métricas por 30 min. exigem {data.per30MinimumSeconds / 60} minutos cobertos no escopo.
          “-” indica amostra insuficiente; “—” indica dado não fornecido.
        </p>
      ) : null}

      {data.rows.length ? (
        <ScrollableTable label="Tabela de estatísticas dos jogadores">
          <table className="statistics-table statistics-table-advanced">
            <thead>
              <tr>
                <th aria-sort={sortState("player")} className="column-player" scope="col">
                  <button className="statistics-sort" onClick={() => sort("player")} type="button">
                    Atleta
                    <StatsIcon
                      name={
                        data.sort === "player" ? (data.direction === "asc" ? "up" : "down") : "sort"
                      }
                    />
                  </button>
                </th>
                {columns.map((metric) => (
                  <th
                    aria-sort={sortState(metric)}
                    className="column-metric"
                    key={metric}
                    scope="col"
                  >
                    <button className="statistics-sort" onClick={() => sort(metric)} type="button">
                      <abbr title={BOXSCORE_METRICS[metric].name}>
                        {metricLabel(metric, availableColumns)}
                      </abbr>
                      <StatsIcon
                        name={
                          data.sort === metric ? (data.direction === "asc" ? "up" : "down") : "sort"
                        }
                      />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={`${row.registrationId}:${row.playerId}`}>
                  <th scope="row" className="reference-player" title={row.playerName}>
                    <span className="reference-jersey">{row.jersey ? `#${row.jersey}` : "—"}</span>
                    <Link aria-label={row.playerName} to={playerPath(context, row)}>
                      {playerDisplayNames.get(row.playerId) ?? row.playerName}
                    </Link>
                    <span className="reference-team" title={row.teamName}>
                      {row.teamAbbreviation ?? row.teamName}
                    </span>
                  </th>
                  {columns.map((metric) => {
                    const cell = row.metrics[metric];
                    const pair = pairedMetrics[metric];
                    const leader =
                      highlightedLeaderMetrics.has(metric) &&
                      data.leaders[metric]?.includes(row.playerId);
                    return (
                      <td
                        className={data.sort === metric ? "reference-sorted" : undefined}
                        data-leader={leader || undefined}
                        data-status={cell.status}
                        key={metric}
                        title={
                          leader
                            ? `Líder em ${BOXSCORE_METRICS[metric].name.toLocaleLowerCase("pt-BR")} neste escopo`
                            : cellTitle(cell)
                        }
                      >
                        {leader ? (
                          <span aria-hidden="true" className="statistics-leader">
                            ★
                          </span>
                        ) : null}
                        {leader ? <span className="sr-only">Líder: </span> : null}
                        {displayMetric(cell, metric, data.mode)}
                        {pair && availableColumns.includes(pair) ? (
                          <>/{displayMetric(row.metrics[pair], pair, data.mode)}</>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      ) : (
        <ResourceState
          detail="Ajuste o escopo, a busca ou os filtros. A página não troca de fase automaticamente."
          kind="empty"
          title="Nenhum atleta neste escopo"
        />
      )}

      <nav aria-label="Paginação dos jogadores" className="statistics-pagination">
        <span>
          Mostrando {data.total ? (data.page - 1) * data.pageSize + 1 : 0}–
          {Math.min(data.page * data.pageSize, data.total)} de {data.total}
        </span>
        <div>
          <button
            disabled={data.page <= 1}
            onClick={() => update((next) => next.set("page", String(data.page - 1)))}
            type="button"
          >
            Anterior
          </button>
          <span>
            {data.page} / {data.totalPages}
          </span>
          <button
            disabled={data.page >= data.totalPages}
            onClick={() => update((next) => next.set("page", String(data.page + 1)))}
            type="button"
          >
            Próxima
          </button>
        </div>
      </nav>
      <p className="reference-legend">
        J = Jogos · MIN = Minutos · PTS = Pontos · REB = Rebotes · RO/RD = Rebotes Of./Def. · AST =
        Assistências · ER = Erros · TO = Tocos · BR = Bolas recuperadas · FC/FR = Faltas
        cometidas/recebidas · AC/AT = Arremessos Convertidos/Tentados · FG% = Aproveitamento nos
        arremessos · LL = Lances Livres · EF = Eficiência · +/- = Saldo em quadra. “—” = dado não
        fornecido.
      </p>
      {data.coverage.unclassifiedGames ? (
        <p className="reference-coverage">
          {data.coverage.unclassifiedGames} jogos sem fase definida aparecem somente no escopo
          Todos.
        </p>
      ) : null}
    </section>
  );
}
