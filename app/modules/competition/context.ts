export const PUBLIC_RESOURCES = [
  "visao-geral",
  "classificacao",
  "jogos",
  "equipes",
  "jogadores",
] as const;

export const PUBLIC_NAV_RESOURCES = ["classificacao", "jogos", "equipes", "jogadores"] as const;

export type PublicResource = (typeof PUBLIC_RESOURCES)[number];
export type DetailResource = Exclude<PublicResource, "classificacao" | "visao-geral">;
export type GenderDivision = "male" | "female";
export type PrimaryDataSource = "manual_scoresheet" | "fiba_boxscore";
export type StatisticsMode = "legacy" | "scoresheet" | "boxscore";

export interface CompetitionDataProfile {
  id: number;
  primarySource: PrimaryDataSource;
  version: number;
}

export interface CompetitionContext {
  competitionId: number;
  dataProfile: CompetitionDataProfile | null;
  displayName: string;
  genderDivision: GenderDivision | null;
  statisticsMode: StatisticsMode;
  year: number;
  series: {
    id: number;
    name: string;
    slug: string;
  };
  category: {
    id: number;
    name: string;
    slug: string;
    hasAdvancedStats: boolean;
  };
}

export interface ContextPreference {
  version: 2;
  genderDivision: GenderDivision | null;
  year: number;
  seriesSlug: string;
  categorySlug: string;
}

export type ContextReference = Omit<ContextPreference, "version">;
export type CanonicalContextReference = Omit<ContextReference, "genderDivision"> & {
  genderDivision: GenderDivision;
};

export interface CompetitionContextRow {
  id: number;
  display_name: string;
  year: number;
  status: string;
  series_id: number;
  category_id: number;
  data_profile_id: number | null;
  data_profile_review_required: boolean;
  gender_division: string | null;
  gender_division_review_required: boolean;
}

export interface DataProfileContextRow {
  id: number;
  series_id: number;
  category_id: number;
  gender_division: GenderDivision;
  version: number;
  primary_source: PrimaryDataSource;
}

export interface SeriesContextRow {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
}

export interface CategoryContextRow {
  id: number;
  name: string;
  slug: string;
  has_advanced_stats: boolean;
  is_active: boolean;
}

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isPublicResource(value: string | undefined): value is PublicResource {
  return PUBLIC_RESOURCES.some((resource) => resource === value);
}

export function isDetailResource(value: PublicResource): value is DetailResource {
  return value !== "classificacao" && value !== "visao-geral";
}

export function canonicalPublicResource(resource: PublicResource): PublicResource {
  return resource === "visao-geral" ? "classificacao" : resource;
}

export function parsePublicYear(value: string | undefined): number | null {
  if (!value || !/^\d{4}$/.test(value)) {
    return null;
  }

  const year = Number(value);
  return year >= 1900 && year <= 2200 ? year : null;
}

export function isGenderDivision(value: unknown): value is GenderDivision {
  return value === "male" || value === "female";
}

export function isPrimaryDataSource(value: unknown): value is PrimaryDataSource {
  return value === "manual_scoresheet" || value === "fiba_boxscore";
}

export function genderDivisionSlug(value: GenderDivision): "masculino" | "feminino" {
  return value === "male" ? "masculino" : "feminino";
}

export function parseGenderDivisionSlug(value: string | undefined): GenderDivision | null {
  if (value === "masculino") return "male";
  if (value === "feminino") return "female";
  return null;
}

export function genderDivisionLabel(value: GenderDivision | null): string {
  if (value === "male") return "Masculino";
  if (value === "female") return "Feminino";
  return "Naipe em revisão";
}

function statisticsMode(profile: DataProfileContextRow | undefined): StatisticsMode {
  if (!profile) return "legacy";
  return profile.primary_source === "fiba_boxscore" ? "boxscore" : "scoresheet";
}

