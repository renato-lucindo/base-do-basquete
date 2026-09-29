import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import type { CompetitionContext } from "../modules/competition/context";
import { BOXSCORE_METRIC_KEYS } from "../modules/statistics/boxscore-metrics";
import type {
  BoxscoreMetricCell,
  BoxscoreStatisticsPlayerRow,
} from "../modules/statistics/boxscore-statistics-domain";
import type { PublicPlayerProfileDto } from "../modules/statistics/player-profile.server";
import { emptyPlayerTotals } from "../modules/statistics/player-profile-domain";
import { PlayerProfile } from "./player-profile";

const context: CompetitionContext = {
  competitionId: 1,
  dataProfile: { id: 1, primarySource: "fiba_boxscore", version: 1 },
  displayName: "Liga 2026 Sub-15",
  genderDivision: null,
  statisticsMode: "boxscore",
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
  mainPosition: null,
  hand: null,
  current: null,
  selection: { mode: "per-game", scope: "regular" },
  currentBoxscore: null,
  competitions: [],
  achievements: [],
  honors: [],
  games: [],
};

function snapshotRow(values: Partial<Record<(typeof BOXSCORE_METRIC_KEYS)[number], number>>) {
  const unavailable: BoxscoreMetricCell = { status: "unavailable", value: null };
  return {
    playerId: 1,
    playerName: "Atleta Teste",
    playerSlug: "atleta-teste",
    registrationId: 1,
    teamId: 1,
    teamName: "Dourada",
    teamSlug: "dourada",
    teamAbbreviation: "DOU",
    jersey: "10",
    metrics: Object.fromEntries(
      BOXSCORE_METRIC_KEYS.map((metric) => [
        metric,
        values[metric] === undefined
          ? unavailable
          : ({ status: "available", value: values[metric] } satisfies BoxscoreMetricCell),
      ]),
    ) as BoxscoreStatisticsPlayerRow["metrics"],
  } satisfies BoxscoreStatisticsPlayerRow;
}

