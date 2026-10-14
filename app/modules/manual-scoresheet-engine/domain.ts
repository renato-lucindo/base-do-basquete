export type Period = "Q1" | "Q2" | "Q3" | "Q4" | `OT${number}`;

export type TeamSide = "home" | "away";

export type PointValue = 1 | 2 | 3;

export type FoulKind = "P" | "T" | "U" | "D" | "B" | "C";

export interface TestRosterPlayer {
  team: TeamSide;
  jersey: string;
  playerId: string;
}

export interface ScoresheetContext {
  period: Period;
  players: TestRosterPlayer[];
}

export interface PointEvent {
  type: "POINT";
  team: TeamSide;
  playerId: string;
  jersey: string;
  value: PointValue;
  period: Period;
}

export interface FoulEvent {
  type: "FOUL";
  team: TeamSide;
  playerId?: string;
  jersey?: string;
  kind: FoulKind;
  freeThrowsAwarded: number;
  compensated: boolean;
  period: Period;
}

export type ScoresheetEvent = PointEvent | FoulEvent;

export interface StoredScoresheetEvent extends ScoresheetEvent {
  id: string;
  sequence: number;
}

export interface ScoresheetState {
  events: StoredScoresheetEvent[];
  undone: StoredScoresheetEvent[];
}

export function appendEvent(state: ScoresheetState, event: ScoresheetEvent): ScoresheetState {
  const stored: StoredScoresheetEvent = {
    ...event,
    id: crypto.randomUUID(),
    sequence: state.events.length + 1,
  };
  return { events: [...state.events, stored], undone: [] };
}

export function undo(state: ScoresheetState): ScoresheetState {
  const event = state.events.at(-1);
  if (!event) return state;
  return { events: state.events.slice(0, -1), undone: [...state.undone, event] };
}

export function redo(state: ScoresheetState): ScoresheetState {
  const event = state.undone.at(-1);
  if (!event) return state;
  return { events: [...state.events, event], undone: state.undone.slice(0, -1) };
}

export function calculateScore(events: ScoresheetEvent[], team: TeamSide): number {
  return events
    .filter((event): event is PointEvent => event.type === "POINT" && event.team === team)
    .reduce((total, event) => total + event.value, 0);
}

export function findPlayer(
  context: ScoresheetContext,
  team: TeamSide,
  jersey: string,
): TestRosterPlayer {
  const player = context.players.find(
    (candidate) => candidate.team === team && candidate.jersey === jersey,
  );

  if (!player) {
    throw new Error("Camisa não encontrada na equipe informada.");
  }

  return player;
}

export function createPointEvent(
  context: ScoresheetContext,
  team: TeamSide,
  jersey: string,
  value: PointValue,
): PointEvent {
  const player = findPlayer(context, team, jersey);

  return {
    type: "POINT",
    team,
    playerId: player.playerId,
    jersey,
    value,
    period: context.period,
  };
}

export function createFoulEvent(input: {
  context: ScoresheetContext;
  team: TeamSide;
  jersey?: string;
  kind: FoulKind;
  freeThrowsAwarded?: number;
}): FoulEvent {
  const player = input.jersey
    ? findPlayer(input.context, input.team, input.jersey)
    : undefined;

  return {
    type: "FOUL",
    team: input.team,
    playerId: player?.playerId,
    jersey: input.jersey,
    kind: input.kind,
    freeThrowsAwarded: input.kind === "B" || input.kind === "C" ? 0 : input.freeThrowsAwarded ?? 0,
    compensated: input.kind.endsWith("c" as never),
    period: input.context.period,
  };
}

export function calculateTeamFreeThrowEfficiency(
  converted: number,
  awarded: number,
): number | null {
  if (awarded === 0) return null;
  return converted / awarded;
}

export function isDisqualified(fouls: Array<Pick<FoulEvent, "kind">>): boolean {
  let technical = 0;
  let unsportsmanlike = 0;

  for (const foul of fouls) {
    if (foul.kind === "D") return true;
    if (foul.kind === "T") technical += 1;
    if (foul.kind === "U") unsportsmanlike += 1;
  }

  return technical >= 2 || unsportsmanlike >= 2 || (technical > 0 && unsportsmanlike > 0);
}
