export const PUBLIC_RESOURCES = ["classificacao", "jogadores", "equipes", "jogos"] as const;

export type PublicResource = (typeof PUBLIC_RESOURCES)[number];
export type DetailResource = Exclude<PublicResource, "classificacao">;

export interface CompetitionContext {
  competitionId: number;
  displayName: string;
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
  version: 1;
  year: number;
  seriesSlug: string;
  categorySlug: string;
}

export interface CompetitionContextRow {
  id: number;
  display_name: string;
  year: number;
  status: string;
  series_id: number;
  category_id: number;
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
  return value !== "classificacao";
}

export function parsePublicYear(value: string | undefined): number | null {
  if (!value || !/^\d{4}$/.test(value)) {
    return null;
  }

  const year = Number(value);
  return year >= 1900 && year <= 2200 ? year : null;
}

export function toCompetitionContext(
  competition: CompetitionContextRow,
  series: SeriesContextRow | undefined,
  category: CategoryContextRow | undefined,
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

  return {
    competitionId: competition.id,
    displayName: competition.display_name,
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
      hasAdvancedStats: category.has_advanced_stats,
    },
  };
}

export function contextPath(
  context: CompetitionContext,
  resource: PublicResource,
  detail?: string | number,
): string {
  const segments = [String(context.year), context.series.slug, context.category.slug, resource];

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
    version: 1,
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

    const candidate = parsed as Partial<ContextPreference>;
    if (
      candidate.version !== 1 ||
      parsePublicYear(String(candidate.year ?? "")) === null ||
      typeof candidate.seriesSlug !== "string" ||
      !slugPattern.test(candidate.seriesSlug) ||
      typeof candidate.categorySlug !== "string" ||
      !slugPattern.test(candidate.categorySlug)
    ) {
      return null;
    }

    return candidate as ContextPreference;
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
