export const FOUL_CODES = ["P", "T", "U", "U2", "D"] as const;
export const FOUL_TYPES = ["P", "T", "U", "D"] as const;
export const FOUL_RULES_VERSION = "FIBA_2024" as const;

export type FoulCode = (typeof FOUL_CODES)[number];
export type FoulType = (typeof FOUL_TYPES)[number];
export type FoulRulesVersion = typeof FOUL_RULES_VERSION;
export type FoulTargetKind = "player" | "bench" | "staff" | "team";
export type TeamSide = "home" | "away";
export type StaffRole = "coach" | "assistant_1";
export type StaffOrigin = "manual" | "captain_placeholder";

export const OFFICIAL_ROLES = [
  "Árbitro",
  "Fiscal 1",
  "Fiscal 2",
  "Apontador",
  "Cronometrista",
  "Operador de 24 Segundos",
] as const;

export type OfficialRole = (typeof OFFICIAL_ROLES)[number];

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
  isStarter?: boolean;
  isCaptain?: boolean;
}

export interface FoulInput {
  periodNumber: number;
  sequenceNumber: number;
  code?: FoulCode;
  type?: FoulType;
  penaltyFtCount?: number;
  originalNotation?: string;
  rulesVersion?: FoulRulesVersion;
}

export interface SemanticFoulEvent {
  periodNumber: number;
  sequenceNumber: number;
  type: FoulType;
  penaltyFtCount: number;
  originalNotation: string;
  rulesVersion: FoulRulesVersion;
}

export interface SemanticFoulTarget {
  kind: FoulTargetKind;
  registrationId: number;
  rosterEntryId?: number;
  staffRole?: StaffRole;
}

export interface SemanticFoulPayload extends SemanticFoulEvent {
  target: SemanticFoulTarget;
}

export interface TeamStaffPayload {
  role: StaffRole;
  name: string;
  origin: StaffOrigin;
  linkedCaptainRosterEntryId?: number;
}

export interface OfficialPayload {
  role: OfficialRole;
  name: string;
}

export interface ManualGamePayload {
  date: string;
  time?: string | null;
  venue?: string | null;
  gameNumber?: string | null;
  phaseRound?: string | null;
  notes?: string | null;
}

export interface FastScoreEntry {
  jerseyNumber: string;
  points: 1 | 2 | 3;
}

export interface FastFoulEntry {
  jerseyNumber: string;
  foul: Omit<SemanticFoulEvent, "periodNumber" | "sequenceNumber">;
}

export interface FastScoreHistoryEntry extends FastScoreEntry {
  side: TeamSide;
  periodNumber: number;
  rosterEntryId: number;
}

export interface ManualScoresheetDiffItem {
  path: string;
  label: string;
  before: string;
  after: string;
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
    isStarter?: boolean;
    isCaptain?: boolean;
  }>;
  staff?: TeamStaffPayload[];
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

export interface ManualScoresheetV2Payload {
  idempotencyKey: string;
  competitionId: number;
  fallbackReason?: string;
  roundId?: number | null;
  game: ManualGamePayload;
  teams: [TeamPayload, TeamPayload];
  periods: PeriodPayload[];
  fouls: SemanticFoulPayload[];
  officials: OfficialPayload[];
}

export interface ManualScoresheetRevisionPayload extends ManualScoresheetV2Payload {
  gameId: number;
  baseSubmissionId: number;
  basePayloadHash: string;
  revisionReason: string;
}

export type FastEntryStage = "jersey" | "value";

export interface FastEntryState {
  stage: FastEntryStage;
  jerseyNumber: string;
}

export interface Disqualification {
  periodNumber: number;
  sequenceNumber: number;
  reason: "D" | "2T" | "2U" | "T+U";
}

export function validateTeamSlots(slots: EditorSlot[]): string[] {
  const active = slots.filter((slot) => slot.rosterEntryId !== null);
  const errors: string[] = [];
  if (active.length === 0 || active.length > 12) errors.push("roster_size");

  const rosterIds = active.map((slot) => slot.rosterEntryId as number);
  if (new Set(rosterIds).size !== rosterIds.length) errors.push("duplicate_player");

  const jerseys = active.map((slot) => normalizeGameJersey(slot.jerseyNumber));
  if (jerseys.some((jersey) => jersey === null)) errors.push("invalid_jersey");
  const validJerseys = jerseys.filter((jersey): jersey is string => jersey !== null);
  if (new Set(validJerseys).size !== validJerseys.length) errors.push("duplicate_jersey");

  if (active.filter((slot) => slot.isCaptain).length !== 1) errors.push("captain_required");
  return errors;
}

