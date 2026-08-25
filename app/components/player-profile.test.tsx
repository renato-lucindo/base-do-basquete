import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import type { CompetitionContext } from "../modules/competition/context";
import { emptyPlayerTotals } from "../modules/statistics/player-profile-domain";
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
  career: { ...emptyPlayerTotals },
  competitions: [],
  achievements: [],
  honors: [],
  games: [],
};

describe("PlayerProfile", () => {
  it("renders only the three primary sections and the honest empty-game state", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PlayerProfile achievements={[]} context={context} profile={profile} />
      </MemoryRouter>,
    );

    expect(html).toContain('href="#resumo"');
    expect(html).toContain('id="estatisticas"');
    expect(html).toContain('id="jogos"');
    expect(html).not.toContain('href="#conquistas-honrarias"');
    expect(html).not.toContain('href="#historico"');
    expect(html).toContain("Nenhum jogo publicado");
    expect(html).not.toContain("0,0");
  });

  it("renders published statistics, honors and games", () => {
    const totals = {
      ...emptyPlayerTotals,
      games: 3,
      secondsPlayed: 1800,
      points: 13,
      twoPointMade: 4,
      twoPointAttempted: 8,
      threePointMade: 1,
      threePointAttempted: 3,
      freeThrowMade: 2,
      freeThrowAttempted: 2,
      offensiveRebounds: 2,
      defensiveRebounds: 8,
      assists: 3,
      steals: 2,
      blocks: 1,
      plusMinus: 4,
    };
    const richProfile: PublicPlayerProfileDto = {
      ...profile,
      current: {
        ...totals,
        context,
        teamName: "Dourada",
        teamSlug: "dourada",
        teamAbbreviation: "DOU",
        jerseyNumber: "10",
        position: "Ala",
        starterAppearances: 2,
      },
      career: totals,
      competitions: [
        {
          ...totals,
          context,
          teamName: "Dourada",
          teamSlug: "dourada",
          teamAbbreviation: "DOU",
          jerseyNumber: "10",
          position: "Ala",
          starterAppearances: 2,
        },
      ],
      honors: [
        {
          id: 1,
          title: "Destaque",
          description: "Honraria confirmada",
          year: 2026,
          competitionName: context.displayName,
        },
      ],
      games: [
        {
          id: 10,
          label: "Jogo 10",
          status: "final",
          scheduledAt: "2026-08-24T15:00:00Z",
          context,
          teamName: "Dourada",
          jerseyNumber: "10",
          opponentName: "Azul",
          result: "Vitória",
          score: "70 × 62",
          totals,
        },
      ],
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PlayerProfile
          achievements={[
            {
              competitionId: 1,
              competitionDisplayName: context.displayName,
              seriesName: context.series.name,
              seriesSlug: context.series.slug,
              year: context.year,
              categoryName: context.category.name,
              categorySlug: context.category.slug,
              placement: 1,
              resultLabel: null,
              teamName: "Dourada",
              teamSlug: "dourada",
            },
          ]}
          context={context}
          profile={richProfile}
        />
      </MemoryRouter>,
    );

    expect(html).toContain("Destaque");
    expect(html).toContain("Azul");
    expect(html).toContain("4,3");
  });
});
