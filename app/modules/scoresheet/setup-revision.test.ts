import { describe, expect, it } from "vitest";
import {
  buildSetupRevision,
  revisionDiff,
  savedScoresheetScore,
  setupFromSavedScoresheet,
} from "./setup-revision";
import { updateSetupStat } from "./setup-state";

import { savedFixture } from "./setup-revision.fixture";

describe("saved scoresheet revisions", () => {
  it("round trips the snapshot without duplicating fouls or changing creation identity", () => {
    const payload = savedFixture();
    const setup = setupFromSavedScoresheet(payload);
    const base = { gameId: 42, submissionId: 80, payloadHash: "a".repeat(32), version: 1, payload };
    expect(setup.submissionKey).not.toBe(payload.idempotencyKey);
    expect(buildSetupRevision(setup, base).payload).toEqual(payload);
    expect(revisionDiff(setup, base)).toEqual([]);
    expect(setup.fouls).toHaveLength(1);
    expect(savedScoresheetScore(payload)).toBe("2 × 0");
  });
  it("shows metadata, jersey, scoring and foul changes", () => {
    const payload = savedFixture();
    const setup = setupFromSavedScoresheet(payload);
    setup.game.venue = "Novo ginásio";
    setup.slots.home[0]!.jerseyNumber = "0";
    setup.stats["home-1-4-two"] = "2";
    setup.fouls = [];
    const base = { gameId: 42, submissionId: 80, payloadHash: "a".repeat(32), version: 1, payload };
    expect(revisionDiff(setup, base).map((item) => item.path)).toEqual(
      expect.arrayContaining([
        "game.venue",
        "teams.home.slots.11.jerseyNumber",
        "periods.4.11.twoPointMade",
        "fouls.4:1:10:player:11:",
      ]),
    );
    expect(savedScoresheetScore(buildSetupRevision(setup, base).payload!)).toBe("4 × 0");
  });
  it("rejects a tampered participant and keeps immutable fallback and round fields", () => {
    const payload = savedFixture();
    const setup = setupFromSavedScoresheet(payload);
    const base = { gameId: 42, submissionId: 80, payloadHash: "a".repeat(32), version: 1, payload };
    setup.fallbackReason = "Attempt to change fallback";
    expect(buildSetupRevision(setup, base).payload?.fallbackReason).toBe(payload.fallbackReason);
    setup.registrationIds.home = 30;
    expect(buildSetupRevision(setup, base).payload).toBeNull();
  });
  it("loads existing OT attestations and invalidates them when earlier points change", () => {
    const payload = savedFixture();
    payload.periods[3]!.stats.find((entry) => entry.rosterEntryId === 21)!.twoPointMade = 1;
    payload.periods.push({
      periodNumber: 5,
      stats: [
        { rosterEntryId: 11, twoPointMade: 0, threePointMade: 0, freeThrowMade: 1, fouls: [] },
        { rosterEntryId: 21, twoPointMade: 0, threePointMade: 0, freeThrowMade: 0, fouls: [] },
      ],
    });
    const setup = setupFromSavedScoresheet(payload);
    const base = { gameId: 42, submissionId: 80, payloadHash: "a".repeat(32), version: 1, payload };
    expect(setup.completedPeriods).toEqual([4]);
    expect(buildSetupRevision(setup, base).issues).toEqual([]);
    expect(
      buildSetupRevision(updateSetupStat(setup, "home-1-4-two", "2"), base).payload,
    ).toBeNull();
  });
});
