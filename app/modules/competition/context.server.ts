import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/database.generated";
import {
  type CanonicalContextReference,
  type CompetitionContext,
  type CompetitionContextRow,
  type ContextPreference,
  compareContextsNewestFirst,
  contextPreference,
  type DataProfileContextRow,
  isGenderDivision,
  isPrimaryDataSource,
  parseContextPreference,
  toCompetitionContext,
} from "./context";

const preferenceCookieName = "__Host-bdb-context";
const preferenceMaxAge = 60 * 60 * 24 * 365;
type DataProfileTableRow = Database["public"]["Tables"]["series_category_data_profiles"]["Row"];
type DataProfileCandidate = Pick<
  DataProfileTableRow,
  "id" | "series_id" | "category_id" | "gender_division" | "version" | "primary_source"
>;

export class PublicContextQueryError extends Error {
  constructor() {
    super("Public competition context query failed");
    this.name = "PublicContextQueryError";
  }
}

function assertQuerySucceeded(error: unknown): asserts error is null {
  if (error) {
    throw new PublicContextQueryError();
  }
}

function isCompatibilitySchemaUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  return ["42703", "42P01", "PGRST204", "PGRST205"].includes(String(error.code));
}

function toDataProfileContextRow(row: DataProfileCandidate): DataProfileContextRow {
  if (
    !Number.isSafeInteger(row.id) ||
    !Number.isSafeInteger(row.series_id) ||
    !Number.isSafeInteger(row.category_id) ||
    !Number.isSafeInteger(row.version) ||
    !isGenderDivision(row.gender_division) ||
    !isPrimaryDataSource(row.primary_source)
  ) {
    throw new PublicContextQueryError();
  }

  return {
    id: row.id as number,
    series_id: row.series_id as number,
    category_id: row.category_id as number,
    gender_division: row.gender_division,
    version: row.version as number,
    primary_source: row.primary_source,
  };
}

export async function resolveCompetitionContext(
  client: SupabaseClient<Database>,
  reference: CanonicalContextReference,
): Promise<CompetitionContext | null> {
  const [seriesResult, categoryResult] = await Promise.all([
    client
      .from("competition_series")
      .select("id,name,slug,is_active")
      .eq("slug", reference.seriesSlug)
      .eq("is_active", true)
      .limit(2),
    client
      .from("categories")
      .select("id,name,slug,has_advanced_stats,is_active")
      .eq("slug", reference.categorySlug)
      .eq("is_active", true)
      .limit(2),
  ]);

  assertQuerySucceeded(seriesResult.error);
  assertQuerySucceeded(categoryResult.error);

  if (seriesResult.data.length !== 1 || categoryResult.data.length !== 1) {
    return null;
  }

  const series = seriesResult.data[0];
  const category = categoryResult.data[0];
  if (!series || !category) {
    return null;
  }
  const competitionQuery = client
    .from("competitions")
    .select(
      "id,display_name,year,status,series_id,category_id,gender_division,gender_division_review_required,data_profile_id,data_profile_review_required",
    )
    .eq("year", reference.year)
    .eq("series_id", series.id)
    .eq("category_id", category.id)
    .in("status", ["published", "archived"]);

  const competitionResult = await competitionQuery
    .eq("gender_division", reference.genderDivision)
    .limit(2);

  assertQuerySucceeded(competitionResult.error);

  if (competitionResult.data.length === 0) {
    return null;
  }
  if (competitionResult.data.length > 1) {
    throw new PublicContextQueryError();
  }

  const competition = competitionResult.data[0];
  if (!competition) {
    return null;
  }
  let profile: DataProfileContextRow | undefined;
  if (competition.data_profile_id !== null) {
    const profileResult = await client
      .from("series_category_data_profiles")
      .select("id,series_id,category_id,gender_division,version,primary_source")
      .eq("id", competition.data_profile_id)
      .limit(2);
    assertQuerySucceeded(profileResult.error);
    if (profileResult.data.length !== 1) {
      throw new PublicContextQueryError();
    }
    const profileRow = profileResult.data[0];
    if (!profileRow) {
      throw new PublicContextQueryError();
    }
    profile = toDataProfileContextRow(profileRow);
  }
  return toCompetitionContext(competition, series, category, profile);
}

