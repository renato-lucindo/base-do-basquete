import { describe, expect, it } from "vitest";

import {
  ADMIN_DRAFT_TTL_MS,
  createAdminFormDraft,
  parseAdminFormDraft,
  sanitizeDraftEntries,
} from "./form-draft";

describe("secure administrative form drafts", () => {
  it("never persists credentials, CSRF, sessions, PDF or file values", () => {
    const fields = sanitizeDraftEntries([
      ["playerId", "12"],
      ["jersey-12", "07"],
      ["csrfToken", "forbidden"],
      ["sessionSecret", "forbidden"],
      ["boxscorePdf", new File(["pdf"], "boxscore.pdf", { type: "application/pdf" })],
    ]);
    expect(fields).toEqual({ playerId: ["12"], "jersey-12": ["07"] });
  });

  it("associates a draft with exactly one form and context", () => {
    const draft = createAdminFormDraft("roster-2", "competition-9", { playerId: ["12"] }, 100);
    const raw = JSON.stringify(draft);
    expect(parseAdminFormDraft(raw, "roster-2", "competition-9", 101)).toEqual(draft);
    expect(parseAdminFormDraft(raw, "roster-3", "competition-9", 101)).toBeNull();
    expect(parseAdminFormDraft(raw, "roster-2", "competition-10", 101)).toBeNull();
  });

  it("expires automatically and rejects malformed payloads", () => {
    const draft = createAdminFormDraft("scoresheet", "competition-9", {}, 100);
    expect(
      parseAdminFormDraft(
        JSON.stringify(draft),
        "scoresheet",
        "competition-9",
        100 + ADMIN_DRAFT_TTL_MS,
      ),
    ).toBeNull();
    expect(parseAdminFormDraft("{invalid", "scoresheet", "competition-9")).toBeNull();
  });

  it("re-sanitizes stored field names while parsing", () => {
    const draft = createAdminFormDraft(
      "review",
      "import-4",
      { registration: ["2"], authToken: ["forbidden"] },
      100,
    );
    expect(parseAdminFormDraft(JSON.stringify(draft), "review", "import-4", 101)?.fields).toEqual({
      registration: ["2"],
    });
  });
});
