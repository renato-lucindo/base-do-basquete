import { z } from "zod";

import {
  buildPrefillSlots,
  evaluateDisqualification,
  FOUL_RULES_VERSION,
  hasFoulAfterDisqualification,
  hasRecordedPointsAfterPeriod,
  type EditorSlot,
  isIsoLocalDate,
  isLocalTime,
  isValidSemanticFoulTarget,
  type ManualGamePayload,
  type SemanticFoulPayload,
  normalizeGameJersey,
  OFFICIAL_ROLES,
  parseFoulNotation,
  playerFoulsForDisqualification,
  type OfficialRole,
  resolveCaptainPlaceholder,
  type TeamSide,
  type TeamStaffPayload,
  validateTeamSlots,
} from "./domain";
import type { ScoresheetRegistration } from "./editor";

export interface SetupStaff {
  coach: TeamStaffPayload | null;
  assistant: string;
}

export interface ScoresheetSetup {
  step: 1 | 2 | 3;
  stats: Record<string, string>;
  fouls: SemanticFoulPayload[];
  game: ManualGamePayload;
  registrationIds: Record<TeamSide, number>;
  slots: Record<TeamSide, EditorSlot[]>;
  staff: Record<TeamSide, SetupStaff>;
  officials: Record<OfficialRole, string>;
}

const sides: TeamSide[] = ["home", "away"];

export function emptySetupSlots(): EditorSlot[] {
  return Array.from({ length: 12 }, (_, index) => ({
    slotNumber: index + 1,
    rosterEntryId: null,
    jerseyNumber: "",
  }));
}

export function createScoresheetSetup(): ScoresheetSetup {
  return {
    step: 1,
    stats: {},
    fouls: [],
    game: { date: "", time: "", venue: "", gameNumber: "", phaseRound: "", notes: "" },
    registrationIds: { home: 0, away: 0 },
    slots: { home: emptySetupSlots(), away: emptySetupSlots() },
    staff: {
      home: { coach: null, assistant: "" },
      away: { coach: null, assistant: "" },
    },
    officials: Object.fromEntries(OFFICIAL_ROLES.map((role) => [role, ""])) as Record<
      OfficialRole,
      string
    >,
  };
}

export function selectSetupTeam(
  current: ScoresheetSetup,
  side: TeamSide,
  registration: ScoresheetRegistration,
): ScoresheetSetup {
  if (current.registrationIds[side] === registration.id) return current;
  return {
    ...current,
    registrationIds: { ...current.registrationIds, [side]: registration.id },
    slots: {
      ...current.slots,
      [side]: buildPrefillSlots(registration.roster, registration.previous),
    },
    staff: { ...current.staff, [side]: { coach: null, assistant: "" } },
    stats: Object.fromEntries(
      Object.entries(current.stats).filter(([key]) => !key.startsWith(`${side}-`)),
    ),
    fouls: current.fouls.filter(
      (foul) => foul.target.registrationId !== current.registrationIds[side],
    ),
  };
}

function selectedCaptain(
  current: ScoresheetSetup,
  side: TeamSide,
  roster: ScoresheetRegistration["roster"],
) {
  const captain = current.slots[side].find((slot) => slot.isCaptain && slot.rosterEntryId !== null);
  const player = roster.find((candidate) => candidate.rosterEntryId === captain?.rosterEntryId);
  return player ? { rosterEntryId: player.rosterEntryId, playerName: player.playerName } : null;
}

function refreshLinkedCoach(
  current: ScoresheetSetup,
  side: TeamSide,
  roster: ScoresheetRegistration["roster"],
): ScoresheetSetup {
  if (current.staff[side].coach?.origin !== "captain_placeholder") return current;
  return {
    ...current,
    staff: {
      ...current.staff,
      [side]: {
        ...current.staff[side],
        coach:
          resolveCaptainPlaceholder(
            current.staff[side].coach ?? undefined,
            selectedCaptain(current, side, roster),
          ) ?? null,
      },
    },
  };
}

