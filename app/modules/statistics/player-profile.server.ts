import type { SupabaseClient } from "@supabase/supabase-js";
import { data } from "react-router";

import type { Database } from "../../types/database.generated";
import { type CompetitionContext, isGenderDivision } from "../competition/context";
import type { PublicAchievement } from "../competition/public-data.server";
import type {
  BoxscoreStatisticsPlayerRow,
  BoxscoreStatisticsPageDto,
} from "./boxscore-statistics-domain";
import { loadBoxscoreStatisticsPage } from "./boxscore-statistics.server";
import {
  type BoxscoreGameScope,
  type BoxscoreStatisticsMode,
  parseBoxscoreGameScope,
  parseBoxscoreStatisticsMode,
} from "./boxscore-statistics-contract";
import type { PlayerTotals } from "./player-profile-domain";

interface PlayerCompetitionBase {
  context: CompetitionContext;
  teamName: string | null;
  teamSlug: string | null;
  teamAbbreviation: string | null;
  jerseyNumber: string | null;
  position: string | null;
  starterAppearances: number;
}

export interface ScoresheetPlayerCompetitionSummary extends PlayerCompetitionBase {
  kind: "scoresheet";
  games: number;
  dnpCount: number;
  points: number | null;
  twoPointMade: number | null;
  threePointMade: number | null;
  freeThrowMade: number | null;
  fouls: number | null;
  disqualifications: number | null;
}

export interface BoxscorePlayerCompetitionSummary extends PlayerCompetitionBase {
  kind: "boxscore";
  games: number;
  advancedGames: number;
  officialPoints: number;
  fouls: number | null;
  advancedTotals: PlayerTotals | null;
}

export type PlayerCompetitionSummary =
  | ScoresheetPlayerCompetitionSummary
  | BoxscorePlayerCompetitionSummary;

interface PlayerGameBase {
  id: number;
  label: string;
  status: string;
  scheduledAt: string | null;
  context: CompetitionContext;
  teamName: string | null;
  jerseyNumber: string | null;
  opponentName: string | null;
  result: string | null;
  score: string | null;
  didNotPlay: boolean;
}

export interface ScoresheetPlayerGame extends PlayerGameBase {
  kind: "scoresheet";
  points: number | null;
  twoPointMade: number | null;
  threePointMade: number | null;
  freeThrowMade: number | null;
  fouls: number | null;
  disqualifications: number | null;
}

export interface BoxscorePlayerGame extends PlayerGameBase {
  kind: "boxscore";
  officialPoints: number | null;
  fouls: number | null;
  advancedTotals: PlayerTotals | null;
}

export type PublicPlayerGame = ScoresheetPlayerGame | BoxscorePlayerGame;

export interface PublicPlayerProfileDto {
  id: number;
  fullName: string;
  slug: string;
  nickname: string | null;
  birthYear: number | null;
  bio: string | null;
  heightCm: number | null;
  mainPosition: string | null;
  hand: string | null;
  current: PlayerCompetitionSummary | null;
  selection: {
    mode: BoxscoreStatisticsMode;
    scope: BoxscoreGameScope;
  };
  currentBoxscore: {
    row: BoxscoreStatisticsPlayerRow | null;
    per30MinimumSeconds: number;
    coverage: BoxscoreStatisticsPageDto["coverage"];
  } | null;
  competitions: PlayerCompetitionSummary[];
  achievements: PublicAchievement[];
  honors: Array<{
    id: number;
    title: string;
    description: string | null;
    year: number | null;
    competitionName: string | null;
  }>;
  games: PublicPlayerGame[];
}

function ensure(error: unknown, statusText: string): asserts error is null {
  if (error) throw data(null, { status: 503, statusText });
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
  fouls: number | null;
  plus_minus: number | null;
}): PlayerTotals {
  return {
    games: 1,
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
    fouls: numberValue(row.fouls),
    plusMinus: row.plus_minus,
  };
}

