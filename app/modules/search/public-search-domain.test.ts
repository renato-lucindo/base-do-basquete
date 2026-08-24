import { describe, expect, it } from "vitest";

import type { CompetitionContext } from "../competition/context";
import {
  buildContextualSearchResults,
  normalizePublicSearch,
  type SearchPlayer,
  type SearchTeam,
} from "./public-search-domain";

const context: CompetitionContext = {
  competitionId: 1,
  displayName: "Liga de Desenvolvimento 2026 · Sub-15",
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
    const many = Array.from({ length: 20 }, (_, index) => ({
      ...players[0],
      id: index + 10,
      name: `Atleta ${index}`,
      slug: `atleta-${index}`,
    }));
    const result = buildContextualSearchResults("atleta", context, many, teams, [], 3);
    expect(result.flatMap((group) => group.items)).toHaveLength(3);
  });

  it("groups matching competitions, categories and years", () => {
    const result = buildContextualSearchResults("sub 15", context, players, teams, [context]);
    expect(result[0]?.type).toBe("contexts");
    expect(result[0]?.items[0]?.description).toContain("2026");
  });
});