export function selectSetupPlayer(
  current: ScoresheetSetup,
  side: TeamSide,
  slotNumber: number,
  rosterEntryId: number | null,
  roster: ScoresheetRegistration["roster"],
): ScoresheetSetup {
  if (
    rosterEntryId !== null &&
    !roster.some((candidate) => candidate.rosterEntryId === rosterEntryId)
  )
    return current;
  if (
    rosterEntryId !== null &&
    current.slots[side].some(
      (slot) => slot.slotNumber !== slotNumber && slot.rosterEntryId === rosterEntryId,
    )
  )
    return current;
  const candidate = roster.find((item) => item.rosterEntryId === rosterEntryId);
  const previous = current.slots[side].find((slot) => slot.slotNumber === slotNumber);
  const resetStats = previous?.rosterEntryId !== rosterEntryId;
  const updated: ScoresheetSetup = {
    ...current,
    stats: resetStats
      ? Object.fromEntries(
          Object.entries(current.stats).filter(
            ([key]) => !key.startsWith(`${side}-${slotNumber}-`),
          ),
        )
      : current.stats,
    fouls:
      resetStats && previous?.rosterEntryId != null
        ? current.fouls.filter(
            (foul) =>
              foul.target.kind !== "player" ||
              foul.target.registrationId !== current.registrationIds[side] ||
              foul.target.rosterEntryId !== previous.rosterEntryId,
          )
        : current.fouls,
    slots: {
      ...current.slots,
      [side]: current.slots[side].map((slot) =>
        slot.slotNumber === slotNumber
          ? {
              ...slot,
              rosterEntryId,
              jerseyNumber: candidate?.jerseyNumber ?? "",
              isStarter: rosterEntryId === null ? false : slot.isStarter,
              isCaptain: rosterEntryId === null ? false : slot.isCaptain,
            }
          : slot,
      ),
    },
  };
  return refreshLinkedCoach(updated, side, roster);
}

export function selectSetupCaptain(
  current: ScoresheetSetup,
  side: TeamSide,
  slotNumber: number,
  roster: ScoresheetRegistration["roster"],
): ScoresheetSetup {
  if (
    !current.slots[side].some(
      (slot) => slot.slotNumber === slotNumber && slot.rosterEntryId !== null,
    )
  )
    return current;
  const updated: ScoresheetSetup = {
    ...current,
    slots: {
      ...current.slots,
      [side]: current.slots[side].map((slot) => ({
        ...slot,
        isCaptain: slot.slotNumber === slotNumber && slot.rosterEntryId !== null,
      })),
    },
  };
  return refreshLinkedCoach(updated, side, roster);
}

export function linkSetupCaptainToCoach(
  current: ScoresheetSetup,
  side: TeamSide,
  roster: ScoresheetRegistration["roster"],
): ScoresheetSetup {
  const captain = selectedCaptain(current, side, roster);
  if (!captain) return current;
  return {
    ...current,
    staff: {
      ...current.staff,
      [side]: {
        ...current.staff[side],
        coach: resolveCaptainPlaceholder(undefined, captain) ?? null,
      },
    },
  };
}

export function editSetupCoach(
  current: ScoresheetSetup,
  side: TeamSide,
  name: string,
): ScoresheetSetup {
  return {
    ...current,
    staff: {
      ...current.staff,
      [side]: {
        ...current.staff[side],
        coach: name === "" ? null : { role: "coach", name, origin: "manual" },
      },
    },
  };
}

export function validateSetupGame(
  setup: ScoresheetSetup,
  registrations: ScoresheetRegistration[],
): string[] {
  const errors: string[] = [];
  const { home, away } = setup.registrationIds;
  if (
    !home ||
    !away ||
    home === away ||
    ![home, away].every((id) => registrations.some((item) => item.id === id))
  ) {
    errors.push("Selecione duas equipes inscritas e diferentes.");
  }
  if (!isIsoLocalDate(setup.game.date)) errors.push("Informe uma data de jogo válida.");
  if (setup.game.time && !isLocalTime(setup.game.time))
    errors.push("Informe um horário válido ou deixe vazio.");
  if (
    (setup.game.venue?.length ?? 0) > 160 ||
    (setup.game.gameNumber?.length ?? 0) > 40 ||
    (setup.game.phaseRound?.length ?? 0) > 160 ||
    (setup.game.notes?.length ?? 0) > 2000
  ) {
    errors.push("Revise o tamanho dos metadados do jogo.");
  }
  return errors;
}

