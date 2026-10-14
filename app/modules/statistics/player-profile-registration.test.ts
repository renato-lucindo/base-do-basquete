import { describe, expect, it, vi } from "vitest";
import type { CompetitionContext } from "../competition/context";
import { loadPublicPlayerProfile } from "./player-profile.server";

function builder(result: unknown) {
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    not: () => query,
    limit: () => query,
    order: () => query,
    // biome-ignore lint/suspicious/noThenProperty: Supabase builders are thenable.
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return query;
}

describe("player profile registration identity", () => {
  it.each(["scoresheet", "boxscore", "legacy"] as const)(
    "keeps %s summary, history and games consistent",
    async (mode) => {
      const context = { competitionId: 77, year: 2026, statisticsMode: mode } as CompetitionContext;
      const previous = { ...context, competitionId: 76, year: 2025 };
      const row = {
        competition_id: 77,
        player_id: 5,
        registration_id: 22,
        team_id: 1,
        team_name: "Lobos",
        team_slug: "lobos",
        team_abbreviation: "LOB",
        jersey_number: "7",
        games_played: 1,
        points: 12,
        official_points: 12,
        advanced_games_played: 0,
        dnp_count: 0,
        starter_appearances: 1,
        two_point_made: 6,
        three_point_made: 0,
        free_throw_made: 0,
        fouls: 0,
        disqualifications: 0,
        roster_position: null,
      };
      const prefix = mode === "legacy" ? "" : `${mode}_`;
      const tables: Record<string, unknown[]> = {
        public_player_profiles: [{ id: 5, full_name: "Atleta", slug: "atleta", is_public: true }],
        roster_entries: [{ id: 10 }],
        [`competition_${prefix}player_statistics`]: [
          row,
          { ...row, competition_id: 76, registration_id: 21 },
        ],
        [`game_${prefix}player_statistics`]: [
          { ...row, game_id: 9, did_not_play: false, has_advanced_coverage: false },
        ],
        games: [
          { id: 9, competition_id: 77, game_number: "1", status: "final", scheduled_at: null },
        ],
        game_participants: [
          { game_id: 9, registration_id: 22, side: "home" },
          { game_id: 9, registration_id: 23, side: "away" },
        ],
        game_scores: [
          { game_id: 9, registration_id: 22, score: 12 },
          { game_id: 9, registration_id: 23, score: 8 },
        ],
        team_registrations: [
          { id: 21, team_id: 1, public_name: "Lobos A" },
          { id: 22, team_id: 1, public_name: "Lobos B" },
          { id: 23, team_id: 1, public_name: "Lobos C" },
        ],
      };
      const client = {
        from: vi.fn((table: string) => builder({ data: tables[table] ?? [], error: null })),
      };
      const profile = await loadPublicPlayerProfile(
        client as never,
        context,
        [context, previous],
        "atleta",
      );
      expect(profile?.current).toMatchObject({ teamName: "Lobos B", teamSlug: "inscricao-22" });
      expect(profile?.competitions[1]).toMatchObject({
        teamName: "Lobos A",
        teamSlug: "inscricao-21",
      });
      expect(profile?.games[0]).toMatchObject({
        teamName: "Lobos B",
        opponentName: "Lobos C",
        score: "12 × 8",
        result: "Vitória",
      });
    },
  );

  it("keeps the legacy summary when public_name is not deployed", async () => {
    const context = {
      competitionId: 77,
      year: 2026,
      statisticsMode: "scoresheet",
    } as CompetitionContext;
    const client = {
      from: vi.fn((table: string) =>
        builder(
          table === "team_registrations"
            ? { data: null, error: { code: "PGRST204" } }
            : {
                data:
                  table === "public_player_profiles"
                    ? [{ id: 5, full_name: "Atleta", slug: "atleta" }]
                    : table === "roster_entries"
                      ? [{ id: 1 }]
                      : table === "competition_scoresheet_player_statistics"
                        ? [
                            {
                              competition_id: 77,
                              registration_id: 22,
                              team_name: "Lobos",
                              team_slug: "lobos",
                            },
                          ]
                        : [],
                error: null,
              },
        ),
      ),
    };
    const result = await loadPublicPlayerProfile(client as never, context, [context], "atleta");
    expect(result?.current).toMatchObject({ teamName: "Lobos", teamSlug: "lobos" });
  });
});
