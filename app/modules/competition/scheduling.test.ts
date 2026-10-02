import { describe, expect, it } from "vitest";
import {
  scheduleId,
  schedulingError,
  validateResolution,
  validateSchedule,
  validateScheduleBatch,
} from "./scheduling";

function form(date = "2026-09-11", time = "19:30") {
  const value = new FormData();
  value.set("matchupId", "12");
  value.set("expectedRevision", "0");
  value.set("scheduledDate", date);
  value.set("scheduledTime", time);
  value.set("venue", " Quadra 1 ");
  return value;
}
describe("private scheduling input", () => {
  it("normalizes official local time and drops untrusted participant fields", () => {
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
    expect(validateSchedule(form("", ""))).toMatchObject({
      ok: true,
      input: { scheduledAt: null },
    });
  });
  it.each([
    ["2026-02-30", "12:00"],
    ["2026-09-11", "24:00"],
    ["yesterday", "19:30"],
    ["1899-01-01", "12:00"],
    ["2026-09-11", ""],
  ])("rejects invalid or incomplete local time %s %s", (date, time) => {
    expect(validateSchedule(form(date, time)).ok).toBe(false);
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

  it("builds one canonical batch and applies shared values only to selected games", () => {
    const input = new FormData();
    input.append("selectedMatchupId", "12");
    input.append("selectedMatchupId", "13");
    input.set("revision-12", "2");
    input.set("date-12", "2026-09-11");
    input.set("time-12", "18:00");
    input.set("venue-12", "Quadra A");
    input.set("revision-13", "4");
    input.set("date-13", "2026-09-12");
    input.set("time-13", "20:00");
    input.set("venue-13", "Quadra B");
    input.set("bulkDate", "2026-09-15");
    input.set("bulkVenue", "Ginásio Central");

    expect(validateScheduleBatch(input)).toEqual({
      ok: true,
      input: {
        items: [
          {
            matchupId: 12,
            expectedRevision: 2,
            scheduledAt: "2026-09-15T21:00:00.000Z",
            venue: "Ginásio Central",
          },
          {
            matchupId: 13,
            expectedRevision: 4,
            scheduledAt: "2026-09-15T23:00:00.000Z",
            venue: "Ginásio Central",
          },
        ],
      },
    });
  });

  it("rejects empty, duplicated or incomplete batch selections", () => {
    expect(validateScheduleBatch(new FormData()).ok).toBe(false);

    const duplicated = new FormData();
    duplicated.append("selectedMatchupId", "12");
    duplicated.append("selectedMatchupId", "12");
    expect(validateScheduleBatch(duplicated).ok).toBe(false);

    const incomplete = new FormData();
    incomplete.append("selectedMatchupId", "12");
    incomplete.set("revision-12", "0");
    incomplete.set("date-12", "2026-09-15");
    expect(validateScheduleBatch(incomplete).ok).toBe(false);
  });
});
