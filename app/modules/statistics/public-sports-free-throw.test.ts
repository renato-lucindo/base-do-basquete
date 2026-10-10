import { describe, expect, it, vi } from "vitest";
import type { CompetitionContext } from "../competition/context";
import { loadPublicSportsCore } from "./public-sports.server";

const context = { competitionId: 77 } as CompetitionContext;

type FixtureOptions = {
  manual?: boolean;
  fiba?: boolean;
  manualHasFibaAdvanced?: boolean;
  manualMissingAuthority?: boolean;
  fibaMissingAdvanced?: boolean;
  missingFibaStatistics?: boolean;
  manualCharged?: number;
  manualConverted?: number;
  missingProjection?: boolean;
};

function fixture(options: FixtureOptions) {
  // Intentionally inverted: games.source must never decide statistical authority.
  const games = [
    ...(options.manual
      ? [
          {
            id: 101,
            game_number: "M1",
            status: "final",
            scheduled_at: null,
            venue: null,
            source: "fiba",
          },
        ]
      : []),
    ...(options.fiba
      ? [
          {
            id: 102,
            game_number: "F1",
            status: "final",
            scheduled_at: null,
            venue: null,
            source: "manual",
          },
        ]
      : []),
  ];
  const participants = games.flatMap((game) => [
    { game_id: game.id, registration_id: 10, side: "home" },
    { game_id: game.id, registration_id: 20, side: "away" },
  ]);
  const scores = games.flatMap((game) => [
    { game_id: game.id, registration_id: 10, score: 50 },
    { game_id: game.id, registration_id: 20, score: 40 },
  ]);
  const sources = [
    ...(options.manual && !options.manualMissingAuthority
      ? [{ game_id: 101, domain: "player_scoring", source_type: "manual_scoresheet" }]
      : []),
    ...(options.manualHasFibaAdvanced
      ? [{ game_id: 101, domain: "player_advanced", source_type: "fiba_boxscore" }]
      : []),
    ...(options.fiba
      ? [{ game_id: 102, domain: "player_scoring", source_type: "fiba_boxscore" }]
      : []),
    ...(options.fiba && !options.fibaMissingAdvanced
      ? [{ game_id: 102, domain: "player_advanced", source_type: "fiba_boxscore" }]
      : []),
  ];
  const stats = [
    ...(options.manual
      ? [
          {
            game_id: 101,
            team_id: 1,
            points: 3,
            free_throw_made: options.manualHasFibaAdvanced ? 2 : 3,
            free_throw_attempted: options.manualHasFibaAdvanced ? 4 : null,
            two_point_made: options.manualHasFibaAdvanced ? 1 : 0,
            two_point_attempted: options.manualHasFibaAdvanced ? 2 : null,
            three_point_made: options.manualHasFibaAdvanced ? 2 : 0,
            three_point_attempted: options.manualHasFibaAdvanced ? 4 : null,
            offensive_rebounds: 3,
            defensive_rebounds: 4,
            assists: 2,
            steals: 1,
            blocks: 1,
            turnovers: 0,
          },
        ]
      : []),
    ...(options.fiba && !options.missingFibaStatistics
      ? [
          {
            game_id: 102,
            team_id: 1,
            points: 10,
            free_throw_made: 2,
            free_throw_attempted: 4,
            two_point_made: 1,
            two_point_attempted: 2,
            three_point_made: 2,
            three_point_attempted: 4,
            offensive_rebounds: 3,
            defensive_rebounds: 4,
            assists: 2,
            steals: 1,
            blocks: 1,
            turnovers: 0,
          },
        ]
      : []),
  ];
  const projections =
    options.manual && !options.missingProjection
      ? [
          {
            game_id: 101,
            free_throw_summary: {
              home: {
                charged: options.manualCharged ?? 5,
                converted: options.manualConverted ?? 3,
              },
              away: { charged: 0, converted: 0 },
            },
          },
        ]
      : [];
  const dataByTable: Record<string, unknown[]> = {
    team_registrations: [
      { id: 10, team_id: 1 },
      { id: 20, team_id: 2 },
    ],
    teams: [
      { id: 1, name: "Azul", slug: "azul", abbreviation: "AZ" },
      { id: 2, name: "Ouro", slug: "ouro", abbreviation: "OU" },
    ],
    games,
    game_participants: participants,
    game_scores: scores,
    game_active_data_sources: sources,
    game_player_statistics: stats,
    manual_scoresheet_public_statistics_projection: projections,
  };
  const from = vi.fn((table: string) => ({
    select: () => {
      const query = {
        eq: () => query,
        in: () => query,
        order: () => query,
        // biome-ignore lint/suspicious/noThenProperty: Mocking Supabase query builders, which are deliberately thenable.
        then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
          Promise.resolve({ data: dataByTable[table], error: null }).then(resolve, reject),
      };
      return query;
    },
  }));
  return {
    client: {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST202" } }),
      from,
    },
    from,
  };
}

