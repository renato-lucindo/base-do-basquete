import { describe, expect, it } from "vitest";

import {
  buildPrefillSlots,
  calculatePoints,
  deriveTeamScore,
  duplicateJerseys,
  evaluateDisqualification,
  parseFoulCodes,
  periodLabel,
} from "./domain";

describe("manual scoresheet domain", () => {
  it("derives points and rejects invalid conversions", () => {
    expect(calculatePoints(3, 2, 4)).toBe(16);
    expect(() => calculatePoints(-1, 0, 0)).toThrow(RangeError);
    expect(() => calculatePoints(0.5, 0, 0)).toThrow(RangeError);
  });

  it("uses the latest eligible lineup before alphabetical fallback", () => {
    const roster = [
      { rosterEntryId: 2, playerName: "Zeca", jerseyNumber: "7" },
      { rosterEntryId: 1, playerName: "Ana", jerseyNumber: "00" },
    ];
    const previous = [{ slotNumber: 3, rosterEntryId: 2, jerseyNumber: "9" }];
    expect(buildPrefillSlots(roster, previous)[0]).toEqual({
      slotNumber: 1,
      rosterEntryId: 2,
      jerseyNumber: "9",
    });
    const fallback = buildPrefillSlots(roster, []);
    expect(fallback.slice(0, 2).map((slot) => slot.rosterEntryId)).toEqual([1, 2]);
    expect(fallback).toHaveLength(12);
  });

  it("preserves 0 and 00 as distinct jerseys while detecting exact duplicates", () => {
    const duplicates = duplicateJerseys([
      { slotNumber: 1, rosterEntryId: 1, jerseyNumber: "00" },
      { slotNumber: 2, rosterEntryId: 2, jerseyNumber: "0" },
      { slotNumber: 3, rosterEntryId: 3, jerseyNumber: "00" },
    ]);
    expect([...duplicates]).toEqual(["00"]);
  });

  it.each([
    [["T", "T"], "2T"],
    [["U", "U"], "2U"],
    [["T", "U"], "T+U"],
    [["D"], "D"],
  ] as const)("derives GD for %j", (codes, reason) => {
    const result = evaluateDisqualification(
      codes.map((code, index) => ({ periodNumber: 1, sequenceNumber: index + 1, code })),
    );
    expect(result?.reason).toBe(reason);
  });

  it("does not derive GD from insufficient or personal fouls", () => {
    expect(
      evaluateDisqualification([
        { periodNumber: 1, sequenceNumber: 1, code: "P" },
        { periodNumber: 4, sequenceNumber: 1, code: "T" },
      ]),
    ).toBeNull();
  });

  it("parses only canonical ordered foul codes", () => {
    expect(parseFoulCodes("p, t, U2")).toEqual(["P", "T", "U2"]);
    expect(parseFoulCodes("X")).toBeNull();
  });

  it("labels regulation and overtime periods", () => {
    expect([1, 4, 5, 6].map(periodLabel)).toEqual(["Q1", "Q4", "OT1", "OT2"]);
  });

  it("derives a team score without accepting a stored total", () => {
    expect(
      deriveTeamScore(
        [
          {
            periodNumber: 1,
            stats: [
              { rosterEntryId: 1, twoPointMade: 2, threePointMade: 1, freeThrowMade: 1, fouls: [] },
              { rosterEntryId: 2, twoPointMade: 9, threePointMade: 0, freeThrowMade: 0, fouls: [] },
            ],
          },
        ],
        new Set([1]),
      ),
    ).toBe(8);
  });
});
