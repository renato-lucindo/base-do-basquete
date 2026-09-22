import { useState } from "react";
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

const defaultColumns: BoxscoreMetric[] = [
  "games",
  "minutes",
  "points",
  "rebounds",
  "assists",
  "fieldGoalPercentage",
  "freeThrowsMade",
  "efficiency",
];

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
  const selectedColumns = visibleColumns(searchParams, false);
  const columns =
    data.mode === "per-30"
      ? selectedColumns.filter((metric) => metric !== "minutes")
      : selectedColumns;
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
      const current =
        data.mode === "per-30" && next.get("sort") === "minutes" ? "points" : next.get("sort");
      const direction = current === metric && next.get("dir") !== "asc" ? "asc" : "desc";
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
  const setComparison = (side: number, value: string) =>
    update((next) => {
      const ids = (next.get("compare") ?? "").split(",").filter(Boolean).slice(0, 2);
      ids[side] = value;
      const unique = ids.filter((id, index) => id && ids.indexOf(id) === index);
      if (unique.length) next.set("compare", unique.join(","));
      else next.delete("compare");
    });
  const currentCompare = (searchParams.get("compare") ?? "").split(",");
  const activeFilters = [
    ...new Set((searchParams.get("filters") ?? "").split(";").filter(Boolean)),
  ];

  return (
    <section aria-label="Estatísticas dos jogadores" className="statistics-explorer">
      <div className="statistics-primary-controls">
        <label className="statistics-search">
          <span>Buscar atleta ou equipe</span>
          <input
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
          <legend>Modo</legend>
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

      <div className="statistics-secondary-controls">
        <details>
          <summary>Filtros{activeFilters.length ? ` (${activeFilters.length})` : ""}</summary>
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
        </details>
        <details>
          <summary>Colunas</summary>
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
        </details>
        <details open={currentCompare.some(Boolean)}>
          <summary>Comparação</summary>
          <div className="statistics-comparison-controls">
            {[0, 1].map((side) => (
              <label key={side}>
                Atleta {side + 1}
                <select
                  onChange={(event) => setComparison(side, event.target.value)}
                  value={currentCompare[side] ?? ""}
                >
                  <option value="">Selecione</option>
                  {data.playerOptions.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name} — {player.teamName}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {data.compared.length ? (
            <ul className="statistics-comparison-results">
              {data.compared.map((player) => (
                <li key={player.playerId}>
                  <strong>{player.playerName}</strong> — {player.teamName}: PTS{" "}
                  {display(player.metrics.points)}, REB {display(player.metrics.rebounds)}, AST{" "}
                  {display(player.metrics.assists)}
                </li>
              ))}
            </ul>
          ) : null}
        </details>
      </div>

      {data.mode === "per-30" ? (
        <p className="statistics-coverage-notice">
          Métricas por 30 min. exigem {data.per30MinimumSeconds / 60} minutos cobertos no escopo.
          “-” indica amostra insuficiente; “—” indica dado não fornecido.
        </p>
      ) : null}
      <header className="statistics-table-heading">
        <div>
          <h2 aria-live="polite">{data.total} atletas</h2>
          <p>
            {data.scope === "regular"
              ? "Fase regular"
              : data.scope === "playoffs"
                ? "Eliminatórias"
                : "Todos os jogos"}
            {data.coverage.unclassifiedGames
              ? ` · ${data.coverage.unclassifiedGames} não classificados somente em Todos`
              : ""}
          </p>
        </div>
        <span className="statistics-scroll-hint">↔ Deslize para ver mais</span>
      </header>

      {data.rows.length ? (
        <ScrollableTable label="Tabela de estatísticas dos jogadores">
          <table className="statistics-table statistics-table-advanced">
            <thead>
              <tr>
                <th className="column-position" scope="col">
                  Pos.
                </th>
                <th aria-sort={sortState("player")} className="column-player" scope="col">
                  <button className="statistics-sort" onClick={() => sort("player")} type="button">
                    Atleta
                  </button>
                </th>
                <th aria-sort={sortState("team")} className="column-team" scope="col">
                  <button className="statistics-sort" onClick={() => sort("team")} type="button">
                    Equipe
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
                        {BOXSCORE_METRICS[metric].label}
                      </abbr>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, index) => (
                <tr key={`${row.registrationId}:${row.playerId}`}>
                  <td>{(data.page - 1) * data.pageSize + index + 1}</td>
                  <th scope="row">
                    <Link to={playerPath(context, row)}>{row.playerName}</Link>
                    {row.jersey ? <small> #{row.jersey}</small> : null}
                  </th>
                  <td>{row.teamAbbreviation ?? row.teamName}</td>
                  {columns.map((metric) => {
                    const cell = row.metrics[metric];
                    const leader = data.leaders[metric]?.includes(row.playerId);
                    return (
                      <td data-status={cell.status} key={metric} title={cellTitle(cell)}>
                        {leader ? (
                          <span className="statistics-leader">
                            <span aria-hidden="true">★ </span>
                            <span className="sr-only">Líder: </span>
                          </span>
                        ) : null}
                        {display(cell)}
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
        <button
          disabled={data.page <= 1}
          onClick={() => update((next) => next.set("page", String(data.page - 1)))}
          type="button"
        >
          Anterior
        </button>
        <span>
          Página {data.page} de {data.totalPages}
        </span>
        <button
          disabled={data.page >= data.totalPages}
          onClick={() => update((next) => next.set("page", String(data.page + 1)))}
          type="button"
        >
          Próxima
        </button>
      </nav>
    </section>
  );
}