export async function listPublicContexts(
  client: SupabaseClient<Database>,
): Promise<CompetitionContext[]> {
  const compatibilityResult = await client
    .from("competitions")
    .select(
      "id,display_name,year,status,series_id,category_id,gender_division,gender_division_review_required,data_profile_id,data_profile_review_required",
    )
    .in("status", ["published", "archived"])
    .order("year", { ascending: false })
    .order("id", { ascending: false });

  let competitions: CompetitionContextRow[];
  if (compatibilityResult.error) {
    if (!isCompatibilitySchemaUnavailable(compatibilityResult.error)) {
      throw new PublicContextQueryError();
    }

    const legacyResult = await client
      .from("competitions")
      .select("id,display_name,year,status,series_id,category_id")
      .in("status", ["published", "archived"])
      .order("year", { ascending: false })
      .order("id", { ascending: false });
    assertQuerySucceeded(legacyResult.error);
    competitions = legacyResult.data.map((competition) => ({
      ...competition,
      data_profile_id: null,
      data_profile_review_required: true,
      gender_division: null,
      gender_division_review_required: true,
    }));
  } else {
    competitions = compatibilityResult.data;
  }

  if (competitions.length === 0) {
    return [];
  }

  const seriesIds = [...new Set(competitions.map((row) => row.series_id))];
  const categoryIds = [...new Set(competitions.map((row) => row.category_id))];
  const profileIds = competitions.flatMap((row) =>
    row.data_profile_id === null ? [] : [row.data_profile_id],
  );
  const [seriesResult, categoryResult, profileResult] = await Promise.all([
    client
      .from("competition_series")
      .select("id,name,slug,is_active")
      .in("id", seriesIds)
      .eq("is_active", true),
    client
      .from("categories")
      .select("id,name,slug,has_advanced_stats,is_active")
      .in("id", categoryIds)
      .eq("is_active", true),
    profileIds.length
      ? client
          .from("series_category_data_profiles")
          .select("id,series_id,category_id,gender_division,version,primary_source")
          .in("id", profileIds)
      : Promise.resolve({ data: [] as DataProfileContextRow[], error: null }),
  ]);

  assertQuerySucceeded(seriesResult.error);
  assertQuerySucceeded(categoryResult.error);
  assertQuerySucceeded(profileResult.error);

  const seriesById = new Map(seriesResult.data.map((row) => [row.id, row]));
  const categoryById = new Map(categoryResult.data.map((row) => [row.id, row]));
  const profileById = new Map(
    profileResult.data.map((row) => {
      const profile = toDataProfileContextRow(row);
      return [profile.id, profile] as const;
    }),
  );

  return competitions
    .map((competition) => {
      const series = seriesById.get(competition.series_id);
      const category = categoryById.get(competition.category_id);
      if (!series || !category) {
        return null;
      }
      const profile =
        competition.data_profile_id === null
          ? undefined
          : profileById.get(competition.data_profile_id);
      return toCompetitionContext(competition, series, category, profile);
    })
    .filter((context): context is CompetitionContext => context !== null)
    .sort(compareContextsNewestFirst);
}

export async function latestPublicContext(
  client: SupabaseClient<Database>,
): Promise<CompetitionContext | null> {
  return (await listPublicContexts(client))[0] ?? null;
}

export function readContextPreference(request: Request): ContextPreference | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) {
    return null;
  }

  const rawCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${preferenceCookieName}=`));

  if (!rawCookie) {
    return null;
  }

  try {
    return parseContextPreference(
      decodeURIComponent(rawCookie.slice(preferenceCookieName.length + 1)),
    );
  } catch {
    return null;
  }
}

export function contextPreferenceCookie(context: CompetitionContext): string {
  const value = encodeURIComponent(JSON.stringify(contextPreference(context)));
  return `${preferenceCookieName}=${value}; Path=/; Max-Age=${preferenceMaxAge}; HttpOnly; Secure; SameSite=Lax`;
}
