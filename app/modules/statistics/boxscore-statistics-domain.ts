import type { Database } from "../../types/database.generated";
import { BOXSCORE_METRICS, type BoxscoreMetric, isBoxscoreMetric } from "./boxscore-metrics";
import {
  type BoxscoreGameScope,
  type BoxscoreStatisticsMode,
  hasMinimumPer30Sample,
  normalizePer30,
  parseBoxscoreGameScope,
  parseBoxscoreStatisticsMode,
} from "./boxscore-statistics-contract";

export type BoxscoreSnapshotRow =
  Database["public"]["Tables"]["competition_player_statistics_publications"]["Row"];
export type BoxscoreSnapshotHeader =
  Database["public"]["Tables"]["competition_publication_statistics"]["Row"];
export type BoxscoreFilterOperator = ">=" | ">" | "<=" | "<" | "=";

export interface BoxscoreStatisticsFilter {
  metric: BoxscoreMetric;
  operator: BoxscoreFilterOperator;
  value: number;
}

export interface BoxscoreStatisticsQuery {
  mode: BoxscoreStatisticsMode;
  scope: BoxscoreGameScope;
  sort: BoxscoreMetric | "player" | "team";
  direction: "asc" | "desc";
  search: string;
  team: string | null;
  filters: BoxscoreStatisticsFilter[];
  page: number;
  compare: number[];
}

export type BoxscoreMetricCell =
  | { status: "available"; value: number }
  | { status: "unavailable"; value: null }
  | { status: "insufficient-sample"; value: null };

export interface BoxscoreStatisticsPlayerRow {
  playerId: number;
  playerName: string;
  playerSlug: string;
  registrationId: number;
  teamId: number;
  teamName: string;
  teamSlug: string;
  teamAbbreviation: string | null;
  jersey: string | null;
  metrics: Record<BoxscoreMetric, BoxscoreMetricCell>;
}

export interface BoxscoreStatisticsPageDto {
  kind: "boxscore-v2";
  competitionId: number;
  publicationId: number;
  per30MinimumSeconds: number;
  mode: BoxscoreStatisticsMode;
  scope: BoxscoreGameScope;
  sort: BoxscoreMetric | "player" | "team";
  direction: "asc" | "desc";
  page: number;
  pageSize: 20;
  total: number;
  totalPages: number;
  rows: BoxscoreStatisticsPlayerRow[];
  compared: BoxscoreStatisticsPlayerRow[];
  leaders: Partial<Record<BoxscoreMetric, number[]>>;
  teams: Array<{ id: number; name: string; slug: string }>;
  playerOptions: Array<{ id: number; name: string; teamName: string }>;
  coverage: {
    regularGames: number;
    playoffGames: number;
    unclassifiedGames: number;
  };
}

const filterOperators = new Set<BoxscoreFilterOperator>([">=", ">", "<=", "<", "="]);

function positivePage(value: string | null): number {
  if (!value || !/^[1-9][0-9]*$/.test(value)) return 1;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 1;
}