describe("public team statistics by effective domain authority", () => {
  it("uses collective manual free throws even when games.source says FIBA", async () => {
    const { client, from } = fixture({ manual: true });
    const result = await loadPublicSportsCore(client as never, context);
    const azul = result.teamStatistics.find((row) => row.id === 1);
    expect(azul?.freeThrowPercentage).toBe(60);
    expect(azul?.fieldGoalPercentage).toBeNull();
    expect(azul?.threePointPercentage).toBeNull();
    expect(azul?.efficiencyPerGame).toBeNull();
    expect(from).toHaveBeenCalledWith("game_active_data_sources");
    expect(from).toHaveBeenCalledWith("manual_scoresheet_public_statistics_projection");
  });

  it("preserves FIBA advanced figures even when games.source says manual", async () => {
    const { client, from } = fixture({ fiba: true });
    const result = await loadPublicSportsCore(client as never, context);
    const azul = result.teamStatistics.find((row) => row.id === 1);
    expect(azul?.freeThrowPercentage).toBe(50);
    expect(azul?.fieldGoalPercentage).toBeCloseTo(50);
    expect(azul?.efficiencyPerGame).not.toBeNull();
    expect(from).not.toHaveBeenCalledWith("manual_scoresheet_public_statistics_projection");
  });

  it("combines manual collective attempts and FIBA advanced attempts across games", async () => {
    const { client } = fixture({ manual: true, fiba: true });
    const result = await loadPublicSportsCore(client as never, context);
    const azul = result.teamStatistics.find((row) => row.id === 1);
    expect(azul?.freeThrowPercentage).toBe(55.6);
    expect(azul?.fieldGoalPercentage).toBeNull();
    expect(azul?.threePointPercentage).toBeNull();
    expect(azul?.efficiencyPerGame).toBeNull();
  });

  it("prefers advanced FIBA denominators when a single manual-scoring game has both domains", async () => {
    const { client, from } = fixture({ manual: true, manualHasFibaAdvanced: true });
    const result = await loadPublicSportsCore(client as never, context);
    const azul = result.teamStatistics.find((row) => row.id === 1);
    expect(azul?.freeThrowPercentage).toBe(50);
    expect(azul?.fieldGoalPercentage).toBeCloseTo(50);
    expect(azul?.efficiencyPerGame).not.toBeNull();
    expect(from).not.toHaveBeenCalledWith("manual_scoresheet_public_statistics_projection");
  });

  it("keeps the percentage unknown when a manual projection is missing", async () => {
    const { client } = fixture({ manual: true, fiba: true, missingProjection: true });
    const result = await loadPublicSportsCore(client as never, context);
    expect(result.teamStatistics.find((row) => row.id === 1)?.freeThrowPercentage).toBeNull();
  });

  it("does not publish inactive manual projection data without scoring authority", async () => {
    const { client, from } = fixture({ manual: true, manualMissingAuthority: true });
    const result = await loadPublicSportsCore(client as never, context);
    expect(result.teamStatistics.find((row) => row.id === 1)?.freeThrowPercentage).toBeNull();
    expect(result.teamStatistics.find((row) => row.id === 1)?.pointsPerGame).toBeNull();
    expect(from).not.toHaveBeenCalledWith("manual_scoresheet_public_statistics_projection");
  });

  it("does not treat games.source as advanced coverage without player_advanced authority", async () => {
    const { client } = fixture({ fiba: true, fibaMissingAdvanced: true });
    const result = await loadPublicSportsCore(client as never, context);
    const azul = result.teamStatistics.find((row) => row.id === 1);
    expect(azul?.freeThrowPercentage).toBeNull();
    expect(azul?.fieldGoalPercentage).toBeNull();
    expect(azul?.efficiencyPerGame).toBeNull();
  });

  it("does not report partial rates when an authoritative FIBA game has no statistics rows", async () => {
    const { client } = fixture({ manual: true, fiba: true, missingFibaStatistics: true });
    const result = await loadPublicSportsCore(client as never, context);
    expect(result.teamStatistics.find((row) => row.id === 1)?.freeThrowPercentage).toBeNull();
  });

  it("does not invent a percentage with zero manual attempts", async () => {
    const { client } = fixture({ manual: true, manualCharged: 0, manualConverted: 0 });
    const result = await loadPublicSportsCore(client as never, context);
    expect(result.teamStatistics.find((row) => row.id === 1)?.freeThrowPercentage).toBeNull();
  });

  it("rejects an inconsistent manual summary where made exceeds awarded attempts", async () => {
    const { client } = fixture({ manual: true, manualCharged: 2, manualConverted: 3 });
    const result = await loadPublicSportsCore(client as never, context);
    expect(result.teamStatistics.find((row) => row.id === 1)?.freeThrowPercentage).toBeNull();
  });
});
