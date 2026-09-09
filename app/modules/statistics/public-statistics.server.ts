import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/database.generated";
import type { CompetitionContext } from "../competition/context";
import { perGame, type PlayerStatistics, type StatisticTotals } from "./domain";
import { emptyStatisticTotals, pointsReconcile, sumStatisticTotals } from "./game-detail-domain";

export interface ScoresheetPlayerStatistics {
  competitionId: number;
  playerId: number;
  playerName: string;
  playerSlug: string;
  teamName: string | null;
  teamSlug: string | null;
  teamAbbreviation: string | null;
  gamesPlayed: number;
  dnpCount: number;
  points: number | null;
  pointsPerGame: number | null;
  twoPointMade: number | null;
  threePointMade: number | null;
  freeThrowMade: number | null;
  fouls: number | null;
  disqualifications: number | null;
}

export interface CompetitionDataCoverage {
  totalGames: number;
  participationGames: number;
  scoringGames: number;
  advancedGames: number;
  foulGames: number;
}

export type CompetitionStatisticsDto =
  | {
      kind: "scoresheet";
      competitionId: number;
      players: ScoresheetPlayerStatistics[];
    }
  | {
      kind: "boxscore";
      competitionId: number;
      players: PlayerStatistics[];
      coverage: CompetitionDataCoverage;
    };

export interface PublicGameTeam {
  registrationId: number;
  side: "home" | "away";
  teamId: number;
  teamName: string;
  teamSlug: string;
  score: number;
  periodScores: Array<{ periodNumber: number; points: number }>;
  statistics: PublicGameTeamStatistics | null;
  totals: StatisticTotals | null;
  pointsReconciled: boolean | null;
}

export interface PublicGameTeamStatistics {
  pointsFromTurnovers: number;
  pointsInPaint: number;
  pointsInPaintMade: number;
  pointsInPaintAttempted: number;
  secondChancePoints: number;
  fastBreakPoints: number;
  fastBreakPointsFromTurnovers: number;
  benchPoints: number;
  largestLead: number;
  largestScoringRun: number;
  pointsPerPossession: number;
  timeLeadingSeconds: number;
}

export interface PublicGamePlayer {
  playerId: number;
  playerName: string;
  playerSlug: string;
  teamId: number;
  side: "home" | "away";
  jerseyNumber: string;
  didNotPlay: boolean;
  isStarter: boolean;
  officialPoints: number | null;
  fouls: number | null;
  advancedTotals: StatisticTotals | null;
}

export interface PublicGameDetail {
  id: number;
  competitionId: number;
  label: string;
  status: string;
  scheduledAt: string | null;
  venue: string | null;
  advanced: boolean;
  teams: [PublicGameTeam, PublicGameTeam];
  gameStatistics: { leadChanges: number; timesTied: number } | null;
  players: PublicGamePlayer[];
}

function ensure(error: unknown): asserts error is null {
  if (error) throw new Error("Public statistics query failed");
}

function numberValue(value: number | null): number {
  return value ?? 0;
}

function nullableNumber(value: number | null): number | null {
  return value;
}

function totalsFromRow(row: {
  seconds_played: number | null;
  points: number | null;
  two_point_made: number | null;
  two_point_attempted: number | null;
  three_point_made: number | null;
  three_point_attempted: number | null;
  free_throw_made: number | null;
  free_throw_attempted: number | null;
  offensive_rebounds: number | null;
  defensive_rebounds: number | null;
  assists: number | null;
  turnovers: number | null;
  steals: number | null;
  blocks: number | null;
  fouls?: number | null;
  plus_minus: number | null;
}): StatisticTotals {
  return {
    secondsPlayed: numberValue(row.seconds_played),
    points: numberValue(row.points),
    twoPointMade: numberValue(row.two_point_made),
    twoPointAttempted: numberValue(row.two_point_attempted),
    threePointMade: numberValue(row.three_point_made),
    threePointAttempted: numberValue(row.three_point_attempted),
    freeThrowMade: numberValue(row.free_throw_made),
    freeThrowAttempted: numberValue(row.free_throw_attempted),
    offensiveRebounds: numberValue(row.offensive_rebounds),
    defensiveRebounds: numberValue(row.defensive_rebounds),
    assists: numberValue(row.assists),
    turnovers: numberValue(row.turnovers),
    steals: numberValue(row.steals),
    blocks: numberValue(row.blocks),
    fouls: numberValue(row.fouls ?? null),
    plusMinus: numberValue(row.plus_minus),
  };
}

