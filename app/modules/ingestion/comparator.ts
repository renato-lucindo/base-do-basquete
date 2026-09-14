export type IngestionPlayer = {
  playerId: number;
  jerseyNumber?: string | null;
  points?: number | null;
  twoPointMade?: number | null;
  threePointMade?: number | null;
  freeThrowMade?: number | null;
};

export type IngestionTeam = {
  registrationId: number;
  score?: number | null;
  periodScores?: number[] | null;
  players?: IngestionPlayer[] | null;
};

export type IngestionGame = {
  competitionId: number;
  gameNumber?: string | null;
  home: IngestionTeam;
  away: IngestionTeam;
};

export type IngestionComparisonIssue = {
  code: string;
  message: string;
  path: string;
  expected?: unknown;
  actual?: unknown;
};

export type IngestionComparison = {
  compatible: boolean;
  sideInverted: boolean;
  errors: IngestionComparisonIssue[];
  warnings: IngestionComparisonIssue[];
};

const messages = {
  competition: "A fonte pertence a outra competição.",
  gameNumber: "O número do jogo diverge do jogo selecionado.",
  participants: "Os participantes não correspondem ao confronto selecionado.",
  side: "Os participantes estão em lados invertidos e o confronto não permite inversão.",
  score: "O placar final diverge do jogo selecionado.",
  periods: "A pontuação por período diverge do jogo selecionado.",
  participation: "A lista de jogadores participantes diverge do jogo selecionado.",
  playerStat: "A pontuação ou as cestas convertidas do jogador divergem.",
  jersey: "O número da camisa diverge; a identidade do jogador foi preservada.",
  inverted: "Os participantes foram reconhecidos com os lados invertidos.",
} as const;

function issue(
  code: string,
  message: string,
  path: string,
  expected?: unknown,
  actual?: unknown,
): IngestionComparisonIssue {
  return { code, message, path, expected, actual };
}

function compareOptionalNumber(
  errors: IngestionComparisonIssue[],
  path: string,
  expected: number | null | undefined,
  actual: number | null | undefined,
  code: string,
  message: string,
) {
  if (expected != null && actual != null && expected !== actual) {
    errors.push(issue(code, message, path, expected, actual));
  }
}

function compareTeam(
  expected: IngestionTeam,
  actual: IngestionTeam,
  path: string,
  errors: IngestionComparisonIssue[],
  warnings: IngestionComparisonIssue[],
) {
  compareOptionalNumber(
    errors,
    `${path}.score`,
    expected.score,
    actual.score,
    "INGESTION_SCORE_MISMATCH",
    messages.score,
  );

  if (expected.periodScores && actual.periodScores) {
    if (
      expected.periodScores.length !== actual.periodScores.length ||
      expected.periodScores.some((points, index) => points !== actual.periodScores?.[index])
    ) {
      errors.push(
        issue(
          "INGESTION_PERIODS_MISMATCH",
          messages.periods,
          `${path}.periodScores`,
          expected.periodScores,
          actual.periodScores,
        ),
      );
    }
  }

  if (!expected.players || !actual.players) return;

  const expectedIds = expected.players.map((player) => player.playerId).sort((a, b) => a - b);
  const actualIds = actual.players.map((player) => player.playerId).sort((a, b) => a - b);
  if (
    expectedIds.length !== actualIds.length ||
    expectedIds.some((playerId, index) => playerId !== actualIds[index])
  ) {
    errors.push(
      issue(
        "INGESTION_PARTICIPATION_MISMATCH",
        messages.participation,
        `${path}.players`,
        expectedIds,
        actualIds,
      ),
    );
  }

  const actualByPlayer = new Map(actual.players.map((player) => [player.playerId, player]));
  for (const expectedPlayer of expected.players) {
    const actualPlayer = actualByPlayer.get(expectedPlayer.playerId);
    if (!actualPlayer) continue;

    if (
      expectedPlayer.jerseyNumber != null &&
      actualPlayer.jerseyNumber != null &&
      expectedPlayer.jerseyNumber !== actualPlayer.jerseyNumber
    ) {
      warnings.push(
        issue(
          "INGESTION_JERSEY_WARNING",
          messages.jersey,
          `${path}.players.${expectedPlayer.playerId}.jerseyNumber`,
          expectedPlayer.jerseyNumber,
          actualPlayer.jerseyNumber,
        ),
      );
    }

    for (const field of ["points", "twoPointMade", "threePointMade", "freeThrowMade"] as const) {
      compareOptionalNumber(
        errors,
        `${path}.players.${expectedPlayer.playerId}.${field}`,
        expectedPlayer[field],
        actualPlayer[field],
        "INGESTION_PLAYER_STATS_MISMATCH",
        messages.playerStat,
      );
    }
  }
}

export function compareIngestionGame(
  expected: IngestionGame,
  actual: IngestionGame,
  options: { allowSideInversion?: boolean } = {},
): IngestionComparison {
  const errors: IngestionComparisonIssue[] = [];
  const warnings: IngestionComparisonIssue[] = [];

  if (expected.competitionId !== actual.competitionId) {
    errors.push(
      issue(
        "INGESTION_COMPETITION_MISMATCH",
        messages.competition,
        "competitionId",
        expected.competitionId,
        actual.competitionId,
      ),
    );
  }

  if (
    expected.gameNumber != null &&
    actual.gameNumber != null &&
    expected.gameNumber !== actual.gameNumber
  ) {
    errors.push(
      issue(
        "INGESTION_GAME_NUMBER_MISMATCH",
        messages.gameNumber,
        "gameNumber",
        expected.gameNumber,
        actual.gameNumber,
      ),
    );
  }

  const sameSides =
    expected.home.registrationId === actual.home.registrationId &&
    expected.away.registrationId === actual.away.registrationId;
  const sideInverted =
    expected.home.registrationId === actual.away.registrationId &&
    expected.away.registrationId === actual.home.registrationId;

  if (!sameSides && !sideInverted) {
    errors.push(
      issue(
        "INGESTION_PARTICIPANTS_MISMATCH",
        messages.participants,
        "participants",
        [expected.home.registrationId, expected.away.registrationId].sort(),
        [actual.home.registrationId, actual.away.registrationId].sort(),
      ),
    );
  } else if (sideInverted && !options.allowSideInversion) {
    errors.push(issue("INGESTION_SIDE_INVERSION_FORBIDDEN", messages.side, "participants"));
  } else {
    if (sideInverted) {
      warnings.push(issue("INGESTION_SIDE_INVERTED", messages.inverted, "participants"));
    }
    compareTeam(expected.home, sideInverted ? actual.away : actual.home, "home", errors, warnings);
    compareTeam(expected.away, sideInverted ? actual.home : actual.away, "away", errors, warnings);
  }

  return { compatible: errors.length === 0, sideInverted, errors, warnings };
}
