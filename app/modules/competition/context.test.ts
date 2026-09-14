import { describe, expect, it } from "vitest";

import {
  type CategoryContextRow,
  type CompetitionContextRow,
  contextPath,
  matchingLegacyContexts,
  parseContextPreference,
  parsePublicYear,
  type SeriesContextRow,
  toCompetitionContext,
} from "./context";

const competition: CompetitionContextRow = {
  id: 42,
  display_name: "Liga 2026 Sub-15",
  year: 2026,
  status: "published",
  series_id: 7,
  category_id: 9,
  data_profile_id: null,
  data_profile_review_required: true,
  gender_division: null,
  gender_division_review_required: true,
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
      dataProfile: null,
      genderDivision: null,
      statisticsMode: "legacy",
      year: 2026,
      series: { slug: "liga-metropolitana" },
      category: { slug: "sub-15", hasAdvancedStats: true },
    });
  });

  it("uses the immutable edition profile instead of the legacy category capability", () => {
    const context = toCompetitionContext(
      {
        ...competition,
        data_profile_id: 81,
        data_profile_review_required: false,
        gender_division: "male",
        gender_division_review_required: false,
      },
      series,
      category,
      {
        id: 81,
        series_id: 7,
        category_id: 9,
        gender_division: "male",
        version: 2,
        primary_source: "manual_scoresheet",
      },
    );

    expect(context).toMatchObject({
      dataProfile: { id: 81, primarySource: "manual_scoresheet", version: 2 },
      genderDivision: "male",
      statisticsMode: "scoresheet",
      category: { hasAdvancedStats: false },
    });
    expect(contextPath(context, "jogadores")).toBe(
      "/2026/liga-metropolitana/sub-15/masculino/jogadores",
    );
  });

  it("rejects a profile from another gender division", () => {
    expect(() =>
      toCompetitionContext(
        {
          ...competition,
          data_profile_id: 81,
          gender_division: "male",
          gender_division_review_required: false,
        },
        series,
        category,
        {
          id: 81,
          series_id: 7,
          category_id: 9,
          gender_division: "female",
          version: 1,
          primary_source: "fiba_boxscore",
        },
      ),
    ).toThrow("data profile relation");
  });

  it("keeps both genders in a legacy match instead of choosing one", () => {
    const contexts = (["male", "female"] as const).map((genderDivision, index) =>
      toCompetitionContext(
        {
          ...competition,
          id: 50 + index,
          data_profile_id: 90 + index,
          data_profile_review_required: false,
          gender_division: genderDivision,
          gender_division_review_required: false,
        },
        series,
        category,
        {
          id: 90 + index,
          series_id: 7,
          category_id: 9,
          gender_division: genderDivision,
          version: 1,
          primary_source: "fiba_boxscore",
        },
      ),
    );

    const matches = matchingLegacyContexts(contexts, {
      year: 2026,
      seriesSlug: "liga-metropolitana",
      categorySlug: "sub-15",
    });

    expect(matches).toHaveLength(2);
    expect(matches.map((context) => contextPath(context, "jogadores"))).toEqual([
      "/2026/liga-metropolitana/sub-15/masculino/jogadores",
      "/2026/liga-metropolitana/sub-15/feminino/jogadores",
    ]);
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
          version: 3,
          year: 2026,
          seriesSlug: "liga",
          categorySlug: "sub-15",
        }),
      ),
    ).toBeNull();
    expect(
      parseContextPreference(
        JSON.stringify({
          version: 1,
          year: 2026,
          seriesSlug: "liga",
          categorySlug: "sub-15",
        }),
      ),
    ).toEqual({
      version: 2,
      genderDivision: null,
      year: 2026,
      seriesSlug: "liga",
      categorySlug: "sub-15",
    });
  });
});
