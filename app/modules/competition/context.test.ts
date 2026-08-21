import { describe, expect, it } from "vitest";

import {
  contextPath,
  parseContextPreference,
  parsePublicYear,
  toCompetitionContext,
  type CategoryContextRow,
  type CompetitionContextRow,
  type SeriesContextRow,
} from "./context";

const competition: CompetitionContextRow = {
  id: 42,
  display_name: "Liga 2026 Sub-15",
  year: 2026,
  status: "published",
  series_id: 7,
  category_id: 9,
};

const series: SeriesContextRow = {
  id: 7,
  name: "Liga Metropolitana",
  slug: "liga-metropolitana",
  is_active: true,
};

const category: CategoryContextRow = {
  id: 9,
  name: "Sub-15",
  slug: "sub-15",
  has_advanced_stats: true,
  is_active: true,
};

describe("competition context", () => {
  it("converts one canonical row and carries the database id", () => {
    const context = toCompetitionContext(competition, series, category);

    expect(context).toMatchObject({
      competitionId: 42,
      year: 2026,
      series: { slug: "liga-metropolitana" },
      category: { slug: "sub-15", hasAdvancedStats: true },
    });
  });

  it("fails explicitly when a relation is absent or inconsistent", () => {
    expect(() => toCompetitionContext(competition, undefined, category)).toThrow("series relation");
    expect(() => toCompetitionContext(competition, series, { ...category, id: 10 })).toThrow(
      "category relation",
    );
  });

  it("builds encoded contextual links without exposing competitionId", () => {
    const context = toCompetitionContext(competition, series, category);
    const path = contextPath(context, "jogadores", "atleta/um");

    expect(path).toBe("/2026/liga-metropolitana/sub-15/jogadores/atleta%2Fum");
    expect(path).not.toContain("42");
    expect(() => contextPath(context, "classificacao", "detail")).toThrow();
  });

  it("validates years and ignores corrupt or unknown preferences", () => {
    expect(parsePublicYear("2026")).toBe(2026);
    expect(parsePublicYear("26")).toBeNull();
    expect(parsePublicYear("1800")).toBeNull();
    expect(parseContextPreference("not-json")).toBeNull();
    expect(
      parseContextPreference(
        JSON.stringify({
          version: 2,
          year: 2026,
          seriesSlug: "liga",
          categorySlug: "sub-15",
        }),
      ),
    ).toBeNull();
  });
});
