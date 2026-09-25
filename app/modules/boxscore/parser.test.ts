import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { extractTextItems, getDocumentProxy } from "unpdf";
import { describe, expect, it } from "vitest";

import { createPdfStorageBody, extractFibaGeniusBoxscore } from "./extract.server";
import { parseFibaGeniusBoxscore, validateParsedBoxscore } from "./parser";
import type { PositionedTextItem } from "./types";

const fixtures = fileURLToPath(
  new URL("../../../docs/plan/referencias/modelos-boxscore/", import.meta.url),
);

async function parseFixture(filename: string) {
  return extractFibaGeniusBoxscore(new Uint8Array(await readFile(`${fixtures}${filename}`)));
}

async function extractFixturePages(filename: string): Promise<PositionedTextItem[][]> {
  const pdf = await getDocumentProxy(new Uint8Array(await readFile(`${fixtures}${filename}`)), {
    stopAtErrors: true,
  });
  const { items } = await extractTextItems(pdf);
  return items.map((page) =>
    page.map((item) => ({
      str: item.str,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
    })),
  );
}

function mergeRowItems(
  pages: PositionedTextItem[][],
  y: number,
  minimum: number,
  maximum: number,
  forcedText?: string,
): void {
  const page = pages[0];
  if (!page) throw new Error("Missing fixture page");
  const selected = page
    .filter(
      (item) =>
        Math.abs(item.y - y) <= 0.01 &&
        item.x >= minimum &&
        item.x < maximum &&
        item.str.trim().length > 0,
    )
    .sort((left, right) => left.x - right.x);
  if (!selected.length) throw new Error("Missing fixture row items");
  const first = selected[0];
  const last = selected.at(-1);
  if (!first || !last) throw new Error("Missing fixture row bounds");
  const selectedItems = new Set(selected);
  const merged: PositionedTextItem = {
    str: forcedText ?? selected.map((item) => item.str.trim()).join(" "),
    x: first.x,
    y,
    width: last.x + last.width - first.x,
    height: Math.max(...selected.map((item) => item.height)),
  };
  pages[0] = page.filter((item) => !selectedItems.has(item));
  pages[0]?.push(merged);
}

