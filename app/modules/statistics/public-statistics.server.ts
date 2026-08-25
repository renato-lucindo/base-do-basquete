import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/database.generated";
import type { CompetitionContext } from "../competition/context";
import {
  categoryCapabilities,
  perGame,
  type PlayerStatistics,
  type StatisticTotals,
} from "./domain";
import { pointsReconcile, sumStatisticTotals } from "./game-detail-domain";

export interface SimplePlayerStatistics {
  competitionId: number;
  playerId: number;
  playerName: string;
  playerSlug: string;
  teamName: string | null;
  teamSlug: string | null;
  teamAbbreviation: string | null;
  gamesPlayed: number;
  points: number;
  pointsPerGame: number | null;
}

export type CompetitionStatisticsDto =
  | {
      kind: "simple";
      competitionId: number;
      players: SimplePlayerStatistics[];
    }
  | {
      kind: "advanced";
      competitionId: number;
      players: PlayerStatistics[];
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
  fouls: number;
  totals: StatisticTotals;
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
  const capabilities = categoryCapabilities(context.category.hasAdvancedStats);
  if (!capabilities.advanced) {
    const result = await client
      .from("competition_player_statistics")
      .select(
        "competition_id,player_id,player_name,player_slug,team_name,team_slug,team_abbreviation,games_played,points",
      )
      .eq("competition_id", context.competitionId)
      .order("points", { ascending: false })
      .order("player_name");
    ensure(result.error);
    return {
      kind: "simple",
      competitionId: context.competitionId,
      players: result.data.map((row) => {
        const gamesPlayed = numberValue(row.games_played);
        const points = numberValue(row.points);
        return {
          competitionId: row.competition_id as number,
          playerId: row.player_id as number,
          playerName: row.player_name as string,
          playerSlug: row.player_slug as string,
          teamName: row.team_name,
          teamSlug: row.team_slug,
          teamAbbreviation: row.team_abbreviation,
          gamesPlayed,
          points,
          pointsPerGame: perGame(points, gamesPlayed),
        };
      }),
    };
  }

  const result = await client
    .from("competition_player_statistics")
    .select("*")
    .eq("competition_id", context.competitionId)
    .order("points", { ascending: false })
    .order("player_name");
  ensure(result.error);
  return {
    kind: "advanced",
    competitionId: context.competitionId,
    players: result.data.map((row) => ({
      competitionId: row.competition_id as number,
      playerId: row.player_id as number,
      playerName: row.player_name as string,
      playerSlug: row.player_slug as string,
      teamName: row.team_name,
      teamSlug: row.team_slug,
      teamAbbreviation: row.team_abbreviation,
      gamesPlayed: numberValue(row.games_played),
      totals: totalsFromRow(row),
    })),
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

  const [
    participantsResult,
    scoresResult,
    periodScoresResult,
    playerResult,
    rosterSlotsResult,
    teamStatisticsResult,
    gameStatisticsResult,
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
    client.from("game_player_statistics").select("*").eq("game_id", gameId),
    client.from("game_roster_slots").select("id,is_starter").eq("game_id", gameId),
    client.from("game_team_statistics").select("*").eq("game_id", gameId),
    client
      .from("game_statistics")
      .select("lead_changes,times_tied")
      .eq("game_id", gameId)
      .maybeSingle(),
  ]);
  ensure(participantsResult.error);
  ensure(scoresResult.error);
  ensure(periodScoresResult.error);
  ensure(playerResult.error);
  ensure(rosterSlotsResult.error);
  ensure(teamStatisticsResult.error);
  ensure(gameStatisticsResult.error);
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
  const players: PublicGamePlayer[] = playerResult.data.map((row) => ({
    playerId: row.player_id as number,
    playerName: row.player_name as string,
    playerSlug: row.player_slug as string,
    teamId: row.team_id as number,
    side: row.side as "home" | "away",
    jerseyNumber: row.jersey_number as string,
    didNotPlay: row.did_not_play as boolean,
    isStarter: starterBySlot.get(row.game_roster_slot_id as number) ?? false,
    fouls: numberValue(row.fouls),
    totals: totalsFromRow(row),
  }));
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
          const teamPlayers = players.filter((player) => player.teamId === team.id);
          return teamPlayers.length
            ? sumStatisticTotals(teamPlayers.map((player) => player.totals))
            : null;
        })(),
        pointsReconciled: (() => {
          const teamPlayers = players.filter((player) => player.teamId === team.id);
          const totals = teamPlayers.length
            ? sumStatisticTotals(teamPlayers.map((player) => player.totals))
            : null;
          const score = scoresResult.data.find(
            (item) => item.registration_id === participant.registration_id,
          )?.score;
          return score === undefined || score === null ? null : pointsReconcile(score, totals);
        })(),
        statistics: (() => {
          const statistics = teamStatisticsResult.data.find(
            (item) => item.registration_id === participant.registration_id,
          );
          return statistics
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
    advanced: categoryCapabilities(context.category.hasAdvancedStats).advanced,
    teams: teams as [PublicGameTeam, PublicGameTeam],
    gameStatistics: gameStatisticsResult.data
      ? {
          leadChanges: gameStatisticsResult.data.lead_changes,
          timesTied: gameStatisticsResult.data.times_tied,
        }
      : null,
    players,
  };
}
