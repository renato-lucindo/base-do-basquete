import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/database.generated";
import type { CompetitionContext } from "../competition/context";
import {
  calculateStandings,
  type PublicGameStatus,
  type PublicGameSummary,
  type PublicTeamSummary,
  type StandingRow,
  summarizeTeamStatistics,
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

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function nullableNumberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function publicationRpcUnavailable(error: unknown): boolean {
  return record(error)?.code === "PGRST202";
}

function registrationIdentitySchemaUnavailable(error: unknown): boolean {
  const code = record(error)?.code;
  return ["42703", "42P01", "PGRST204", "PGRST205"].includes(String(code));
}

function publishedRegistrationIdentity(team: Record<string, unknown>) {
  return typeof team.registrationId === "number" &&
    Number.isSafeInteger(team.registrationId) &&
    team.registrationId > 0
    ? { registrationId: team.registrationId }
    : {};
}

function publishedSportsCore(snapshotValue: unknown): PublicSportsCoreDto | null {
  const snapshot = record(snapshotValue);
  if (!snapshot || !Array.isArray(snapshot.teams) || !Array.isArray(snapshot.games)) return null;
  const teams = snapshot.teams.flatMap((value): PublicTeamSummary[] => {
    const team = record(value);
    if (
      !team ||
      typeof team.id !== "number" ||
      typeof team.name !== "string" ||
      typeof team.slug !== "string"
    )
      return [];
    return [
      {
        id: team.id,
        ...publishedRegistrationIdentity(team),
        name: team.name,
        slug: team.slug,
        abbreviation: nullableString(team.abbreviation),
      },
    ];
  });
  const teamIds = new Set(teams.map((team) => team.id));
  const games = snapshot.games.flatMap((value): PublicGameSummary[] => {
    const game = record(value);
    const home = record(game?.home);
    const away = record(game?.away);
    if (
      !game ||
      typeof game.id !== "number" ||
      typeof game.label !== "string" ||
      !["scheduled", "live", "final"].includes(String(game.status)) ||
      !home ||
      !away ||
      typeof home.id !== "number" ||
      typeof away.id !== "number" ||
      typeof home.name !== "string" ||
      typeof away.name !== "string" ||
      typeof home.slug !== "string" ||
      typeof away.slug !== "string" ||
      !teamIds.has(home.id) ||
      !teamIds.has(away.id)
    )
      return [];
    return [
      {
        id: game.id,
        label: game.label,
        status: game.status as PublicGameStatus,
        scheduledAt: nullableString(game.scheduledAt),
        venue: nullableString(game.venue),
        home: {
          id: home.id,
          ...publishedRegistrationIdentity(home),
          name: home.name,
          slug: home.slug,
          abbreviation: nullableString(home.abbreviation),
        },
        away: {
          id: away.id,
          ...publishedRegistrationIdentity(away),
          name: away.name,
          slug: away.slug,
          abbreviation: nullableString(away.abbreviation),
        },
        homeScore: nullableNumberValue(game.homeScore),
        awayScore: nullableNumberValue(game.awayScore),
        structure: {
          trackCode: nullableString(game.trackCode),
          stageCode: nullableString(game.stageCode),
          stageName: nullableString(game.stageName),
          roundCode: nullableString(game.roundCode),
          roundName: nullableString(game.roundName),
          roundOrder: nullableNumberValue(game.roundOrder),
          matchupCode: nullableString(game.matchupCode),
          matchupOrder: nullableNumberValue(game.matchupOrder),
        },
      },
    ];
  });
  const finalGames = games.filter(
    (game) => game.status === "final" && game.homeScore !== null && game.awayScore !== null,
  );
  const teamStatistics = teams.map((team): TeamStatisticsRow => {
    const played = finalGames.filter(
      (game) => game.home.id === team.id || game.away.id === team.id,
    );
    const points = played.reduce((total, game) => {
      if (game.home.id === team.id) return total + (game.homeScore ?? 0);
      return total + (game.awayScore ?? 0);
    }, 0);
    return {
      ...team,
      games: played.length,
      pointsPerGame: played.length ? Math.round((points / played.length) * 10) / 10 : null,
      reboundsPerGame: null,
      assistsPerGame: null,
      fieldGoalPercentage: null,
      threePointPercentage: null,
      freeThrowPercentage: null,
      efficiencyPerGame: null,
    };
  });
  return { games, standings: calculateStandings(teams, games), teamStatistics, teams };
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
  const publicationResult = await client.rpc("public_get_competition_publication", {
    p_competition_id: context.competitionId,
  });
  if (publicationResult.error && !publicationRpcUnavailable(publicationResult.error)) {
    ensure(publicationResult.error);
  }
  const published = publishedSportsCore(publicationResult.data);
  if (published) return published;

  const registrationsWithIdentityResult = await client
    .from("team_registrations")
    .select("id,team_id,public_name")
    .eq("competition_id", context.competitionId)
    .in("status", ["confirmed", "completed"]);
  const registrationIdentityAvailable = !registrationIdentitySchemaUnavailable(
    registrationsWithIdentityResult.error,
  );
  const legacyRegistrationsResult = registrationIdentityAvailable
    ? null
    : await client
        .from("team_registrations")
        .select("id,team_id")
        .eq("competition_id", context.competitionId)
        .in("status", ["confirmed", "completed"]);
  if (registrationIdentityAvailable) {
    ensure(registrationsWithIdentityResult.error);
  } else {
    ensure(legacyRegistrationsResult?.error ?? null);
  }
  const registrations = registrationIdentityAvailable
    ? (registrationsWithIdentityResult.data ?? [])
    : (legacyRegistrationsResult?.data ?? []).map((registration) => ({
        ...registration,
        public_name: null,
      }));

  if (registrations.length === 0) {
    return { games: [], standings: [], teamStatistics: [], teams: [] };
  }

  const teamsResult = await client
    .from("teams")
    .select("id,name,slug,abbreviation")
    .in(
      "id",
      registrations.map((registration) => registration.team_id),
    )
    .eq("is_public", true)
    .order("name");
  ensure(teamsResult.error);

  const globalTeamById = new Map(teamsResult.data.map((team) => [team.id, team]));
  const teamByRegistrationId = new Map<number, PublicTeamSummary>();
  for (const registration of registrations) {
    const team = globalTeamById.get(registration.team_id);
    if (!team) continue;
    teamByRegistrationId.set(registration.id, {
      id: registrationIdentityAvailable ? registration.id : team.id,
      name: registrationIdentityAvailable ? (registration.public_name ?? team.name) : team.name,
      slug: registrationIdentityAvailable ? `inscricao-${registration.id}` : team.slug,
      abbreviation: team.abbreviation,
    });
  }
  const teams = [
    ...new Map([...teamByRegistrationId.values()].map((team) => [team.id, team] as const)).values(),
  ];

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
    const home = homeParticipant ? teamByRegistrationId.get(homeParticipant.registration_id) : null;
    const away = awayParticipant ? teamByRegistrationId.get(awayParticipant.registration_id) : null;
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
    const rows = statisticsResult.data.filter((row) =>
      registrationIdentityAvailable ? row.registration_id === team.id : row.team_id === team.id,
    );
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
