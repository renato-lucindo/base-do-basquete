import type { PublicAchievement } from "../competition/public-data.server";

export interface PlayerTotals {
  games: number;
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
  plusMinus: number | null;
}

export const emptyPlayerTotals: PlayerTotals = {
  games: 0,
  secondsPlayed: 0,
  points: 0,
  twoPointMade: 0,
  twoPointAttempted: 0,
  threePointMade: 0,
  threePointAttempted: 0,
  freeThrowMade: 0,
  freeThrowAttempted: 0,
  offensiveRebounds: 0,
  defensiveRebounds: 0,
  assists: 0,
  turnovers: 0,
  steals: 0,
  blocks: 0,
  fouls: 0,
  plusMinus: 0,
};

export function perGame(total: number, games: number): number | null {
  return games === 0 ? null : Math.round((total / games) * 10) / 10;
}

export interface PlayerAchievementGroup {
  competitionName: string;
  entries: Array<{
    placement: number;
    categoryName: string;
    years: number[];
  }>;
}

export function groupPlayerAchievements(
  achievements: PublicAchievement[],
): PlayerAchievementGroup[] {
  const byCompetition = new Map<
    string,
    Map<string, { placement: number; categoryName: string; years: Set<number> }>
  >();
  for (const achievement of achievements) {
    const competition =
      byCompetition.get(achievement.seriesName) ??
      new Map<string, { placement: number; categoryName: string; years: Set<number> }>();
    const key = `${achievement.placement}:${achievement.categorySlug}`;
    const entry = competition.get(key) ?? {
      placement: achievement.placement,
      categoryName: achievement.categoryName,
      years: new Set<number>(),
    };
    entry.years.add(achievement.year);
    competition.set(key, entry);
    byCompetition.set(achievement.seriesName, competition);
  }
  return [...byCompetition.entries()].map(([competitionName, entries]) => ({
    competitionName,
    entries: [...entries.values()]
      .map((entry) => ({
        ...entry,
        years: [...entry.years].sort((left, right) => left - right),
      }))
      .sort(
        (left, right) =>
          left.placement - right.placement || left.categoryName.localeCompare(right.categoryName),
      ),
  }));
}

export function addPlayerTotals(rows: PlayerTotals[]): PlayerTotals {
  return rows.reduce(
    (total, row) => ({
      games: total.games + row.games,
      secondsPlayed: total.secondsPlayed + row.secondsPlayed,
      points: total.points + row.points,
      twoPointMade: total.twoPointMade + row.twoPointMade,
      twoPointAttempted: total.twoPointAttempted + row.twoPointAttempted,
      threePointMade: total.threePointMade + row.threePointMade,
      threePointAttempted: total.threePointAttempted + row.threePointAttempted,
      freeThrowMade: total.freeThrowMade + row.freeThrowMade,
      freeThrowAttempted: total.freeThrowAttempted + row.freeThrowAttempted,
      offensiveRebounds: total.offensiveRebounds + row.offensiveRebounds,
      defensiveRebounds: total.defensiveRebounds + row.defensiveRebounds,
      assists: total.assists + row.assists,
      turnovers: total.turnovers + row.turnovers,
      steals: total.steals + row.steals,
      blocks: total.blocks + row.blocks,
      fouls: total.fouls + row.fouls,
      plusMinus:
        total.plusMinus === null || row.plusMinus === null ? null : total.plusMinus + row.plusMinus,
    }),
    { ...emptyPlayerTotals },
  );
}

export function percentage(made: number, attempted: number): number | null {
  return attempted > 0 ? Math.round((made / attempted) * 1000) / 10 : null;
}

export function efficiency(totals: PlayerTotals): number {
  return (
    totals.points +
    totals.offensiveRebounds +
    totals.defensiveRebounds +
    totals.assists +
    totals.steals +
    totals.blocks -
    (totals.twoPointAttempted - totals.twoPointMade) -
    (totals.threePointAttempted - totals.threePointMade) -
    (totals.freeThrowAttempted - totals.freeThrowMade) -
    totals.turnovers
  );
}