export function validateSetupTeams(
  setup: ScoresheetSetup,
  registrations: ScoresheetRegistration[],
): string[] {
  const errors: string[] = [];
  for (const side of sides) {
    const label = side === "home" ? "Mandante" : "Visitante";
    const registration = registrations.find((item) => item.id === setup.registrationIds[side]);
    if (!registration) {
      errors.push(`${label}: equipe indisponível.`);
      continue;
    }
    const active = setup.slots[side].filter((slot) => slot.rosterEntryId !== null);
    if (!active.length || active.length > 12) errors.push(`${label}: selecione de 1 a 12 atletas.`);
    if (
      active.some(
        (slot) =>
          !registration.roster.some((player) => player.rosterEntryId === slot.rosterEntryId),
      )
    ) {
      errors.push(`${label}: há atleta que não pertence ao elenco inscrito.`);
    }
    if (active.some((slot) => normalizeGameJersey(slot.jerseyNumber) === null)) {
      errors.push(`${label}: revise os números de camisa (0, 00 ou 1 a 99).`);
    }
    const invalidSlots = validateTeamSlots(setup.slots[side]);
    if (invalidSlots.length)
      errors.push(`${label}: escolha um capitão e elimine atletas ou camisas repetidos.`);
    if (
      (setup.staff[side].coach?.name.length ?? 0) > 160 ||
      setup.staff[side].assistant.length > 160
    ) {
      errors.push(`${label}: revise os nomes da comissão técnica.`);
    }
  }
  if (OFFICIAL_ROLES.some((role) => setup.officials[role].length > 160)) {
    errors.push("Revise os nomes dos oficiais.");
  }
  return errors;
}

const slotSchema = z.object({
  slotNumber: z.number().int().min(1).max(12),
  rosterEntryId: z.number().int().positive().nullable(),
  jerseyNumber: z.string().max(8),
  isStarter: z.boolean().optional(),
  isCaptain: z.boolean().optional(),
});
const coachSchema = z.object({
  role: z.literal("coach"),
  name: z.string().max(160),
  origin: z.enum(["manual", "captain_placeholder"]),
  linkedCaptainRosterEntryId: z.number().int().positive().optional(),
});
const staffSchema = z.object({ coach: coachSchema.nullable(), assistant: z.string().max(160) });
const foulSchema = z.object({
  periodNumber: z.number().int().min(1).max(4),
  sequenceNumber: z.number().int().positive().max(1000),
  type: z.enum(["P", "T", "U", "D"]),
  penaltyFtCount: z.number().int().min(0).max(3),
  originalNotation: z.string().max(3),
  rulesVersion: z.literal(FOUL_RULES_VERSION),
  target: z.object({
    kind: z.enum(["player", "bench", "staff", "team"]),
    registrationId: z.number().int().positive(),
    rosterEntryId: z.number().int().positive().optional(),
    staffRole: z.enum(["coach", "assistant_1"]).optional(),
  }),
});
const setupSchema = z.object({
  step: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  stats: z.record(z.string(), z.string().max(40)).optional(),
  fouls: z.array(foulSchema).max(1000).optional(),
  game: z.object({
    date: z.string().max(10),
    time: z.string().max(5).nullish(),
    venue: z.string().max(160).nullish(),
    gameNumber: z.string().max(40).nullish(),
    phaseRound: z.string().max(160).nullish(),
    notes: z.string().max(2000).nullish(),
  }),
  registrationIds: z.object({
    home: z.number().int().nonnegative(),
    away: z.number().int().nonnegative(),
  }),
  slots: z.object({ home: z.array(slotSchema).length(12), away: z.array(slotSchema).length(12) }),
  staff: z.object({ home: staffSchema, away: staffSchema }),
  officials: z.record(z.enum(OFFICIAL_ROLES), z.string().max(160)),
});

