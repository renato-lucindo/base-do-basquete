import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/database.generated";
import type { CompetitionContext, DetailResource, PublicResource } from "./context";
import { PublicContextQueryError } from "./context.server";

export interface PublicResourceItem {
  id: string;
  label: string;
  detail: string;
  detailKey?: string;
}

export interface PublicDetail {
  label: string;
  description: string;
  achievements: PublicAchievement[];
}

export interface PublicAchievement {
  competitionId: number;
  competitionDisplayName: string;
  seriesName: string;
  seriesSlug: string;
  year: number;
  categoryName: string;
  categorySlug: string;
  placement: number;
  resultLabel: string | null;
  teamName?: string;
  teamSlug?: string;
}

function ensureQuery(error: unknown): asserts error is null {
  if (error) {
    throw new PublicContextQueryError();
  }
}

function toPublicAchievement(achievement: {
  category_name: string | null;
  category_slug: string | null;
  competition_display_name: string | null;
  competition_id: number | null;
  placement: number | null;
  result_label: string | null;
  series_name: string | null;
  series_slug: string | null;
  team_name?: string | null;
  team_slug?: string | null;
  year: number | null;
}): PublicAchievement | null {
  if (
    achievement.competition_id === null ||
    achievement.competition_display_name === null ||
    achievement.series_name === null ||
    achievement.series_slug === null ||
    achievement.year === null ||
    achievement.category_name === null ||
    achievement.category_slug === null ||
    achievement.placement === null
  ) {
    return null;
  }
  return {
    competitionId: achievement.competition_id,
    competitionDisplayName: achievement.competition_display_name,
    seriesName: achievement.series_name,
    seriesSlug: achievement.series_slug,
    year: achievement.year,
    categoryName: achievement.category_name,
    categorySlug: achievement.category_slug,
    placement: achievement.placement,
    resultLabel: achievement.result_label,
    teamName: achievement.team_name ?? undefined,
    teamSlug: achievement.team_slug ?? undefined,
  };
}

async function teamItems(
  client: SupabaseClient<Database>,
  context: CompetitionContext,
): Promise<PublicResourceItem[]> {
  const registrationResult = await client
    .from("team_registrations")
    .select("id,team_id,status")
    .eq("competition_id", context.competitionId)
    .in("status", ["confirmed", "completed"]);
  ensureQuery(registrationResult.error);

  if (registrationResult.data.length === 0) {
    return [];
  }

  const teamResult = await client
    .from("teams")
    .select("id,name,slug,abbreviation")
    .in(
      "id",
      registrationResult.data.map((registration) => registration.team_id),
    )
    .eq("is_public", true)
    .order("name");
  ensureQuery(teamResult.error);

  return teamResult.data.map((team) => ({
    id: String(team.id),
    label: team.name,
    detail: team.abbreviation ?? "Equipe inscrita",
    detailKey: team.slug,
  }));
}

async function playerItems(
  client: SupabaseClient<Database>,
  context: CompetitionContext,
): Promise<PublicResourceItem[]> {
  const rosterResult = await client
    .from("roster_entries")
    .select("player_id,jersey_number")
    .eq("competition_id", context.competitionId)
    .eq("status", "active");
  ensureQuery(rosterResult.error);
  if (rosterResult.data.length === 0) {
    return [];
  }

  const playerResult = await client
    .from("public_player_profiles")
    .select("id,full_name,slug")
    .in(
      "id",
      rosterResult.data.map((entry) => entry.player_id),
    )
    .eq("is_public", true)
    .order("full_name");
  ensureQuery(playerResult.error);

  const jerseyByPlayer = new Map(
    rosterResult.data.map((entry) => [entry.player_id, entry.jersey_number]),
  );
  return playerResult.data.flatMap((player): PublicResourceItem[] => {
    if (player.id === null || player.full_name === null || player.slug === null) {
      return [];
    }
    return [
      {
        id: String(player.id),
        label: player.full_name,
        detail: jerseyByPlayer.get(player.id)
          ? `Camisa ${jerseyByPlayer.get(player.id)}`
          : "Atleta inscrito",
        detailKey: player.slug,
      },
    ];
  });
}

