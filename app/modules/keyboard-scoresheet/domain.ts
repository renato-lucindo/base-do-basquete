import { z } from "zod";

export const sideSchema = z.enum(["home", "away"]);
export type Side = z.infer<typeof sideSchema>;
const id = z.number().int().positive().safe();
export const rosterSchema = z.object({
  rosterEntryId: id,
  registrationId: id,
  side: sideSchema,
  jersey: z.string().regex(/^(00|0|[1-9][0-9]?)$/),
  played: z.boolean(),
});
export type RosterSlot = z.infer<typeof rosterSchema>;
export const eventSchema = z.object({
  id: z.uuid(),
  side: sideSchema,
  period: z.number().int().min(1).max(12),
  target: z.string().regex(/^(00|0|[1-9][0-9]?|B|C)$/),
  code: z.string().max(3),
});
export type Entry = z.infer<typeof eventSchema>;
export const documentSchema = z.object({
  rulesVersion: z.literal("FIBA_2024"),
  periods: z.number().int().min(4).max(12),
  roster: z.array(rosterSchema).min(2).max(24),
  coachPlayer: z.object({ home: id.nullable(), away: id.nullable() }),
  events: z.array(eventSchema).max(2000),
});
export type Sheet = z.infer<typeof documentSchema>;
export type Foul = {
  kind: "P" | "T" | "U" | "D" | "B" | "C";
  freeThrows: number;
  compensated: boolean;
};

export function parseFoul(code: string, target: string): Foul | null {
  const value = code.trim().toUpperCase();
  const match = /^([PTUDBC])([123C]?)$/.exec(value);
  if (!match) return null;
  const kind = match[1] as Foul["kind"];
  const suffix = match[2] ?? "";
  if (
    target === "B"
      ? kind !== "B"
      : target === "C"
        ? !["C", "D"].includes(kind)
        : ["B", "C"].includes(kind)
  )
    return null;
  // B2 is a bench disqualification penalty, not a second technical.
  if ((kind === "T" || kind === "C") && !["1", "C"].includes(suffix)) return null;
  if (kind === "B" && !["1", "2", "C"].includes(suffix)) return null;
  return {
    kind,
    freeThrows: suffix === "C" ? 0 : Number(suffix || 0),
    compensated: suffix === "C",
  };
}

export function periodLabel(period: number): string {
  return period <= 4 ? `Q${period}` : `OT${period - 4}`;
}
export function periodColor(period: number): "red" | "blue" {
  return period === 1 || period === 3 ? "red" : "blue";
}