export async function loadCompetitionStatistics(
  client: SupabaseClient<Database>,
  context: CompetitionContext,
): Promise<CompetitionStatisticsDto> {
  if (context.statisticsMode !== "boxscore") {
    const source =
      context.statisticsMode === "scoresheet"
        ? "competition_scoresheet_player_statistics"
        : "competition_player_statistics";
    const result = await client
      .from(source)
      .select("*")
      .eq("competition_id", context.competitionId)
      .order("points", { ascending: false })
      .order("player_name");
    ensure(result.error);
    return {
      kind: "scoresheet",
      competitionId: context.competitionId,
      players: result.data.map((row) => {
        const gamesPlayed = numberValue(row.games_played);
        const points = nullableNumber(row.points);
        return {
          competitionId: row.competition_id as number,
          playerId: row.player_id as number,
          playerName: row.player_name as string,
          playerSlug: row.player_slug as string,
          teamName: row.team_name,
          teamSlug: row.team_slug,
          teamAbbreviation: row.team_abbreviation,
          gamesPlayed,
          dnpCount: "dnp_count" in row ? numberValue(row.dnp_count) : 0,
          points,
          pointsPerGame: points === null ? null : perGame(points, gamesPlayed),
          twoPointMade: nullableNumber(row.two_point_made),
          threePointMade: nullableNumber(row.three_point_made),
          freeThrowMade: nullableNumber(row.free_throw_made),
          fouls: "fouls" in row ? nullableNumber(row.fouls) : null,
          disqualifications:
            "disqualifications" in row ? nullableNumber(row.disqualifications) : null,
        };
      }),
    };
  }

  const [result, coverageResult] = await Promise.all([
    client
      .from("competition_boxscore_player_statistics")
      .select("*")
      .eq("competition_id", context.competitionId)
      .order("official_points", { ascending: false })
      .order("player_name"),
    client
      .from("competition_data_coverage")
      .select("final_games,participation_games,scoring_games,advanced_games,foul_games")
      .eq("competition_id", context.competitionId)
      .maybeSingle(),
  ]);
  ensure(result.error);
  ensure(coverageResult.error);
  const coverage = coverageResult.data;
  return {
    kind: "boxscore",
    competitionId: context.competitionId,
    coverage: {
      totalGames: numberValue(coverage?.final_games ?? null),
      participationGames: numberValue(coverage?.participation_games ?? null),
      scoringGames: numberValue(coverage?.scoring_games ?? null),
      advancedGames: numberValue(coverage?.advanced_games ?? null),
      foulGames: numberValue(coverage?.foul_games ?? null),
    },
    players: result.data.map((row) => {
      const advancedGamesPlayed = numberValue(row.advanced_games_played);
      return {
        competitionId: row.competition_id as number,
        playerId: row.player_id as number,
        playerName: row.player_name as string,
        playerSlug: row.player_slug as string,
        teamName: row.team_name,
        teamSlug: row.team_slug,
        teamAbbreviation: row.team_abbreviation,
        gamesPlayed: numberValue(row.games_played),
        advancedGamesPlayed,
        officialPoints: numberValue(row.official_points),
        fouls: nullableNumber(row.fouls),
        advancedTotals:
          advancedGamesPlayed === 0
            ? null
            : {
                ...totalsFromRow({ ...row, points: row.advanced_points }),
                games: advancedGamesPlayed,
              },
      };
    }),
  };
}

