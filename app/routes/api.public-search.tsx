import { data } from "react-router";

import { cloudflareContext } from "../context";
import { createAnonymousSupabaseClient } from "../modules/auth/supabase.server";
import { listPublicContexts } from "../modules/competition/context.server";
import {
  buildContextualSearchResults,
  normalizePublicSearch,
  PUBLIC_SEARCH_MIN_LENGTH,
  type SearchPlayer,
  type SearchTeam,
} from "../modules/search/public-search-domain";
import type { Route } from "./+types/api.public-search";

export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const competitionId = Number(url.searchParams.get("competitionId"));
  const query = normalizePublicSearch(url.searchParams.get("q") ?? "");
  if (!Number.isSafeInteger(competitionId) || query.length < PUBLIC_SEARCH_MIN_LENGTH) {
    return data({ groups: [], query }, { headers: { "Cache-Control": "public, max-age=30" } });
  }

  const { env } = context.get(cloudflareContext);
  const client = createAnonymousSupabaseClient(env);
  const contexts = await listPublicContexts(client);
  const selected = contexts.find((item) => item.competitionId === competitionId);
  if (!selected) {
    throw data(null, { status: 404, statusText: "Contexto não encontrado" });
  }

  const [statisticsResult, registrationsResult] = await Promise.all([
    client
      .from("competition_player_statistics")
      .select("player_id,player_name,player_slug,team_name")
      .eq("competition_id", competitionId)
      .order("player_name")
      .limit(200),
    client
      .from("team_registrations")
      .select("team_id")
      .eq("competition_id", competitionId)
      .in("status", ["confirmed", "completed"])
      .limit(80),
  ]);
  if (statisticsResult.error || registrationsResult.error) {
    throw new Response("Falha na busca pública", { status: 503 });
  }

  const playerIds = [
    ...new Set(
      statisticsResult.data
        .map((row) => row.player_id)
        .filter((id): id is number => typeof id === "number"),
    ),
  ];
  const teamIds = [...new Set(registrationsResult.data.map((row) => row.team_id))];
  const [profilesResult, teamsResult] = await Promise.all([
    playerIds.length
      ? client
          .from("players")
          .select("id,nickname")
          .in("id", playerIds)
          .eq("is_public", true)
          .limit(200)
      : Promise.resolve({ data: [], error: null }),
    teamIds.length
      ? client
          .from("teams")
          .select("id,name,abbreviation,slug,is_public")
          .in("id", teamIds)
          .eq("is_public", true)
          .order("name")
          .limit(80)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profilesResult.error || teamsResult.error) {
    throw new Response("Falha na busca pública", { status: 503 });
  }

  const nicknameById = new Map(profilesResult.data.map((row) => [row.id, row.nickname]));
  const players: SearchPlayer[] = statisticsResult.data.flatMap((row) =>
    typeof row.player_id === "number" && row.player_name && row.player_slug
      ? [
          {
            id: row.player_id,
            name: row.player_name,
            nickname: nicknameById.get(row.player_id) ?? null,
            slug: row.player_slug,
            teamName: row.team_name,
            isPublic: nicknameById.has(row.player_id),
          },
        ]
      : [],
  );
  const teams: SearchTeam[] = teamsResult.data.map((team) => ({
    id: team.id,
    name: team.name,
    abbreviation: team.abbreviation,
    slug: team.slug,
    isPublic: team.is_public,
  }));

  return data(
    { groups: buildContextualSearchResults(query, selected, players, teams, contexts), query },
    { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } },
  );
}
