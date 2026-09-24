import { describe, expect, it } from "vitest";

import {
  addPlayerTotals,
  emptyPlayerTotals,
  groupPlayerAchievements,
  perGame,
} from "./player-profile-domain";

describe("player profile domain", () => {
  it("does not turn absence of games into a misleading zero average", () => {
    expect(perGame(0, 0)).toBeNull();
  });

  it("rounds per-game values to one decimal place", () => {
    expect(perGame(17, 3)).toBe(5.7);
  });

  it("adds career totals across competitions", () => {
    expect(
      addPlayerTotals([
        {
          ...emptyPlayerTotals,
          games: 2,
          points: 10,
          assists: 3,
          offensiveRebounds: 2,
          defensiveRebounds: 6,
          steals: 1,
        },
        {
          ...emptyPlayerTotals,
          games: 3,
          points: 21,
          assists: 4,
          offensiveRebounds: 3,
          defensiveRebounds: 6,
          steals: 2,
          blocks: 1,
        },
      ]),
    ).toEqual({
      ...emptyPlayerTotals,
      games: 5,
      points: 31,
      assists: 7,
      offensiveRebounds: 5,
      defensiveRebounds: 12,
      steals: 3,
      blocks: 1,
    });
  });

  it("keeps career plus/minus unavailable when coverage is incomplete", () => {
    expect(
      addPlayerTotals([
        { ...emptyPlayerTotals, plusMinus: 3 },
        { ...emptyPlayerTotals, plusMinus: null },
      ]).plusMinus,
    ).toBeNull();
  });

  it("groups repeated achievements without losing category, placement or year", () => {
    const base = {
      competitionDisplayName: "Liga Sub-15",
      seriesName: "Liga",
      seriesSlug: "liga",
      categoryName: "Sub-15",
      categorySlug: "sub-15",
      genderDivision: null,
      placement: 1,
      resultLabel: null,
    } as const;
    expect(
      groupPlayerAchievements([
        { ...base, competitionId: 2, year: 2026 },
        { ...base, competitionId: 1, year: 2025 },
        {
          ...base,
          competitionId: 3,
          year: 2026,
          placement: 2,
          categoryName: "Sub-17",
          categorySlug: "sub-17",
        },
      ]),
    ).toEqual([
      {
        competitionName: "Liga",
        entries: [
          { placement: 1, categoryName: "Sub-15", years: [2025, 2026] },
          { placement: 2, categoryName: "Sub-17", years: [2026] },
        ],
      },
    ]);
  });
});
