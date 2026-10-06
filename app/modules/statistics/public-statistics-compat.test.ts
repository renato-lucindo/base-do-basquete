import { describe, expect, it, vi } from "vitest";

import type { CompetitionContext } from "../competition/context";
import { loadCompetitionStatistics } from "./public-statistics.server";

const context = {
  competitionId: 77,
  statisticsMode: "boxscore",
} as CompetitionContext;

function resultBuilder(result: unknown) {
  const builder = {
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
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