export function isValidSemanticFoulTarget(target: SemanticFoulTarget): boolean {
  if (!Number.isSafeInteger(target.registrationId) || target.registrationId <= 0) return false;
  if (target.kind === "player") {
    return (
      Number.isSafeInteger(target.rosterEntryId) &&
      (target.rosterEntryId as number) > 0 &&
      target.staffRole === undefined
    );
  }
  if (target.kind === "bench") {
    return target.rosterEntryId === undefined && target.staffRole === undefined;
  }
  if (target.kind === "team") {
    return target.rosterEntryId === undefined && target.staffRole === undefined;
  }
  return (
    target.kind === "staff" &&
    target.rosterEntryId === undefined &&
    (target.staffRole === "coach" || target.staffRole === "assistant_1")
  );
}

export function undoFastScoreEntry(
  history: FastScoreHistoryEntry[],
): { entry: FastScoreHistoryEntry; remaining: FastScoreHistoryEntry[] } | null {
  const entry = history.at(-1);
  return entry ? { entry, remaining: history.slice(0, -1) } : null;
}

function displayDiffValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return String(value);
}

export function buildManualScoresheetDiff(
  before: ManualScoresheetV2Payload,
  after: ManualScoresheetV2Payload,
): ManualScoresheetDiffItem[] {
  const items: ManualScoresheetDiffItem[] = [];
  const add = (path: string, label: string, left: unknown, right: unknown) => {
    if (JSON.stringify(left) === JSON.stringify(right)) return;
    items.push({ path, label, before: displayDiffValue(left), after: displayDiffValue(right) });
  };

  add("game.date", "Data", before.game.date, after.game.date);
  add("game.time", "Horário", before.game.time, after.game.time);
  add("game.venue", "Local", before.game.venue, after.game.venue);
  add("game.gameNumber", "Número do jogo", before.game.gameNumber, after.game.gameNumber);
  add("game.phaseRound", "Fase/rodada", before.game.phaseRound, after.game.phaseRound);
  add("game.notes", "Observações", before.game.notes, after.game.notes);

  for (const side of ["home", "away"] as const) {
    const beforeTeam = before.teams.find((team) => team.side === side);
    const afterTeam = after.teams.find((team) => team.side === side);
    if (!beforeTeam || !afterTeam) continue;
    const sideLabel = side === "home" ? "Mandante" : "Visitante";
    const beforeSlots = new Map(beforeTeam.slots.map((slot) => [slot.rosterEntryId, slot]));
    const afterSlots = new Map(afterTeam.slots.map((slot) => [slot.rosterEntryId, slot]));
    const rosterIds = new Set([...beforeSlots.keys(), ...afterSlots.keys()]);
    for (const rosterEntryId of rosterIds) {
      const previous = beforeSlots.get(rosterEntryId);
      const next = afterSlots.get(rosterEntryId);
      if (!previous || !next) {
        add(
          `teams.${side}.slots.${rosterEntryId}`,
          `${sideLabel} · atleta ${rosterEntryId}`,
          previous ? `#${previous.jerseyNumber}` : "fora do jogo",
          next ? `#${next.jerseyNumber}` : "fora do jogo",
        );
        continue;
      }
      add(
        `teams.${side}.slots.${rosterEntryId}.jerseyNumber`,
        `${sideLabel} · atleta ${rosterEntryId} · camisa`,
        previous.jerseyNumber,
        next.jerseyNumber,
      );
      add(
        `teams.${side}.slots.${rosterEntryId}.isStarter`,
        `#${next.jerseyNumber} · titular`,
        Boolean(previous.isStarter),
        Boolean(next.isStarter),
      );
      add(
        `teams.${side}.slots.${rosterEntryId}.isCaptain`,
        `#${next.jerseyNumber} · capitão`,
        Boolean(previous.isCaptain),
        Boolean(next.isCaptain),
      );
    }
    for (const role of ["coach", "assistant_1"] as const) {
      const previous = beforeTeam.staff?.find((staff) => staff.role === role);
      const next = afterTeam.staff?.find((staff) => staff.role === role);
      add(
        `teams.${side}.staff.${role}`,
        `${sideLabel} · ${role === "coach" ? "técnico" : "1º assistente"}`,
        previous ? `${previous.name} (${previous.origin})` : null,
        next ? `${next.name} (${next.origin})` : null,
      );
    }
  }

  for (const role of OFFICIAL_ROLES) {
    add(
      `officials.${role}`,
      role,
      before.officials.find((official) => official.role === role)?.name ?? null,
      after.officials.find((official) => official.role === role)?.name ?? null,
    );
  }

  const jerseyByRoster = new Map<number, string>();
  for (const team of after.teams) {
    for (const slot of team.slots) jerseyByRoster.set(slot.rosterEntryId, slot.jerseyNumber);
  }
  const beforePeriodStats = new Map<string, PeriodStatPayload>();
  const afterPeriodStats = new Map<string, PeriodStatPayload>();
  for (const period of before.periods) {
    for (const stat of period.stats) {
      beforePeriodStats.set(`${period.periodNumber}:${stat.rosterEntryId}`, stat);
    }
  }
  for (const period of after.periods) {
    for (const stat of period.stats) {
      afterPeriodStats.set(`${period.periodNumber}:${stat.rosterEntryId}`, stat);
    }
  }
  const statKeys = new Set([...beforePeriodStats.keys(), ...afterPeriodStats.keys()]);
  for (const key of statKeys) {
    const [periodText, rosterText] = key.split(":");
    const periodNumber = Number(periodText);
    const rosterEntryId = Number(rosterText);
    const previous = beforePeriodStats.get(key);
    const next = afterPeriodStats.get(key);
    const jersey = jerseyByRoster.get(rosterEntryId) ?? rosterText;
    for (const [field, label] of [
      ["twoPointMade", "2PT"],
      ["threePointMade", "3PT"],
      ["freeThrowMade", "LL"],
    ] as const) {
      add(
        `periods.${periodNumber}.${rosterEntryId}.${field}`,
        `#${jersey} ${periodLabel(periodNumber)}: ${label}`,
        previous?.[field] ?? 0,
        next?.[field] ?? 0,
      );
    }
  }

  const foulIdentity = (foul: SemanticFoulPayload) =>
    `${foul.periodNumber}:${foul.sequenceNumber}:${foul.target.registrationId}:${foul.target.kind}:${foul.target.rosterEntryId ?? ""}:${foul.target.staffRole ?? ""}`;
  const beforeFouls = new Map(before.fouls.map((foul) => [foulIdentity(foul), foul]));
  const afterFouls = new Map(after.fouls.map((foul) => [foulIdentity(foul), foul]));
  for (const key of new Set([...beforeFouls.keys(), ...afterFouls.keys()])) {
    const previous = beforeFouls.get(key);
    const next = afterFouls.get(key);
    const foul = next ?? previous;
    if (!foul) continue;
    const target =
      foul.target.kind === "player"
        ? `#${jerseyByRoster.get(foul.target.rosterEntryId ?? -1) ?? foul.target.rosterEntryId}`
        : foul.target.kind === "bench"
          ? "Banco"
          : foul.target.staffRole === "coach"
            ? "Técnico"
            : "1º assistente";
    add(
      `fouls.${key}`,
      `${target} ${periodLabel(foul.periodNumber)} · falta`,
      previous?.originalNotation ?? null,
      next?.originalNotation ?? null,
    );
  }
  return items;
}

