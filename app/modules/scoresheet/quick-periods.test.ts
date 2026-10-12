import { describe, expect, it } from "vitest";
import { hasRecordedPointsAfterPeriod } from "./domain";
import {
  quickOvertimeEligibility,
  quickScoreBlockedByGd,
  quickScoreThroughPeriod,
} from "./quick-periods";

describe("overtime eligibility from cumulative conversion totals", () => {
  const tied = { "home-1-1-three": "2", "away-1-4-two": "3" };
  const confirmed = [4, 5, 6, 7, 8, 9, 10, 11, 12];
  it("requires explicit period completion even on a tied or empty scoreboard", () => {
    expect(quickOvertimeEligibility(tied, 4, []).canAdd).toBe(false);
    expect(quickOvertimeEligibility({}, 4, []).canAdd).toBe(false);
    expect(quickOvertimeEligibility(tied, 5, [4])).toMatchObject({
      canAdd: false,
      message: expect.stringContaining("OT1 concluído"),
    });
  });

  it("requires a cumulative tie, not just a tie in Q4", () => {
    expect(quickOvertimeEligibility(tied, 4, confirmed).canAdd).toBe(true);
    expect(quickScoreThroughPeriod(tied, 4)).toEqual({ home: 6, away: 6 });
    const untied = { ...tied, "home-2-2-free": "1", "home-2-4-fouls": "T" };
    expect(quickOvertimeEligibility(untied, 4, confirmed)).toMatchObject({
      canAdd: false,
      message: expect.stringContaining("7 × 6"),
    });
    expect(quickOvertimeEligibility({ "home-1-1-two": "1" }, 4, confirmed).canAdd).toBe(false);
  });

  it("requires a tie after each OT and rechecks previous ties after corrections", () => {
    const homeLeads = { ...tied, "home-1-5-free": "1" };
    expect(quickOvertimeEligibility(homeLeads, 5, confirmed).canAdd).toBe(false);
    const tiedOt = { ...homeLeads, "away-1-5-free": "1" };
    expect(quickOvertimeEligibility(tiedOt, 5, confirmed).canAdd).toBe(true);
    expect(quickScoreThroughPeriod(tiedOt, 5)).toEqual({ home: 7, away: 7 });
    const corrected = { ...tiedOt, "home-1-1-three": "1", "home-1-5-three": "1" };
    expect(quickOvertimeEligibility(corrected, 5, confirmed)).toMatchObject({
      canAdd: false,
      message: expect.stringContaining("preservados"),
    });
    expect(quickOvertimeEligibility(tied, 12, confirmed).canAdd).toBe(false);
  });

  it.each(["?", "-1", "1.5", "1e1", "100"])(
    "does not release OT using an unfinished counter %s",
    (value) => {
      expect(
        quickOvertimeEligibility({ ...tied, "home-1-2-two": value }, 4, confirmed).canAdd,
      ).toBe(false);
    },
  );

  it("treats blank counters as zero and excludes future periods and fouls", () => {
    expect(
      quickScoreThroughPeriod(
        { ...tied, "home-1-2-free": "", "home-1-4-fouls": "U2", "away-1-5-three": "?" },
        4,
      ),
    ).toEqual({ home: 6, away: 6 });
  });
});

describe("GD uses the shared Q4/OT foul group", () => {
  it("allows group scoring but blocks OT after an earlier GD", () => {
    for (let period = 4; period <= 12; period += 1) {
      expect(quickScoreBlockedByGd(period, 4)).toBe(false);
      expect(quickScoreBlockedByGd(period, 3)).toBe(true);
    }
    expect(quickScoreBlockedByGd(2, 2)).toBe(false);
    expect(hasRecordedPointsAfterPeriod({ "home-1-12-three": "1" }, "home", 1, 3)).toBe(true);
    expect(hasRecordedPointsAfterPeriod({ "home-1-5-two": "1" }, "home", 1, 4)).toBe(false);
    expect(hasRecordedPointsAfterPeriod({ "away-1-5-two": "1" }, "home", 1, 3)).toBe(false);
  });
});
