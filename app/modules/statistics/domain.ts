export type StatisticsMode = "totals" | "averages";
export type FilterOperator = ">=" | ">" | "<=" | "<" | "=";
export type ComparisonState = "better" | "worse" | "equal" | "unavailable";

export interface CategoryCapabilities {
  advanced: boolean;
  comparison: boolean;
  filters: boolean;
}

export interface StatisticTotals {
  secondsPlayed: number;
  points: number;
  twoPointMade: number;
  twoPointAttempted: number;
  threePointMade: number;
  threePointAttempted: number;
  freeThrowMade: number;
  freeThrowAttempted: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  assists: number;
  turnovers: number;
  steals: number;
  blocks: number;
  fouls: number;
  plusMinus: number;
}

export interface PlayerStatistics {
  competitionId: number;
  playerId: number;
  playerName: string;
  playerSlug: string;
  teamName: string | null;
  teamSlug: string | null;
  teamAbbreviation: string | null;
  gamesPlayed: number;
  advancedGamesPlayed: number;
  officialPoints: number;
  fouls: number | null;
  advancedTotals: StatisticTotals | null;
}

export type FilterMetric =
  | "games"
  | "minutes"
  | "points"
  | "rebounds"
  | "offensiveRebounds"
  | "defensiveRebounds"
  | "assists"
  | "steals"
  | "blocks"
  | "turnovers"
  | "fouls"
  | "fieldGoalPercentage"
  | "threePointPercentage"
  | "freeThrowPercentage"
  | "efficiency"
  | "plusMinus";

export interface StatisticFilter {
  id: string;
  metric: FilterMetric;
  operator: FilterOperator;
  value: number;
}

export function categoryCapabilities(hasAdvancedStats: boolean | null | undefined) {
  const advanced = hasAdvancedStats === true;
  return { advanced, comparison: advanced, filters: advanced } satisfies CategoryCapabilities;
}

export function percentage(made: number, attempted: number): number | null {
  if (attempted === 0) return null;
  if (attempted < 0 || made < 0 || made > attempted) {
    throw new RangeError("Invalid shooting totals");
  }
  return Math.round((made / attempted) * 1000) / 10;
}

export function perGame(total: number, gamesPlayed: number): number | null {
  if (gamesPlayed === 0) return null;
  if (gamesPlayed < 0) throw new RangeError("Invalid game count");
  return Math.round((total / gamesPlayed) * 10) / 10;
}

export function rebounds(totals: StatisticTotals): number {
  return totals.offensiveRebounds + totals.defensiveRebounds;
}

// FIBA-style efficiency: positive contributions minus missed shots and turnovers.
export function efficiency(totals: StatisticTotals): number {
  const missedFieldGoals =
    totals.twoPointAttempted -
    totals.twoPointMade +
    totals.threePointAttempted -
    totals.threePointMade;
  const missedFreeThrows = totals.freeThrowAttempted - totals.freeThrowMade;
  return (
    totals.points +
    rebounds(totals) +
    totals.assists +
    totals.steals +
    totals.blocks -
    missedFieldGoals -
    missedFreeThrows -
    totals.turnovers
  );
}

export function statisticValue(
  player: PlayerStatistics,
  metric: FilterMetric,
  mode: StatisticsMode,
): number | null {
  const advanced = player.advancedTotals;
  const total = (() => {
    switch (metric) {
      case "games":
        return player.gamesPlayed;
      case "minutes":
        return advanced === null ? null : advanced.secondsPlayed / 60;
      case "points":
        return player.officialPoints;
      case "rebounds":
        return advanced === null ? null : rebounds(advanced);
      case "offensiveRebounds":
        return advanced?.offensiveRebounds ?? null;
      case "defensiveRebounds":
        return advanced?.defensiveRebounds ?? null;
      case "assists":
        return advanced?.assists ?? null;
      case "steals":
        return advanced?.steals ?? null;
      case "blocks":
        return advanced?.blocks ?? null;
      case "turnovers":
        return advanced?.turnovers ?? null;
      case "fouls":
        return player.fouls;
      case "fieldGoalPercentage":
        return advanced === null
          ? null
          : percentage(
              advanced.twoPointMade + advanced.threePointMade,
              advanced.twoPointAttempted + advanced.threePointAttempted,
            );
      case "threePointPercentage":
        return advanced === null
          ? null
          : percentage(advanced.threePointMade, advanced.threePointAttempted);
      case "freeThrowPercentage":
        return advanced === null
          ? null
          : percentage(advanced.freeThrowMade, advanced.freeThrowAttempted);
      case "efficiency":
        return advanced === null ? null : efficiency(advanced);
      case "plusMinus":
        return advanced?.plusMinus ?? null;
    }
  })();
  if (total === null) return null;
  if (
    metric === "games" ||
    metric === "fieldGoalPercentage" ||
    metric === "threePointPercentage" ||
    metric === "freeThrowPercentage"
  ) {
    return total;
  }
  const denominator =
    metric === "points" || metric === "fouls" ? player.gamesPlayed : player.advancedGamesPlayed;
  return mode === "totals" ? total : perGame(total, denominator);
}

function matches(value: number, operator: FilterOperator, target: number): boolean {
  if (operator === ">=") return value >= target;
  if (operator === "<=") return value <= target;
  if (operator === ">") return value > target;
  if (operator === "<") return value < target;
  return value === target;
}

export function applyStatisticFilters(
  players: PlayerStatistics[],
  filters: StatisticFilter[],
  mode: StatisticsMode,
): PlayerStatistics[] {
  if (filters.some((filter) => !Number.isFinite(filter.value))) {
    throw new RangeError("Invalid statistic filter");
  }
  return players.filter((player) =>
    filters.every((filter) => {
      const value = statisticValue(player, filter.metric, mode);
      return value !== null && matches(value, filter.operator, filter.value);
    }),
  );
}

export function compareStatistic(
  left: PlayerStatistics,
  right: PlayerStatistics,
  metric: FilterMetric,
  mode: StatisticsMode,
): { left: ComparisonState; right: ComparisonState } {
  const leftValue = statisticValue(left, metric, mode);
  const rightValue = statisticValue(right, metric, mode);
  if (leftValue === null || rightValue === null) {
    return { left: "unavailable", right: "unavailable" };
  }
  if (leftValue === rightValue) return { left: "equal", right: "equal" };
  const lowerIsBetter = metric === "turnovers" || metric === "fouls";
  const leftIsBetter = lowerIsBetter ? leftValue < rightValue : leftValue > rightValue;
  return leftIsBetter ? { left: "better", right: "worse" } : { left: "worse", right: "better" };
}
