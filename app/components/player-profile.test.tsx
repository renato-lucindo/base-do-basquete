import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import type { CompetitionContext } from "../modules/competition/context";
import type { PublicPlayerProfileDto } from "../modules/statistics/player-profile.server";
import { PlayerProfile } from "./player-profile";

const context: CompetitionContext = {
  competitionId: 1,
  displayName: "Liga 2026 Sub-15",
  year: 2026,
  series: { id: 1, name: "Liga", slug: "liga" },
  category: { id: 1, name: "Sub-15", slug: "sub-15", hasAdvancedStats: true },
};

const profile: PublicPlayerProfileDto = {
  id: 1,
  fullName: "Atleta Teste",
  slug: "atleta-teste",
  nickname: null,
  birthYear: 2011,
  bio: null,
  heightCm: null,
  weightKg: null,
  mainPosition: null,
  hand: null,
  homeCity: null,
  homeState: null,
  current: null,
  career: { games: 0, points: 0, assists: 0, rebounds: 0, steals: 0, blocks: 0 },
  competitions: [],
  honors: [],
  games: [],
};

describe("PlayerProfile", () => {
  it("renders all hash sections and the honest empty-game state", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PlayerProfile achievements={[]} context={context} profile={profile} />
      </MemoryRouter>,
    );

    expect(html).toContain('href="#resumo"');
    expect(html).toContain('id="estatisticas"');
    expect(html).toContain('id="conquistas-honrarias"');
    expect(html).toContain('id="jogos"');
    expect(html).toContain('id="historico"');
    expect(html).toContain("Nenhum jogo publicado");
    expect(html).not.toContain("0,0");
  });
});
