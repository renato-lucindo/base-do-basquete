import { describe, expect, it } from "vitest";
import {
  calculateTeamFreeThrowEfficiency,
  createFoulEvent,
  createPointEvent,
  appendEvent,
  calculateScore,
  redo,
  undo,
  isDisqualified,
} from "./domain";

const context = {
  period: "Q1" as const,
  players: [
    { team: "home" as const, jersey: "12", playerId: "home-12" },
    { team: "away" as const, jersey: "12", playerId: "away-12" },
  ],
};

describe("manual scoresheet engine", () => {
  it("resolves duplicated jersey numbers using team context", () => {
    expect(createPointEvent(context, "home", "12", 3).playerId).toBe("home-12");
    expect(createPointEvent(context, "away", "12", 3).playerId).toBe("away-12");
  });

  it("creates fouls that grant team free throws", () => {
    const event = createFoulEvent({
      context,
      team: "away",
      jersey: "12",
      kind: "P",
      freeThrowsAwarded: 2,
    });

    expect(event.freeThrowsAwarded).toBe(2);
  });

  it("calculates collective free throw efficiency only", () => {
    expect(calculateTeamFreeThrowEfficiency(8, 10)).toBe(0.8);
  });

  it("detects FIBA disqualification combinations", () => {
    expect(isDisqualified([{ kind: "T" }, { kind: "U" }])).toBe(true);
    expect(isDisqualified([{ kind: "P" }, { kind: "P" }])).toBe(false);
  });

  it("keeps event history and supports undo/redo", () => {
    const initial = { events: [], undone: [] };
    const state = appendEvent(initial, createPointEvent(context, "home", "12", 3));
    expect(calculateScore(state.events, "home")).toBe(3);
    expect(undo(state).events).toHaveLength(0);
    expect(redo(undo(state)).events).toHaveLength(1);
  });
});
