import { useRef, useState } from "react";
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
  "turnovers",
  "blocks",
  "steals",
  "fieldGoalsMade",
  "fieldGoalsAttempted",
  "fieldGoalPercentage",
  "freeThrowsMade",
  "freeThrowsAttempted",
  "freeThrowPercentage",
  "efficiency",
  "plusMinus",
];

const pairedMetrics: Partial<Record<BoxscoreMetric, BoxscoreMetric>> = {
  fieldGoalsMade: "fieldGoalsAttempted",
  freeThrowsMade: "freeThrowsAttempted",
};

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterMetric, setFilterMetric] = useState<BoxscoreMetric>("points");
  const [filterOperator, setFilterOperator] = useState(">=");
  const [filterValue, setFilterValue] = useState("");
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

  return (
    <section
      aria-label="Estatísticas dos jogadores"
      className="statistics-explorer reference-explorer"
    >
      <header className="reference-heading">
        <h1>{context.series.name}</h1>
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
        <details className="reference-filters">
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
            {activeFilters.length ? (
              <ul className="active-filters" aria-label="Filtros ativos">
                {activeFilters.map((filter) => (
                  <li key={filter}>
                    {filter}
                    <button
                      aria-label={`Remover filtro ${filter}`}
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
            ) : null}
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
      <div className="reference-column-toolbar">
        <details>
          <summary>
            <StatsIcon name="columns" />
            Filtro de colunas
          </summary>
          <div className="reference-panel">
            <h2>Colunas da tabela</h2>
            <button type="button" onClick={() => update((next) => next.delete("visible"))}>
              Restaurar padrão
            </button>
            <div className="column-options">
              {Object.entries(BOXSCORE_METRICS).map(([metric, definition]) => (
                <label key={metric}>
                  <input
                    checked={selectedColumns.includes(metric as BoxscoreMetric)}
                    disabled={data.mode === "per-30" && metric === "minutes"}
                    onChange={(event) =>
                      update((next) => {
                        const stored = visibleColumns(next, false);
                        const selected = event.target.checked
                          ? [...new Set([...stored, metric as BoxscoreMetric])]
                          : stored.filter((item) => item !== metric);
                        next.set("visible", selected.join(","));
                      })
                    }
                    type="checkbox"
                  />
                  {definition.label}
                </label>
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
          {[0, 1].map((side) => (
            <div className="reference-player-picker" key={side}>
              <label>
                Jogador {side === 0 ? "A" : "B"}
                <input
                  type="search"
                  placeholder="Buscar jogador ou time…"
                  value={comparisonSearch[side]}
                  onChange={(event) =>
                    setComparisonSearch((current) =>
                      current.map((value, index) => (index === side ? event.target.value : value)),
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
                  .map((player) => (
                    <button
                      type="button"
                      key={player.id}
                      aria-pressed={currentCompare[side] === String(player.id)}
                      disabled={currentCompare[1 - side] === String(player.id)}
                      onClick={() => setComparison(side, String(player.id))}
                    >
                      {player.name}
                      <small>{player.teamName}</small>
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
        {data.compared.length ? (
          <div className="reference-comparison-results">
            <table>
              <caption>Comparação no modo e escopo atuais</caption>
              <thead>
                <tr>
                  <th scope="col">Estatística</th>
                  {data.compared.map((player) => (
                    <th key={player.playerId} scope="col">
                      {player.playerName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {columns.map((metric) => (
                  <tr key={metric}>
                    <th scope="row">{BOXSCORE_METRICS[metric].name}</th>
                    {data.compared.map((player) => (
                      <td key={player.playerId}>
                        {displayMetric(player.metrics[metric], metric, data.mode)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
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
                    <Link to={playerPath(context, row)}>{row.playerName}</Link>
                    <span className="reference-team" title={row.teamName}>
                      {row.teamAbbreviation ?? row.teamName}
                    </span>
                  </th>
                  {columns.map((metric) => {
                    const cell = row.metrics[metric];
                    const pair = pairedMetrics[metric];
                    const leader = data.leaders[metric]?.includes(row.playerId);
                    return (
                      <td
                        className={data.sort === metric ? "reference-sorted" : undefined}
                        data-leader={leader || undefined}
                        data-status={cell.status}
                        key={metric}
                        title={cellTitle(cell)}
                      >
                        {leader ? (
                          <span className="statistics-leader">
                            <span className="sr-only">Líder: </span>
                          </span>
                        ) : null}
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
