import { describe, expect, it } from "vitest";

import type { EditorSlot } from "./domain";
import { prepareQuickScore } from "./fast-scoring-panel";

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
