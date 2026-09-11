import { describe, expect, it } from "vitest";
import { scheduleId, schedulingError, validateResolution, validateSchedule } from "./scheduling";

function form(date = "2026-09-11T19:30-03:00") {
  const value = new FormData();
  value.set("matchupId", "12");
  value.set("expectedRevision", "0");
  value.set("scheduledAt", date);
  value.set("venue", " Quadra 1 ");
  return value;
}
describe("private scheduling input", () => {
  it("normalizes explicit offset and drops untrusted participant fields", () => {
    const input = form();
    input.set("homeRegistrationId", "99");
    expect(validateSchedule(input)).toEqual({
      ok: true,
      input: {
        matchupId: 12,
        expectedRevision: 0,
        scheduledAt: "2026-09-11T22:30:00.000Z",
        venue: "Quadra 1",
      },
    });
  });
  it("allows a private preparation without a date", () => {
    expect(validateSchedule(form(""))).toMatchObject({ ok: true, input: { scheduledAt: null } });
  });
  it.each([
    "2026-02-30T12:00Z",
    "2026-09-11T19:30",
    "2026-09-11T24:00Z",
    "yesterday",
    "1899-01-01T12:00Z",
  ])("rejects invalid or implicit time %s", (date) => {
    expect(validateSchedule(form(date)).ok).toBe(false);
  });
  it.each(["-1", "1.2", "9007199254740992", "01", ""])("rejects invalid version %s", (revision) => {
    const input = form();
    input.set("expectedRevision", revision);
    expect(validateSchedule(input).ok).toBe(false);
  });
  it("bounds the venue", () => {
    const input = form();
    input.set("venue", "x".repeat(161));
    expect(validateSchedule(input).ok).toBe(false);
  });
  it.each(["0", "-1", "NaN", "1e2", "9007199254740992"])("rejects unsafe id %s", (id) => {
    expect(scheduleId(id)).toBeNull();
  });
  it("does not expose database details", () => {
    expect(schedulingError("SQL secret detail")).not.toContain("SQL");
    expect(schedulingError("BR026")).toContain("Recarregue");
  });
  it("accepts only explicit safe ids for result resolution", () => {
    const input = new FormData();
    input.set("matchupId", "12");
    input.set("officialResultSubmissionId", "34");
    expect(validateResolution(input)).toEqual({
      ok: true,
      input: { matchupId: 12, submissionId: 34 },
    });
    input.set("officialResultSubmissionId", "1e2");
    expect(validateResolution(input).ok).toBe(false);
  });
});