export function parseBoxscoreStatisticsQuery(
  searchParams: URLSearchParams,
): BoxscoreStatisticsQuery {
  const mode = parseBoxscoreStatisticsMode(searchParams.get("mode"));
  const scope = parseBoxscoreGameScope(searchParams.get("scope"));
  const requestedSort = searchParams.get("sort") ?? "points";
  const parsedSort =
    requestedSort === "player" || requestedSort === "team" || isBoxscoreMetric(requestedSort)
      ? requestedSort
      : "points";
  const sort = mode === "per-30" && parsedSort === "minutes" ? "points" : parsedSort;
  const filters = (searchParams.get("filters") ?? "")
    .split(";")
    .slice(0, 5)
    .flatMap((serialized): BoxscoreStatisticsFilter[] => {
      const [metric, operator, rawValue] = serialized.split(":");
      const value = Number(rawValue);
      if (
        !metric ||
        !isBoxscoreMetric(metric) ||
        !operator ||
        !filterOperators.has(operator as BoxscoreFilterOperator) ||
        !Number.isFinite(value) ||
        (mode === "per-30" && metric === "minutes")
      ) {
        return [];
      }
      return [{ metric, operator: operator as BoxscoreFilterOperator, value }];
    });
  return {
    mode,
    scope,
    search: (searchParams.get("q") ?? "").trim().slice(0, 80),
    team: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(searchParams.get("team") ?? "")
      ? searchParams.get("team")
      : null,
    filters,
    sort,
    direction: searchParams.get("dir") === "asc" ? "asc" : "desc",
    page: positivePage(searchParams.get("page")),
    compare: [...new Set((searchParams.get("compare") ?? "").split(","))]
      .flatMap((value) => (/^[1-9][0-9]*$/.test(value) ? [Number(value)] : []))
      .filter(Number.isSafeInteger)
      .slice(0, 2),
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function percentage(made: number | null, attempted: number | null): number | null {
  if (made === null || attempted === null || attempted === 0) return null;
  return round((made / attempted) * 100);
}

function available(value: number | null): BoxscoreMetricCell {
  return value === null
    ? { status: "unavailable", value: null }
    : { status: "available", value: round(value) };
}

function scaled(
  total: number | null,
  denominator: number,
  seconds: number | null,
  mode: BoxscoreStatisticsMode,
  minimumSeconds: number,
): BoxscoreMetricCell {
  if (total === null) return { status: "unavailable", value: null };
  if (mode === "total") return available(total);
  if (mode === "per-game")
    return denominator > 0 ? available(total / denominator) : available(null);
  if (seconds === null || !hasMinimumPer30Sample(seconds, minimumSeconds)) {
    return { status: "insufficient-sample", value: null };
  }
  return available(normalizePer30(total, seconds, minimumSeconds));
}

function efficiency(row: BoxscoreSnapshotRow): number | null {
  if (
    row.advanced_points === null ||
    row.offensive_rebounds === null ||
    row.defensive_rebounds === null ||
    row.assists === null ||
    row.steals === null ||
    row.blocks === null ||
    row.two_point_attempted === null ||
    row.two_point_made === null ||
    row.three_point_attempted === null ||
    row.three_point_made === null ||
    row.free_throw_attempted === null ||
    row.free_throw_made === null ||
    row.turnovers === null
  ) {
    return null;
  }
  return (
    row.advanced_points +
    row.offensive_rebounds +
    row.defensive_rebounds +
    row.assists +
    row.steals +
    row.blocks -
    (row.two_point_attempted - row.two_point_made) -
    (row.three_point_attempted - row.three_point_made) -
    (row.free_throw_attempted - row.free_throw_made) -
    row.turnovers
  );
}

export function boxscorePlayerRow(
  row: BoxscoreSnapshotRow,
  mode: BoxscoreStatisticsMode,
): BoxscoreStatisticsPlayerRow {
  const seconds = row.seconds_covered;
  const minimumSeconds = row.per_30_minimum_seconds;
  const advancedGames = row.advanced_games_covered;
  const fieldGoalsMade =
    row.two_point_made === null || row.three_point_made === null
      ? null
      : row.two_point_made + row.three_point_made;
  const fieldGoalsAttempted =
    row.two_point_attempted === null || row.three_point_attempted === null
      ? null
      : row.two_point_attempted + row.three_point_attempted;
  const plusMinus =
    mode === "total"
      ? available(row.plus_minus)
      : row.plus_minus === null || advancedGames === 0
        ? available(null)
        : available(row.plus_minus / advancedGames);
  return {
    playerId: row.player_id,
    playerName: row.player_name,
    playerSlug: row.player_slug,
    registrationId: row.registration_id,
    teamId: row.team_id,
    teamName: row.team_name,
    teamSlug: row.team_slug,
    teamAbbreviation: row.team_abbreviation,
    jersey: row.jersey_varies ? "var." : row.jersey_number,
    metrics: {
      games: available(row.games_played),
      minutes:
        mode === "total"
          ? available(seconds === null ? null : seconds / 60)
          : available(
              seconds === null || advancedGames === 0 ? null : seconds / 60 / advancedGames,
            ),
      points: scaled(
        mode === "per-30" ? row.advanced_points : row.official_points,
        mode === "per-30" ? advancedGames : row.scoring_games_covered,
        seconds,
        mode,
        minimumSeconds,
      ),
      rebounds: scaled(
        row.offensive_rebounds === null || row.defensive_rebounds === null
          ? null
          : row.offensive_rebounds + row.defensive_rebounds,
        advancedGames,
        seconds,
        mode,
        minimumSeconds,
      ),
      offensiveRebounds: scaled(
        row.offensive_rebounds,
        advancedGames,
        seconds,
        mode,
        minimumSeconds,
      ),
      defensiveRebounds: scaled(
        row.defensive_rebounds,
        advancedGames,
        seconds,
        mode,
        minimumSeconds,
      ),
      assists: scaled(row.assists, advancedGames, seconds, mode, minimumSeconds),
      turnovers: scaled(row.turnovers, advancedGames, seconds, mode, minimumSeconds),
      blocks: scaled(row.blocks, advancedGames, seconds, mode, minimumSeconds),
      steals: scaled(row.steals, advancedGames, seconds, mode, minimumSeconds),
      foulsCommitted: scaled(
        row.fouls_committed,
        row.foul_games_covered,
        seconds,
        mode,
        minimumSeconds,
      ),
      foulsReceived: scaled(
        row.fouls_received,
        row.fouls_received_games_covered,
        seconds,
        mode,
        minimumSeconds,
      ),
      fieldGoalsMade: scaled(fieldGoalsMade, advancedGames, seconds, mode, minimumSeconds),
      fieldGoalsAttempted: scaled(
        fieldGoalsAttempted,
        advancedGames,
        seconds,
        mode,
        minimumSeconds,
      ),
      freeThrowsMade: scaled(row.free_throw_made, advancedGames, seconds, mode, minimumSeconds),
      freeThrowsAttempted: scaled(
        row.free_throw_attempted,
        advancedGames,
        seconds,
        mode,
        minimumSeconds,
      ),
      efficiency: scaled(efficiency(row), advancedGames, seconds, mode, minimumSeconds),
      plusMinus,
      fieldGoalPercentage: available(percentage(fieldGoalsMade, fieldGoalsAttempted)),
      freeThrowPercentage: available(percentage(row.free_throw_made, row.free_throw_attempted)),
    },
  };
}

function normalized(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function matches(value: number, operator: BoxscoreFilterOperator, target: number): boolean {
  if (operator === ">=") return value >= target;
  if (operator === "<=") return value <= target;
  if (operator === ">") return value > target;
  if (operator === "<") return value < target;
  return value === target;
}

function compareNullable(
  left: number | string | null,
  right: number | string | null,
  direction: "asc" | "desc",
): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  const compared =
    typeof left === "string" && typeof right === "string"
      ? left.localeCompare(right, "pt-BR", { sensitivity: "base" })
      : Number(left) - Number(right);
  return direction === "asc" ? compared : -compared;
}

export function buildBoxscoreStatisticsPage(
  rawRows: BoxscoreSnapshotRow[],
  header: BoxscoreSnapshotHeader,
  query: BoxscoreStatisticsQuery,
): BoxscoreStatisticsPageDto {
  const allRows = rawRows.map((row) => boxscorePlayerRow(row, query.mode));
  const searched = allRows.filter((row) => {
    const search = normalized(query.search);
    return (
      (!search || normalized(`${row.playerName} ${row.teamName}`).includes(search)) &&
      (!query.team || row.teamSlug === query.team) &&
      query.filters.every((filter) => {
        const cell = row.metrics[filter.metric];
        return cell.status === "available" && matches(cell.value, filter.operator, filter.value);
      })
    );
  });
  const sortValue = (row: BoxscoreStatisticsPlayerRow): number | string | null => {
    if (query.sort === "player") return row.playerName;
    if (query.sort === "team") return row.teamName;
    const cell = row.metrics[query.sort];
    return cell.status === "available" ? cell.value : null;
  };
  const sorted = [...searched].sort(
    (left, right) =>
      compareNullable(sortValue(left), sortValue(right), query.direction) ||
      left.playerName.localeCompare(right.playerName, "pt-BR"),
  );
  const leaders: Partial<Record<BoxscoreMetric, number[]>> = {};
  for (const metric of Object.keys(BOXSCORE_METRICS) as BoxscoreMetric[]) {
    const availableRows = searched.filter((row) => row.metrics[metric].status === "available");
    if (!availableRows.length) continue;
    const lowerIsBetter = BOXSCORE_METRICS[metric].lowerIsBetter;
    const leadingValue = Math[lowerIsBetter ? "min" : "max"](
      ...availableRows.map((row) => (row.metrics[metric] as { value: number }).value),
    );
    leaders[metric] = availableRows
      .filter((row) => (row.metrics[metric] as { value: number }).value === leadingValue)
      .map((row) => row.playerId);
  }
  const totalPages = Math.max(1, Math.ceil(sorted.length / 20));
  const page = Math.min(query.page, totalPages);
  const compared = query.compare.flatMap((playerId) => {
    const row = allRows.find((candidate) => candidate.playerId === playerId);
    return row ? [row] : [];
  });
  const teams = [
    ...new Map(
      allRows.map((row) => [
        row.teamId,
        { id: row.teamId, name: row.teamName, slug: row.teamSlug },
      ]),
    ).values(),
  ].sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  return {
    kind: "boxscore-v2",
    competitionId: header.competition_id,
    publicationId: header.publication_id,
    per30MinimumSeconds: header.per_30_minimum_seconds,
    mode: query.mode,
    scope: query.scope,
    sort: query.sort,
    direction: query.direction,
    page,
    pageSize: 20,
    total: sorted.length,
    totalPages,
    rows: sorted.slice((page - 1) * 20, page * 20),
    compared,
    leaders,
    teams,
    playerOptions: allRows
      .map((row) => ({ id: row.playerId, name: row.playerName, teamName: row.teamName }))
      .sort((left, right) => left.name.localeCompare(right.name, "pt-BR")),
    coverage: {
      regularGames: header.regular_games,
      playoffGames: header.playoff_games,
      unclassifiedGames: header.unclassified_games,
    },
  };
}
