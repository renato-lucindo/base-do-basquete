import { describe, expect, it, vi } from "vitest";

import type { CompetitionContext } from "../competition/context";
import { loadCompetitionStatistics, loadPublicGameDetail } from "./public-statistics.server";

const context = {
  competitionId: 77,
  statisticsMode: "boxscore",
} as CompetitionContext;

function resultBuilder(result: unknown) {
  const builder = {
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(() => builder),
    order: vi.fn(() => builder),
    // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are intentionally thenable.
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

describe("public statistics schema compatibility", () => {
  it("uses legacy team identity when registration public_name is unavailable", async () => {
    const client = {
      from: vi.fn((table: string) => ({
        select: vi.fn(() => {
          if (table === "competition_boxscore_player_statistics") {
            return resultBuilder({
              data: [
                {
                  advanced_games_played: 0,
                  advanced_points: null,
                  assists: null,
                  blocks: null,
                  competition_id: 77,
                  defensive_rebounds: null,
                  fouls: 0,
                  free_throw_attempted: null,
                  free_throw_made: null,
                  games_played: 1,
                  jersey_number: "7",
                  offensive_rebounds: null,
                  official_points: 12,
                  player_id: 5,
                  player_name: "Atleta",
                  player_slug: "atleta",
                  plus_minus: null,
                  registration_id: 10,
                  roster_position: null,
                  seconds_played: null,
                  starter_appearances: 0,
                  steals: null,
                  team_abbreviation: "AZL",
                  team_id: 1,
                  team_name: "Azul",
                  team_slug: "azul",
                  three_point_attempted: null,
                  three_point_made: null,
                  turnovers: null,
                  two_point_attempted: null,
                  two_point_made: null,
                },
              ],
              error: null,
            });
          }
          if (table === "competition_data_coverage") {
            return resultBuilder({
              data: {
                final_games: 1,
                participation_games: 1,
                scoring_games: 1,
                advanced_games: 0,
                foul_games: 1,
              },
              error: null,
            });
          }
          if (table === "team_registrations") {
            return resultBuilder({ data: null, error: { code: "PGRST204" } });
          }
          throw new Error(`unexpected table: ${table}`);
        }),
      })),
    };

    const result = await loadCompetitionStatistics(client as never, context);

    expect(result.players[0]).toMatchObject({
      teamName: "Azul",
      teamSlug: "azul",
    });
  });
});

function gameClient(schemaError: string | null) {
  const tables: Record<string, unknown> = {
    games: [
      {
        id: 5,
        competition_id: 77,
        game_number: 1,
        status: "final",
        scheduled_at: null,
        venue: null,
      },
    ],
    game_participants: [
      { registration_id: 10, side: "home" },
      { registration_id: 11, side: "away" },
    ],
    game_scores: [
      { registration_id: 10, side: "home", score: 10 },
      { registration_id: 11, side: "away", score: 8 },
    ],
    team_registrations: schemaError
      ? [
          { id: 10, team_id: 1 },
          { id: 11, team_id: 2 },
        ]
      : [
          { id: 10, team_id: 1, public_name: "Lobos A" },
          { id: 11, team_id: 1, public_name: "Lobos B" },
        ],
    teams: [
      { id: 1, name: "Lobos", slug: "lobos" },
      { id: 2, name: "Ursos", slug: "ursos" },
    ],
    game_statistics: null,
  };
  return {
    from: (table: string) => ({
      select: (columns: string) =>
        resultBuilder(
          table === "team_registrations" && schemaError && columns.includes("public_name")
            ? { data: null, error: { code: schemaError } }
            : { data: tables[table] ?? (table === "game_statistics" ? null : []), error: null },
        ),
    }),
  };
}

describe("public game detail registration identity", () => {
  it.each(["42703", "PGRST204"])(
    "loads the real game detail on the old schema (%s)",
    async (code) => {
      const result = await loadPublicGameDetail(gameClient(code) as never, context, "5");
      expect(
        result?.teams.map(({ registrationId, teamName, teamSlug, score }) => ({
          registrationId,
          teamName,
          teamSlug,
          score,
        })),
      ).toEqual([
        { registrationId: 10, teamName: "Lobos", teamSlug: "lobos", score: 10 },
        { registrationId: 11, teamName: "Ursos", teamSlug: "ursos", score: 8 },
      ]);
    },
  );
  it("keeps A/B identities and scores distinct on the new schema", async () => {
    const result = await loadPublicGameDetail(gameClient(null) as never, context, "5");
    expect(
      result?.teams.map(({ teamId, teamName, teamSlug, score }) => ({
        teamId,
        teamName,
        teamSlug,
        score,
      })),
    ).toEqual([
      { teamId: 1, teamName: "Lobos A", teamSlug: "inscricao-10", score: 10 },
      { teamId: 1, teamName: "Lobos B", teamSlug: "inscricao-11", score: 8 },
    ]);
  });
  it("propagates authorization failures instead of falling back", async () => {
    await expect(loadPublicGameDetail(gameClient("42501") as never, context, "5")).rejects.toThrow(
      "Public statistics query failed",
    );
  });
});
