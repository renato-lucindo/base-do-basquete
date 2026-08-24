import { describe, expect, it } from "vitest";

import type { StatisticTotals } from "./domain";
import { emptyStatisticTotals, pointsReconcile, sumStatisticTotals } from "./game-detail-domain";

function totals(points: number, assists: number): StatisticTotals {
  return { ...emptyStatisticTotals(), points, assists };
}

describe("expanded game detail", () => {
  it("builds a team total from authoritative player rows", () => {
    expect(sumStatisticTotals([totals(10, 2), totals(7, 3)])).toMatchObject({
      points: 17,
      assists: 5,
    });
  });

  it("reconciles player points with the scoreboard", () => {
    expect(pointsReconcile(17, totals(17, 0))).toBe(true);
    expect(pointsReconcile(18, totals(17, 0))).toBe(false);
  });

  it("keeps reconciliation unavailable when the boxscore is absent", () => {
    expect(pointsReconcile(0, null)).toBeNull();
  });
});