function semanticFoulType(foul: FoulInput): FoulType {
  if (foul.type) return foul.type;
  if (foul.code === "U2") return "U";
  if (foul.code && FOUL_TYPES.includes(foul.code as FoulType)) return foul.code as FoulType;
  throw new RangeError("Tipo de falta inválido.");
}

export function normalizeGameJersey(value: string): string | null {
  const text = value.trim();
  if (text === "00" || text === "0") return text;
  if (!/^[1-9][0-9]?$/.test(text)) return null;
  return text;
}

export function parseFastPointValue(value: string): 1 | 2 | 3 | null {
  const text = value.trim();
  return text === "1" || text === "2" || text === "3" ? (Number(text) as 1 | 2 | 3) : null;
}

export function parseFastScoreEntry(value: string): FastScoreEntry | null {
  const match = value.trim().match(/^(00|0|[1-9][0-9]?)\s+([123])$/);
  if (!match) return null;
  const [, jerseyText, pointsText] = match;
  if (!jerseyText || !pointsText) return null;
  const jerseyNumber = normalizeGameJersey(jerseyText);
  const points = parseFastPointValue(pointsText);
  return jerseyNumber && points ? { jerseyNumber, points } : null;
}

export function beginFastEntry(value: string): FastEntryState | null {
  const jerseyNumber = normalizeGameJersey(value);
  return jerseyNumber ? { stage: "value", jerseyNumber } : null;
}

