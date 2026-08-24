import { describe, expect, it } from "vitest";

import {
  calculateStandings,
  gameScoreLabel,
  splitGames,
  summarizeTeamStatistics,
  type PublicGameSummary,
  type PublicTeamSummary,
} from "./sports-domain";

const teams: PublicTeamSummary[] = [
  { id: 1, name: "Águias", slug: "aguias", abbreviation: "AGU" },
  { id: 2, name: "Búfalos", slug: "bufalos", abbreviation: "BUF" },
  { id: 3, name: "Corujas", slug: "corujas", abbreviation: "COR" },
];

const game = (
  id: number,
  home: number,
  away: number,
  homeScore: number | null,
  awayScore: number | null,
  status: PublicGameSummary["status"] = "final",
): PublicGameSummary => ({
  id,
  label: `Jogo ${id}`,
  status,
  scheduledAt: `2026-08-${String(id).padStart(2, "0")}T18:00:00.000Z`,
  venue: "Ginásio",
  home: teams.find((team) => team.id === home) as PublicTeamSummary,
  away: teams.find((team) => team.id === away) as PublicTeamSummary,
  homeScore,
  awayScore,
});

describe("public sports domain", () => {
  it("never represents a scheduled game as a confirmed zero score", () => {
    expect(gameScoreLabel(game(1, 1, 2, 0, 0, "scheduled"))).toBe(
      "Placar disponível após o início",
    );
    expect(gameScoreLabel(game(1, 1, 2, null, null, "live"))).toBe("Placar indisponível");
  });

  it("splits upcoming and final games in the expected chronological direction", () => {
    const result = splitGames([
      game(3, 1, 2, 80, 70),
      game(1, 1, 2, null, null, "scheduled"),
      game(2, 2, 3, null, null, "live"),
    ]);
    expect(result.upcoming.map((item) => item.id)).toEqual([1, 2]);
    expect(result.finished.map((item) => item.id)).toEqual([3]);
  });

  it("ignores non-final games and uses direct confrontation before point difference", () => {
    const standings = calculateStandings(teams, [
      game(1, 1, 2, 61, 60),
      game(2, 2, 3, 100, 50),
      game(3, 1, 2, 0, 0, "scheduled"),
    ]);
    expect(standings.map((row) => row.id)).toEqual([1, 2, 3]);
    expect(standings.find((row) => row.id === 1)).toMatchObject({
      games: 1,
      wins: 1,
      losses: 0,
      pointsFor: 61,
      pointsAgainst: 60,
    });
  });

  it("keeps teams without final games and orders their names deterministically", () => {
    const standings = calculateStandings(teams, []);
    expect(standings.map((row) => row.name)).toEqual(["Águias", "Búfalos", "Corujas"]);
    expect(standings[0]?.winPercentage).toBeNull();
  });

  it("derives team averages and percentages from authoritative totals", () => {
    expect(
      summarizeTeamStatistics({
        ...teams[0],
        games: 2,
        points: 150,
        offensiveRebounds: 10,
        defensiveRebounds: 30,
        assists: 24,
        twoPointMade: 30,
        twoPointAttempted: 50,
        threePointMade: 10,
        threePointAttempted: 25,
        freeThrowMade: 20,
        freeThrowAttempted: 30,
        efficiency: 160,
      }),
    ).toMatchObject({
      pointsPerGame: 75,
      reboundsPerGame: 20,
      assistsPerGame: 12,
      fieldGoalPercentage: 53.3,
      threePointPercentage: 40,
      freeThrowPercentage: 66.7,
      efficiencyPerGame: 80,
    });
  });
});
