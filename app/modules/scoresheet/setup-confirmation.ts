import {
  deriveTeamScore,
  evaluateDisqualification,
  FOUL_RULES_VERSION,
  hasFoulAfterDisqualification,
  hasRecordedPointsAfterPeriod,
  isIsoLocalDate,
  isLocalTime,
  OFFICIAL_ROLES,
  parseFoulCodes,
  parseFoulNotation,
  playerFoulsForDisqualification,
  type ManualScoresheetV2Payload,
  type PeriodPayload,
  type SemanticFoulPayload,
  type TeamSide,
  validateTeamSlots,
} from "./domain";
import { quickScoreThroughPeriod } from "./quick-periods";
import type { ScoresheetSetup } from "./setup-state";

const sides: TeamSide[] = ["home", "away"];

export function buildSetupConfirmation(
  setup: ScoresheetSetup,
  competitionId: number,
  fallbackReason = setup.fallbackReason,
): { payload: ManualScoresheetV2Payload | null; issues: string[] } {
  const issues: string[] = [];
  if (!isIsoLocalDate(setup.game.date) || (setup.game.time && !isLocalTime(setup.game.time)))
    issues.push("Revise a data e a hora da partida.");
  if (setup.periodCount < 4 || setup.periodCount > 12 || !Number.isInteger(setup.periodCount))
    issues.push("A quantidade de períodos deve ficar entre Q1–Q4 e OT8.");
  if (
    setup.registrationIds.home <= 0 ||
    setup.registrationIds.away <= 0 ||
    setup.registrationIds.home === setup.registrationIds.away
  )
    issues.push("Selecione duas equipes diferentes.");
  if (setup.game.venue && setup.game.venue.length > 160) issues.push("Revise o local da partida.");
  if (setup.game.phaseRound && setup.game.phaseRound.length > 120)
    issues.push("Revise a fase ou rodada.");

  const teams = sides.map((side) => {
    const slots = setup.slots[side];
    if (validateTeamSlots(slots).length)
      issues.push(`${side === "home" ? "Mandante" : "Visitante"}: revise o elenco e o capitão.`);
    const staff = setup.staff[side];
    if (!staff.coach?.name.trim())
      issues.push(`${side === "home" ? "Mandante" : "Visitante"}: informe o técnico.`);
    return {
      side,
      registrationId: setup.registrationIds[side],
      slots: slots
        .filter((slot) => slot.rosterEntryId !== null)
        .map((slot) => ({
          slotNumber: slot.slotNumber,
          rosterEntryId: slot.rosterEntryId as number,
          jerseyNumber: slot.jerseyNumber,
          isStarter: Boolean(slot.isStarter),
          isCaptain: Boolean(slot.isCaptain),
        })),
      staff: [
        ...(staff.coach ? [staff.coach] : []),
        ...(staff.assistant.trim()
          ? [
              {
                role: "assistant_1" as const,
                name: staff.assistant.trim(),
                origin: "manual" as const,
              },
            ]
          : []),
      ],
    };
  });

  const periods: PeriodPayload[] = [];
  for (let periodNumber = 1; periodNumber <= Math.min(setup.periodCount, 12); periodNumber += 1) {
    const stats: PeriodPayload["stats"] = [];
    for (const side of sides)
      for (const slot of setup.slots[side]) {
        if (slot.rosterEntryId === null) continue;
        const read = (field: "two" | "three" | "free") => {
          const raw = setup.stats[`${side}-${slot.slotNumber}-${periodNumber}-${field}`] ?? "";
          if (raw && !/^(?:0|[1-9][0-9]?)$/.test(raw.trim())) {
            issues.push(
              `Corrija conversões inválidas na camisa ${slot.jerseyNumber}, período ${periodNumber}.`,
            );
            return 0;
          }
          return Number(raw || 0);
        };
        stats.push({
          rosterEntryId: slot.rosterEntryId,
          twoPointMade: read("two"),
          threePointMade: read("three"),
          freeThrowMade: read("free"),
          fouls: [],
        });
      }
    periods.push({ periodNumber, stats });
  }

  const fouls: SemanticFoulPayload[] = [];
  const nextSequence = new Map<number, number>();
  const appendFoul = (foul: SemanticFoulPayload) => {
    const sequenceNumber = (nextSequence.get(foul.periodNumber) ?? 0) + 1;
    nextSequence.set(foul.periodNumber, sequenceNumber);
    fouls.push({ ...foul, sequenceNumber });
  };
  for (const periodNumber of [1, 2, 3, 4])
    for (const side of sides)
      for (const slot of setup.slots[side]) {
        if (slot.rosterEntryId === null) continue;
        const codes = parseFoulCodes(
          setup.stats[`${side}-${slot.slotNumber}-${periodNumber}-fouls`] ?? "",
        );
        if (!codes) {
          issues.push(
            `Corrija as faltas incompletas da camisa ${slot.jerseyNumber} no Q${periodNumber}.`,
          );
          continue;
        }
        for (const code of codes) {
          const parsed = parseFoulNotation(code);
          if (parsed)
            appendFoul({
              ...parsed,
              periodNumber,
              sequenceNumber: 0,
              target: {
                kind: "player",
                registrationId: setup.registrationIds[side],
                rosterEntryId: slot.rosterEntryId,
              },
            });
        }
      }
  for (const foul of [...setup.fouls].sort(
    (a, b) => a.periodNumber - b.periodNumber || a.sequenceNumber - b.sequenceNumber,
  )) {
    if (foul.periodNumber > 4 || foul.periodNumber < 1 || foul.rulesVersion !== FOUL_RULES_VERSION)
      issues.push("Revise o período e a regra das faltas coletadas.");
    else appendFoul(foul);
  }
  for (const side of sides)
    for (const slot of setup.slots[side]) {
      if (slot.rosterEntryId === null) continue;
      const playerFouls = playerFoulsForDisqualification(
        setup.stats,
        setup.fouls,
        side,
        slot,
        setup.registrationIds[side],
      );
      if (!playerFouls || hasFoulAfterDisqualification(playerFouls)) {
        issues.push(`Revise as faltas e a GD da camisa ${slot.jerseyNumber}.`);
        continue;
      }
      const gd = evaluateDisqualification(playerFouls);
      if (gd && hasRecordedPointsAfterPeriod(setup.stats, side, slot.slotNumber, gd.periodNumber))
        issues.push(`A camisa ${slot.jerseyNumber} tem pontos posteriores à GD.`);
    }
  for (let period = 4; period < setup.periodCount; period += 1) {
    const score = quickScoreThroughPeriod(setup.stats, period);
    if (!score || score.home !== score.away || !setup.completedPeriods.includes(period))
      issues.push(
        `Para OT${period - 3}, confirme ${period === 4 ? "Q4" : `OT${period - 4}`} concluído e empatado.`,
      );
  }
  const homeIds = new Set(teams[0]?.slots.map((slot) => slot.rosterEntryId) ?? []);
  const awayIds = new Set(teams[1]?.slots.map((slot) => slot.rosterEntryId) ?? []);
  const home = deriveTeamScore(periods, homeIds);
  const away = deriveTeamScore(periods, awayIds);
  if (home === away)
    issues.push("O placar final está empatado. Registre a prorrogação correspondente.");
  if (fouls.length > 1000) issues.push("Quantidade de faltas excedida.");
  if (issues.length) return { payload: null, issues };
  return {
    issues,
    payload: {
      idempotencyKey: setup.submissionKey,
      competitionId,
      ...(fallbackReason.trim() ? { fallbackReason: fallbackReason.trim() } : {}),
      game: setup.game,
      teams: teams as ManualScoresheetV2Payload["teams"],
      periods,
      fouls,
      officials: OFFICIAL_ROLES.filter((role) => setup.officials[role]?.trim()).map((role) => ({
        role,
        name: setup.officials[role].trim(),
      })),
    },
  };
}