export function cancelFastEntry(): FastEntryState {
  return { stage: "jersey", jerseyNumber: "" };
}

export function completeFastScoreEntry(
  state: FastEntryState,
  value: string,
): FastScoreEntry | null {
  if (state.stage !== "value") return null;
  const points = parseFastPointValue(value);
  return points ? { jerseyNumber: state.jerseyNumber, points } : null;
}

export function parseFoulNotation(
  value: string,
): Omit<SemanticFoulEvent, "periodNumber" | "sequenceNumber"> | null {
  const notation = value.trim().toUpperCase();
  const match = notation.match(/^(?:([PTUD])([0-3])?|([CB])1)$/);
  if (!match) return null;
  const type = match[3] ? "T" : (match[1] as FoulType);
  return {
    type,
    penaltyFtCount: match[3] ? 1 : match[2] ? Number(match[2]) : 0,
    originalNotation: notation,
    rulesVersion: FOUL_RULES_VERSION,
  };
}

export function parseFastFoulEntry(value: string): FastFoulEntry | null {
  const match = value
    .trim()
    .toUpperCase()
    .match(/^(00|0|[1-9][0-9]?)\s*([PTUD][0-3]?)$/);
  if (!match) return null;
  const [, jerseyText, foulText] = match;
  if (!jerseyText || !foulText) return null;
  const jerseyNumber = normalizeGameJersey(jerseyText);
  const foul = parseFoulNotation(foulText);
  return jerseyNumber && foul ? { jerseyNumber, foul } : null;
}

export function semanticFoulFromLegacyCode(
  code: FoulCode,
): Omit<SemanticFoulEvent, "periodNumber" | "sequenceNumber"> {
  if (code === "U2") {
    return {
      type: "U",
      penaltyFtCount: 2,
      originalNotation: "U2",
      rulesVersion: FOUL_RULES_VERSION,
    };
  }
  return {
    type: code,
    penaltyFtCount: 0,
    originalNotation: code,
    rulesVersion: FOUL_RULES_VERSION,
  };
}

export function sumPenaltyFreeThrows(
  fouls: Array<Pick<SemanticFoulEvent, "penaltyFtCount">>,
): number {
  return fouls.reduce((total, foul) => total + foul.penaltyFtCount, 0);
}

export function normalizeOptionalText(value: string, maxLength: number): string | null {
  const text = value.trim();
  return text && text.length <= maxLength ? text : text ? null : "";
}

export function isIsoLocalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isLocalTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function resolveCaptainPlaceholder(
  current: TeamStaffPayload | undefined,
  captain: { rosterEntryId: number; playerName: string } | null,
): TeamStaffPayload | undefined {
  if (!captain) {
    return current?.origin === "captain_placeholder" ? undefined : current;
  }
  if (!current || current.origin === "captain_placeholder") {
    return {
      role: "coach",
      name: captain.playerName,
      origin: "captain_placeholder",
      linkedCaptainRosterEntryId: captain.rosterEntryId,
    };
  }
  return current;
}

