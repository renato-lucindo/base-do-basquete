import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { extractFibaGeniusBoxscore } from "./extract.server";
import { validateParsedBoxscore } from "./parser";

const fixtures = fileURLToPath(
  new URL("../../../docs/plan/referencias/modelos-boxscore/", import.meta.url),
);

async function parseFixture(filename: string) {
  return extractFibaGeniusBoxscore(new Uint8Array(await readFile(`${fixtures}${filename}`)));
}

describe("FIBA/Genius Sports parser", () => {
  it("parses ALC x AVA from the supported fixture", async () => {
    const parsed = await parseFixture("Box Score FIBA ALC vs AVA 09 maio.pdf");
    expect(parsed.gameNumber).toBe("5205808");
    expect(parsed.scheduledLocal).toBe("2026-05-09T17:00");
    expect(
      parsed.teams.map((team) => [team.abbreviation, team.score, team.players.length]),
    ).toEqual([
      ["ALC", 58, 10],
      ["AVA", 67, 12],
    ]);
    expect(parsed.teams[0].players[0]).toMatchObject({
      jerseyNumber: "00",
      name: "Marcos Gabriel Araujo de Oliveira",
      starter: true,
      points: 12,
    });
    expect(parsed.teams[1].players.find((player) => player.jerseyNumber === "5")).toMatchObject({
      name: "Flavio de Leon Santos Scherer",
      captain: true,
      didNotPlay: true,
    });
    expect(parsed.teams[0].teamStatistics).toEqual({
      pointsFromTurnovers: 13,
      pointsInPaint: 28,
      pointsInPaintMade: 14,
      pointsInPaintAttempted: 39,
      secondChancePoints: 15,
      fastBreakPoints: 21,
      fastBreakPointsFromTurnovers: 8,
      benchPoints: 28,
      largestLead: 0,
      largestScoringRun: 9,
      pointsPerPossession: 0.7,
      timeLeadingSeconds: 0,
    });
    expect(parsed.teams[1].teamStatistics?.pointsInPaint).toBe(32);
    expect(parsed.gameStatistics).toEqual({ leadChanges: 1, timesTied: 4 });
    expect(validateParsedBoxscore(parsed).valid).toBe(true);

    const incomplete = structuredClone(parsed);
    delete incomplete.teams[0].teamStatistics;
    delete incomplete.gameStatistics;
    expect(validateParsedBoxscore(incomplete).issues).toContainEqual(
      expect.objectContaining({ code: "BDB_PDF_TEAM_STATISTICS_MISSING" }),
    );
  });

  it("parses IVV x CAC from the supported fixture", async () => {
    const parsed = await parseFixture("Box Score FIBA IVV vs CAC 06 maio.pdf");
    expect(parsed.gameNumber).toBe("5205822");
    expect(parsed.scheduledLocal).toBe("2026-05-06T20:30");
    expect(
      parsed.teams.map((team) => [team.abbreviation, team.score, team.players.length]),
    ).toEqual([
      ["IVV", 93, 12],
      ["CAC", 39, 8],
    ]);
    expect(parsed.teams[0].players[0]).toMatchObject({
      jerseyNumber: "2",
      name: "Alisson Venâncio do Nascimento",
      points: 12,
    });
    expect(parsed.teams[1].players.find((player) => player.jerseyNumber === "36")?.name).toBe(
      "Thierry Botelho de Oliveira Claudino",
    );
    expect(parsed.teams[0].teamStatistics).toMatchObject({
      pointsFromTurnovers: 20,
      pointsInPaint: 48,
      secondChancePoints: 28,
      fastBreakPoints: 20,
      fastBreakPointsFromTurnovers: 7,
      benchPoints: 41,
      largestLead: 55,
      largestScoringRun: 18,
      pointsPerPossession: 1.11,
      timeLeadingSeconds: 1964,
    });
    expect(parsed.gameStatistics).toEqual({ leadChanges: 4, timesTied: 2 });
    expect(validateParsedBoxscore(parsed).valid).toBe(true);
  });

  it("rejects a PDF without a text layer before interpretation", async () => {
    await expect(extractFibaGeniusBoxscore(new Uint8Array([37, 80, 68, 70, 45]))).rejects.toThrow();
  });
});

describe("basketball site parser", () => {
  it("parses the two-page fixture without inventing unavailable statistics", async () => {
    const parsed = await parseFixture("Boxscore-site.pdf");

    expect(parsed).toMatchObject({
      format: "BASKETBALL_SITE",
      parserVersion: "basketball-site-v1",
      competitionName: null,
      gameNumber: null,
      scheduledLocal: "2026-05-13T20:30",
      durationSeconds: null,
      venue: "Sesport",
    });
    expect(parsed.teams.map((team) => [team.name, team.score, team.players.length])).toEqual([
      ["Instituto Viva Vida", 98, 12],
      ["Saldanha da Gama", 57, 12],
    ]);
    expect(parsed.teams[0].periodScores).toBeNull();
    expect(parsed.teams[0].teamStatistics).toBeUndefined();
    expect(parsed.gameStatistics).toBeUndefined();
    expect(parsed.teams[0].players[0]).toMatchObject({
      jerseyNumber: "3",
      name: "A. Freitas Brochado",
      secondsPlayed: 928,
      points: 6,
      plusMinus: null,
      foulsReceived: null,
    });
    expect(parsed.teams[1].players.find((player) => player.jerseyNumber === "13")).toMatchObject({
      name: "V. Christ de Miranda",
      points: 13,
    });
    expect(validateParsedBoxscore(parsed)).toEqual({ valid: true, issues: [] });
  });
});