describe("FIBA/Genius Sports parser", () => {
  it("preserves the caller PDF bytes after extraction for later storage", async () => {
    const bytes = new Uint8Array(
      await readFile(`${fixtures}Box Score FIBA SAL vs SAN 09 maio.pdf`),
    );
    const originalByteLength = bytes.byteLength;

    const parsed = await extractFibaGeniusBoxscore(bytes);

    expect(parsed.gameNumber).toBe("5205816");
    expect(bytes.byteLength).toBe(originalByteLength);
    expect(createPdfStorageBody(bytes).size).toBe(originalByteLength);
  });

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

  it("parses SAL x SAN from the supported FIBA/Genius variation", async () => {
    const parsed = await parseFixture("Box Score FIBA SAL vs SAN 09 maio.pdf");
    expect(parsed.gameNumber).toBe("5205816");
    expect(parsed.scheduledLocal).toBe("2026-05-09T15:00");
    expect(
      parsed.teams.map((team) => [team.abbreviation, team.score, team.players.length]),
    ).toEqual([
      ["SAL", 59, 12],
      ["SAN", 40, 11],
    ]);
    expect(parsed.teams[0].players[0]).toMatchObject({
      jerseyNumber: "0",
      name: "Arthur Ferreira Cock",
      didNotPlay: true,
    });
    expect(parsed.teams[0].players.find((player) => player.jerseyNumber === "2")).toMatchObject({
      plusMinus: 17,
      efficiency: 11,
      points: 5,
    });
    expect(parsed.teams[0].players.find((player) => player.jerseyNumber === "4")).toMatchObject({
      plusMinus: 19,
      efficiency: 16,
      points: 11,
    });
    expect(parsed.teams[0].teamStatistics).toMatchObject({
      pointsFromTurnovers: 19,
      pointsInPaint: 28,
      pointsInPaintMade: 14,
      pointsInPaintAttempted: 23,
      secondChancePoints: 7,
      fastBreakPoints: 12,
      fastBreakPointsFromTurnovers: 3,
      benchPoints: 16,
      largestLead: 19,
      largestScoringRun: 11,
      pointsPerPossession: 0.79,
      timeLeadingSeconds: 2357,
    });
    expect(parsed.teams[1].teamStatistics).toMatchObject({
      pointsFromTurnovers: 16,
      pointsInPaint: 24,
      pointsInPaintMade: 12,
      pointsInPaintAttempted: 37,
      timeLeadingSeconds: 0,
    });
    expect(parsed.gameStatistics).toEqual({ leadChanges: 1, timesTied: 1 });
    expect(validateParsedBoxscore(parsed).valid).toBe(true);
  });

  it("maps fused player cells by their geometric columns", async () => {
    const pages = await extractFixturePages("Box Score FIBA SAL vs SAN 09 maio.pdf");
    const page = pages[0];
    if (!page) throw new Error("Missing fixture page");
    const julioRow = page.find((item) => item.str === "Júlio Cesar Silva Filho")?.y;
    if (julioRow === undefined) throw new Error("Missing Júlio fixture row");

    mergeRowItems(pages, julioRow, 484, 543);
    const parsed = parseFibaGeniusBoxscore(pages);
    expect(parsed.teams[0].players.find((player) => player.jerseyNumber === "2")).toMatchObject({
      foulsCommitted: 1,
      foulsReceived: 0,
      plusMinus: 17,
      efficiency: 11,
      points: 5,
    });
  });

  it("maps three fused cells without shifting them into adjacent columns", async () => {
    const pages = await extractFixturePages("Box Score FIBA SAL vs SAN 09 maio.pdf");
    const page = pages[0];
    if (!page) throw new Error("Missing fixture page");
    const julioRow = page.find((item) => item.str === "Júlio Cesar Silva Filho")?.y;
    if (julioRow === undefined) throw new Error("Missing Júlio fixture row");

    mergeRowItems(pages, julioRow, 498, 543);
    const parsed = parseFibaGeniusBoxscore(pages);
    expect(parsed.teams[0].players.find((player) => player.jerseyNumber === "2")).toMatchObject({
      foulsReceived: 0,
      plusMinus: 17,
      efficiency: 11,
    });
  });

  it("maps fused negative values by geometry", async () => {
    const pages = await extractFixturePages("Box Score FIBA SAL vs SAN 09 maio.pdf");
    const page = pages[0];
    if (!page) throw new Error("Missing fixture page");
    const negativePlusMinus = page.find((item) => item.str === "-18");
    if (!negativePlusMinus) throw new Error("Missing negative fixture row");

    mergeRowItems(pages, negativePlusMinus.y, 513, 543);
    const parsed = parseFibaGeniusBoxscore(pages);
    expect(parsed.teams[1].players.find((player) => player.jerseyNumber === "10")).toMatchObject({
      plusMinus: -18,
      efficiency: -16,
      points: 1,
    });
  });

  it("keeps ignored percentage columns in the geometric alignment", async () => {
    const pages = await extractFixturePages("Box Score FIBA SAL vs SAN 09 maio.pdf");
    const page = pages[0];
    if (!page) throw new Error("Missing fixture page");
    const julioRow = page.find((item) => item.str === "Júlio Cesar Silva Filho")?.y;
    if (julioRow === undefined) throw new Error("Missing Júlio fixture row");

    mergeRowItems(pages, julioRow, 215, 264);
    const parsed = parseFibaGeniusBoxscore(pages);
    expect(
      parsed.teams[0].players.find((player) => player.jerseyNumber === "2")?.twoPoints,
    ).toEqual({ made: 1, attempted: 2 });
  });

  it("rejects fused tokens that cannot be reconciled with occupied columns", async () => {
    const pages = await extractFixturePages("Box Score FIBA SAL vs SAN 09 maio.pdf");
    const page = pages[0];
    if (!page) throw new Error("Missing fixture page");
    const fused = page.find((item) => item.str === "17 11");
    if (!fused) throw new Error("Missing fused fixture item");

    fused.str = "17 11 5";
    expect(() => parseFibaGeniusBoxscore(pages)).toThrow("BDB_PDF_PLAYER_GEOMETRY");
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