export interface PlayerTotal {
  rosterEntryId: number;
  side: Side;
  jersey: string;
  two: number;
  three: number;
  free: number;
  points: number;
  fouls: number;
  technical: number;
  unsportsmanlike: number;
  status: "eligible" | "excluded" | "GD" | "D";
}
export interface TeamTotal {
  points: number;
  periods: number[];
  freeMade: number;
  freeTaken: number;
  freeConceded: number;
  coachC: number;
  coachB: number;
  coachStatus: "eligible" | "GD" | "D";
  foulsByPeriod: number[];
}
export function aggregate(sheet: Sheet) {
  const players: PlayerTotal[] = sheet.roster.map((s) => ({
    ...s,
    two: 0,
    three: 0,
    free: 0,
    points: 0,
    fouls: 0,
    technical: 0,
    unsportsmanlike: 0,
    status: "eligible",
  }));
  const team = (): TeamTotal => ({
    points: 0,
    periods: Array(sheet.periods).fill(0),
    freeMade: 0,
    freeTaken: 0,
    freeConceded: 0,
    coachC: 0,
    coachB: 0,
    coachStatus: "eligible",
    foulsByPeriod: Array(sheet.periods).fill(0),
  });
  const teams = { home: team(), away: team() };
  const errors: string[] = [];
  for (const side of ["home", "away"] as const) {
    const roster = sheet.roster.filter((s) => s.side === side);
    if (
      !roster.length ||
      roster.length > 12 ||
      new Set(roster.map((s) => s.jersey)).size !== roster.length
    )
      errors.push(`Revise as camisas e os relacionados da equipe ${side === "home" ? "A" : "B"}.`);
    if (
      sheet.coachPlayer[side] !== null &&
      !roster.some((s) => s.rosterEntryId === sheet.coachPlayer[side])
    )
      errors.push("O atleta-treinador deve estar relacionado.");
  }
  if (new Set(sheet.roster.map((s) => s.rosterEntryId)).size !== sheet.roster.length)
    errors.push("Atleta duplicado.");
  if (new Set(sheet.events.map((e) => e.id)).size !== sheet.events.length)
    errors.push("Lançamento duplicado.");
  for (const event of [...sheet.events].sort((a, b) => a.period - b.period)) {
    const player = players.find((p) => p.side === event.side && p.jersey === event.target);
    const own = teams[event.side];
    const opponent = teams[event.side === "home" ? "away" : "home"];
    if (event.period > sheet.periods || (!player && !["B", "C"].includes(event.target))) {
      errors.push("Camisa ou período inválido.");
      continue;
    }
    if (player && !sheet.roster.find((s) => s.rosterEntryId === player.rosterEntryId)?.played)
      errors.push(`Marque a participação de #${player.jersey} antes de lançar pontos ou faltas.`);
    if (/^[123]$/.test(event.code) && player) {
      const points = Number(event.code);
      if (points === 1) {
        player.free++;
        own.freeMade++;
      }
      if (points === 2) player.two++;
      if (points === 3) player.three++;
      player.points += points;
      own.points += points;
      own.periods[event.period - 1] = (own.periods[event.period - 1] ?? 0) + points;
      continue;
    }
    const foul = parseFoul(event.code, event.target);
    if (!foul) {
      errors.push(`Código inválido: ${event.code}.`);
      continue;
    }
    own.freeConceded += foul.freeThrows;
    opponent.freeTaken += foul.freeThrows;
    if (player) {
      if (player.status !== "eligible")
        errors.push(
          `Há falta posterior à exclusão de #${player.jersey}. Use B para uma ocorrência de banco.`,
        );
      player.fouls++;
      own.foulsByPeriod[event.period - 1] = (own.foulsByPeriod[event.period - 1] ?? 0) + 1;
      if (foul.kind === "T") player.technical++;
      if (foul.kind === "U") player.unsportsmanlike++;
      player.status =
        foul.kind === "D"
          ? "D"
          : player.technical + player.unsportsmanlike >= 2
            ? "GD"
            : player.fouls >= 5
              ? "excluded"
              : "eligible";
    } else {
      if (foul.kind === "C") own.coachC++;
      if (foul.kind === "B" && event.code !== "B2") own.coachB++;
      if (foul.kind === "D") own.coachStatus = "D";
    }
    const coach = players.find((p) => p.rosterEntryId === sheet.coachPlayer[event.side]);
    if (coach?.status === "D") own.coachStatus = "D";
    if (
      own.coachStatus !== "D" &&
      (own.coachC >= 2 ||
        own.coachC + own.coachB >= 3 ||
        (coach &&
          (coach.status === "GD" ||
            coach.status === "D" ||
            (coach.technical + coach.unsportsmanlike > 0 && (own.coachC > 0 || own.coachB >= 2)))))
    )
      own.coachStatus = "GD";
    if (coach && own.coachStatus !== "eligible") coach.status = own.coachStatus;
  }
  return { players, teams, errors: [...new Set(errors)] };
}

export function validateSheet(input: unknown, final = false): Sheet {
  const sheet = documentSchema.parse(input);
  const result = aggregate(sheet);
  if (result.errors.length) throw new Error(result.errors[0]);
  if (final) {
    for (const team of Object.values(result.teams))
      if (team.freeMade > team.freeTaken)
        throw new Error("LL convertidos excedem LL cobrados. Revise as faltas adversárias.");
    if (result.teams.home.points === result.teams.away.points)
      throw new Error("O placar final está empatado.");
    for (let p = 4; p < sheet.periods; p++) {
      const total = (side: Side) =>
        result.teams[side].periods.slice(0, p).reduce((a, b) => a + b, 0);
      if (total("home") !== total("away"))
        throw new Error("Prorrogação sem empate no período anterior.");
    }
  }
  return sheet;
}

export interface History {
  present: Sheet;
  past: Sheet[];
  future: Sheet[];
}
export function change(history: History, next: Sheet): History {
  return {
    present: validateSheet(next),
    past: [...history.past.slice(-49), history.present],
    future: [],
  };
}
export function undo(history: History): History {
  const next = history.past.at(-1);
  return next
    ? {
        present: next,
        past: history.past.slice(0, -1),
        future: [...history.future, history.present],
      }
    : history;
}
export function redo(history: History): History {
  const next = history.future.at(-1);
  return next
    ? {
        present: next,
        past: [...history.past, history.present],
        future: history.future.slice(0, -1),
      }
    : history;
}
