import { data } from "react-router";

import { cloudflareContext } from "../context";
import { createAnonymousSupabaseClient } from "../modules/auth/supabase.server";
import { listPublicContexts } from "../modules/competition/context.server";
import {
  buildContextualSearchResults,
  buildGlobalSearchResults,
  normalizePublicSearch,
  PUBLIC_SEARCH_MIN_LENGTH,
  type SearchPlayer,
  type SearchTeam,
  type SearchGame,
} from "../modules/search/public-search-domain";
import { loadCompetitionStatistics } from "../modules/statistics/public-statistics.server";
import { loadPublicSportsCore } from "../modules/statistics/public-sports.server";
import type { Route } from "./+types/api.public-search";

export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const competitionId = Number(url.searchParams.get("competitionId"));
  const scope = url.searchParams.get("scope") === "global" ? "global" : "current";
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

  if (scope === "global") {
    const bundles = await Promise.all(
      contexts.map(async (item) => {
        const [statistics, sports] = await Promise.all([
          loadCompetitionStatistics(client, item),
          loadPublicSportsCore(client, item),
        ]);
        return { context: item, statistics, sports };
      }),
    );
    const playerIds = [
      ...new Set(
        bundles.flatMap((bundle) => bundle.statistics.players.map((player) => player.playerId)),
      ),
    ];
    const profilesResult = playerIds.length
      ? await client
          .from("players")
          .select("id,nickname")
          .in("id", playerIds)
          .eq("is_public", true)
          .limit(500)
      : { data: [], error: null };
    const nicknameById = new Map(
      profilesResult.error ? [] : profilesResult.data.map((row) => [row.id, row.nickname]),
    );
    const players: SearchPlayer[] = bundles.flatMap((bundle) =>
      bundle.statistics.players.map((player) => ({
        id: player.playerId,
        name: player.playerName,
        nickname: nicknameById.get(player.playerId) ?? null,
        slug: player.playerSlug,
        teamName: player.teamName,
        isPublic: true,
        context: bundle.context,
      })),
    );
    const teams: SearchTeam[] = bundles.flatMap((bundle) =>
      bundle.sports.teams.map((team) => ({
        id: team.id,
        name: team.name,
        abbreviation: team.abbreviation,
        slug: team.slug,
        isPublic: true,
        context: bundle.context,
      })),
    );
    const games: SearchGame[] = bundles.flatMap((bundle) =>
      bundle.sports.games.map((game) => ({
        id: game.id,
        label: game.label,
        homeName: game.home.name,
        awayName: game.away.name,
        context: bundle.context,
      })),
    );
    return data(
      { groups: buildGlobalSearchResults(query, contexts, players, teams, games), query },
      { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } },
    );
  }

  const [statistics, sports] = await Promise.all([
    loadCompetitionStatistics(client, selected),
    loadPublicSportsCore(client, selected),
  ]);
  const playerIds = statistics.players.map((player) => player.playerId);
  const profilesResult =
    playerIds.length > 0
      ? await client
          .from("players")
          .select("id,nickname")
          .in("id", playerIds)
          .eq("is_public", true)
          .limit(200)
      : { data: [], error: null };
  const nicknameById = new Map(
    profilesResult.error ? [] : profilesResult.data.map((row) => [row.id, row.nickname]),
  );

  const players: SearchPlayer[] = statistics.players.map((player) => ({
    id: player.playerId,
    name: player.playerName,
    nickname: nicknameById.get(player.playerId) ?? null,
    slug: player.playerSlug,
    teamName: player.teamName,
    // O read model estatístico já aplica as regras públicas do contexto.
    isPublic: true,
  }));
  const teams: SearchTeam[] = sports.teams.map((team) => ({
    id: team.id,
    name: team.name,
    abbreviation: team.abbreviation,
    slug: team.slug,
    // A carga esportiva seleciona somente equipes públicas inscritas.
    isPublic: true,
  }));

  return data(
    { groups: buildContextualSearchResults(query, selected, players, teams, contexts), query },
    { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } },
  );
}
