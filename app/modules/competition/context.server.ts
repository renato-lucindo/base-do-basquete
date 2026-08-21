import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/database.generated";
import {
  compareContextsNewestFirst,
  contextPreference,
  parseContextPreference,
  toCompetitionContext,
  type CompetitionContext,
  type ContextPreference,
} from "./context";

const preferenceCookieName = "__Host-bdb-context";
const preferenceMaxAge = 60 * 60 * 24 * 365;

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

export async function resolveCompetitionContext(
  client: SupabaseClient<Database>,
  reference: Omit<ContextPreference, "version">,
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
  const competitionResult = await client
    .from("competitions")
    .select("id,display_name,year,status,series_id,category_id")
    .eq("year", reference.year)
    .eq("series_id", series.id)
    .eq("category_id", category.id)
    .in("status", ["published", "archived"])
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
  return toCompetitionContext(competition, series, category);
}

export async function listPublicContexts(
  client: SupabaseClient<Database>,
): Promise<CompetitionContext[]> {
  const competitionResult = await client
    .from("competitions")
    .select("id,display_name,year,status,series_id,category_id")
    .in("status", ["published", "archived"])
    .order("year", { ascending: false })
    .order("id", { ascending: false });

  assertQuerySucceeded(competitionResult.error);
  if (competitionResult.data.length === 0) {
    return [];
  }

  const seriesIds = [...new Set(competitionResult.data.map((row) => row.series_id))];
  const categoryIds = [...new Set(competitionResult.data.map((row) => row.category_id))];
  const [seriesResult, categoryResult] = await Promise.all([
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
  ]);

  assertQuerySucceeded(seriesResult.error);
  assertQuerySucceeded(categoryResult.error);

  const seriesById = new Map(seriesResult.data.map((row) => [row.id, row]));
  const categoryById = new Map(categoryResult.data.map((row) => [row.id, row]));

  return competitionResult.data
    .map((competition) => {
      const series = seriesById.get(competition.series_id);
      const category = categoryById.get(competition.category_id);
      if (!series || !category) {
        return null;
      }
      return toCompetitionContext(competition, series, category);
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
