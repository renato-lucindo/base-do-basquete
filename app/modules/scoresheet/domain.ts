export const FOUL_CODES = ["P", "T", "U", "U2", "D"] as const;

export type FoulCode = (typeof FOUL_CODES)[number];
export type TeamSide = "home" | "away";

export interface RosterCandidate {
  rosterEntryId: number;
  playerName: string;
  jerseyNumber: string | null;
}

export interface PreviousSlot {
  slotNumber: number;
  rosterEntryId: number;
  jerseyNumber: string;
}

export interface EditorSlot {
  slotNumber: number;
  rosterEntryId: number | null;
  jerseyNumber: string;
}

export interface FoulInput {
  periodNumber: number;
  sequenceNumber: number;
  code: FoulCode;
}

export interface PeriodStatPayload {
  rosterEntryId: number;
  twoPointMade: number;
  threePointMade: number;
  freeThrowMade: number;
  fouls: FoulCode[];
}

export interface PeriodPayload {
  periodNumber: number;
  stats: PeriodStatPayload[];
}

export interface TeamPayload {
  side: TeamSide;
  registrationId: number;
  slots: Array<{
    slotNumber: number;
    rosterEntryId: number;
    jerseyNumber: string;
  }>;
}

export interface ManualScoresheetPayload {
  idempotencyKey: string;
  competitionId: number;
  gameId: number;
  fallbackReason?: string;
  gameNumber: string | null;
  scheduledLocal: string;
  venue: string;
  teams: [TeamPayload, TeamPayload];
  periods: PeriodPayload[];
}

export interface Disqualification {
  periodNumber: number;
  sequenceNumber: number;
  reason: "D" | "2T" | "2U" | "T+U";
}

export function calculatePoints(
  twoPointMade: number,
  threePointMade: number,
  freeThrowMade: number,
) {
  for (const value of [twoPointMade, threePointMade, freeThrowMade]) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError("As conversões devem ser inteiros não negativos.");
    }
  }
  return twoPointMade * 2 + threePointMade * 3 + freeThrowMade;
}

export function parseNonnegativeInteger(value: FormDataEntryValue | null): number | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!/^(?:0|[1-9][0-9]?)$/.test(text)) return null;
  return Number(text);
}

export function parseFoulCodes(value: FormDataEntryValue | null): FoulCode[] | null {
  const text = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!text) return [];
  const codes = text.split(",").map((code) => code.trim());
  if (codes.length > 20 || codes.some((code) => !FOUL_CODES.includes(code as FoulCode))) {
    return null;
  }
  return codes as FoulCode[];
}

export function evaluateDisqualification(fouls: FoulInput[]): Disqualification | null {
  const ordered = [...fouls].sort(
    (left, right) =>
      left.periodNumber - right.periodNumber || left.sequenceNumber - right.sequenceNumber,
  );
  let technical = 0;
  let unsportsmanlike = 0;
  for (const foul of ordered) {
    if (foul.code === "T") technical += 1;
    if (foul.code === "U") unsportsmanlike += 1;
    if (foul.code === "U2") unsportsmanlike += 2;
    let reason: Disqualification["reason"] | null = null;
    if (foul.code === "D") reason = "D";
    else if (technical >= 2) reason = "2T";
    else if (unsportsmanlike >= 2) reason = "2U";
    else if (technical >= 1 && unsportsmanlike >= 1) reason = "T+U";
    if (reason)
      return { periodNumber: foul.periodNumber, sequenceNumber: foul.sequenceNumber, reason };
  }
  return null;
}

export function buildPrefillSlots(
  roster: RosterCandidate[],
  previous: PreviousSlot[],
): EditorSlot[] {
  const rosterById = new Map(roster.map((candidate) => [candidate.rosterEntryId, candidate]));
  const selected = new Set<number>();
  const slots: EditorSlot[] = [];

  for (const previousSlot of [...previous].sort(
    (left, right) => left.slotNumber - right.slotNumber,
  )) {
    const candidate = rosterById.get(previousSlot.rosterEntryId);
    if (!candidate || selected.has(candidate.rosterEntryId) || slots.length >= 12) continue;
    selected.add(candidate.rosterEntryId);
    slots.push({
      slotNumber: slots.length + 1,
      rosterEntryId: candidate.rosterEntryId,
      jerseyNumber: previousSlot.jerseyNumber,
    });
  }

  if (slots.length === 0) {
    const alphabetical = [...roster].sort(
      (left, right) =>
        left.playerName.localeCompare(right.playerName, "pt-BR") ||
        left.rosterEntryId - right.rosterEntryId,
    );
    for (const candidate of alphabetical.slice(0, 12)) {
      slots.push({
        slotNumber: slots.length + 1,
        rosterEntryId: candidate.rosterEntryId,
        jerseyNumber: candidate.jerseyNumber ?? "",
      });
    }
  }

  while (slots.length < 12) {
    slots.push({ slotNumber: slots.length + 1, rosterEntryId: null, jerseyNumber: "" });
  }
  return slots;
}

export function duplicateJerseys(slots: EditorSlot[]): Set<string> {
  const counts = new Map<string, number>();
  for (const slot of slots) {
    if (slot.rosterEntryId === null || !slot.jerseyNumber) continue;
    counts.set(slot.jerseyNumber, (counts.get(slot.jerseyNumber) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([jersey]) => jersey));
}

export function periodLabel(periodNumber: number): string {
  return periodNumber <= 4 ? `Q${periodNumber}` : `OT${periodNumber - 4}`;
}

export function deriveTeamScore(periods: PeriodPayload[], rosterEntryIds: Set<number>): number {
  return periods.reduce(
    (total, period) =>
      total +
      period.stats.reduce(
        (periodTotal, stat) =>
          periodTotal +
          (rosterEntryIds.has(stat.rosterEntryId)
            ? calculatePoints(stat.twoPointMade, stat.threePointMade, stat.freeThrowMade)
            : 0),
        0,
      ),
    0,
  );
}

export function buildPublicGamePath(
  year: number,
  competitionSlug: string,
  categorySlug: string,
  genderDivision: "male" | "female",
  gameId: number,
): string {
  const genderSlug = genderDivision === "male" ? "masculino" : "feminino";
  return `/${year}/${competitionSlug}/${categorySlug}/${genderSlug}/jogos/${gameId}`;
}
