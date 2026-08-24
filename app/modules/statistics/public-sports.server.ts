import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/database.generated";
import type { CompetitionContext } from "../competition/context";
import {
  calculateStandings,
  summarizeTeamStatistics,
  type PublicGameStatus,
  type PublicGameSummary,
  type PublicTeamSummary,
  type StandingRow,
  type TeamStatisticsRow,
} from "./sports-domain";

export interface PublicSportsCoreDto {
  games: PublicGameSummary[];
  standings: StandingRow[];
  teamStatistics: TeamStatisticsRow[];
  teams: PublicTeamSummary[];
}

function ensure(error: unknown): asserts error is null {
  if (error) throw new Error("Public sports query failed");
}

function numberValue(value: number | null): number {
  return value ?? 0;
}

function efficiency(row: {
  points: number | null;
  offensive_rebounds: number | null;
  defensive_rebounds: number | null;
  assists: number | null;
  steals: number | null;
  blocks: number | null;
  two_point_made: number | null;
  two_point_attempted: number | null;
  three_point_made: number | null;
  three_point_attempted: number | null;
  free_throw_made: number | null;
  free_throw_attempted: number | null;
  turnovers: number | null;
}): number {
  return (
    numberValue(row.points) +
    numberValue(row.offensive_rebounds) +
    numberValue(row.defensive_rebounds) +
    numberValue(row.assists) +
    numberValue(row.steals) +
    numberValue(row.blocks) -
    (numberValue(row.two_point_attempted) - numberValue(row.two_point_made)) -
    (numberValue(row.three_point_attempted) - numberValue(row.three_point_made)) -
    (numberValue(row.free_throw_attempted) - numberValue(row.free_throw_made)) -
    numberValue(row.turnovers)
  );
}

export async function loadPublicSportsCore(
  client: SupabaseClient<Database>,
  context: CompetitionContext,
): Promise<PublicSportsCoreDto> {
  const registrationsResult = await client
    .from("team_registrations")
    .select("id,team_id")
    .eq("competition_id", context.competitionId)
    .in("status", ["confirmed", "completed"]);
  ensure(registrationsResult.error);

  if (registrationsResult.data.length === 0) {
    return { games: [], standings: [], teamStatistics: [], teams: [] };
  }

  const teamsResult = await client
    .from("teams")
    .select("id,name,slug,abbreviation")
    .in(
      "id",
      registrationsResult.data.map((registration) => registration.team_id),
    )
    .eq("is_public", true)
    .order("name");
  ensure(teamsResult.error);

  const teams: PublicTeamSummary[] = teamsResult.data.map((team) => ({
    id: team.id,
    name: team.name,
    slug: team.slug,
    abbreviation: team.abbreviation,
  }));
  const registrationById = new Map(
    registrationsResult.data.map((registration) => [registration.id, registration]),
  );
  const teamById = new Map(teams.map((team) => [team.id, team]));

  const gamesResult = await client
    .from("games")
    .select("id,game_number,status,scheduled_at,venue")
    .eq("competition_id", context.competitionId)
    .in("status", ["scheduled", "live", "final"])
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .order("id");
  ensure(gamesResult.error);

  if (gamesResult.data.length === 0) {
    return {
      games: [],
      standings: calculateStandings(teams, []),
      teamStatistics: teams.map((team) =>
        summarizeTeamStatistics({
          ...team,
          games: 0,
          points: 0,
          offensiveRebounds: 0,
          defensiveRebounds: 0,
          assists: 0,
          twoPointMade: 0,
          twoPointAttempted: 0,
          threePointMade: 0,
          threePointAttempted: 0,
          freeThrowMade: 0,
          freeThrowAttempted: 0,
          efficiency: 0,
        }),
      ),
      teams,
    };
  }

  const gameIds = gamesResult.data.map((game) => game.id);
  const [participantsResult, scoresResult] = await Promise.all([
    client
      .from("game_participants")
      .select("game_id,registration_id,side")
      .eq("competition_id", context.competitionId)
      .in("game_id", gameIds),
    client
      .from("game_scores")
      .select("game_id,registration_id,score")
      .eq("competition_id", context.competitionId)
      .in("game_id", gameIds),
  ]);
  ensure(participantsResult.error);
  ensure(scoresResult.error);

  const games = gamesResult.data.flatMap((game): PublicGameSummary[] => {
    if (!["scheduled", "live", "final"].includes(game.status)) return [];
    const participants = participantsResult.data.filter((item) => item.game_id === game.id);
    const homeParticipant = participants.find((item) => item.side === "home");
    const awayParticipant = participants.find((item) => item.side === "away");
    const homeRegistration = homeParticipant
      ? registrationById.get(homeParticipant.registration_id)
      : null;
    const awayRegistration = awayParticipant
      ? registrationById.get(awayParticipant.registration_id)
      : null;
    const home = homeRegistration ? teamById.get(homeRegistration.team_id) : null;
    const away = awayRegistration ? teamById.get(awayRegistration.team_id) : null;
    if (!homeParticipant || !awayParticipant || !home || !away) return [];
    const score = (registrationId: number) =>
      scoresResult.data.find(
        (item) => item.game_id === game.id && item.registration_id === registrationId,
      )?.score ?? null;
    return [
      {
        id: game.id,
        label: game.game_number ? `Jogo ${game.game_number}` : `Jogo ${game.id}`,
        status: game.status as PublicGameStatus,
        scheduledAt: game.scheduled_at,
        venue: game.venue,
        home,
        away,
        homeScore: game.status === "scheduled" ? null : score(homeParticipant.registration_id),
        awayScore: game.status === "scheduled" ? null : score(awayParticipant.registration_id),
      },
    ];
  });

  const finalGameIds = games.filter((game) => game.status === "final").map((game) => game.id);
  const statisticsResult =
    finalGameIds.length > 0
      ? await client.from("game_player_statistics").select("*").in("game_id", finalGameIds)
      : { data: [], error: null };
  ensure(statisticsResult.error);

  const teamStatistics = teams.map((team) => {
    const rows = statisticsResult.data.filter((row) => row.team_id === team.id);
    const sum = (key: keyof (typeof rows)[number]) =>
      rows.reduce((total, row) => total + numberValue(row[key] as number | null), 0);
    return summarizeTeamStatistics({
      ...team,
      games: new Set(rows.map((row) => row.game_id)).size,
      points: sum("points"),
      offensiveRebounds: sum("offensive_rebounds"),
      defensiveRebounds: sum("defensive_rebounds"),
      assists: sum("assists"),
      twoPointMade: sum("two_point_made"),
      twoPointAttempted: sum("two_point_attempted"),
      threePointMade: sum("three_point_made"),
      threePointAttempted: sum("three_point_attempted"),
      freeThrowMade: sum("free_throw_made"),
      freeThrowAttempted: sum("free_throw_attempted"),
      efficiency: rows.reduce((total, row) => total + efficiency(row), 0),
    });
  });

  return {
    games,
    standings: calculateStandings(teams, games),
    teamStatistics,
    teams,
  };
}
