import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import type { CompetitionContext } from "../modules/competition/context";
import type { CompetitionStatisticsDto } from "../modules/statistics/public-statistics.server";
import { StatisticsExplorer } from "./statistics-explorer";

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

describe("StatisticsExplorer", () => {
  it("renders the scoresheet contract without advanced controls or invented values", () => {
    const statistics: CompetitionStatisticsDto = {
      kind: "scoresheet",
      competitionId: context.competitionId,
      players: [
        {
          competitionId: context.competitionId,
          playerId: 10,
          playerName: "Atleta Um",
          playerSlug: "atleta-um",
          teamName: "Dourada",
          teamSlug: "dourada",
          teamAbbreviation: "DOU",
          gamesPlayed: 2,
          dnpCount: 1,
          points: 9,
          pointsPerGame: 4.5,
          twoPointMade: 3,
          threePointMade: 1,
          freeThrowMade: 0,
          fouls: null,
          disqualifications: null,
        },
      ],
    };

    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/?sort=points&dir=desc&team=dourada"]}>
        <StatisticsExplorer context={context} statistics={statistics} />
      </MemoryRouter>,
    );

    expect(html).toContain("Dados registrados por súmula");
    expect(html).toContain("PTS/J");
    expect(html).toContain("Atleta Um");
    expect(html).toContain("4,5");
    expect(html).toContain(">—<");
    expect(html).not.toContain("Filtro avançado");
    expect(html).not.toContain("Comparar jogadores");
    expect(html).not.toContain("MIN");
    expect(html).not.toContain("REB");
    expect(html).toContain("1 atleta encontrado");
    expect(html).not.toContain('class="statistics-table-heading"');
    expect(html).not.toContain("atletas com participação");
  });

  it("warns when boxscore advanced coverage has a smaller denominator", () => {
    const statistics: CompetitionStatisticsDto = {
      kind: "boxscore",
      competitionId: context.competitionId,
      players: [],
      coverage: {
        totalGames: 3,
        participationGames: 3,
        scoringGames: 3,
        advancedGames: 2,
        foulGames: 3,
      },
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <StatisticsExplorer
          context={{
            ...context,
            dataProfile: { id: 3, primarySource: "fiba_boxscore", version: 2 },
            statisticsMode: "boxscore",
          }}
          statistics={statistics}
        />
      </MemoryRouter>,
    );

    expect(html).toContain("Estatísticas avançadas disponíveis em 2 de 3 jogos");
  });
});
