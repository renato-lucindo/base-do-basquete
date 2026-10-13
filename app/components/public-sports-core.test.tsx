import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import type { CompetitionContext } from "../modules/competition/context";
import type { PublicSportsCoreDto } from "../modules/statistics/public-sports.server";
import { PublicSportsCore } from "./public-sports-core";

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

const dourada = { id: 1, name: "Associação Dourada", slug: "dourada", abbreviation: "DOU" };
const azul = { id: 2, name: "Clube Azul", slug: "azul", abbreviation: "AZU" };

const data: PublicSportsCoreDto = {
  teams: [dourada, azul],
  standings: [],
  teamStatistics: [],
  games: [
    {
      id: 40,
      label: "Jogo 40",
      status: "scheduled",
      scheduledAt: "2026-08-26T15:00:00Z",
      venue: "Ginásio",
      home: dourada,
      away: azul,
      homeScore: null,
      awayScore: null,
    },
    {
      id: 39,
      label: "Jogo 39",
      status: "final",
      scheduledAt: "2026-08-25T15:00:00Z",
      venue: "Ginásio",
      home: dourada,
      away: azul,
      homeScore: 72,
      awayScore: 60,
    },
  ],
};

describe("PublicSportsCore games", () => {
  it("uses full team names, accessible winner text and the simplified status filter", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PublicSportsCore context={context} data={data} resource="jogos" />
      </MemoryRouter>,
    );

    expect(html).toContain("Agenda");
    expect(html).toContain("Resultados");
    expect(html).toContain("Associação Dourada");
    expect(html).toContain(", vencedor");
    expect(html).toContain('<option value="scheduled">Agendados</option>');
    expect(html).toContain('<option value="final">Finalizados</option>');
    expect(html).not.toContain('<option value="live">');
    expect(html).toContain("Placar disponível após o início");
  });
});