export async function loadPublicGameDetail(
  client: SupabaseClient<Database>,
  context: CompetitionContext,
  detailKey: string,
): Promise<PublicGameDetail | null> {
  if (!/^[1-9][0-9]*$/.test(detailKey)) return null;
  const gameId = Number(detailKey);
  const gameResult = await client
    .from("games")
    .select("id,competition_id,game_number,status,scheduled_at,venue")
    .eq("id", gameId)
    .eq("competition_id", context.competitionId)
    .in("status", ["scheduled", "live", "final"])
    .limit(2);
  ensure(gameResult.error);
  const game = gameResult.data.length === 1 ? gameResult.data[0] : null;
  if (!game) return null;

  const playerResultPromise =
    context.statisticsMode === "boxscore"
      ? client.from("game_boxscore_player_statistics").select("*").eq("game_id", gameId)
      : context.statisticsMode === "scoresheet"
        ? client.from("game_scoresheet_player_statistics").select("*").eq("game_id", gameId)
        : client.from("game_player_statistics").select("*").eq("game_id", gameId);

  const [
    participantsResult,
    scoresResult,
    periodScoresResult,
    playerResult,
    rosterSlotsResult,
    teamStatisticsResult,
    gameStatisticsResult,
    activeSourcesResult,
  ] = await Promise.all([
    client
      .from("game_participants")
      .select("registration_id,side")
      .eq("game_id", gameId)
      .eq("competition_id", context.competitionId),
    client
      .from("game_scores")
      .select("registration_id,side,score")
      .eq("game_id", gameId)
      .eq("competition_id", context.competitionId),
    client
      .from("game_period_scores")
      .select("registration_id,period_number,points")
      .eq("game_id", gameId)
      .order("period_number"),
    playerResultPromise,
    client.from("game_roster_slots").select("id,is_starter").eq("game_id", gameId),
    client.from("game_team_statistics").select("*").eq("game_id", gameId),
    client
      .from("game_statistics")
      .select("lead_changes,times_tied")
      .eq("game_id", gameId)
      .maybeSingle(),
    client.from("game_active_data_sources").select("domain,source_type").eq("game_id", gameId),
  ]);
  ensure(participantsResult.error);
  ensure(scoresResult.error);
  ensure(periodScoresResult.error);
  ensure(playerResult.error);
  ensure(rosterSlotsResult.error);
  ensure(teamStatisticsResult.error);
  ensure(gameStatisticsResult.error);
  ensure(activeSourcesResult.error);
  if (participantsResult.data.length !== 2) return null;

  const registrationIds = participantsResult.data.map((participant) => participant.registration_id);
  const registrationsResult = await client
    .from("team_registrations")
    .select("id,team_id")
    .eq("competition_id", context.competitionId)
    .in("id", registrationIds);
  ensure(registrationsResult.error);
  const teamsResult = await client
    .from("teams")
    .select("id,name,slug")
    .in(
      "id",
      registrationsResult.data.map((registration) => registration.team_id),
    )
    .eq("is_public", true);
  ensure(teamsResult.error);

  const registrationById = new Map(
    registrationsResult.data.map((registration) => [registration.id, registration]),
  );
  const teamById = new Map(teamsResult.data.map((team) => [team.id, team]));
  const starterBySlot = new Map(rosterSlotsResult.data.map((slot) => [slot.id, slot.is_starter]));
  const activeDomains = new Set(activeSourcesResult.data.map((source) => source.domain));
  const players: PublicGamePlayer[] = playerResult.data.map((row) => {
    const points =
      "official_points" in row ? row.official_points : "points" in row ? row.points : null;
    const hasAdvancedCoverage =
      "has_advanced_coverage" in row && Boolean(row.has_advanced_coverage);
    return {
      playerId: row.player_id as number,
      playerName: row.player_name as string,
      playerSlug: row.player_slug as string,
      teamId: row.team_id as number,
      side: row.side as "home" | "away",
      jerseyNumber: row.jersey_number as string,
      didNotPlay: row.did_not_play as boolean,
      isStarter:
        "is_starter" in row
          ? Boolean(row.is_starter)
          : (starterBySlot.get(row.game_roster_slot_id as number) ?? false),
      officialPoints: nullableNumber(points),
      fouls: nullableNumber(row.fouls),
      advancedTotals:
        hasAdvancedCoverage && "advanced_points" in row
          ? totalsFromRow({ ...row, points: row.advanced_points })
          : null,
    };
  });
  const totalsForTeam = (teamId: number): StatisticTotals | null => {
    const participatingPlayers = players.filter(
      (player) => player.teamId === teamId && !player.didNotPlay,
    );
    if (!participatingPlayers.length) return null;
    if (context.statisticsMode === "boxscore" && activeDomains.has("player_advanced")) {
      if (participatingPlayers.some((player) => player.advancedTotals === null)) return null;
      return sumStatisticTotals(
        participatingPlayers.flatMap((player) =>
          player.advancedTotals === null ? [] : [player.advancedTotals],
        ),
      );
    }
    if (
      !activeDomains.has("player_scoring") ||
      participatingPlayers.some((player) => player.officialPoints === null)
    ) {
      return null;
    }
    return sumStatisticTotals(
      participatingPlayers.map((player) => ({
        ...emptyStatisticTotals(),
        points: player.officialPoints ?? 0,
      })),
    );
  };
  const teams = participantsResult.data
    .map((participant): PublicGameTeam | null => {
      const registration = registrationById.get(participant.registration_id);
      const team = registration ? teamById.get(registration.team_id) : null;
      if (!registration || !team || (participant.side !== "home" && participant.side !== "away")) {
        return null;
      }
      return {
        registrationId: participant.registration_id,
        side: participant.side,
        teamId: team.id,
        teamName: team.name,
        teamSlug: team.slug,
        score:
          scoresResult.data.find((score) => score.registration_id === participant.registration_id)
            ?.score ?? 0,
        periodScores: periodScoresResult.data
          .filter((score) => score.registration_id === participant.registration_id)
          .map((score) => ({ periodNumber: score.period_number, points: score.points })),
        totals: (() => {
          return totalsForTeam(team.id);
        })(),
        pointsReconciled: (() => {
          const totals = totalsForTeam(team.id);
          const score = scoresResult.data.find(
            (item) => item.registration_id === participant.registration_id,
          )?.score;
          return score === undefined || score === null ? null : pointsReconcile(score, totals);
        })(),
        statistics: (() => {
          const statistics = teamStatisticsResult.data.find(
            (item) => item.registration_id === participant.registration_id,
          );
          return statistics && activeDomains.has("team_advanced")
            ? {
                pointsFromTurnovers: statistics.points_from_turnovers,
                pointsInPaint: statistics.points_in_paint,
                pointsInPaintMade: statistics.points_in_paint_made,
                pointsInPaintAttempted: statistics.points_in_paint_attempted,
                secondChancePoints: statistics.second_chance_points,
                fastBreakPoints: statistics.fast_break_points,
                fastBreakPointsFromTurnovers: statistics.fast_break_points_from_turnovers,
                benchPoints: statistics.bench_points,
                largestLead: statistics.largest_lead,
                largestScoringRun: statistics.largest_scoring_run,
                pointsPerPossession: statistics.points_per_possession,
                timeLeadingSeconds: statistics.time_leading_seconds,
              }
            : null;
        })(),
      };
    })
    .filter((team): team is PublicGameTeam => team !== null)
    .sort((left, right) => (left.side === "home" ? -1 : right.side === "home" ? 1 : 0));
  if (teams.length !== 2) return null;

  return {
    id: game.id,
    competitionId: context.competitionId,
    label: game.game_number ? `Jogo ${game.game_number}` : `Jogo ${game.id}`,
    status: game.status,
    scheduledAt: game.scheduled_at,
    venue: game.venue,
    advanced: context.statisticsMode === "boxscore" && activeDomains.has("player_advanced"),
    teams: teams as [PublicGameTeam, PublicGameTeam],
    gameStatistics:
      gameStatisticsResult.data && activeDomains.has("game_advanced")
        ? {
            leadChanges: gameStatisticsResult.data.lead_changes,
            timesTied: gameStatisticsResult.data.times_tied,
          }
        : null,
    players,
  };
}
