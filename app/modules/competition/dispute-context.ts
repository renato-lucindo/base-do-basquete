import type { Database } from "~/types/database.generated";

export type CompetitionDisputeContextRow =
  Database["public"]["Views"]["competition_dispute_contexts"]["Row"];

export interface CompetitionDisputeContext {
  competitionId: number;
  displayName: string;
  status: string;
  startsOn: string | null;
  endsOn: string | null;
  season: {
    id: number;
    seriesId: number;
    seriesName: string;
    seriesSlug: string;
    year: number;
    genderDivision: "male" | "female";
    name: string;
    description: string | null;
    suggestedStartsOn: string | null;
    suggestedEndsOn: string | null;
  };
  category: {
    id: number;
    name: string;
    slug: string;
  };
  competitiveDivision: {
    typeId: number;
    typeName: string;
    typeSlug: string;
    valueId: number;
    valueName: string;
    valueSlug: string;
    sortOrder: number;
  } | null;
}

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isRequiredText(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && value.length > 0;
}

function isSlug(value: unknown): value is string {
  return typeof value === "string" && slugPattern.test(value);
}

export function toCompetitionDisputeContext(
  row: CompetitionDisputeContextRow,
): CompetitionDisputeContext {
  if (
    !isPositiveInteger(row.competition_id) ||
    !isPositiveInteger(row.season_id) ||
    !isPositiveInteger(row.series_id) ||
    !isPositiveInteger(row.category_id) ||
    typeof row.year !== "number" ||
    !Number.isSafeInteger(row.year) ||
    row.year < 1900 ||
    row.year > 2200 ||
    (row.gender_division !== "male" && row.gender_division !== "female") ||
    !isRequiredText(row.competition_display_name) ||
    !isRequiredText(row.season_name) ||
    !isRequiredText(row.series_name) ||
    !isRequiredText(row.category_name) ||
    !isSlug(row.series_slug) ||
    !isSlug(row.category_slug) ||
    !isRequiredText(row.status)
  ) {
    throw new Error("Competition dispute context is invalid");
  }

  const divisionFields = [
    row.competitive_division_type_id,
    row.competitive_division_type_name,
    row.competitive_division_type_slug,
    row.competitive_division_value_id,
    row.competitive_division_value_name,
    row.competitive_division_value_slug,
    row.competitive_division_sort_order,
  ];
  const hasDivision = divisionFields.some((value) => value !== null);
  if (
    hasDivision &&
    (!isPositiveInteger(row.competitive_division_type_id) ||
      !isRequiredText(row.competitive_division_type_name) ||
      !isSlug(row.competitive_division_type_slug) ||
      !isPositiveInteger(row.competitive_division_value_id) ||
      !isRequiredText(row.competitive_division_value_name) ||
      !isSlug(row.competitive_division_value_slug) ||
      !isPositiveInteger(row.competitive_division_sort_order))
  ) {
    throw new Error("Competition competitive division context is invalid");
  }

  return {
    competitionId: row.competition_id,
    displayName: row.competition_display_name,
    status: row.status,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    season: {
      id: row.season_id,
      seriesId: row.series_id,
      seriesName: row.series_name,
      seriesSlug: row.series_slug,
      year: row.year,
      genderDivision: row.gender_division,
      name: row.season_name,
      description: row.season_description,
      suggestedStartsOn: row.suggested_starts_on,
      suggestedEndsOn: row.suggested_ends_on,
    },
    category: {
      id: row.category_id,
      name: row.category_name,
      slug: row.category_slug,
    },
    competitiveDivision: hasDivision
      ? {
          typeId: row.competitive_division_type_id as number,
          typeName: row.competitive_division_type_name as string,
          typeSlug: row.competitive_division_type_slug as string,
          valueId: row.competitive_division_value_id as number,
          valueName: row.competitive_division_value_name as string,
          valueSlug: row.competitive_division_value_slug as string,
          sortOrder: row.competitive_division_sort_order as number,
        }
      : null,
  };
}
