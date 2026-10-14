import { describe, expect, it } from "vitest";

import type { CompetitionContext } from "../competition/context";
import {
  buildContextualSearchResults,
  buildGlobalSearchResults,
  normalizePublicSearch,
  type SearchPlayer,
  type SearchTeam,
} from "./public-search-domain";

const context: CompetitionContext = {
  competitionId: 1,
  dataProfile: null,
  displayName: "Liga de Desenvolvimento 2026 · Sub-15",
  genderDivision: null,
  statisticsMode: "legacy",
  year: 2026,
  series: { id: 1, name: "Liga de Desenvolvimento", slug: "liga-de-desenvolvimento" },
  category: { id: 1, name: "Sub-15", slug: "sub-15", hasAdvancedStats: false },
};

const players: SearchPlayer[] = [
  {
    id: 1,
    name: "João da Silva",
    nickname: "Jojô",
    slug: "joao-da-silva",
    teamName: "Águias do Sul",
    isPublic: true,
  },
  {
    id: 2,
    name: "Atleta Privado",
    nickname: "Oculto",
    slug: "atleta-privado",
    teamName: null,
    isPublic: false,
  },
];

const teams: SearchTeam[] = [
  { id: 1, name: "Águias do Sul", abbreviation: "ADS", slug: "aguias-do-sul", isPublic: true },
];

describe("public contextual search", () => {
  it("normalizes accents, case and whitespace", () => {
    expect(normalizePublicSearch("  JOÃO   ÁGUIAS ")).toBe("joao aguias");
  });

  it("matches substring, nickname and team abbreviation", () => {
    expect(
      buildContextualSearchResults("silv", context, players, teams, [])[0]?.items,
    ).toHaveLength(1);
    expect(
      buildContextualSearchResults("jojo", context, players, teams, [])[0]?.items[0]?.label,
    ).toContain("Jojô");
    expect(buildContextualSearchResults("ads", context, players, teams, [])[0]?.type).toBe("teams");
  });

  it("rejects short queries, excludes private records and enforces the result limit", () => {
    expect(buildContextualSearchResults("a", context, players, teams, [])).toEqual([]);
    expect(buildContextualSearchResults("oculto", context, players, teams, [])).toEqual([]);
    const many: SearchPlayer[] = Array.from({ length: 20 }, (_, index) => ({
      id: index + 10,
      name: `Atleta ${index}`,
      nickname: null,
      slug: `atleta-${index}`,
      teamName: "Águias do Sul",
      isPublic: true,
    }));
    const result = buildContextualSearchResults("atleta", context, many, teams, [], 3);
    expect(result.flatMap((group) => group.items)).toHaveLength(3);
  });

  it("groups matching competitions, categories and years", () => {
    const result = buildContextualSearchResults("sub 15", context, players, teams, [context]);
    expect(result[0]?.type).toBe("contexts");
    expect(result[0]?.items[0]?.description).toContain("2026");
  });

  it("groups global games and keeps destination context in the URL", () => {
    const result = buildGlobalSearchResults(
      "aguias",
      [context],
      players.map((player) => ({ ...player, context })),
      teams.map((team) => ({ ...team, context })),
      [
        {
          id: 7,
          label: "Jogo 7",
          homeName: "Águias do Sul",
          awayName: "Estrelas",
          context,
        },
      ],
    );

    expect(result.map((group) => group.type)).toEqual(["players", "teams", "games"]);
    expect(result.at(-1)?.items[0]?.href).toBe("/2026/liga-de-desenvolvimento/sub-15/jogos/7");
  });

  it("keeps two public registration identities backed by the same global team", () => {
    const result = buildGlobalSearchResults(
      "lobos",
      [context],
      [],
      [
        {
          id: 10,
          name: "Lobos",
          abbreviation: "LOB",
          slug: "inscricao-10",
          isPublic: true,
          context,
        },
        {
          id: 11,
          name: "Lobos B",
          abbreviation: "LOB",
          slug: "inscricao-11",
          isPublic: true,
          context,
        },
      ],
      [],
    );
    const teamItems = result.find((group) => group.type === "teams")?.items ?? [];

    expect(teamItems.map((item) => item.label)).toEqual(["Lobos", "Lobos B"]);
    expect(teamItems.map((item) => item.href)).toEqual([
      "/2026/liga-de-desenvolvimento/sub-15/equipes/inscricao-10",
      "/2026/liga-de-desenvolvimento/sub-15/equipes/inscricao-11",
    ]);
  });
});
