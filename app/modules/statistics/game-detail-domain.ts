import type { StatisticTotals } from "./domain";

export function emptyStatisticTotals(): StatisticTotals {
  return {
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
}

export function sumStatisticTotals(rows: StatisticTotals[]): StatisticTotals {
  return rows.reduce(
    (total, row) => ({
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
    emptyStatisticTotals(),
  );
}

export function pointsReconcile(score: number, totals: StatisticTotals | null): boolean | null {
  return totals ? totals.points === score : null;
}
