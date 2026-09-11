export type PublicGameStatus = "scheduled" | "live" | "final";

export interface PublicTeamSummary {
  id: number;
  name: string;
  slug: string;
  abbreviation: string | null;
}

export interface PublicGameSummary {
  id: number;
  label: string;
  status: PublicGameStatus;
  scheduledAt: string | null;
  venue: string | null;
  home: PublicTeamSummary;
  away: PublicTeamSummary;
  homeScore: number | null;
  awayScore: number | null;
  structure?: {
    trackCode: string | null;
    stageCode: string | null;
    stageName: string | null;
    roundCode: string | null;
    roundName: string | null;
    roundOrder: number | null;
    matchupCode: string | null;
    matchupOrder: number | null;
  };
}

export interface StandingRow extends PublicTeamSummary {
  position: number;
  games: number;
  wins: number;
  losses: number;
  winPercentage: number | null;
  pointsFor: number;
  pointsAgainst: number;
  pointDifference: number;
}

export interface TeamStatisticsRow extends PublicTeamSummary {
  games: number;
  pointsPerGame: number | null;
  reboundsPerGame: number | null;
  assistsPerGame: number | null;
  fieldGoalPercentage: number | null;
  threePointPercentage: number | null;
  freeThrowPercentage: number | null;
  efficiencyPerGame: number | null;
}

function rounded(value: number): number {
  return Math.round(value * 10) / 10;
}

function ratio(value: number, denominator: number): number | null {
  return denominator === 0 ? null : rounded(value / denominator);
}

function percent(made: number, attempted: number): number | null {
  return attempted === 0 ? null : rounded((made / attempted) * 100);
}

export function gameScoreLabel(game: PublicGameSummary): string {
  if (game.status === "scheduled") return "Placar disponível após o início";
  if (game.homeScore === null || game.awayScore === null) return "Placar indisponível";
  return `${game.homeScore} × ${game.awayScore}`;
}

export function splitGames(games: PublicGameSummary[]): {
  upcoming: PublicGameSummary[];
  finished: PublicGameSummary[];
} {
  const timestamp = (game: PublicGameSummary) =>
    game.scheduledAt ? Date.parse(game.scheduledAt) : Number.POSITIVE_INFINITY;
  return {
    upcoming: games
      .filter((game) => game.status !== "final")
      .sort((left, right) => timestamp(left) - timestamp(right) || left.id - right.id),
    finished: games
      .filter((game) => game.status === "final")
      .sort((left, right) => timestamp(right) - timestamp(left) || right.id - left.id),
  };
}

export function calculateStandings(
  teams: PublicTeamSummary[],
  games: PublicGameSummary[],
): StandingRow[] {
  const rows = new Map<number, Omit<StandingRow, "position">>(
    teams.map((team) => [
      team.id,
      {
        ...team,
        games: 0,
        wins: 0,
        losses: 0,
        winPercentage: null,
        pointsFor: 0,
        pointsAgainst: 0,
        pointDifference: 0,
      },
    ]),
  );

  const finalGames = games.filter(
    (game) =>
      game.status === "final" &&
      game.homeScore !== null &&
      game.awayScore !== null &&
      game.homeScore !== game.awayScore,
  );

  for (const game of finalGames) {
    const home = rows.get(game.home.id);
    const away = rows.get(game.away.id);
    if (!home || !away || game.homeScore === null || game.awayScore === null) continue;
    home.games += 1;
    away.games += 1;
    home.pointsFor += game.homeScore;
    home.pointsAgainst += game.awayScore;
    away.pointsFor += game.awayScore;
    away.pointsAgainst += game.homeScore;
    if (game.homeScore > game.awayScore) {
      home.wins += 1;
      away.losses += 1;
    } else {
      away.wins += 1;
      home.losses += 1;
    }
  }

  const directWins = (teamId: number, opponentId: number) =>
    finalGames.filter((game) => {
      if (
        !(
          (game.home.id === teamId && game.away.id === opponentId) ||
          (game.home.id === opponentId && game.away.id === teamId)
        ) ||
        game.homeScore === null ||
        game.awayScore === null
      ) {
        return false;
      }
      return game.homeScore > game.awayScore ? game.home.id === teamId : game.away.id === teamId;
    }).length;

  return [...rows.values()]
    .map((row) => ({
      ...row,
      winPercentage: ratio(row.wins * 100, row.games),
      pointDifference: row.pointsFor - row.pointsAgainst,
    }))
    .sort(
      (left, right) =>
        right.wins - left.wins ||
        directWins(right.id, left.id) - directWins(left.id, right.id) ||
        right.pointDifference - left.pointDifference ||
        right.pointsFor - left.pointsFor ||
        left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" }),
    )
    .map((row, index) => ({ ...row, position: index + 1 }));
}

export interface TeamStatisticInput extends PublicTeamSummary {
  games: number;
  points: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  assists: number;
  twoPointMade: number;
  twoPointAttempted: number;
  threePointMade: number;
  threePointAttempted: number;
  freeThrowMade: number;
  freeThrowAttempted: number;
  efficiency: number;
}

export function summarizeTeamStatistics(input: TeamStatisticInput): TeamStatisticsRow {
  const fieldMade = input.twoPointMade + input.threePointMade;
  const fieldAttempted = input.twoPointAttempted + input.threePointAttempted;
  return {
    id: input.id,
    name: input.name,
    slug: input.slug,
    abbreviation: input.abbreviation,
    games: input.games,
    pointsPerGame: ratio(input.points, input.games),
    reboundsPerGame: ratio(input.offensiveRebounds + input.defensiveRebounds, input.games),
    assistsPerGame: ratio(input.assists, input.games),
    fieldGoalPercentage: percent(fieldMade, fieldAttempted),
    threePointPercentage: percent(input.threePointMade, input.threePointAttempted),
    freeThrowPercentage: percent(input.freeThrowMade, input.freeThrowAttempted),
    efficiencyPerGame: ratio(input.efficiency, input.games),
  };
}