export function restoreScoresheetSetup(
  raw: unknown,
  registrations: ScoresheetRegistration[],
): ScoresheetSetup | null {
  const result = setupSchema.safeParse(raw);
  if (!result.success) return null;
  const setup: ScoresheetSetup = {
    ...result.data,
    stats: result.data.stats ?? {},
    fouls: result.data.fouls ?? [],
  };
  for (const side of sides) {
    const registrationId = setup.registrationIds[side];
    if (setup.slots[side].some((slot, index) => slot.slotNumber !== index + 1)) return null;
    if (registrationId === 0) {
      if (setup.slots[side].some((slot) => slot.rosterEntryId !== null)) return null;
      continue;
    }
    const registration = registrations.find((entry) => entry.id === registrationId);
    if (!registration) return null;
    const available = new Set(registration.roster.map((player) => player.rosterEntryId));
    if (
      setup.slots[side].some(
        (slot) => slot.rosterEntryId !== null && !available.has(slot.rosterEntryId),
      )
    )
      return null;
    const captain = selectedCaptain(setup, side, registration.roster);
    const coach = setup.staff[side].coach;
    if (
      coach?.origin === "captain_placeholder" &&
      (!captain ||
        captain.rosterEntryId !== coach.linkedCaptainRosterEntryId ||
        captain.playerName !== coach.name)
    )
      return null;
  }
  for (const key of Object.keys(setup.stats)) {
    const match = /^(home|away)-(1[0-2]|[1-9])-([1-4])-(two|three|free|fouls)$/.exec(key);
    if (!match) return null;
    const [, side, slotNumber] = match;
    if (!side || !slotNumber) return null;
    const slot = setup.slots[side as TeamSide].find(
      (entry) => entry.slotNumber === Number(slotNumber),
    );
    if (!slot || slot.rosterEntryId === null) return null;
  }
  const sequences = new Set<string>();
  for (const foul of setup.fouls) {
    const key = `${foul.periodNumber}:${foul.sequenceNumber}`;
    if (sequences.has(key) || !isValidSemanticFoulTarget(foul.target)) return null;
    sequences.add(key);
    const notation = parseFoulNotation(foul.originalNotation);
    if (
      !notation ||
      notation.type !== foul.type ||
      notation.penaltyFtCount !== foul.penaltyFtCount ||
      notation.originalNotation !== foul.originalNotation
    )
      return null;
    const side = sides.find((item) => setup.registrationIds[item] === foul.target.registrationId);
    if (!side) return null;
    if (foul.target.kind === "player") {
      if (foul.originalNotation === "C1" || foul.originalNotation === "B1") return null;
      if (!setup.slots[side].some((slot) => slot.rosterEntryId === foul.target.rosterEntryId))
        return null;
    } else if (foul.target.kind === "bench" && foul.originalNotation !== "B1") return null;
    else if (
      foul.target.kind === "staff" &&
      foul.originalNotation !== (foul.target.staffRole === "coach" ? "C1" : "B1")
    )
      return null;
  }
  for (const side of sides) {
    for (const slot of setup.slots[side]) {
      if (slot.rosterEntryId === null) continue;
      const playerFouls = playerFoulsForDisqualification(
        setup.stats,
        setup.fouls,
        side,
        slot,
        setup.registrationIds[side],
      );
      // An unfinished legacy cell remains editable after restore. Quick foul entry
      // rejects it until repaired; only complete entries can be reconciled here.
      if (playerFouls === null) continue;
      if (hasFoulAfterDisqualification(playerFouls)) return null;
      const gd = evaluateDisqualification(playerFouls);
      if (gd && hasRecordedPointsAfterPeriod(setup.stats, side, slot.slotNumber, gd.periodNumber))
        return null;
    }
  }
  return setup;
}
