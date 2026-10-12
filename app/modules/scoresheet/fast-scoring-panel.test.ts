import { describe, expect, it } from "vitest";

import {
  evaluateDisqualification,
  playerFoulsForDisqualification,
  type EditorSlot,
  type SemanticFoulPayload,
} from "./domain";
import { prepareQuickFoul, prepareQuickScore } from "./fast-scoring-panel";

const slots: EditorSlot[] = [
  { slotNumber: 1, rosterEntryId: 12, jerseyNumber: "12" },
  { slotNumber: 2, rosterEntryId: 13, jerseyNumber: "00" },
];

describe("quick scoring conversion counters", () => {
  it("records OT1 and OT8 separately and rejects invalid periods", () => {
    expect(prepareQuickScore({}, slots, "home", 5, "12", 2)).toMatchObject({
      ok: true,
      entry: { key: "home-1-5-two", next: "1" },
    });
    expect(prepareQuickScore({}, slots, "away", 12, "00", 1)).toMatchObject({
      ok: true,
      entry: { key: "away-2-12-free", next: "1" },
    });
    for (const period of [0, 13, 4.5, Number.NaN])
      expect(prepareQuickScore({}, slots, "home", period, "12", 2)).toMatchObject({ ok: false });
  });
  it("keeps jersey 00 as text and increments the correct period/side/category", () => {
    const result = prepareQuickScore({}, slots, "home", 1, "00", 3);
    expect(result).toEqual({
      ok: true,
      entry: {
        key: "home-2-1-three",
        previous: undefined,
        next: "1",
        jerseyNumber: "00",
        points: 3,
        side: "home",
        periodNumber: 1,
      },
    });
    expect(prepareQuickScore({ "away-1-2-free": "2" }, slots, "away", 2, "12", 1)).toMatchObject({
      ok: true,
      entry: { key: "away-1-2-free", previous: "2", next: "3" },
    });
    expect(prepareQuickScore({}, slots, "home", 4, "12", 2)).toMatchObject({
      ok: true,
      entry: { key: "home-1-4-two", next: "1" },
    });
  });

  it("rejects unknown or duplicate jerseys and invalid or capped counters", () => {
    expect(prepareQuickScore({}, slots, "home", 1, "9", 2)).toMatchObject({ ok: false });
    expect(
      prepareQuickScore(
        {},
        [...slots, { slotNumber: 3, rosterEntryId: 14, jerseyNumber: "00" }],
        "home",
        1,
        "00",
        2,
      ),
    ).toMatchObject({ ok: false });
    expect(prepareQuickScore({ "home-1-1-two": "99" }, slots, "home", 1, "12", 2)).toMatchObject({
      ok: false,
    });
    expect(prepareQuickScore({ "home-1-1-two": "NaN" }, slots, "home", 1, "12", 2)).toMatchObject({
      ok: false,
    });
  });
});

