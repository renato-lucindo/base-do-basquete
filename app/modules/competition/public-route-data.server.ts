import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/database.generated";
import { loadPublicPlayerProfile } from "../statistics/player-profile.server";
import { loadPublicSportsCore } from "../statistics/public-sports.server";
import {
  loadCompetitionStatistics,
  loadPublicGameDetail,
} from "../statistics/public-statistics.server";
import type { CompetitionContext, DetailResource, PublicResource } from "./context";
import { listPublicContexts } from "./context.server";
import { loadPublicDetail } from "./public-data.server";

export async function loadPublicContextPayload(
  client: SupabaseClient<Database>,
  resolvedContext: CompetitionContext,
  resource: PublicResource,
  knownContexts?: CompetitionContext[],
) {
  const [contexts, playerStatistics, sportsCore] = await Promise.all([
    knownContexts ?? listPublicContexts(client),
    resource === "jogadores"
      ? loadCompetitionStatistics(client, resolvedContext)
      : Promise.resolve(null),
    resource === "jogadores"
      ? Promise.resolve(null)
      : loadPublicSportsCore(client, resolvedContext),
  ]);

  return {
    context: resolvedContext,
    contexts,
    playerStatistics,
    resource,
    sportsCore,
  };
}

export type PublicContextPayload = Awaited<ReturnType<typeof loadPublicContextPayload>>;

export async function loadPublicDetailPayload(
  client: SupabaseClient<Database>,
  resolvedContext: CompetitionContext,
  resource: DetailResource,
  detailReference: string,
  knownContexts?: CompetitionContext[],
) {
  const contexts = knownContexts ?? (await listPublicContexts(client));
  const [loadedDetail, game, playerProfile] = await Promise.all([
    resource === "jogadores"
      ? Promise.resolve(null)
      : loadPublicDetail(client, resolvedContext, resource, detailReference),
    resource === "jogos"
      ? loadPublicGameDetail(client, resolvedContext, detailReference)
      : Promise.resolve(null),
    resource === "jogadores"
      ? loadPublicPlayerProfile(client, resolvedContext, contexts, detailReference)
      : Promise.resolve(null),
  ]);
  const detail = playerProfile
    ? {
        label: playerProfile.fullName,
        description: playerProfile.bio ?? "Perfil público do atleta.",
        achievements: playerProfile.achievements,
      }
    : loadedDetail;
  if (!detail || (resource === "jogos" && !game) || (resource === "jogadores" && !playerProfile)) {
    return null;
  }

  return {
    context: resolvedContext,
    contexts,
    detail,
    game,
    playerProfile,
    resource,
  };
}

export type PublicDetailPayload = NonNullable<Awaited<ReturnType<typeof loadPublicDetailPayload>>>;
