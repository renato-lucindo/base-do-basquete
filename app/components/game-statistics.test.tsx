import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import type { CompetitionContext } from "../modules/competition/context";
import type { PublicGameDetail } from "../modules/statistics/public-statistics.server";
import { GameStatistics } from "./game-statistics";

const context: CompetitionContext = {
  competitionId: 8,
  dataProfile: { id: 2, primarySource: "manual_scoresheet", version: 1 },
  displayName: "Copa 2026 Sub-15",
  genderDivision: null,
  statisticsMode: "scoresheet",
  year: 2026,
  series: { id: 1, name: "Copa", slug: "copa" },
  category: { id: 1, name: "Sub-15", slug: "sub-15", hasAdvancedStats: true },
};

describe("GameStatistics", () => {
  it("renders unavailable scoresheet domains as unavailable instead of false zeros", () => {
    const game: PublicGameDetail = {
      id: 40,
      competitionId: context.competitionId,
      label: "Jogo 40",
      status: "final",
      scheduledAt: "2026-08-25T15:00:00Z",
      venue: "Ginásio",
      advanced: false,
      teams: [
        {
          registrationId: 1,
          side: "home",
          teamId: 1,
          teamName: "Dourada",
          teamSlug: "dourada",
          score: 12,
          periodScores: [],
          statistics: null,
          totals: null,
          pointsReconciled: null,
        },
        {
          registrationId: 2,
          side: "away",
          teamId: 2,
          teamName: "Azul",
          teamSlug: "azul",
          score: 10,
          periodScores: [],
          statistics: null,
          totals: null,
          pointsReconciled: null,
        },
      ],
      gameStatistics: null,
      players: [
        {
          playerId: 1,
          playerName: "Atleta Um",
          playerSlug: "atleta-um",
          teamId: 1,
          side: "home",
          jerseyNumber: "7",
          didNotPlay: false,
          isStarter: true,
          officialPoints: null,
          fouls: null,
          advancedTotals: null,
        },
      ],
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <GameStatistics context={context} game={game} />
      </MemoryRouter>,
    );

    expect(html).toContain("Atleta Um");
    expect(html).toContain("<td>—</td><td>—</td>");
    expect(html).not.toContain("MIN");
    expect(html).not.toContain(">0<");
  });
});
