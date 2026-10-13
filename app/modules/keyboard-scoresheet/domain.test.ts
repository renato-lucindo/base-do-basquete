import { describe, expect, it } from "vitest";
import {
  aggregate,
  change,
  parseFoul,
  periodColor,
  redo,
  type Sheet,
  undo,
  validateSheet,
} from "./domain";

const base: Sheet = {
  rulesVersion: "FIBA_2024",
  periods: 4,
  coachPlayer: { home: null, away: null },
  roster: [
    { rosterEntryId: 1, registrationId: 10, side: "home", jersey: "12", played: true },
    { rosterEntryId: 2, registrationId: 20, side: "away", jersey: "12", played: true },
    { rosterEntryId: 3, registrationId: 10, side: "home", jersey: "00", played: true },
  ],
  events: [],
};
let serial = 0;
function entry(side: "home" | "away", code: string, period = 1, target = "12") {
  return {
    id: `00000000-0000-4000-8000-${String(++serial).padStart(12, "0")}`,
    side,
    code,
    period,
    target,
  };
}
describe("keyboard transcription", () => {
  it("preserves direct D in both player-coach roles", () => {
    for (const target of ["12", "C"]) {
      const result = aggregate({
        ...base,
        coachPlayer: { home: 1, away: null },
        events: [entry("home", "D2", 1, target)],
      });
      expect(result.players[0]?.status).toBe("D");
      expect(result.teams.home.coachStatus).toBe("D");
    }
  });
  it("distinguishes a related DNP from a participant with zero points", () => {
    const sheet = {
      ...base,
      roster: base.roster.map((s) => ({ ...s, played: s.rosterEntryId !== 3 })),
    };
    expect(validateSheet(sheet).roster.find((s) => s.rosterEntryId === 3)?.played).toBe(false);
    expect(() => validateSheet({ ...sheet, events: [entry("home", "2", 1, "00")] })).toThrow(
      "participação",
    );
  });
  it("keeps same jerseys separated by team and 00 distinct", () => {
    const result = aggregate({
      ...base,
      events: [entry("home", "3"), entry("away", "2"), entry("home", "1", 1, "00")],
    });
    expect(result.teams.home.points).toBe(4);
    expect(result.teams.away.points).toBe(2);
    expect(result.players.find((p) => p.jersey === "00")?.free).toBe(1);
  });
  it.each(["Pc", "Tc", "Uc", "Dc", "Bc", "Cc"])(
    "preserves compensated %s without free throws",
    (code) => {
      const target = code.startsWith("B") ? "B" : code.startsWith("C") ? "C" : "12";
      expect(parseFoul(code, target)).toMatchObject({ compensated: true, freeThrows: 0 });
    },
  );
  it.each(["T2", "C2", "B3", "TC1", "U4", "Z2"])("rejects non-FIBA notation %s", (code) =>
    expect(
      parseFoul(code, code.startsWith("C") ? "C" : code.startsWith("B") ? "B" : "12"),
    ).toBeNull(),
  );
  it("U2 is one unsportsmanlike foul granting two team free throws", () => {
    const result = aggregate({ ...base, events: [entry("away", "U2")] });
    expect(result.players[1]).toMatchObject({ fouls: 1, unsportsmanlike: 1, status: "eligible" });
    expect(result.teams.away.freeConceded).toBe(2);
    expect(result.teams.home.freeTaken).toBe(2);
  });
  it.each([
    ["Tc", "Uc"],
    ["Tc", "T1"],
    ["Uc", "U2"],
  ])("counts compensated fouls towards GD %s/%s", (a, b) => {
    expect(
      aggregate({ ...base, events: [entry("home", a), entry("home", b)] }).players[0]?.status,
    ).toBe("GD");
  });
  it("counts five personal fouls and restores exclusion after undo", () => {
    const sheet = { ...base, events: Array.from({ length: 5 }, () => entry("home", "Pc")) };
    expect(aggregate(sheet).players[0]?.status).toBe("excluded");
    const history = change(
      { present: { ...sheet, events: sheet.events.slice(0, 4) }, past: [], future: [] },
      sheet,
    );
    expect(aggregate(undo(history).present).players[0]?.status).toBe("eligible");
    expect(aggregate(redo(undo(history)).present).players[0]?.status).toBe("excluded");
    expect(() =>
      validateSheet({ ...sheet, events: [...sheet.events, entry("home", "P")] }),
    ).toThrow("posterior");
  });
  it("coach C+C or three B/C cause GD; B2 is not a technical counter", () => {
    expect(
      aggregate({ ...base, events: [entry("home", "Cc", 1, "C"), entry("home", "C1", 1, "C")] })
        .teams.home.coachStatus,
    ).toBe("GD");
    expect(
      aggregate({
        ...base,
        events: [
          entry("home", "B1", 1, "B"),
          entry("home", "B2", 1, "B"),
          entry("home", "B1", 1, "B"),
        ],
      }).teams.home,
    ).toMatchObject({ coachStatus: "eligible", freeConceded: 4 });
    expect(
      aggregate({
        ...base,
        events: [
          entry("home", "B1", 1, "B"),
          entry("home", "Bc", 1, "B"),
          entry("home", "C1", 1, "C"),
        ],
      }).teams.home.coachStatus,
    ).toBe("GD");
  });
  it("combines player-coach personal technical and C1", () => {
    const result = aggregate({
      ...base,
      coachPlayer: { home: 1, away: null },
      events: [entry("home", "T1"), entry("home", "C1", 1, "C")],
    });
    expect(result.players[0]?.status).toBe("GD");
    expect(result.teams.home.coachStatus).toBe("GD");
  });
  it("rejects duplicate events and wrong-team jerseys", () => {
    const e = entry("home", "2");
    expect(() => validateSheet({ ...base, events: [e, e] })).toThrow("duplicado");
    expect(() => validateSheet({ ...base, events: [entry("away", "2", 1, "00")] })).toThrow(
      "Camisa",
    );
  });
  it("edits or moves an event and recalculates both teams and periods", () => {
    const e = entry("home", "P2");
    const sheet = { ...base, events: [e] };
    const next = change(
      { present: sheet, past: [], future: [] },
      { ...sheet, events: [{ ...e, side: "away", period: 2, code: "P3" }] },
    );
    expect(aggregate(next.present).teams.home.freeTaken).toBe(3);
    expect(aggregate(next.present).teams.away.freeTaken).toBe(0);
    expect(periodColor(next.present.events[0]?.period ?? 0)).toBe("blue");
    expect(undo(next).present.events[0]).toEqual(e);
  });
  it("requires final reconciliation but permits partial draft entry", () => {
    const sheet = { ...base, events: [entry("home", "1")] };
    expect(() => validateSheet(sheet)).not.toThrow();
    expect(() => validateSheet(sheet, true)).toThrow("LL convertidos");
    expect(() =>
      validateSheet({ ...sheet, events: [...sheet.events, entry("away", "B1", 1, "B")] }, true),
    ).not.toThrow();
  });
  it("validates multi-overtime scores and keeps original colors", () => {
    const sheet = {
      ...base,
      periods: 6,
      events: [
        entry("home", "2", 1),
        entry("away", "2", 2),
        entry("home", "3", 5),
        entry("away", "3", 5),
        entry("home", "2", 6),
      ],
    };
    expect(() => validateSheet(sheet, true)).not.toThrow();
    expect([1, 2, 3, 4, 5, 6].map(periodColor)).toEqual([
      "red",
      "blue",
      "red",
      "blue",
      "blue",
      "blue",
    ]);
    expect(() =>
      validateSheet(
        { ...sheet, events: sheet.events.filter((e) => !(e.side === "away" && e.period === 5)) },
        true,
      ),
    ).toThrow("Prorrogação");
  });
});