async function gameItems(
  client: SupabaseClient<Database>,
  context: CompetitionContext,
): Promise<PublicResourceItem[]> {
  const gameResult = await client
    .from("games")
    .select("id,game_number,status,scheduled_at,venue")
    .eq("competition_id", context.competitionId)
    .in("status", ["scheduled", "live", "final"])
    .order("scheduled_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false });
  ensureQuery(gameResult.error);

  return gameResult.data.map((game) => ({
    id: String(game.id),
    label: game.game_number ? `Jogo ${game.game_number}` : `Jogo ${game.id}`,
    detail: game.venue ?? game.status,
    detailKey: String(game.id),
  }));
}

export async function loadPublicResourceItems(
  client: SupabaseClient<Database>,
  context: CompetitionContext,
  resource: PublicResource,
): Promise<PublicResourceItem[]> {
  if (resource === "jogadores") {
    return playerItems(client, context);
  }
  if (resource === "jogos") {
    return gameItems(client, context);
  }
  return teamItems(client, context);
}

export async function loadPublicDetail(
  client: SupabaseClient<Database>,
  context: CompetitionContext,
  resource: DetailResource,
  detailKey: string,
): Promise<PublicDetail | null> {
  if (resource === "equipes") {
    const teamResult = await client
      .from("teams")
      .select("id,name,slug,abbreviation")
      .eq("slug", detailKey)
      .eq("is_public", true)
      .limit(2);
    ensureQuery(teamResult.error);
    if (teamResult.data.length !== 1) {
      return null;
    }
    const team = teamResult.data[0];
    if (!team) {
      return null;
    }

    const registrationResult = await client
      .from("team_registrations")
      .select("id")
      .eq("competition_id", context.competitionId)
      .eq("team_id", team.id)
      .in("status", ["confirmed", "completed"])
      .limit(1);
    ensureQuery(registrationResult.error);
    if (registrationResult.data.length !== 1) return null;
    const achievementsResult = await client
      .from("team_achievements")
      .select(
        "competition_id,competition_display_name,series_name,series_slug,year,category_name,category_slug,placement,result_label",
      )
      .eq("team_id", team.id)
      .order("year", { ascending: false })
      .order("placement");
    ensureQuery(achievementsResult.error);
    return {
      label: team.name,
      description: team.abbreviation ?? "Equipe inscrita nesta edição.",
      achievements: achievementsResult.data
        .map(toPublicAchievement)
        .filter((achievement): achievement is PublicAchievement => achievement !== null),
    };
  }

  if (resource === "jogadores") {
    const playerResult = await client
      .from("public_player_profiles")
      .select("id,full_name,slug")
      .eq("slug", detailKey)
      .eq("is_public", true)
      .limit(2);
    ensureQuery(playerResult.error);
    if (playerResult.data.length !== 1) {
      return null;
    }
    const player = playerResult.data[0];
    if (
      !player ||
      player.id === null ||
      player.full_name === null ||
      player.slug === null
    ) {
      return null;
    }

    const rosterResult = await client
      .from("roster_entries")
      .select("jersey_number")
      .eq("competition_id", context.competitionId)
      .eq("player_id", player.id)
      .eq("status", "active")
      .limit(1);
    ensureQuery(rosterResult.error);
    if (rosterResult.data.length !== 1) {
      return null;
    }
    const primaryJerseyResult = await client
      .from("player_primary_jerseys")
      .select("jersey_number,game_count")
      .eq("player_id", player.id)
      .limit(1);
    ensureQuery(primaryJerseyResult.error);
    const currentJersey = rosterResult.data[0]?.jersey_number;
    const primaryJersey = primaryJerseyResult.data[0];
    const achievementsResult = await client
      .from("player_achievements")
      .select(
        "competition_id,competition_display_name,series_name,series_slug,year,category_name,category_slug,placement,result_label,team_name,team_slug",
      )
      .eq("player_id", player.id)
      .order("year", { ascending: false })
      .order("placement");
    ensureQuery(achievementsResult.error);
    return {
      label: player.full_name,
      description: [
        currentJersey ? `Camisa ${currentJersey} nesta edição.` : "Atleta inscrito nesta edição.",
        primaryJersey
          ? `Camisa histórica: ${primaryJersey.jersey_number} em ${primaryJersey.game_count} jogo(s).`
          : "Sem histórico de jogos finalizados.",
      ].join(" "),
      achievements: achievementsResult.data
        .map(toPublicAchievement)
        .filter((achievement): achievement is PublicAchievement => achievement !== null),
    };
  }

  if (!/^\d+$/.test(detailKey)) {
    return null;
  }
  const gameResult = await client
    .from("games")
    .select("id,game_number,status,venue")
    .eq("id", Number(detailKey))
    .eq("competition_id", context.competitionId)
    .in("status", ["scheduled", "live", "final"])
    .limit(2);
  ensureQuery(gameResult.error);
  if (gameResult.data.length !== 1) {
    return null;
  }

  const game = gameResult.data[0];
  if (!game) {
    return null;
  }
  return {
    label: game.game_number ? `Jogo ${game.game_number}` : `Jogo ${game.id}`,
    description: game.venue ?? `Status: ${game.status}`,
    achievements: [],
  };
}
