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
    expect(validateParsedBoxscore(parsed).valid).toBe(true);
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
    expect(validateParsedBoxscore(parsed).valid).toBe(true);
  });

  it("rejects a PDF without a text layer before interpretation", async () => {
    await expect(extractFibaGeniusBoxscore(new Uint8Array([37, 80, 68, 70, 45]))).rejects.toThrow();
  });
});