describe("quick foul entry and FIBA 2024 GD", () => {
  const submit = (
    fouls: SemanticFoulPayload[],
    value: string,
    target: "player" | "bench" | "coach" | "assistant_1" = "player",
    period = 1,
    registrationId = 10,
    stats: Record<string, string> = {},
    side: "home" | "away" = "home",
  ) => prepareQuickFoul(fouls, slots, registrationId, period, target, value, stats, side);

  it("shares Q4/OT sequence and GD without inventing an OT foul period", () => {
    const q4 = submit([], "12U2", "player", 4);
    if (!q4.ok) throw new Error(q4.message);
    const ot = submit([q4.entry], "12T1", "player", 5, 10, { "home-1-5-two": "1" });
    expect(ot).toMatchObject({
      ok: true,
      entry: { periodNumber: 4, sequenceNumber: 2 },
      disqualification: "T+U",
    });
    if (!ot.ok) throw new Error(ot.message);
    expect(submit([q4.entry, ot.entry], "12P", "player", 6)).toMatchObject({ ok: false });
    for (const target of ["bench", "coach", "assistant_1"] as const) {
      expect(
        submit([q4.entry, ot.entry], target === "coach" ? "C1" : "B1", target, 12),
      ).toMatchObject({
        ok: true,
        entry: { periodNumber: 4, sequenceNumber: 3, target: { registrationId: 10 } },
      });
    }
    expect(submit([], "12D", "player", 3, 10, { "home-1-5-free": "1" })).toMatchObject({
      ok: false,
    });
    expect(submit([], "12D", "player", 4, 10, { "home-1-5-free": "1" })).toMatchObject({
      ok: true,
    });
  });

  it("accepts spaced and lowercase FIBA notation, keeping literal 00 and global period sequence", () => {
    const first = submit([], "12u2");
    expect(first).toMatchObject({
      ok: true,
      entry: {
        periodNumber: 1,
        sequenceNumber: 1,
        type: "U",
        penaltyFtCount: 2,
        originalNotation: "U2",
        rulesVersion: "FIBA_2024",
        target: { kind: "player", registrationId: 10, rosterEntryId: 12 },
      },
    });
    if (!first.ok) throw new Error(first.message);
    expect(submit([first.entry], "00 d", "player", 1, 20)).toMatchObject({
      ok: true,
      entry: { sequenceNumber: 2, target: { rosterEntryId: 13, registrationId: 20 } },
      disqualification: "D",
    });
    expect(submit([first.entry], "12 T1", "player", 2)).toMatchObject({
      ok: true,
      entry: { periodNumber: 2, sequenceNumber: 1, type: "T" },
      disqualification: "T+U",
    });
  });

  it("rejects post-GD and retroactive GD without invalidating other players", () => {
    const u = submit([], "12U2");
    if (!u.ok) throw new Error(u.message);
    const second = submit([u.entry], "12U2");
    expect(second).toMatchObject({ ok: true, disqualification: "2U" });
    if (!second.ok) throw new Error(second.message);
    expect(submit([u.entry, second.entry], "12P")).toMatchObject({
      ok: false,
      message: expect.stringContaining("GD"),
    });
    expect(submit([u.entry, second.entry], "00P")).toMatchObject({ ok: true });
    const later = submit([], "12P", "player", 3);
    if (!later.ok) throw new Error(later.message);
    expect(submit([later.entry], "12D", "player", 2)).toMatchObject({
      ok: false,
      message: expect.stringContaining("posteriores"),
    });
    expect(submit([], "12D")).toMatchObject({ ok: true, disqualification: "D" });
    const t = submit([], "12T");
    if (!t.ok) throw new Error(t.message);
    expect(submit([t.entry], "12T")).toMatchObject({ ok: true, disqualification: "2T" });
  });

  it("keeps bench and staff events without a synthetic athlete and validates their codes", () => {
    expect(submit([], "b1", "bench")).toMatchObject({
      ok: true,
      entry: {
        target: { kind: "bench", registrationId: 10 },
        type: "T",
        originalNotation: "B1",
      },
    });
    expect(submit([], "C1", "coach")).toMatchObject({
      ok: true,
      entry: {
        target: { kind: "staff", registrationId: 10, staffRole: "coach" },
      },
    });
    expect(submit([], "B1", "assistant_1")).toMatchObject({
      ok: true,
      entry: {
        target: { kind: "staff", staffRole: "assistant_1" },
      },
    });
    expect(submit([], "C1", "bench")).toMatchObject({ ok: false });
    expect(submit([], "12X2")).toMatchObject({ ok: false });
    expect(submit([], "99T")).toMatchObject({ ok: false });
    expect(submit([], "12P", "player", 13)).toMatchObject({ ok: false });
    expect(submit([], "12P", "player", 1, 0)).toMatchObject({ ok: false });
  });

  it("reconciles legacy and semantic fouls exactly once, including identical notations", () => {
    const stats = { "home-1-1-fouls": "T,T", "away-1-1-fouls": "D" };
    const playerSlot = slots[0];
    if (!playerSlot) throw new Error("missing player slot");
    const player = playerFoulsForDisqualification(stats, [], "home", playerSlot, 10);
    expect(player).toHaveLength(2);
    expect(evaluateDisqualification(player ?? [])).toMatchObject({ reason: "2T", periodNumber: 1 });
    expect(submit([], "12P", "player", 2, 10, stats)).toMatchObject({
      ok: false,
      message: expect.stringContaining("GD"),
    });
    const first = submit([], "12U2", "player", 1, 10, { "home-1-1-fouls": "T" });
    expect(first).toMatchObject({ ok: true, disqualification: "T+U" });
    if (!first.ok) throw new Error(first.message);
    expect(
      playerFoulsForDisqualification(
        { "home-1-1-fouls": "T" },
        [first.entry],
        "home",
        playerSlot,
        10,
      ),
    ).toHaveLength(2);
    expect(submit([], "12U2", "player", 1, 10, { "away-1-1-fouls": "D" })).toMatchObject({
      ok: true,
      disqualification: null,
    });
    expect(submit([], "12P", "player", 1, 10, { "home-1-1-fouls": "T,?" })).toMatchObject({
      ok: false,
      message: expect.stringContaining("legadas incompletas"),
    });
  });

  it("allows an earlier-period foul before an existing GD but rejects a newly earlier GD", () => {
    const disqualifying = submit([], "12D", "player", 3);
    if (!disqualifying.ok) throw new Error(disqualifying.message);
    expect(submit([disqualifying.entry], "12P", "player", 2)).toMatchObject({
      ok: true,
      disqualification: "D",
    });
    expect(submit([disqualifying.entry], "12P", "player", 3)).toMatchObject({
      ok: false,
      message: expect.stringContaining("posteriores"),
    });

    const technical = submit([], "12T", "player", 1);
    if (!technical.ok) throw new Error(technical.message);
    const laterD = submit([technical.entry], "12D", "player", 3);
    if (!laterD.ok) throw new Error(laterD.message);
    expect(submit([technical.entry, laterD.entry], "12T", "player", 2)).toMatchObject({
      ok: false,
      message: expect.stringContaining("posteriores"),
    });
  });

  it("rejects retroactive GD with later scoring, but accepts scoring in the GD period", () => {
    const futurePoints = { "home-1-3-two": "1" };
    expect(submit([], "12D", "player", 2, 10, futurePoints)).toMatchObject({
      ok: false,
      message: expect.stringContaining("GD retroativa"),
    });
    expect(submit([], "12D", "player", 2, 10, { "home-1-2-two": "1" })).toMatchObject({
      ok: true,
      disqualification: "D",
    });
    expect(submit([], "12D", "player", 2, 10, { "away-1-3-two": "1" })).toMatchObject({
      ok: true,
      disqualification: "D",
    });
    expect(
      submit([], "12U2", "player", 2, 10, { ...futurePoints, "home-1-1-fouls": "T" }),
    ).toMatchObject({
      ok: false,
      message: expect.stringContaining("GD retroativa"),
    });
    expect(submit([], "12P", "player", 2, 10, futurePoints)).toMatchObject({
      ok: true,
      disqualification: null,
    });
  });
});
