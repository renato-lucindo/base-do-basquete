export const BOXSCORE_STATISTICS_MODES = ["per-game", "total", "per-30"] as const;
export type BoxscoreStatisticsMode = (typeof BOXSCORE_STATISTICS_MODES)[number];

export const BOXSCORE_GAME_SCOPES = ["regular", "playoffs", "all"] as const;
export type BoxscoreGameScope = (typeof BOXSCORE_GAME_SCOPES)[number];

export const MINIMUM_PER_30_SECONDS = 600;

export type PublishedStatisticsProfile =
  | { primarySource: "fiba_boxscore"; status: "active" }
  | { primarySource: "manual_scoresheet"; status: "active" }
  | { primarySource: string | null; status: "pending" | "legacy" };

export function isPublishedBoxscoreProfile(
  profile: PublishedStatisticsProfile,
): profile is { primarySource: "fiba_boxscore"; status: "active" } {
  return profile.status === "active" && profile.primarySource === "fiba_boxscore";
}

export function parseBoxscoreStatisticsMode(value: string | null): BoxscoreStatisticsMode {
  return BOXSCORE_STATISTICS_MODES.includes(value as BoxscoreStatisticsMode)
    ? (value as BoxscoreStatisticsMode)
    : "per-game";
}

export function parseBoxscoreGameScope(value: string | null): BoxscoreGameScope {
  return BOXSCORE_GAME_SCOPES.includes(value as BoxscoreGameScope)
    ? (value as BoxscoreGameScope)
    : "regular";
}

export function scopesForStageKind(
  stageKind: "round_robin" | "playoffs" | "legacy_unclassified" | null,
): BoxscoreGameScope[] {
  if (stageKind === "round_robin") return ["regular", "all"];
  if (stageKind === "playoffs") return ["playoffs", "all"];
  return ["all"];
}

export function hasMinimumPer30Sample(secondsCovered: number): boolean {
  return Number.isFinite(secondsCovered) && secondsCovered >= MINIMUM_PER_30_SECONDS;
}

export function normalizePer30(total: number | null, secondsCovered: number): number | null {
  if (total === null || !hasMinimumPer30Sample(secondsCovered)) return null;
  return Math.round(((total * 1800) / secondsCovered) * 10) / 10;
}
