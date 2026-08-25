import { describe, expect, it } from "vitest";

import { addPlayerTotals, emptyPlayerTotals, perGame } from "./player-profile-domain";

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
});