export function breakCaptainPlaceholderLink(
  current: TeamStaffPayload | undefined,
  name: string,
): TeamStaffPayload | undefined {
  const normalized = name.trim();
  if (!normalized) return undefined;
  return { role: current?.role ?? "coach", name: normalized, origin: "manual" };
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

// Legacy grid codes and quick-entry events are separate recorded fouls. Keep each
// exactly once, with legacy codes preceding quick entries in the same period.
// Never deduplicate by notation: two identical T or U fouls are still two events.
export function playerFoulsForDisqualification(
  stats: Record<string, string>,
  semanticFouls: SemanticFoulPayload[],
  side: TeamSide,
  slot: EditorSlot,
  registrationId: number,
): FoulInput[] | null {
  if (slot.rosterEntryId === null) return [];
  const combined: FoulInput[] = [];
  for (let period = 1; period <= 4; period += 1) {
    const codes = parseFoulCodes(stats[`${side}-${slot.slotNumber}-${period}-fouls`] ?? "");
    if (!codes) return null; // An unfinished legacy cell must be corrected before a new foul.
    codes.forEach((code, index) => {
      combined.push({ periodNumber: period, sequenceNumber: index + 1, code });
    });
  }
  for (const foul of semanticFouls) {
    if (
      foul.target.kind === "player" &&
      foul.target.registrationId === registrationId &&
      foul.target.rosterEntryId === slot.rosterEntryId
    ) {
      combined.push({ ...foul, sequenceNumber: foul.sequenceNumber + 20 });
    }
  }
  return combined;
}

export function hasRecordedPointsAfterPeriod(
  stats: Record<string, string>,
  side: TeamSide,
  slotNumber: number,
  periodNumber: number,
): boolean {
  // Quick-entry fouls group Q4 and every OT together. Their relative scoring
  // chronology is unknown; only GD in Q1-Q3 proves later scoring invalid.
  if (periodNumber >= 4) return false;
  for (let period = periodNumber + 1; period <= 12; period += 1) {
    for (const field of ["two", "three", "free"]) {
      const value = stats[`${side}-${slotNumber}-${period}-${field}`]?.trim();
      // Non-empty, incomplete draft counters are preserved and treated conservatively.
      if (value && (Number(value) > 0 || !/^(?:0|[1-9][0-9]?)$/.test(value))) return true;
    }
  }
  return false;
}

export function parseSemanticFoulList(
  value: FormDataEntryValue | null,
): Array<Omit<SemanticFoulEvent, "periodNumber" | "sequenceNumber">> | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return [];
  const values = text.split(",").map((item) => item.trim());
  if (values.length > 20) return null;
  const fouls = values.map(parseFoulNotation);
  return fouls.some((foul) => foul === null)
    ? null
    : (fouls as Array<Omit<SemanticFoulEvent, "periodNumber" | "sequenceNumber">>);
}

export function evaluateDisqualification(fouls: FoulInput[]): Disqualification | null {
  const ordered = [...fouls].sort(
    (left, right) =>
      left.periodNumber - right.periodNumber || left.sequenceNumber - right.sequenceNumber,
  );
  let technical = 0;
  let unsportsmanlike = 0;
  for (const foul of ordered) {
    const type = semanticFoulType(foul);
    if (type === "T") technical += 1;
    if (type === "U") unsportsmanlike += 1;
    let reason: Disqualification["reason"] | null = null;
    if (type === "D") reason = "D";
    else if (technical >= 2) reason = "2T";
    else if (unsportsmanlike >= 2) reason = "2U";
    else if (technical >= 1 && unsportsmanlike >= 1) reason = "T+U";
    if (reason)
      return { periodNumber: foul.periodNumber, sequenceNumber: foul.sequenceNumber, reason };
  }
  return null;
}

export function hasFoulAfterDisqualification(fouls: FoulInput[]): boolean {
  const disqualification = evaluateDisqualification(fouls);
  if (!disqualification) return false;
  return fouls.some(
    (foul) =>
      foul.periodNumber > disqualification.periodNumber ||
      (foul.periodNumber === disqualification.periodNumber &&
        foul.sequenceNumber > disqualification.sequenceNumber),
  );
}

export function canAddPlayerFoul(existingFouls: FoulInput[]): boolean {
  return evaluateDisqualification(existingFouls) === null;
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
  gameId: number,
): string {
  return `/${year}/${competitionSlug}/${categorySlug}/jogos/${gameId}`;
}
