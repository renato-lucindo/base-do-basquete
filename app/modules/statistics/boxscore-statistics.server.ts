import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/database.generated";
import type { CompetitionContext } from "../competition/context";
import {
  type BoxscoreSnapshotHeader,
  type BoxscoreSnapshotRow,
  type BoxscoreStatisticsPageDto,
  buildBoxscoreStatisticsPage,
  parseBoxscoreStatisticsQuery,
} from "./boxscore-statistics-domain";

export class PublicBoxscoreStatisticsQueryError extends Error {
  constructor() {
    super("Public boxscore statistics query failed");
    this.name = "PublicBoxscoreStatisticsQueryError";
  }
}

export async function loadBoxscoreStatisticsPage(
  client: SupabaseClient<Database>,
  context: CompetitionContext,
  searchParams: URLSearchParams,
): Promise<BoxscoreStatisticsPageDto | null> {
  if (
    context.statisticsMode !== "boxscore" ||
    context.dataProfile?.primarySource !== "fiba_boxscore"
  ) {
    return null;
  }
  const query = parseBoxscoreStatisticsQuery(searchParams);
  const headerResult = await client
    .from("competition_publication_statistics")
    .select("*")
    .eq("competition_id", context.competitionId)
    .eq("statistics_contract", "boxscore")
    .maybeSingle();
  if (headerResult.error) throw new PublicBoxscoreStatisticsQueryError();
  if (!headerResult.data) return null;
  const header = headerResult.data as BoxscoreSnapshotHeader;
  if (
    header.data_profile_id !== context.dataProfile.id ||
    header.data_profile_version !== context.dataProfile.version ||
    header.primary_source !== "fiba_boxscore"
  ) {
    return null;
  }
  const rowsResult = await client
    .from("competition_player_statistics_publications")
    .select("*")
    .eq("competition_id", context.competitionId)
    .eq("publication_id", header.publication_id)
    .eq("scope", query.scope);
  if (rowsResult.error) throw new PublicBoxscoreStatisticsQueryError();
  return buildBoxscoreStatisticsPage(rowsResult.data as BoxscoreSnapshotRow[], header, query);
}
