import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/database.generated";
import { loadBoxscoreStatisticsPage } from "../statistics/boxscore-statistics.server";
import { loadPublicPlayerProfile } from "../statistics/player-profile.server";
import { loadPublicSportsCore } from "../statistics/public-sports.server";
import {
  loadCompetitionStatistics,
  loadPublicGameDetail,
} from "../statistics/public-statistics.server";
import type {
  PublicGameSummary,
  PublicTeamSummary,
  StandingRow,
  TeamStatisticsRow,
} from "../statistics/sports-domain";
import type { CompetitionContext, DetailResource, PublicResource } from "./context";
import { listPublicContexts } from "./context.server";
import { loadPublicDetail } from "./public-data.server";

export interface PublicTeamProfileDto {
  games: PublicGameSummary[];
  standing: StandingRow | null;
  statistics: TeamStatisticsRow | null;
  team: PublicTeamSummary;
}

export async function loadPublicContextPayload(
  client: SupabaseClient<Database>,
  resolvedContext: CompetitionContext,
  resource: PublicResource,
  knownContexts?: CompetitionContext[],
  searchParams = new URLSearchParams(),
) {
  const [contexts, boxscoreStatistics, sportsCore] = await Promise.all([
    knownContexts ?? listPublicContexts(client),
    resource === "jogadores"
      ? loadBoxscoreStatisticsPage(client, resolvedContext, searchParams)
      : Promise.resolve(null),
    resource === "jogadores"
      ? Promise.resolve(null)
      : loadPublicSportsCore(client, resolvedContext),
  ]);
  const playerStatistics =
    resource === "jogadores" && boxscoreStatistics === null
      ? await loadCompetitionStatistics(client, resolvedContext)
      : null;

  return {
    boxscoreStatistics,
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
  searchParams = new URLSearchParams(),
) {
  const contexts = knownContexts ?? (await listPublicContexts(client));
  const [loadedDetail, game, playerProfile, teamSportsCore] = await Promise.all([
    resource === "jogadores"
      ? Promise.resolve(null)
      : loadPublicDetail(client, resolvedContext, resource, detailReference),
    resource === "jogos"
      ? loadPublicGameDetail(client, resolvedContext, detailReference)
      : Promise.resolve(null),
    resource === "jogadores"
      ? loadPublicPlayerProfile(client, resolvedContext, contexts, detailReference, searchParams)
      : Promise.resolve(null),
    resource === "equipes" ? loadPublicSportsCore(client, resolvedContext) : Promise.resolve(null),
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
  const team =
    teamSportsCore?.teams.find(
      (item) =>
        item.slug === detailReference ||
        (loadedDetail?.registrationId !== undefined &&
          (item.registrationId === loadedDetail.registrationId ||
            item.slug === `inscricao-${loadedDetail.registrationId}`)),
    ) ?? null;
  const teamProfile: PublicTeamProfileDto | null =
    team && teamSportsCore
      ? {
          games: teamSportsCore.games.filter(
            (item) => item.home.id === team.id || item.away.id === team.id,
          ),
          standing: teamSportsCore.standings.find((item) => item.id === team.id) ?? null,
          statistics: teamSportsCore.teamStatistics.find((item) => item.id === team.id) ?? null,
          team,
        }
      : null;
  if (resource === "equipes" && !teamProfile) return null;

  return {
    context: resolvedContext,
    contexts,
    detail,
    game,
    playerProfile,
    resource,
    teamProfile,
  };
}

export type PublicDetailPayload = NonNullable<Awaited<ReturnType<typeof loadPublicDetailPayload>>>;
