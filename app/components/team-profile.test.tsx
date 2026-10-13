import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import type { CompetitionContext } from "../modules/competition/context";
import type { PublicTeamProfileDto } from "../modules/competition/public-route-data.server";
import { TeamProfile } from "./team-profile";

const context: CompetitionContext = {
  competitionId: 8,
  dataProfile: { id: 2, primarySource: "manual_scoresheet", version: 1 },
  displayName: "Copa 2026 Sub-15",
  genderDivision: "male",
  statisticsMode: "scoresheet",
  year: 2026,
  series: { id: 1, name: "Copa", slug: "copa" },
  category: { id: 1, name: "Sub-15", slug: "sub-15", hasAdvancedStats: false },
};

const profile: PublicTeamProfileDto = {
  team: { id: 1, name: "Dourada", slug: "dourada", abbreviation: "DOU" },
  standing: {
    id: 1,
    name: "Dourada",
    slug: "dourada",
    abbreviation: "DOU",
    position: 1,
    games: 1,
    wins: 1,
    losses: 0,
    winPercentage: 100,
    pointsFor: 72,
    pointsAgainst: 60,
    pointDifference: 12,
  },
  statistics: {
    id: 1,
    name: "Dourada",
    slug: "dourada",
    abbreviation: "DOU",
    games: 1,
    pointsPerGame: 72,
    reboundsPerGame: null,
    assistsPerGame: null,
    fieldGoalPercentage: null,
    threePointPercentage: null,
    freeThrowPercentage: null,
    efficiencyPerGame: null,
  },
  games: [
    {
      id: 40,
      label: "Jogo 40",
      status: "final",
      scheduledAt: "2026-08-25T15:00:00Z",
      venue: "Ginásio",
      home: { id: 1, name: "Dourada", slug: "dourada", abbreviation: "DOU" },
      away: { id: 2, name: "Azul", slug: "azul", abbreviation: "AZU" },
      homeScore: 72,
      awayScore: 60,
    },
  ],
};

describe("TeamProfile", () => {
  it("renders the current edition, games and confirmed achievements with contextual links", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <TeamProfile
          achievements={[
            {
              competitionId: 7,
              competitionDisplayName: "Copa 2025 Sub-15",
              seriesName: "Copa",
              seriesSlug: "copa",
              year: 2025,
              categoryName: "Sub-15",
              categorySlug: "sub-15",
              genderDivision: "male",
              placement: 1,
              resultLabel: null,
            },
          ]}
          context={context}
          profile={profile}
        />
      </MemoryRouter>,
    );

    expect(html).toContain("Resumo competitivo");
    expect(html).toContain("Vitória");
    expect(html).toContain("72 × 60");
    expect(html).toContain("Campeão");
    expect(html).toContain("/2026/copa/sub-15/masculino/jogos/40");
    expect(html).toContain("/2025/copa/sub-15/masculino/classificacao");
    expect(html).not.toContain("Não informado");
  });
});
