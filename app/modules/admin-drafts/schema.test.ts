import { describe, expect, it } from "vitest";

import { createAdminDraft, parseAdminDraft } from "./schema";

describe("administrative draft schema", () => {
  it("serializes a versioned draft and restores it", () => {
    const now = new Date("2026-08-26T12:00:00.000Z");
    const draft = createAdminDraft("roster", 20, { selectedIds: [1, 2] }, { entityId: 7, now });
    const result = parseAdminDraft<{ selectedIds: number[] }>(JSON.stringify(draft), {
      flow: "roster",
      competitionId: 20,
      entityId: 7,
      now,
    });
    expect(result.status).toBe("available");
  });

  it("expires a draft after seven days", () => {
    const draft = createAdminDraft(
      "manual-scoresheet",
      20,
      { periodCount: 4 },
      { now: new Date("2026-08-01T00:00:00.000Z") },
    );
    expect(
      parseAdminDraft(JSON.stringify(draft), {
        flow: "manual-scoresheet",
        competitionId: 20,
        now: new Date("2026-08-09T00:00:00.000Z"),
      }).status,
    ).toBe("expired");
  });

  it("rejects sensitive fields before they reach local storage", () => {
    expect(() => createAdminDraft("boxscore-review", 20, { csrfToken: "secret" })).toThrow(
      "ADMIN_DRAFT_UNSAFE_DATA",
    );
  });

  it("discards an incompatible schema", () => {
    expect(
      parseAdminDraft('{"schemaVersion":2}', {
        flow: "roster",
        competitionId: 20,
      }).status,
    ).toBe("incompatible");
  });
});
