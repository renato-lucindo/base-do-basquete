import { describe, expect, it } from "vitest";

import { addPlayerTotals, perGame, publicProfileValue } from "./player-profile-domain";

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
        { games: 2, points: 10, assists: 3, rebounds: 8, steals: 1, blocks: 0 },
        { games: 3, points: 21, assists: 4, rebounds: 9, steals: 2, blocks: 1 },
      ]),
    ).toEqual({ games: 5, points: 31, assists: 7, rebounds: 17, steals: 3, blocks: 1 });
  });

  it("uses an explicit fallback only for missing public data", () => {
    expect(publicProfileValue(null)).toBe("NÃ£o informado");
    expect(publicProfileValue(0)).toBe("0");
  });
});

