import type { PlayerStatistics } from "./domain";
import type { SimplePlayerStatistics } from "./public-statistics.server";

export type SortDirection = "asc" | "desc";
export type StatisticsSortKey =
  | "player"
  | "team"
  | "games"
  | "minutes"
  | "points"
  | "pointsPerGame"
  | "rebounds"
  | "assists"
  | "efficiency"
  | "plusMinus";

export type AdvancedColumn =
  | "games"
  | "minutes"
  | "points"
  | "rebounds"
  | "offensiveRebounds"
  | "defensiveRebounds"
  | "assists"
  | "fieldGoals"
  | "fieldGoalPercentage"
  | "threePointers"
  | "threePointPercentage"
  | "freeThrows"
  | "freeThrowPercentage"
  | "efficiency"
  | "plusMinus";

export type ColumnPreset = "summary" | "shooting" | "complete";

export const advancedColumnPresets: Record<ColumnPreset, AdvancedColumn[]> = {
  summary: ["games", "minutes", "points", "rebounds", "assists", "efficiency", "plusMinus"],
  shooting: [
    "games",
    "points",
    "fieldGoals",
    "fieldGoalPercentage",
    "threePointers",
    "threePointPercentage",
    "freeThrows",
    "freeThrowPercentage",
  ],
  complete: [
    "games",
    "minutes",
    "points",
    "rebounds",
    "offensiveRebounds",
    "defensiveRebounds",
    "assists",
    "fieldGoals",
    "fieldGoalPercentage",
    "threePointers",
    "threePointPercentage",
    "freeThrows",
    "freeThrowPercentage",
    "efficiency",
    "plusMinus",
  ],
};

const allowedColumns = new Set<AdvancedColumn>(advancedColumnPresets.complete);
const allowedSortKeys = new Set<StatisticsSortKey>([
  "player",
  "team",
  "games",
  "minutes",
  "points",
  "pointsPerGame",
  "rebounds",
  "assists",
  "efficiency",
  "plusMinus",
]);

export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function matchesStatisticsSearch(
  player: Pick<PlayerStatistics | SimplePlayerStatistics, "playerName" | "teamName">,
  query: string,
): boolean {
  const normalized = normalizeSearch(query);
  if (!normalized) return true;
  return normalizeSearch(`${player.playerName} ${player.teamName ?? ""}`).includes(normalized);
}

export function parseColumnPreset(value: string | null): ColumnPreset {
  return value === "shooting" || value === "complete" ? value : "summary";
}

export function parseColumns(value: string | null, fallback: ColumnPreset): AdvancedColumn[] {
  if (!value) return advancedColumnPresets[fallback];
  const columns = value
    .split(",")
    .filter((column): column is AdvancedColumn => allowedColumns.has(column as AdvancedColumn));
  return columns.length > 0 ? [...new Set(columns)] : advancedColumnPresets[fallback];
}

export function serializeColumns(columns: AdvancedColumn[]): string {
  return columns.filter((column) => allowedColumns.has(column)).join(",");
}

export function parseSortKey(value: string | null, fallback: StatisticsSortKey): StatisticsSortKey {
  return value && allowedSortKeys.has(value as StatisticsSortKey)
    ? (value as StatisticsSortKey)
    : fallback;
}

export function parseSortDirection(value: string | null): SortDirection {
  return value === "asc" ? "asc" : "desc";
}

export function compareValues(
  left: number | string | null,
  right: number | string | null,
  direction: SortDirection,
): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  const result =
    typeof left === "string" && typeof right === "string"
      ? left.localeCompare(right, "pt-BR", { sensitivity: "base" })
      : Number(left) - Number(right);
  return direction === "asc" ? result : -result;
}

export function nextSort(
  currentKey: StatisticsSortKey,
  currentDirection: SortDirection,
  requestedKey: StatisticsSortKey,
): { key: StatisticsSortKey; direction: SortDirection } {
  if (currentKey !== requestedKey) {
    return { key: requestedKey, direction: requestedKey === "player" ? "asc" : "desc" };
  }
  return { key: currentKey, direction: currentDirection === "asc" ? "desc" : "asc" };
}