describe("PlayerProfile", () => {
  it("renders the five ordered sections and an honest empty state", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PlayerProfile achievements={[]} context={context} profile={profile} />
      </MemoryRouter>,
    );

    for (const id of ["resumo", "estatisticas", "conquistas", "jogos", "historico"]) {
      expect(html).toContain(`href="#${id}"`);
    }
    expect(html.indexOf('id="resumo"')).toBeLessThan(html.indexOf('id="estatisticas"'));
    expect(html.indexOf('id="estatisticas"')).toBeLessThan(html.indexOf('id="conquistas"'));
    expect(html.indexOf('id="conquistas"')).toBeLessThan(html.indexOf('id="jogos"'));
    expect(html.indexOf('id="jogos"')).toBeLessThan(html.indexOf('id="historico"'));
    expect(html).toContain("Nenhum jogo publicado");
    expect(html).not.toContain("0,0");
    expect(html).not.toContain("boxscore");
    expect(html).not.toContain("súmula");
  });

  it("renders identity, selected statistics, achievements, honors and games", () => {
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
    const summary = {
      kind: "boxscore" as const,
      context,
      teamName: "Dourada",
      teamSlug: "dourada",
      teamAbbreviation: "DOU",
      jerseyNumber: "10",
      position: "Ala",
      starterAppearances: 2,
      games: totals.games,
      advancedGames: totals.games,
      officialPoints: totals.points,
      fouls: totals.fouls,
      advancedTotals: totals,
    };
    const richProfile: PublicPlayerProfileDto = {
      ...profile,
      heightCm: 178,
      hand: "Destro",
      current: summary,
      competitions: [summary],
      currentBoxscore: {
        row: snapshotRow({
          games: 3,
          minutes: 10,
          points: 4.3,
          rebounds: 3.3,
          assists: 1,
          fieldGoalPercentage: 50,
        }),
        per30MinimumSeconds: 600,
        coverage: { regularGames: 3, playoffGames: 0, unclassifiedGames: 0 },
      },
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
          didNotPlay: false,
          kind: "boxscore",
          officialPoints: totals.points,
          fouls: totals.fouls,
          advancedTotals: totals,
        },
      ],
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PlayerProfile
          achievements={[
            {
              competitionId: 2,
              competitionDisplayName: "Liga 2025 Sub-15",
              seriesName: context.series.name,
              seriesSlug: context.series.slug,
              year: 2025,
              categoryName: context.category.name,
              categorySlug: context.category.slug,
              genderDivision: null,
              placement: 1,
              resultLabel: null,
              teamName: "Dourada",
              teamSlug: "dourada",
            },
            {
              competitionId: 1,
              competitionDisplayName: context.displayName,
              seriesName: context.series.name,
              seriesSlug: context.series.slug,
              year: context.year,
              categoryName: context.category.name,
              categorySlug: context.category.slug,
              genderDivision: null,
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

    expect(html).toContain('aria-label="Camisa 10"');
    expect(html).not.toContain("<img");
    expect(html).toContain("1,78 m");
    expect(html).toContain("Destaque");
    expect(html).toContain("Primeiro lugar");
    expect(html).toContain("Sub-15 — 2025, 2026");
    expect(html).toContain("Azul");
    expect(html).toContain("4,3");
    expect(html).toContain("Vitória 70 × 62");
  });

  it("hides minutes in the per-30 recorte and explains the minimum sample", () => {
    const totals = { ...emptyPlayerTotals, games: 1, secondsPlayed: 600, points: 10 };
    const summary = {
      kind: "boxscore" as const,
      context,
      teamName: "Dourada",
      teamSlug: "dourada",
      teamAbbreviation: "DOU",
      jerseyNumber: "10",
      position: null,
      starterAppearances: 1,
      games: 1,
      advancedGames: 1,
      officialPoints: 10,
      fouls: 1,
      advancedTotals: totals,
    };
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/?mode=per-30"]}>
        <PlayerProfile
          achievements={[]}
          context={context}
          profile={{
            ...profile,
            current: summary,
            competitions: [summary],
            selection: { mode: "per-30", scope: "regular" },
            currentBoxscore: {
              row: snapshotRow({ games: 1, points: 30 }),
              per30MinimumSeconds: 600,
              coverage: { regularGames: 1, playoffGames: 0, unclassifiedGames: 0 },
            },
          }}
        />
      </MemoryRouter>,
    );

    expect(html).toContain("mínimo de 10 minutos totais");
    expect(html).not.toContain(">MIN<");
  });

  it("keeps a basic profile limited to confirmed fields", () => {
    const scoresheetContext: CompetitionContext = {
      ...context,
      dataProfile: { id: 2, primarySource: "manual_scoresheet", version: 1 },
      statisticsMode: "scoresheet",
    };
    const summary = {
      kind: "scoresheet" as const,
      context: scoresheetContext,
      teamName: "Dourada",
      teamSlug: "dourada",
      teamAbbreviation: "DOU",
      jerseyNumber: "10",
      position: "Ala",
      starterAppearances: 1,
      games: 2,
      dnpCount: 1,
      points: 9,
      twoPointMade: 3,
      threePointMade: 1,
      freeThrowMade: 0,
      fouls: null,
      disqualifications: null,
    };
    const scoresheetProfile: PublicPlayerProfileDto = {
      ...profile,
      current: summary,
      competitions: [summary],
      games: [
        {
          id: 11,
          label: "Jogo 11",
          status: "final",
          scheduledAt: "2026-08-25T15:00:00Z",
          context: scoresheetContext,
          teamName: "Dourada",
          jerseyNumber: "10",
          opponentName: "Azul",
          result: null,
          score: null,
          didNotPlay: true,
          kind: "scoresheet",
          points: null,
          twoPointMade: null,
          threePointMade: null,
          freeThrowMade: null,
          fouls: null,
          disqualifications: null,
        },
      ],
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PlayerProfile achievements={[]} context={scoresheetContext} profile={scoresheetProfile} />
      </MemoryRouter>,
    );

    expect(html).toContain(
      "Nesta edição estão disponíveis jogos, pontos, cestas convertidas, lances livres e faltas.",
    );
    expect(html).toContain("PTS/J");
    expect(html).toContain("Não jogou");
    expect(html).not.toContain("Comparar jogador");
    expect(html).not.toContain("Exibição");
    expect(html).not.toContain("AP%");
    expect(html).not.toContain("súmula");
  });
});
