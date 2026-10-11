import { describe, expect, it } from "vitest";

import type { EditorSlot, SemanticFoulPayload } from "./domain";
import { prepareQuickFoul, prepareQuickScore } from "./fast-scoring-panel";

const slots: EditorSlot[] = [
  { slotNumber: 1, rosterEntryId: 12, jerseyNumber: "12" },
  { slotNumber: 2, rosterEntryId: 13, jerseyNumber: "00" },
];

describe("quick scoring conversion counters", () => {
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
  ) => prepareQuickFoul(fouls, slots, registrationId, period, target, value);

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
    expect(submit([], "12P", "player", 5)).toMatchObject({ ok: false });
    expect(submit([], "12P", "player", 1, 0)).toMatchObject({ ok: false });
  });
});
