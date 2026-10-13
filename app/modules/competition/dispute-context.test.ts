import { describe, expect, it } from "vitest";

import { type CompetitionDisputeContextRow, toCompetitionDisputeContext } from "./dispute-context";

const adultRow: CompetitionDisputeContextRow = {
  category_id: 1,
  category_name: "Adulto",
  category_slug: "adulto",
  competition_display_name: "Liga Metropolitana Adulto",
  competition_id: 42,
  competitive_division_sort_order: null,
  competitive_division_type_id: null,
  competitive_division_type_name: null,
  competitive_division_type_slug: null,
  competitive_division_value_id: null,
  competitive_division_value_name: null,
  competitive_division_value_slug: null,
  ends_on: "2031-11-30",
  gender_division: "male",
  season_description: "Temporada compartilhada.",
  season_id: 7,
  season_name: "Liga Metropolitana 2031",
  series_id: 3,
  series_name: "Liga Metropolitana",
  series_slug: "liga-metropolitana",
  starts_on: "2031-03-01",
  status: "draft",
  suggested_ends_on: "2031-12-07",
  suggested_starts_on: "2031-03-01",
  year: 2031,
};

describe("competition dispute context", () => {
  it("represents Adulto without inventing a competitive division", () => {
    expect(toCompetitionDisputeContext(adultRow)).toMatchObject({
      competitionId: 42,
      season: {
        id: 7,
        genderDivision: "male",
        seriesSlug: "liga-metropolitana",
        year: 2031,
      },
      category: { name: "Adulto", slug: "adulto" },
      competitiveDivision: null,
    });
  });

  it("keeps Sub-15 and Série Ouro as separate dimensions", () => {
    const context = toCompetitionDisputeContext({
      ...adultRow,
      category_id: 2,
      category_name: "Sub-15",
      category_slug: "sub-15",
      competitive_division_sort_order: 1,
      competitive_division_type_id: 9,
      competitive_division_type_name: "Série",
      competitive_division_type_slug: "serie",
      competitive_division_value_id: 10,
      competitive_division_value_name: "Ouro",
      competitive_division_value_slug: "ouro",
    });

    expect(context.category.name).toBe("Sub-15");
    expect(context.competitiveDivision).toEqual({
      typeId: 9,
      typeName: "Série",
      typeSlug: "serie",
      valueId: 10,
      valueName: "Ouro",
      valueSlug: "ouro",
      sortOrder: 1,
    });
  });

  it("rejects a partial competitive division", () => {
    expect(() =>
      toCompetitionDisputeContext({
        ...adultRow,
        competitive_division_type_id: 9,
      }),
    ).toThrow("competitive division context");
  });
});
