import {
  buildManualScoresheetDiff,
  deriveTeamScore,
  type ManualScoresheetV2Payload,
} from "./domain";
import { buildSetupConfirmation } from "./setup-confirmation";
import { createScoresheetSetup, type ScoresheetSetup } from "./setup-state";

export interface ScoresheetRevisionBase {
  gameId: number;
  submissionId: number;
  payloadHash: string;
  version: number;
  payload: ManualScoresheetV2Payload;
}

export function setupFromSavedScoresheet(payload: ManualScoresheetV2Payload): ScoresheetSetup {
  const setup = createScoresheetSetup();
  setup.game = { ...payload.game };
  setup.fallbackReason = payload.fallbackReason ?? "";
  setup.periodCount = payload.periods.length;
  // An existing saved OT already attests that the preceding period ended tied.
  // Editing its points invalidates this attestation through updateSetupStat.
  setup.completedPeriods = Array.from(
    { length: Math.max(0, setup.periodCount - 4) },
    (_, i) => i + 4,
  );
  setup.fouls = structuredClone(payload.fouls);
  for (const team of payload.teams) {
    setup.registrationIds[team.side] = team.registrationId;
    for (const slot of team.slots) setup.slots[team.side][slot.slotNumber - 1] = { ...slot };
    setup.staff[team.side] = {
      coach: structuredClone(team.staff?.find((staff) => staff.role === "coach") ?? null),
      assistant: team.staff?.find((staff) => staff.role === "assistant_1")?.name ?? "",
    };
    for (const period of payload.periods)
      for (const slot of team.slots) {
        const stat = period.stats.find((entry) => entry.rosterEntryId === slot.rosterEntryId);
        if (!stat) continue;
        const key = `${team.side}-${slot.slotNumber}-${period.periodNumber}`;
        setup.stats[`${key}-two`] = String(stat.twoPointMade);
        setup.stats[`${key}-three`] = String(stat.threePointMade);
        setup.stats[`${key}-free`] = String(stat.freeThrowMade);
      }
  }
  for (const official of payload.officials) setup.officials[official.role] = official.name;
  return setup;
}

export function buildSetupRevision(setup: ScoresheetSetup, base: ScoresheetRevisionBase) {
  const result = buildSetupConfirmation(
    setup,
    base.payload.competitionId,
    base.payload.fallbackReason ?? "",
  );
  for (const side of ["home", "away"] as const)
    if (
      setup.registrationIds[side] !==
      base.payload.teams.find((team) => team.side === side)?.registrationId
    )
      result.issues.push("Mandante e visitante não podem ser alterados em uma revisão.");
  if (!result.payload || result.issues.length) return { payload: null, issues: result.issues };
  // Preserve creation identity and structural fields from the trusted database snapshot.
  const payload: ManualScoresheetV2Payload = {
    ...result.payload,
    idempotencyKey: base.payload.idempotencyKey,
    ...(Object.hasOwn(base.payload, "roundId") ? { roundId: base.payload.roundId } : {}),
    ...(Object.hasOwn(base.payload, "fallbackReason")
      ? { fallbackReason: base.payload.fallbackReason }
      : {}),
  };
  return { payload, issues: result.issues };
}

export function revisionDiff(setup: ScoresheetSetup, base: ScoresheetRevisionBase) {
  const result = buildSetupRevision(setup, base);
  return result.payload ? buildManualScoresheetDiff(base.payload, result.payload) : [];
}

export function savedScoresheetScore(payload: ManualScoresheetV2Payload) {
  return (["home", "away"] as const)
    .map((side) =>
      deriveTeamScore(
        payload.periods,
        new Set(
          payload.teams.find((team) => team.side === side)?.slots.map((slot) => slot.rosterEntryId),
        ),
      ),
    )
    .join(" × ");
}

export const REVISION_REASON_ERROR = "Informe o motivo da revisão com 10 a 500 caracteres.";
