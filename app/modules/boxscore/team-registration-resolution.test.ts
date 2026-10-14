import { describe, expect, it } from "vitest";

import type { ParsedBoxscore } from "./types";
import {
  matchingRegistrationCandidates,
  uniqueRegistrationCandidate,
} from "./team-registration-resolution";

const sourceTeam = {
  name: "Lobos B",
  abbreviation: "LOB",
  score: 0,
  periodScores: [],
  players: [],
} satisfies ParsedBoxscore["teams"][number];

const candidates = [
  { teamId: 1, teamName: "Lobos", publicName: "Lobos", abbreviation: "LOB", registrationId: 10 },
  { teamId: 1, teamName: "Lobos", publicName: "Lobos B", abbreviation: "LOB", registrationId: 11 },
];

describe("team registration resolution", () => {
  it("prefers the exact registration public name over a shared global team identity", () => {
    expect(
      matchingRegistrationCandidates(sourceTeam, candidates).map((item) => item.registrationId),
    ).toEqual([11]);
    expect(uniqueRegistrationCandidate(sourceTeam, candidates)?.registrationId).toBe(11);
  });

  it("does not silently choose when only a shared abbreviation matches multiple registrations", () => {
    const ambiguous = { ...sourceTeam, name: "Lobos EC" };
    expect(matchingRegistrationCandidates(ambiguous, candidates)).toHaveLength(2);
    expect(uniqueRegistrationCandidate(ambiguous, candidates)).toBeUndefined();
  });
});
