import { describe, expect, it } from "vitest";

import {
  applyStatisticFilters,
  categoryCapabilities,
  compareStatistic,
  efficiency,
  percentage,
  perGame,
  type PlayerStatistics,
} from "./domain";

const player = (playerId: number, points: number, gamesPlayed = 2): PlayerStatistics => ({
  competitionId: 10,
  playerId,
  playerName: `Atleta ${playerId}`,
  playerSlug: `atleta-${playerId}`,
  gamesPlayed,
  totals: {
    secondsPlayed: 1200,
    points,
    twoPointMade: 2,
    twoPointAttempted: 3,
    threePointMade: 1,
    threePointAttempted: 2,
    freeThrowMade: 1,
    freeThrowAttempted: 2,
    offensiveRebounds: 1,
    defensiveRebounds: 2,
    assists: 3,
    turnovers: 1,
    steals: 2,
    blocks: 1,
    plusMinus: 5,
  },
});

describe("statistics domain", () => {
  it("defaults unknown category capability to the safe simple mode", () => {
    expect(categoryCapabilities(undefined)).toEqual({
      advanced: false,
      comparison: false,
      filters: false,
    });
    expect(categoryCapabilities(true).advanced).toBe(true);
  });

  it("derives percentages from summed makes and attempts", () => {
    expect(percentage(2, 3)).toBe(66.7);
    expect(percentage(0, 0)).toBeNull();
    expect(() => percentage(3, 2)).toThrow(RangeError);
  });

  it("derives averages without persisting or fabricating division by zero", () => {
    expect(perGame(7, 2)).toBe(3.5);
    expect(perGame(7, 0)).toBeNull();
  });

  it("uses the documented efficiency formula", () => {
    expect(efficiency(player(1, 8).totals)).toBe(13);
  });

  it("combines validated filters using AND in the selected scale", () => {
    const players = [player(1, 8), player(2, 3)];
    expect(
      applyStatisticFilters(
        players,
        [
          { id: "a", metric: "points", operator: ">=", value: 4 },
          { id: "b", metric: "assists", operator: ">", value: 2 },
        ],
        "totals",
      ).map((item) => item.playerId),
    ).toEqual([1]);
    expect(() =>
      applyStatisticFilters(
        players,
        [{ id: "bad", metric: "points", operator: ">", value: Number.NaN }],
        "totals",
      ),
    ).toThrow(RangeError);
  });

  it("compares equivalent modes with explicit non-color states", () => {
    expect(compareStatistic(player(1, 8), player(2, 3), "points", "totals")).toEqual({
      left: "better",
      right: "worse",
    });
    expect(compareStatistic(player(1, 8, 0), player(2, 3), "points", "averages")).toEqual({
      left: "unavailable",
      right: "unavailable",
    });
  });
});
