import { describe, expect, it } from "vitest";

import {
  applyStatisticFilters,
  categoryCapabilities,
  compareStatistic,
  efficiency,
  type PlayerStatistics,
  percentage,
  perGame,
  type StatisticTotals,
  statisticValue,
} from "./domain";

const player = (
  playerId: number,
  points: number,
  gamesPlayed = 2,
): PlayerStatistics & { advancedTotals: StatisticTotals } => ({
  competitionId: 10,
  playerId,
  playerName: `Atleta ${playerId}`,
  playerSlug: `atleta-${playerId}`,
  teamName: "Equipe Teste",
  teamSlug: "equipe-teste",
  teamAbbreviation: "ET",
  gamesPlayed,
  advancedGamesPlayed: gamesPlayed,
  officialPoints: points,
  fouls: 2,
  advancedTotals: {
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
    fouls: 2,
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
    expect(efficiency(player(1, 8).advancedTotals)).toBe(13);
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

  it("supports equality and treats ER and FC as lower-is-better", () => {
    expect(
      applyStatisticFilters(
        [player(1, 8), player(2, 3)],
        [{ id: "equal", metric: "points", operator: "=", value: 8 }],
        "totals",
      ).map((item) => item.playerId),
    ).toEqual([1]);
    const left = player(1, 8);
    const right = player(2, 3);
    left.advancedTotals.turnovers = 1;
    right.advancedTotals.turnovers = 3;
    expect(compareStatistic(left, right, "turnovers", "totals")).toEqual({
      left: "better",
      right: "worse",
    });
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

  it("uses total games for points and advanced games for advanced averages", () => {
    const mixed = player(1, 12, 3);
    mixed.advancedGamesPlayed = 2;
    mixed.advancedTotals.assists = 6;
    expect(statisticValue(mixed, "points", "averages")).toBe(4);
    expect(statisticValue(mixed, "assists", "averages")).toBe(3);
  });

  it("keeps unavailable advanced metrics null for fallback-only players", () => {
    const fallbackOnly: PlayerStatistics = player(1, 7, 1);
    fallbackOnly.advancedGamesPlayed = 0;
    fallbackOnly.advancedTotals = null;
    expect(statisticValue(fallbackOnly, "points", "totals")).toBe(7);
    expect(statisticValue(fallbackOnly, "assists", "totals")).toBeNull();
  });

  it("does not turn unavailable plus/minus into zero", () => {
    const withoutPlusMinus = player(1, 7, 1);
    withoutPlusMinus.advancedTotals.plusMinus = null;
    expect(statisticValue(withoutPlusMinus, "plusMinus", "totals")).toBeNull();
    expect(statisticValue(withoutPlusMinus, "plusMinus", "averages")).toBeNull();
  });
});
