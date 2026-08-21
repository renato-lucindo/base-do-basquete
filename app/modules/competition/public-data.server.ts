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
}

function ensureQuery(error: unknown): asserts error is null {
  if (error) {
    throw new PublicContextQueryError();
  }
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
    .from("players")
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
  return playerResult.data.map((player) => ({
    id: String(player.id),
    label: player.full_name,
    detail: jerseyByPlayer.get(player.id)
      ? `Camisa ${jerseyByPlayer.get(player.id)}`
      : "Atleta inscrito",
    detailKey: player.slug,
  }));
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
    return registrationResult.data.length === 1
      ? {
          label: team.name,
          description: team.abbreviation ?? "Equipe inscrita nesta edição.",
        }
      : null;
  }

  if (resource === "jogadores") {
    const playerResult = await client
      .from("players")
      .select("id,full_name,slug")
      .eq("slug", detailKey)
      .eq("is_public", true)
      .limit(2);
    ensureQuery(playerResult.error);
    if (playerResult.data.length !== 1) {
      return null;
    }
    const player = playerResult.data[0];
    if (!player) {
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
    return {
      label: player.full_name,
      description: [
        currentJersey ? `Camisa ${currentJersey} nesta edição.` : "Atleta inscrito nesta edição.",
        primaryJersey
          ? `Camisa histórica: ${primaryJersey.jersey_number} em ${primaryJersey.game_count} jogo(s).`
          : "Sem histórico de jogos finalizados.",
      ].join(" "),
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
  };
}
