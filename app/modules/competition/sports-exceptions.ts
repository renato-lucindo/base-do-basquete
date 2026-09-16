export type DecisionType = "walkover" | "withdrawal" | "administrative_decision";

export interface ExceptionOutcome {
  kind: string;
  winnerRegistrationId: number;
  loserRegistrationId: number;
  decisionType?: string;
}

export interface ExceptionMatchup {
  id: number;
  code: string;
  round: string;
  roundOrder: number;
  groupId: number | null;
  homeRegistrationId: number | null;
  awayRegistrationId: number | null;
  game: { id: number; status: string; startedAt: string | null } | null;
  outcome: ExceptionOutcome | null;
}

export interface SportsExceptionsDashboard {
  competitionId: number;
  rulesetRevisionId: number;
  preset: "single_group" | "single_elimination";
  groups: Array<{ id: number; code: string; closed: boolean; closureId: number | null }>;
  matchups: ExceptionMatchup[];
}

export interface GroupClosurePreview {
  groupId: number;
  eligible: boolean;
  closed: boolean;
  sourceHash: string;
  invalidMatchupIds: number[];
  standings: Array<{
    registrationId: number;
    games: number;
    wins: number;
    losses: number;
    pointsFor: number;
    pointsAgainst: number;
    pointDifference: number;
  }>;
}

export interface DecisionImpact {
  matchupId: number;
  homeRegistrationId: number;
  awayRegistrationId: number;
  winnerRegistrationId: number;
  loserRegistrationId: number;
  dependentSlots: number;
  alreadyResolved: boolean;
  game: { id: number; status: string; startedAt: string | null } | null;
}

