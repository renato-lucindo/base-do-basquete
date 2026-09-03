import { describe, expect, it } from "vitest";

import { compareIngestionGame, type IngestionGame } from "./comparator";

const expected: IngestionGame = {
  competitionId: 8,
  gameNumber: "63",
  home: {
    registrationId: 10,
    score: 58,
    periodScores: [11, 14, 15, 18],
    players: [
      {
        playerId: 100,
        jerseyNumber: "00",
        points: 12,
        twoPointMade: 3,
        threePointMade: 1,
        freeThrowMade: 3,
      },
    ],
  },
  away: {
    registrationId: 20,
    score: 67,
    periodScores: [19, 14, 18, 16],
    players: [{ playerId: 200, jerseyNumber: "5", points: 8 }],
  },
};

describe("compareIngestionGame", () => {
  it("accepts identical evidence", () => {
    expect(compareIngestionGame(expected, structuredClone(expected))).toEqual({
      compatible: true,
      sideInverted: false,
      errors: [],
      warnings: [],
    });
  });

  it("accepts an allowed inversion and aligns team data", () => {
    const actual = { ...structuredClone(expected), home: expected.away, away: expected.home };
    const result = compareIngestionGame(expected, actual, { allowSideInversion: true });
    expect(result.compatible).toBe(true);
    expect(result.sideInverted).toBe(true);
    expect(result.warnings.map(({ code }) => code)).toEqual(["INGESTION_SIDE_INVERTED"]);
  });

  it("rejects participant and period divergences with stable Portuguese errors", () => {
    const participantMismatch = structuredClone(expected);
    participantMismatch.away.registrationId = 99;
    expect(compareIngestionGame(expected, participantMismatch).errors[0]).toMatchObject({
      code: "INGESTION_PARTICIPANTS_MISMATCH",
      message: "Os participantes não correspondem ao confronto selecionado.",
    });

    const periodMismatch = structuredClone(expected);
    periodMismatch.home.periodScores = [11, 14, 15, 17];
    expect(compareIngestionGame(expected, periodMismatch).errors[0]).toMatchObject({
      code: "INGESTION_PERIODS_MISMATCH",
      message: "A pontuação por período diverge do jogo selecionado.",
    });
  });

  it("treats jersey as a warning but scoring as an error", () => {
    const actual = structuredClone(expected);
    if (!actual.home.players?.[0]) throw new Error("fixture inválida");
    actual.home.players[0].jerseyNumber = "9";
    actual.home.players[0].threePointMade = 2;

    const result = compareIngestionGame(expected, actual);
    expect(result.warnings[0]?.code).toBe("INGESTION_JERSEY_WARNING");
    expect(result.errors[0]?.code).toBe("INGESTION_PLAYER_STATS_MISMATCH");
  });
});