export function toCompetitionContext(
  competition: CompetitionContextRow,
  series: SeriesContextRow | undefined,
  category: CategoryContextRow | undefined,
  profile?: DataProfileContextRow,
): CompetitionContext {
  if (competition.status !== "published" && competition.status !== "archived") {
    throw new Error("Competition is not public");
  }

  if (
    !series ||
    !series.is_active ||
    series.id !== competition.series_id ||
    !slugPattern.test(series.slug)
  ) {
    throw new Error("Competition series relation is invalid");
  }

  if (
    !category ||
    !category.is_active ||
    category.id !== competition.category_id ||
    !slugPattern.test(category.slug)
  ) {
    throw new Error("Competition category relation is invalid");
  }

  if (
    !Number.isSafeInteger(competition.id) ||
    parsePublicYear(String(competition.year)) === null ||
    competition.display_name.trim().length < 2
  ) {
    throw new Error("Competition row is invalid");
  }

  const genderDivision = isGenderDivision(competition.gender_division)
    ? competition.gender_division
    : null;
  if (
    (competition.gender_division === null && !competition.gender_division_review_required) ||
    (competition.gender_division !== null && genderDivision === null)
  ) {
    throw new Error("Competition gender division is invalid");
  }

  if (competition.data_profile_id !== null) {
    if (
      !profile ||
      profile.id !== competition.data_profile_id ||
      profile.series_id !== competition.series_id ||
      profile.category_id !== competition.category_id ||
      profile.gender_division !== genderDivision
    ) {
      throw new Error("Competition data profile relation is invalid");
    }
  } else if (profile) {
    throw new Error("Competition data profile relation is invalid");
  }

  const resolvedStatisticsMode = statisticsMode(profile);

  return {
    competitionId: competition.id,
    dataProfile: profile
      ? { id: profile.id, primarySource: profile.primary_source, version: profile.version }
      : null,
    displayName: competition.display_name,
    genderDivision,
    statisticsMode: resolvedStatisticsMode,
    year: competition.year,
    series: {
      id: series.id,
      name: series.name,
      slug: series.slug,
    },
    category: {
      id: category.id,
      name: category.name,
      slug: category.slug,
      hasAdvancedStats:
        resolvedStatisticsMode === "legacy"
          ? category.has_advanced_stats
          : resolvedStatisticsMode === "boxscore",
    },
  };
}

export function contextPath(
  context: CompetitionContext,
  resource: PublicResource,
  detail?: string | number,
): string {
  const segments = [String(context.year), context.series.slug, context.category.slug];
  if (context.genderDivision) {
    segments.push(genderDivisionSlug(context.genderDivision));
  }
  segments.push(resource);

  if (detail !== undefined) {
    if (!isDetailResource(resource)) {
      throw new Error("Classification does not support a detail route");
    }
    segments.push(String(detail));
  }

  return `/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
}

export function contextPreference(context: CompetitionContext): ContextPreference {
  return {
    version: 2,
    genderDivision: context.genderDivision,
    year: context.year,
    seriesSlug: context.series.slug,
    categorySlug: context.category.slug,
  };
}

export function parseContextPreference(value: string | null): ContextPreference | null {
  if (!value) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const candidate = parsed as {
      version?: number;
      genderDivision?: unknown;
      year?: unknown;
      seriesSlug?: unknown;
      categorySlug?: unknown;
    };
    if (
      (candidate.version !== 1 && candidate.version !== 2) ||
      parsePublicYear(String(candidate.year ?? "")) === null ||
      typeof candidate.seriesSlug !== "string" ||
      !slugPattern.test(candidate.seriesSlug) ||
      typeof candidate.categorySlug !== "string" ||
      !slugPattern.test(candidate.categorySlug) ||
      (candidate.version === 2 &&
        candidate.genderDivision !== null &&
        !isGenderDivision(candidate.genderDivision))
    ) {
      return null;
    }

    const genderDivision =
      candidate.version === 2 && isGenderDivision(candidate.genderDivision)
        ? candidate.genderDivision
        : null;
    return {
      version: 2,
      genderDivision,
      year: candidate.year as number,
      seriesSlug: candidate.seriesSlug,
      categorySlug: candidate.categorySlug,
    };
  } catch {
    return null;
  }
}

export function compareContextsNewestFirst(
  left: CompetitionContext,
  right: CompetitionContext,
): number {
  return (
    right.year - left.year ||
    left.series.name.localeCompare(right.series.name, "pt-BR") ||
    left.category.name.localeCompare(right.category.name, "pt-BR") ||
    right.competitionId - left.competitionId
  );
}

export function matchingLegacyContexts(
  contexts: CompetitionContext[],
  reference: Omit<ContextReference, "genderDivision">,
): CompetitionContext[] {
  return contexts.filter(
    (context) =>
      context.year === reference.year &&
      context.series.slug === reference.seriesSlug &&
      context.category.slug === reference.categorySlug,
  );
}