export async function loadPublicPlayerProfile(
  client: SupabaseClient<Database>,
  context: CompetitionContext,
  contexts: CompetitionContext[],
  slug: string,
  searchParams = new URLSearchParams(),
): Promise<PublicPlayerProfileDto | null> {
  const profileResult = await client
    .from("public_player_profiles")
    .select("id,full_name,slug,nickname,birth_year,bio,height_cm,main_position,hand,is_public")
    .eq("slug", slug)
    .eq("is_public", true)
    .limit(2);
  let profile =
    !profileResult.error && profileResult.data.length === 1 ? profileResult.data[0] : null;
  if (profileResult.error) {
    const legacyResult = await client
      .from("players")
      .select("id,full_name,slug,is_public")
      .eq("slug", slug)
      .eq("is_public", true)
      .limit(2);
    ensure(legacyResult.error, "Perfil público temporariamente indisponível");
    const legacy = legacyResult.data.length === 1 ? legacyResult.data[0] : null;
    profile = legacy
      ? {
          ...legacy,
          nickname: null,
          birth_year: null,
          bio: null,
          height_cm: null,
          main_position: null,
          hand: null,
        }
      : null;
  }
  if (!profile?.id || !profile.full_name || !profile.slug) return null;

  const rosterResult = await client
    .from("roster_entries")
    .select("id")
    .eq("competition_id", context.competitionId)
    .eq("player_id", profile.id)
    .eq("status", "active")
    .limit(1);
  ensure(rosterResult.error, "Inscrição pública temporariamente indisponível");
  if (rosterResult.data.length !== 1) return null;

  const selection = {
    mode: parseBoxscoreStatisticsMode(searchParams.get("mode")),
    scope: parseBoxscoreGameScope(searchParams.get("scope")),
  };
  const snapshotParams = new URLSearchParams();
  if (selection.mode !== "per-game") snapshotParams.set("mode", selection.mode);
  if (selection.scope !== "regular") snapshotParams.set("scope", selection.scope);
  snapshotParams.set("compare", String(profile.id));

  const contextById = new Map(contexts.map((item) => [item.competitionId, item]));
  const [
    scoresheetStatisticsResult,
    boxscoreStatisticsResult,
    legacyStatisticsResult,
    currentBoxscorePage,
  ] = await Promise.all([
    client.from("competition_scoresheet_player_statistics").select("*").eq("player_id", profile.id),
    client.from("competition_boxscore_player_statistics").select("*").eq("player_id", profile.id),
    client.from("competition_player_statistics").select("*").eq("player_id", profile.id),
    context.statisticsMode === "boxscore"
      ? loadBoxscoreStatisticsPage(client, context, snapshotParams)
      : Promise.resolve(null),
  ]);
  ensure(scoresheetStatisticsResult.error, "Estatísticas básicas temporariamente indisponíveis");
  ensure(boxscoreStatisticsResult.error, "Estatísticas detalhadas temporariamente indisponíveis");
  ensure(legacyStatisticsResult.error, "Estatísticas públicas temporariamente indisponíveis");

  const scoresheetCompetitions = scoresheetStatisticsResult.data.flatMap(
    (row): PlayerCompetitionSummary[] => {
      const rowContext = row.competition_id ? contextById.get(row.competition_id) : undefined;
      if (rowContext?.statisticsMode !== "scoresheet") return [];
      return [
        {
          kind: "scoresheet",
          context: rowContext,
          teamName: row.team_name,
          teamSlug: row.team_slug,
          teamAbbreviation: row.team_abbreviation,
          jerseyNumber: row.jersey_number,
          position: row.roster_position,
          starterAppearances: numberValue(row.starter_appearances),
          games: numberValue(row.games_played),
          dnpCount: numberValue(row.dnp_count),
          points: nullableNumber(row.points),
          twoPointMade: nullableNumber(row.two_point_made),
          threePointMade: nullableNumber(row.three_point_made),
          freeThrowMade: nullableNumber(row.free_throw_made),
          fouls: nullableNumber(row.fouls),
          disqualifications: nullableNumber(row.disqualifications),
        },
      ];
    },
  );
  const boxscoreCompetitions = boxscoreStatisticsResult.data.flatMap(
    (row): PlayerCompetitionSummary[] => {
      const rowContext = row.competition_id ? contextById.get(row.competition_id) : undefined;
      if (rowContext?.statisticsMode !== "boxscore") return [];
      const advancedGames = numberValue(row.advanced_games_played);
      return [
        {
          kind: "boxscore",
          context: rowContext,
          teamName: row.team_name,
          teamSlug: row.team_slug,
          teamAbbreviation: row.team_abbreviation,
          jerseyNumber: row.jersey_number,
          position: row.roster_position,
          starterAppearances: numberValue(row.starter_appearances),
          games: numberValue(row.games_played),
          advancedGames,
          officialPoints: numberValue(row.official_points),
          fouls: nullableNumber(row.fouls),
          advancedTotals:
            advancedGames === 0
              ? null
              : {
                  ...totalsFromRow({ ...row, points: row.advanced_points }),
                  games: advancedGames,
                },
        },
      ];
    },
  );
  const legacyCompetitions = legacyStatisticsResult.data.flatMap(
    (row): PlayerCompetitionSummary[] => {
      const rowContext = row.competition_id ? contextById.get(row.competition_id) : undefined;
      if (rowContext?.statisticsMode !== "legacy") return [];
      return [
        {
          kind: "scoresheet",
          context: rowContext,
          teamName: row.team_name,
          teamSlug: row.team_slug,
          teamAbbreviation: row.team_abbreviation,
          jerseyNumber: row.jersey_number,
          position: row.roster_position,
          starterAppearances: numberValue(row.starter_appearances),
          games: numberValue(row.games_played),
          dnpCount: 0,
          points: nullableNumber(row.points),
          twoPointMade: nullableNumber(row.two_point_made),
          threePointMade: nullableNumber(row.three_point_made),
          freeThrowMade: nullableNumber(row.free_throw_made),
          fouls: nullableNumber(row.fouls),
          disqualifications: null,
        },
      ];
    },
  );
  const competitions = [
    ...scoresheetCompetitions,
    ...boxscoreCompetitions,
    ...legacyCompetitions,
  ].sort(
    (left, right) =>
      right.context.year - left.context.year ||
      right.context.competitionId - left.context.competitionId,
  );

  const [
    honorsResult,
    scoresheetGameStatisticsResult,
    boxscoreGameStatisticsResult,
    legacyGameStatisticsResult,
    achievementsResult,
  ] = await Promise.all([
    client
      .from("player_honors")
      .select("id,title,description,year,competition_id,status,confirmed_at")
      .eq("player_id", profile.id)
      .eq("status", "confirmed")
      .not("confirmed_at", "is", null)
      .order("year", { ascending: false, nullsFirst: false }),
    client.from("game_scoresheet_player_statistics").select("*").eq("player_id", profile.id),
    client.from("game_boxscore_player_statistics").select("*").eq("player_id", profile.id),
    client.from("game_player_statistics").select("*").eq("player_id", profile.id),
    client
      .from("player_achievements")
      .select(
        "competition_id,competition_display_name,series_name,series_slug,year,category_name,category_slug,gender_division,placement,result_label,team_name,team_slug",
      )
      .eq("player_id", profile.id)
      .order("year", { ascending: false }),
  ]);
  ensure(
    scoresheetGameStatisticsResult.error,
    "Participações básicas temporariamente indisponíveis",
  );
  ensure(
    boxscoreGameStatisticsResult.error,
    "Participações detalhadas temporariamente indisponíveis",
  );
  ensure(legacyGameStatisticsResult.error, "Participações públicas temporariamente indisponíveis");

  const gameIds = [
    ...scoresheetGameStatisticsResult.data,
    ...boxscoreGameStatisticsResult.data,
    ...legacyGameStatisticsResult.data,
  ].flatMap((row) => (row.game_id === null ? [] : [row.game_id]));
  const gameResult = gameIds.length
    ? await client
        .from("games")
        .select("id,competition_id,game_number,status,scheduled_at")
        .in("id", gameIds)
        .in("status", ["live", "final"])
        .order("scheduled_at", { ascending: false, nullsFirst: false })
    : { data: [], error: null };
  ensure(gameResult.error, "Jogos públicos temporariamente indisponíveis");

  const participantsResult = gameIds.length
    ? await client
        .from("game_participants")
        .select("game_id,registration_id,side")
        .in("game_id", gameIds)
    : { data: [], error: null };
  ensure(participantsResult.error, "Adversários temporariamente indisponíveis");
  const registrationIds = participantsResult.data.map((item) => item.registration_id);
  const registrationsResult = registrationIds.length
    ? await client.from("team_registrations").select("id,team_id").in("id", registrationIds)
    : { data: [], error: null };
  ensure(registrationsResult.error, "Equipes temporariamente indisponíveis");
  const teamIds = registrationsResult.data.map((item) => item.team_id);
  const teamsResult = teamIds.length
    ? await client.from("teams").select("id,name").in("id", teamIds).eq("is_public", true)
    : { data: [], error: null };
  ensure(teamsResult.error, "Equipes temporariamente indisponíveis");
  const scoresResult = gameIds.length
    ? await client
        .from("game_scores")
        .select("game_id,registration_id,score")
        .in("game_id", gameIds)
    : { data: [], error: null };
  ensure(scoresResult.error, "Resultados temporariamente indisponíveis");

  const scoresheetStatByGame = new Map(
    scoresheetGameStatisticsResult.data.flatMap((row) =>
      row.game_id === null ? [] : ([[row.game_id, row]] as const),
    ),
  );
  const boxscoreStatByGame = new Map(
    boxscoreGameStatisticsResult.data.flatMap((row) =>
      row.game_id === null ? [] : ([[row.game_id, row]] as const),
    ),
  );
  const legacyStatByGame = new Map(
    legacyGameStatisticsResult.data.flatMap((row) =>
      row.game_id === null ? [] : ([[row.game_id, row]] as const),
    ),
  );
  const registrationById = new Map(registrationsResult.data.map((item) => [item.id, item]));
  const teamById = new Map(teamsResult.data.map((item) => [item.id, item]));

  return {
    id: profile.id,
    fullName: profile.full_name,
    slug: profile.slug,
    nickname: profile.nickname,
    birthYear: profile.birth_year,
    bio: profile.bio,
    heightCm: profile.height_cm,
    mainPosition: profile.main_position,
    hand: profile.hand,
    current:
      competitions.find((item) => item.context.competitionId === context.competitionId) ?? null,
    selection,
    currentBoxscore: currentBoxscorePage
      ? {
          row: currentBoxscorePage.compared.find((item) => item.playerId === profile.id) ?? null,
          per30MinimumSeconds: currentBoxscorePage.per30MinimumSeconds,
          coverage: currentBoxscorePage.coverage,
        }
      : null,
    competitions,
    achievements: achievementsResult.error
      ? []
      : achievementsResult.data.flatMap((achievement): PublicAchievement[] => {
          if (
            achievement.competition_id === null ||
            achievement.competition_display_name === null ||
            achievement.series_name === null ||
            achievement.series_slug === null ||
            achievement.year === null ||
            achievement.category_name === null ||
            achievement.category_slug === null ||
            (achievement.gender_division !== null &&
              !isGenderDivision(achievement.gender_division)) ||
            achievement.placement === null
          ) {
            return [];
          }
          return [
            {
              competitionId: achievement.competition_id,
              competitionDisplayName: achievement.competition_display_name,
              seriesName: achievement.series_name,
              seriesSlug: achievement.series_slug,
              year: achievement.year,
              categoryName: achievement.category_name,
              categorySlug: achievement.category_slug,
              genderDivision: isGenderDivision(achievement.gender_division)
                ? achievement.gender_division
                : null,
              placement: achievement.placement,
              resultLabel: achievement.result_label,
              teamName: achievement.team_name ?? undefined,
              teamSlug: achievement.team_slug ?? undefined,
            },
          ];
        }),
    honors: (honorsResult.error ? [] : honorsResult.data).map((honor) => ({
      id: honor.id,
      title: honor.title,
      description: honor.description,
      year: honor.year,
      competitionName:
        honor.competition_id === null
          ? null
          : (contextById.get(honor.competition_id)?.displayName ?? null),
    })),
    games: gameResult.data.flatMap((game): PublicPlayerGame[] => {
      const rowContext = contextById.get(game.competition_id);
      const scoresheetStats = scoresheetStatByGame.get(game.id);
      const boxscoreStats = boxscoreStatByGame.get(game.id);
      const legacyStats = legacyStatByGame.get(game.id);
      const stats =
        rowContext?.statisticsMode === "boxscore"
          ? boxscoreStats
          : rowContext?.statisticsMode === "scoresheet"
            ? scoresheetStats
            : legacyStats;
      if (!rowContext || !stats) return [];
      const participants = participantsResult.data.filter((item) => item.game_id === game.id);
      const ownParticipant = participants.find(
        (item) => registrationById.get(item.registration_id)?.team_id === stats.team_id,
      );
      const opponentParticipant = participants.find(
        (item) => item.registration_id !== ownParticipant?.registration_id,
      );
      const opponentRegistration = opponentParticipant
        ? registrationById.get(opponentParticipant.registration_id)
        : null;
      const opponent = opponentRegistration ? teamById.get(opponentRegistration.team_id) : null;
      const ownScore = scoresResult.data.find(
        (item) =>
          item.game_id === game.id && item.registration_id === ownParticipant?.registration_id,
      )?.score;
      const opponentScore = scoresResult.data.find(
        (item) =>
          item.game_id === game.id && item.registration_id === opponentParticipant?.registration_id,
      )?.score;
      const result =
        game.status !== "final" || ownScore == null || opponentScore == null
          ? "Em andamento"
          : ownScore > opponentScore
            ? "Vitória"
            : ownScore < opponentScore
              ? "Derrota"
              : "Empate";
      const base = {
        id: game.id,
        label: game.game_number ? `Jogo ${game.game_number}` : `Jogo ${game.id}`,
        status: game.status,
        scheduledAt: game.scheduled_at,
        context: rowContext,
        teamName: stats.team_name,
        jerseyNumber: stats.jersey_number,
        opponentName: opponent?.name ?? null,
        result,
        score: ownScore == null || opponentScore == null ? null : `${ownScore} × ${opponentScore}`,
        didNotPlay: Boolean(stats.did_not_play),
      };
      if (rowContext.statisticsMode === "boxscore" && boxscoreStats) {
        return [
          {
            ...base,
            kind: "boxscore" as const,
            officialPoints: nullableNumber(boxscoreStats.official_points),
            fouls: nullableNumber(boxscoreStats.fouls),
            advancedTotals: boxscoreStats.has_advanced_coverage
              ? totalsFromRow({ ...boxscoreStats, points: boxscoreStats.advanced_points })
              : null,
          },
        ];
      }
      if (rowContext.statisticsMode === "scoresheet" && scoresheetStats) {
        return [
          {
            ...base,
            kind: "scoresheet" as const,
            points: nullableNumber(scoresheetStats.points),
            twoPointMade: nullableNumber(scoresheetStats.two_point_made),
            threePointMade: nullableNumber(scoresheetStats.three_point_made),
            freeThrowMade: nullableNumber(scoresheetStats.free_throw_made),
            fouls: nullableNumber(scoresheetStats.fouls),
            disqualifications: nullableNumber(scoresheetStats.disqualifications),
          },
        ];
      }
      if (!legacyStats) return [];
      return [
        {
          ...base,
          kind: "scoresheet" as const,
          points: nullableNumber(legacyStats.points),
          twoPointMade: nullableNumber(legacyStats.two_point_made),
          threePointMade: nullableNumber(legacyStats.three_point_made),
          freeThrowMade: nullableNumber(legacyStats.free_throw_made),
          fouls: nullableNumber(legacyStats.fouls),
          disqualifications: null,
        },
      ];
    }),
  };
}
