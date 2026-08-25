import type { SupabaseClient } from "@supabase/supabase-js";
import { data } from "react-router";

import type { Database } from "../../types/database.generated";
import type { CompetitionContext } from "../competition/context";
import type { PublicAchievement } from "../competition/public-data.server";
import { addPlayerTotals, type PlayerTotals } from "./player-profile-domain";

export interface PlayerCompetitionSummary extends PlayerTotals {
  context: CompetitionContext;
  teamName: string | null;
  teamSlug: string | null;
  teamAbbreviation: string | null;
  jerseyNumber: string | null;
  position: string | null;
  starterAppearances: number;
}

export interface PublicPlayerProfileDto {
  id: number;
  fullName: string;
  slug: string;
  nickname: string | null;
  birthYear: number | null;
  bio: string | null;
  heightCm: number | null;
  weightKg: number | null;
  mainPosition: string | null;
  hand: string | null;
  homeCity: string | null;
  homeState: string | null;
  current: PlayerCompetitionSummary | null;
  career: PlayerTotals;
  competitions: PlayerCompetitionSummary[];
  achievements: PublicAchievement[];
  honors: Array<{
    id: number;
    title: string;
    description: string | null;
    year: number | null;
    competitionName: string | null;
  }>;
  games: Array<{
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
    totals: PlayerTotals;
  }>;
}

function ensure(error: unknown, statusText: string): asserts error is null {
  if (error) throw data(null, { status: 503, statusText });
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
    plusMinus: numberValue(row.plus_minus),
  };
}

export async function loadPublicPlayerProfile(
  client: SupabaseClient<Database>,
  context: CompetitionContext,
  contexts: CompetitionContext[],
  slug: string,
): Promise<PublicPlayerProfileDto | null> {
  const profileResult = await client
    .from("public_player_profiles")
    .select(
      "id,full_name,slug,nickname,birth_year,bio,height_cm,weight_kg,main_position,hand,home_city,home_state,is_public",
    )
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
          weight_kg: null,
          main_position: null,
          hand: null,
          home_city: null,
          home_state: null,
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

  const statisticsResult = await client
    .from("competition_player_statistics")
    .select("*")
    .eq("player_id", profile.id);
  ensure(statisticsResult.error, "Estatísticas públicas temporariamente indisponíveis");

  const contextById = new Map(contexts.map((item) => [item.competitionId, item]));
  const competitions = statisticsResult.data
    .flatMap((row): PlayerCompetitionSummary[] => {
      const rowContext = row.competition_id ? contextById.get(row.competition_id) : undefined;
      if (!rowContext) return [];
      return [
        {
          context: rowContext,
          teamName: row.team_name,
          teamSlug: row.team_slug,
          teamAbbreviation: row.team_abbreviation,
          jerseyNumber: row.jersey_number,
          position: row.roster_position,
          starterAppearances: numberValue(row.starter_appearances),
          games: numberValue(row.games_played),
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
          plusMinus: numberValue(row.plus_minus),
        },
      ];
    })
    .sort(
      (left, right) =>
        right.context.year - left.context.year ||
        right.context.competitionId - left.context.competitionId,
    );

  const [honorsResult, gameStatisticsResult, achievementsResult] = await Promise.all([
    client
      .from("player_honors")
      .select("id,title,description,year,competition_id,status,confirmed_at")
      .eq("player_id", profile.id)
      .eq("status", "confirmed")
      .not("confirmed_at", "is", null)
      .order("year", { ascending: false, nullsFirst: false }),
    client.from("game_player_statistics").select("*").eq("player_id", profile.id),
    client
      .from("player_achievements")
      .select(
        "competition_id,competition_display_name,series_name,series_slug,year,category_name,category_slug,placement,result_label,team_name,team_slug",
      )
      .eq("player_id", profile.id)
      .order("year", { ascending: false }),
  ]);
  ensure(gameStatisticsResult.error, "Participações públicas temporariamente indisponíveis");

  const gameIds = gameStatisticsResult.data.flatMap((row) =>
    row.game_id === null ? [] : [row.game_id],
  );
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

  const statByGame = new Map(
    gameStatisticsResult.data.flatMap((row) =>
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
    weightKg: profile.weight_kg,
    mainPosition: profile.main_position,
    hand: profile.hand,
    homeCity: profile.home_city,
    homeState: profile.home_state,
    current:
      competitions.find((item) => item.context.competitionId === context.competitionId) ?? null,
    career: addPlayerTotals(competitions),
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
    games: gameResult.data.flatMap((game) => {
      const rowContext = contextById.get(game.competition_id);
      const stats = statByGame.get(game.id);
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
      return [
        {
          id: game.id,
          label: game.game_number ? `Jogo ${game.game_number}` : `Jogo ${game.id}`,
          status: game.status,
          scheduledAt: game.scheduled_at,
          context: rowContext,
          teamName: stats.team_name,
          jerseyNumber: stats.jersey_number,
          opponentName: opponent?.name ?? null,
          result,
          score:
            ownScore == null || opponentScore == null ? null : `${ownScore} × ${opponentScore}`,
          totals: totalsFromRow(stats),
        },
      ];
    }),
  };
}
