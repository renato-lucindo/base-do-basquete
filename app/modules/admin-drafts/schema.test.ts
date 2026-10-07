import { describe, expect, it } from "vitest";

import {
  adminDraftKey,
  createAdminDraft,
  MANUAL_SCORESHEET_DRAFT_EDITOR_VERSION,
  parseAdminDraft,
} from "./schema";

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

  it("scopes scoresheet drafts by editor version", () => {
    expect(adminDraftKey("roster", 20, 7)).toBe("base-do-basquete:admin-draft:v1:roster:20:7");
    expect(
      adminDraftKey("manual-scoresheet", 20, undefined, MANUAL_SCORESHEET_DRAFT_EDITOR_VERSION),
    ).toBe("base-do-basquete:admin-draft:v1:manual-scoresheet:20:new:v2");
    const draft = createAdminDraft(
      "manual-scoresheet",
      20,
      { periodCount: 4 },
      {
        editorVersion: MANUAL_SCORESHEET_DRAFT_EDITOR_VERSION,
        now: new Date("2026-08-01T00:00:00.000Z"),
      },
    );
    expect(
      parseAdminDraft(JSON.stringify(draft), {
        flow: "manual-scoresheet",
        competitionId: 20,
        editorVersion: MANUAL_SCORESHEET_DRAFT_EDITOR_VERSION,
        now: new Date("2026-08-01T12:00:00.000Z"),
      }).status,
    ).toBe("available");
    expect(
      parseAdminDraft(JSON.stringify(draft), {
        flow: "manual-scoresheet",
        competitionId: 20,
        editorVersion: "v1",
        now: new Date("2026-08-01T12:00:00.000Z"),
      }).status,
    ).toBe("incompatible");
  });

  it("discards malformed draft envelopes before using their data", () => {
    expect(
      parseAdminDraft(
        JSON.stringify({
          schemaVersion: 1,
          flow: "roster",
          competitionId: "20",
          savedAt: "2026-08-01T00:00:00.000Z",
          expiresAt: "2026-08-02T00:00:00.000Z",
          data: {},
        }),
        {
          flow: "roster",
          competitionId: 20,
          now: new Date("2026-08-01T12:00:00.000Z"),
        },
      ).status,
    ).toBe("incompatible");
  });
});
