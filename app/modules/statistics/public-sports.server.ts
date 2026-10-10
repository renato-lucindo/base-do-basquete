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
          name: home.name,
          slug: home.slug,
          abbreviation: nullableString(home.abbreviation),
        },
        away: {
          id: away.id,
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

type CollectiveFreeThrowCounts = { charged: number; converted: number };

function collectiveFreeThrows(
  summary: unknown,
  side: "home" | "away",
): CollectiveFreeThrowCounts | null {
  const values = record(record(summary)?.[side]);
  const charged = nullableNumberValue(values?.charged);
  const converted = nullableNumberValue(values?.converted);
  if (
    charged === null ||
    converted === null ||
    !Number.isInteger(charged) ||
    !Number.isInteger(converted) ||
    charged < 0 ||
    converted < 0 ||
    converted > charged
  )
    return null;
  return { charged, converted };
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

  const finalGames = games.filter((game) => game.status === "final");
  const finalGameIds = finalGames.map((game) => game.id);
  const sourcesResult =
    finalGameIds.length > 0
      ? await client
          .from("game_active_data_sources")
          .select("game_id,domain,source_type")
          .in("game_id", finalGameIds)
          .in("domain", ["player_scoring", "player_advanced"])
      : { data: [], error: null };
  ensure(sourcesResult.error);

  const advancedGameIds = new Set(
    sourcesResult.data
      .filter(
        (source) => source.domain === "player_advanced" && source.source_type === "fiba_boxscore",
      )
      .map((source) => source.game_id),
  );
  const scoringGameIds = new Set(
    sourcesResult.data
      .filter(
        (source) =>
          source.domain === "player_scoring" &&
          (source.source_type === "manual_scoresheet" || source.source_type === "fiba_boxscore"),
      )
      .map((source) => source.game_id),
  );
  // Advanced FIBA attempts win when both domains are present on the same game.
  // The manual collective projection is the only usable denominator otherwise.
  const manualGameIds = finalGameIds.filter(
    (gameId) =>
      !advancedGameIds.has(gameId) &&
      sourcesResult.data.some(
        (source) =>
          source.game_id === gameId &&
          source.domain === "player_scoring" &&
          source.source_type === "manual_scoresheet",
      ),
  );
  const manualGameIdSet = new Set(manualGameIds);
  const [statisticsResult, manualProjectionResult] = await Promise.all([
    finalGameIds.length > 0
      ? client.from("game_player_statistics").select("*").in("game_id", finalGameIds)
      : Promise.resolve({ data: [], error: null }),
    manualGameIds.length > 0
      ? client
          .from("manual_scoresheet_public_statistics_projection")
          .select("game_id,free_throw_summary")
          .in("game_id", manualGameIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  ensure(statisticsResult.error);
  ensure(manualProjectionResult.error);
  const collectiveByGame = new Map(
    manualProjectionResult.data.map((projection) => [
      projection.game_id,
      projection.free_throw_summary,
    ]),
  );

  const teamStatistics = teams.map((team) => {
    const teamGames = finalGames.filter(
      (game) => game.home.id === team.id || game.away.id === team.id,
    );
    const rows = statisticsResult.data.filter((row) => row.team_id === team.id);
    const advancedRows = rows.filter(
      (row) => row.game_id !== null && advancedGameIds.has(row.game_id),
    );
    const scoringRows = rows.filter(
      (row) => row.game_id !== null && scoringGameIds.has(row.game_id),
    );
    const sum = (items: typeof rows, key: keyof (typeof rows)[number]) =>
      items.reduce((total, row) => total + numberValue(row[key] as number | null), 0);
    let collectiveMade = 0;
    let collectiveAttempted = 0;
    let freeThrowCoverageComplete = true;
    let advancedCoverageComplete = teamGames.length > 0;
    let scoringCoverageComplete = teamGames.length > 0;
    for (const game of teamGames) {
      const gameRows = rows.filter((row) => row.game_id === game.id);
      const missingAdvanced = gameRows.some(
        (row) =>
          !row.did_not_play &&
          (row.two_point_attempted === null ||
            row.three_point_attempted === null ||
            row.free_throw_attempted === null),
      );
      if (!scoringGameIds.has(game.id) || gameRows.length === 0) {
        scoringCoverageComplete = false;
      }
      if (!advancedGameIds.has(game.id) || gameRows.length === 0 || missingAdvanced) {
        advancedCoverageComplete = false;
      }
      if (advancedGameIds.has(game.id)) {
        if (
          gameRows.length === 0 ||
          gameRows.some((row) => row.free_throw_attempted === null || row.free_throw_made === null)
        ) {
          freeThrowCoverageComplete = false;
        }
      } else if (manualGameIdSet.has(game.id)) {
        const counts = collectiveFreeThrows(
          collectiveByGame.get(game.id),
          game.home.id === team.id ? "home" : "away",
        );
        if (!counts) {
          freeThrowCoverageComplete = false;
        } else {
          collectiveMade += counts.converted;
          collectiveAttempted += counts.charged;
        }
      } else {
        freeThrowCoverageComplete = false;
      }
    }
    const summary = summarizeTeamStatistics({
      ...team,
      games: teamGames.length,
      points: sum(scoringRows, "points"),
      offensiveRebounds: sum(advancedRows, "offensive_rebounds"),
      defensiveRebounds: sum(advancedRows, "defensive_rebounds"),
      assists: sum(advancedRows, "assists"),
      twoPointMade: sum(advancedRows, "two_point_made"),
      twoPointAttempted: sum(advancedRows, "two_point_attempted"),
      threePointMade: sum(advancedRows, "three_point_made"),
      threePointAttempted: sum(advancedRows, "three_point_attempted"),
      freeThrowMade: sum(advancedRows, "free_throw_made") + collectiveMade,
      freeThrowAttempted: sum(advancedRows, "free_throw_attempted") + collectiveAttempted,
      efficiency: advancedRows.reduce((total, row) => total + efficiency(row), 0),
    });
    if (!scoringCoverageComplete) summary.pointsPerGame = null;
    if (!advancedCoverageComplete) {
      summary.reboundsPerGame = null;
      summary.assistsPerGame = null;
      summary.fieldGoalPercentage = null;
      summary.threePointPercentage = null;
      summary.efficiencyPerGame = null;
    }
    if (!freeThrowCoverageComplete) summary.freeThrowPercentage = null;
    return summary;
  });

  return {
    games,
    standings: calculateStandings(teams, games),
    teamStatistics,
    teams,
  };
}