export interface AmendmentImpact {
  matchupId: number;
  sourceRevisionId: number;
  cutoff: "before_dependent_start" | "dependent_started";
  canAmend: boolean;
  before: ExceptionOutcome;
  after: ExceptionOutcome;
  dependents: Array<{
    matchupId: number;
    gameId: number | null;
    status: string | null;
    startedAt: string | null;
    hasSubmission: boolean;
  }>;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function positiveInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

function nullablePositiveInteger(value: unknown): number | null | undefined {
  if (value === null) return null;
  return positiveInteger(value) ?? undefined;
}

function parseOutcome(value: unknown): ExceptionOutcome | null | undefined {
  if (value === null) return null;
  const item = record(value);
  const winnerRegistrationId = positiveInteger(item?.winnerRegistrationId);
  const loserRegistrationId = positiveInteger(item?.loserRegistrationId);
  if (!item || typeof item.kind !== "string" || !winnerRegistrationId || !loserRegistrationId)
    return undefined;
  return {
    kind: item.kind,
    winnerRegistrationId,
    loserRegistrationId,
    decisionType: typeof item.decisionType === "string" ? item.decisionType : undefined,
  };
}

export function parseSportsExceptionsDashboard(value: unknown): SportsExceptionsDashboard | null {
  const item = record(value);
  const competitionId = positiveInteger(item?.competitionId);
  const rulesetRevisionId = positiveInteger(item?.rulesetRevisionId);
  if (
    !item ||
    !competitionId ||
    !rulesetRevisionId ||
    (item.preset !== "single_group" && item.preset !== "single_elimination") ||
    !Array.isArray(item.groups) ||
    !Array.isArray(item.matchups)
  )
    return null;
  const groups = item.groups.map((value) => {
    const group = record(value);
    const id = positiveInteger(group?.id);
    const closureId = nullablePositiveInteger(group?.closureId);
    return group &&
      id &&
      closureId !== undefined &&
      typeof group.code === "string" &&
      typeof group.closed === "boolean"
      ? { id, code: group.code, closed: group.closed, closureId }
      : null;
  });
  const matchups = item.matchups.map((value) => {
    const matchup = record(value);
    const id = positiveInteger(matchup?.id);
    const roundOrder = positiveInteger(matchup?.roundOrder);
    const groupId = nullablePositiveInteger(matchup?.groupId);
    const homeRegistrationId = nullablePositiveInteger(matchup?.homeRegistrationId);
    const awayRegistrationId = nullablePositiveInteger(matchup?.awayRegistrationId);
    const outcome = parseOutcome(matchup?.outcome);
    const gameValue = matchup?.game;
    let game: ExceptionMatchup["game"] | undefined;
    if (gameValue === null) game = null;
    else {
      const gameRecord = record(gameValue);
      const gameId = positiveInteger(gameRecord?.id);
      if (
        gameRecord &&
        gameId &&
        typeof gameRecord.status === "string" &&
        (gameRecord.startedAt === null || typeof gameRecord.startedAt === "string")
      )
        game = { id: gameId, status: gameRecord.status, startedAt: gameRecord.startedAt };
    }
    return matchup &&
      id &&
      roundOrder &&
      groupId !== undefined &&
      homeRegistrationId !== undefined &&
      awayRegistrationId !== undefined &&
      outcome !== undefined &&
      game !== undefined &&
      typeof matchup.code === "string" &&
      typeof matchup.round === "string"
      ? {
          id,
          code: matchup.code,
          round: matchup.round,
          roundOrder,
          groupId,
          homeRegistrationId,
          awayRegistrationId,
          game,
          outcome,
        }
      : null;
  });
  if (groups.some((group) => group === null) || matchups.some((matchup) => matchup === null))
    return null;
  return {
    competitionId,
    rulesetRevisionId,
    preset: item.preset,
    groups: groups.filter((group) => group !== null),
    matchups: matchups.filter((matchup) => matchup !== null),
  };
}

export function parseGroupClosurePreview(value: unknown): GroupClosurePreview | null {
  const item = record(value);
  const groupId = positiveInteger(item?.groupId);
  if (
    !item ||
    !groupId ||
    typeof item.eligible !== "boolean" ||
    typeof item.closed !== "boolean" ||
    typeof item.sourceHash !== "string" ||
    !/^[0-9a-f]{32}$/.test(item.sourceHash) ||
    !Array.isArray(item.invalidMatchupIds) ||
    !Array.isArray(item.standings)
  )
    return null;
  const invalidMatchupIds = item.invalidMatchupIds.map(positiveInteger);
  const standings = item.standings.map((value) => {
    const standing = record(value);
    const registrationId = positiveInteger(standing?.registrationId);
    const games = integer(standing?.games);
    const wins = integer(standing?.wins);
    const losses = integer(standing?.losses);
    const pointsFor = integer(standing?.pointsFor);
    const pointsAgainst = integer(standing?.pointsAgainst);
    const pointDifference = integer(standing?.pointDifference);
    return standing &&
      registrationId &&
      games !== null &&
      wins !== null &&
      losses !== null &&
      pointsFor !== null &&
      pointsAgainst !== null &&
      pointDifference !== null
      ? { registrationId, games, wins, losses, pointsFor, pointsAgainst, pointDifference }
      : null;
  });
  if (invalidMatchupIds.some((id) => id === null) || standings.some((row) => row === null))
    return null;
  return {
    groupId,
    eligible: item.eligible,
    closed: item.closed,
    sourceHash: item.sourceHash,
    invalidMatchupIds: invalidMatchupIds.filter((id) => id !== null),
    standings: standings.filter((row) => row !== null),
  };
}

export function parseDecisionImpact(value: unknown): DecisionImpact | null {
  const item = record(value);
  const matchupId = positiveInteger(item?.matchupId);
  const homeRegistrationId = positiveInteger(item?.homeRegistrationId);
  const awayRegistrationId = positiveInteger(item?.awayRegistrationId);
  const winnerRegistrationId = positiveInteger(item?.winnerRegistrationId);
  const loserRegistrationId = positiveInteger(item?.loserRegistrationId);
  const dependentSlots = integer(item?.dependentSlots);
  let game: DecisionImpact["game"] | undefined;
  if (item?.game === null) game = null;
  else {
    const gameRecord = record(item?.game);
    const gameId = positiveInteger(gameRecord?.id);
    if (
      gameRecord &&
      gameId &&
      typeof gameRecord.status === "string" &&
      (gameRecord.startedAt === null || typeof gameRecord.startedAt === "string")
    )
      game = { id: gameId, status: gameRecord.status, startedAt: gameRecord.startedAt };
  }
  return item &&
    matchupId &&
    homeRegistrationId &&
    awayRegistrationId &&
    winnerRegistrationId &&
    loserRegistrationId &&
    dependentSlots !== null &&
    dependentSlots >= 0 &&
    typeof item.alreadyResolved === "boolean" &&
    game !== undefined
    ? {
        matchupId,
        homeRegistrationId,
        awayRegistrationId,
        winnerRegistrationId,
        loserRegistrationId,
        dependentSlots,
        alreadyResolved: item.alreadyResolved,
        game,
      }
    : null;
}

export function parseAmendmentImpact(value: unknown): AmendmentImpact | null {
  const item = record(value);
  const matchupId = positiveInteger(item?.matchupId);
  const sourceRevisionId = positiveInteger(item?.sourceRevisionId);
  const before = parseOutcome(item?.before);
  const after = parseOutcome(item?.after);
  if (
    !item ||
    !matchupId ||
    !sourceRevisionId ||
    (item.cutoff !== "before_dependent_start" && item.cutoff !== "dependent_started") ||
    typeof item.canAmend !== "boolean" ||
    !before ||
    !after ||
    !Array.isArray(item.dependents)
  )
    return null;
  const dependents = item.dependents.map((value) => {
    const dependent = record(value);
    const dependentMatchupId = positiveInteger(dependent?.matchupId);
    const gameId = nullablePositiveInteger(dependent?.gameId);
    return dependent &&
      dependentMatchupId &&
      gameId !== undefined &&
      (dependent.status === null || typeof dependent.status === "string") &&
      (dependent.startedAt === null || typeof dependent.startedAt === "string") &&
      typeof dependent.hasSubmission === "boolean"
      ? {
          matchupId: dependentMatchupId,
          gameId,
          status: dependent.status,
          startedAt: dependent.startedAt,
          hasSubmission: dependent.hasSubmission,
        }
      : null;
  });
  return dependents.some((dependent) => dependent === null)
    ? null
    : {
        matchupId,
        sourceRevisionId,
        cutoff: item.cutoff,
        canAmend: item.canAmend,
        before,
        after,
        dependents: dependents.filter((dependent) => dependent !== null),
      };
}

function reason(value: FormDataEntryValue | null): string | null {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length >= 10 && normalized.length <= 500 ? normalized : null;
}

export function isRequestId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export function validateDecisionInput(form: FormData, confirmation: boolean) {
  const matchupId = positiveInteger(form.get("matchupId"));
  const homeRegistrationId = positiveInteger(form.get("homeRegistrationId"));
  const awayRegistrationId = positiveInteger(form.get("awayRegistrationId"));
  const winnerRegistrationId = positiveInteger(form.get("winnerRegistrationId"));
  const decisionType = form.get("decisionType");
  const normalizedReason = reason(form.get("reason"));
  const requestId = form.get("requestId");
  if (
    !matchupId ||
    !homeRegistrationId ||
    !awayRegistrationId ||
    homeRegistrationId === awayRegistrationId ||
    !winnerRegistrationId ||
    ![homeRegistrationId, awayRegistrationId].includes(winnerRegistrationId) ||
    (decisionType !== "walkover" &&
      decisionType !== "withdrawal" &&
      decisionType !== "administrative_decision") ||
    !normalizedReason ||
    (confirmation && (!isRequestId(requestId) || form.get("confirmed") !== "on"))
  )
    return { ok: false as const };
  return {
    ok: true as const,
    input: {
      matchupId,
      homeRegistrationId,
      awayRegistrationId,
      winnerRegistrationId,
      decisionType: decisionType as DecisionType,
      reason: normalizedReason,
      requestId: confirmation ? (requestId as string) : null,
    },
  };
}

export function validateAmendmentInput(form: FormData, confirmation: boolean) {
  const matchupId = positiveInteger(form.get("matchupId"));
  const expectedWinnerRegistrationId = positiveInteger(form.get("expectedWinnerRegistrationId"));
  const correctedWinnerRegistrationId = positiveInteger(form.get("correctedWinnerRegistrationId"));
  const normalizedReason = reason(form.get("reason"));
  const requestId = form.get("requestId");
  if (
    !matchupId ||
    !expectedWinnerRegistrationId ||
    !correctedWinnerRegistrationId ||
    expectedWinnerRegistrationId === correctedWinnerRegistrationId ||
    !normalizedReason ||
    (confirmation && (!isRequestId(requestId) || form.get("confirmed") !== "on"))
  )
    return { ok: false as const };
  return {
    ok: true as const,
    input: {
      matchupId,
      expectedWinnerRegistrationId,
      correctedWinnerRegistrationId,
      reason: normalizedReason,
      requestId: confirmation ? (requestId as string) : null,
    },
  };
}

export function validateGroupOrder(form: FormData) {
  const groupId = positiveInteger(form.get("groupId"));
  const sourceHash = form.get("sourceHash");
  const requestId = form.get("requestId");
  const registrationIds = form.getAll("registrationId").map(positiveInteger);
  const positions = form.getAll("position").map(positiveInteger);
  const normalizedReason = String(form.get("tieBreakReason") ?? "").trim();
  if (
    !groupId ||
    typeof sourceHash !== "string" ||
    !/^[0-9a-f]{32}$/.test(sourceHash) ||
    !isRequestId(requestId) ||
    form.get("confirmed") !== "on" ||
    registrationIds.length < 2 ||
    registrationIds.length !== positions.length ||
    registrationIds.some((id) => id === null) ||
    positions.some((position) => position === null) ||
    new Set(registrationIds).size !== registrationIds.length ||
    new Set(positions).size !== positions.length ||
    positions.some((position) => !position || position > positions.length) ||
    normalizedReason.length > 500 ||
    (normalizedReason.length > 0 && normalizedReason.length < 10)
  )
    return { ok: false as const };
  const orderedRegistrationIds = registrationIds
    .map((registrationId, index) => ({
      registrationId: registrationId as number,
      position: positions[index] as number,
    }))
    .sort((left, right) => left.position - right.position)
    .map(({ registrationId }) => registrationId);
  return {
    ok: true as const,
    input: {
      groupId,
      sourceHash,
      requestId,
      orderedRegistrationIds,
      tieBreakReason: normalizedReason || null,
    },
  };
}

export function sportsExceptionError(code: string | undefined): string {
  const messages: Record<string, string> = {
    BD401: "Confirme novamente o MFA para continuar.",
    BD404: "A edição, o grupo ou o confronto não foi encontrado.",
    BR010: "A solicitação mudou. Recarregue e revise antes de confirmar.",
    BR070: "O grupo já foi encerrado e seu snapshot é imutável.",
    BR073: "Ainda existem confrontos sem resultado oficial ou decisão válida.",
    BR074: "Os resultados mudaram. Gere uma nova prévia.",
    BR075: "A ordem final contém equipe duplicada, ausente ou com vitórias incompatíveis.",
    BR076: "Explique o critério usado para resolver o empate.",
    BR081: "O confronto já possui uma resolução imutável.",
    BR082: "Revise o tipo, o motivo e os participantes da decisão.",
    BR083: "Os participantes mudaram. Recarregue a página.",
    BR084: "O jogo já começou; use uma emenda versionada quando aplicável.",
    BR092: "Revise o confronto, o vencedor corrigido e a justificativa.",
    BR094: "O resultado mudou. Gere uma nova prévia da emenda.",
    BR095: "Um jogo dependente já começou ou recebeu dados. O histórico não pode ser reescrito.",
  };
  return messages[code ?? ""] ?? "Não foi possível concluir. Recarregue e tente novamente.";
}
