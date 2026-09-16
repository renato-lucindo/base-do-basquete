import { describe, expect, it } from "vitest";
import {
  parseGroupClosurePreview,
  parseSportsExceptionsDashboard,
  validateAmendmentInput,
  validateDecisionInput,
  validateGroupOrder,
} from "./sports-exceptions";

describe("sports exceptions boundary", () => {
  it("parses the discriminated private dashboard", () => {
    expect(
      parseSportsExceptionsDashboard({
        competitionId: 8,
        rulesetRevisionId: 10,
        preset: "single_elimination",
        groups: [],
        matchups: [
          {
            id: 1,
            code: "final_match_1",
            round: "Final",
            roundOrder: 2,
            groupId: null,
            homeRegistrationId: 3,
            awayRegistrationId: 4,
            game: null,
            outcome: null,
          },
        ],
      }),
    ).not.toBeNull();
  });

  it("rejects malformed dashboard data", () => {
    expect(
      parseSportsExceptionsDashboard({ competitionId: 8, groups: [], matchups: [] }),
    ).toBeNull();
  });

  it("parses a zero-point administrative standing", () => {
    expect(
      parseGroupClosurePreview({
        groupId: 1,
        eligible: true,
        closed: false,
        sourceHash: "a".repeat(32),
        invalidMatchupIds: [],
        standings: [
          {
            registrationId: 2,
            games: 1,
            wins: 1,
            losses: 0,
            pointsFor: 0,
            pointsAgainst: 0,
            pointDifference: 0,
          },
        ],
      }),
    ).not.toBeNull();
  });

  it("requires a winner belonging to the locked matchup", () => {
    const form = new FormData();
    form.set("matchupId", "1");
    form.set("homeRegistrationId", "2");
    form.set("awayRegistrationId", "3");
    form.set("winnerRegistrationId", "4");
    form.set("decisionType", "walkover");
    form.set("reason", "Motivo suficientemente detalhado");
    expect(validateDecisionInput(form, false).ok).toBe(false);
  });

  it("requires explicit secondary confirmation for a decision", () => {
    const form = new FormData();
    form.set("matchupId", "1");
    form.set("homeRegistrationId", "2");
    form.set("awayRegistrationId", "3");
    form.set("winnerRegistrationId", "2");
    form.set("decisionType", "withdrawal");
    form.set("reason", "Desistência formal devidamente documentada");
    form.set("requestId", "11111111-1111-4111-8111-111111111111");
    expect(validateDecisionInput(form, true).ok).toBe(false);
    form.set("confirmed", "on");
    expect(validateDecisionInput(form, true).ok).toBe(true);
  });

  it("rejects an amendment that keeps the same winner", () => {
    const form = new FormData();
    form.set("matchupId", "1");
    form.set("expectedWinnerRegistrationId", "2");
    form.set("correctedWinnerRegistrationId", "2");
    form.set("reason", "Correção documental com motivo suficiente");
    expect(validateAmendmentInput(form, false).ok).toBe(false);
  });

  it("orders a complete group by explicit positions", () => {
    const form = new FormData();
    form.set("groupId", "1");
    form.set("sourceHash", "a".repeat(32));
    form.set("requestId", "11111111-1111-4111-8111-111111111111");
    form.set("confirmed", "on");
    form.append("registrationId", "10");
    form.append("position", "2");
    form.append("registrationId", "20");
    form.append("position", "1");
    const parsed = validateGroupOrder(form);
    expect(parsed.ok && parsed.input.orderedRegistrationIds).toEqual([20, 10]);
  });

  it("rejects duplicate final positions", () => {
    const form = new FormData();
    form.set("groupId", "1");
    form.set("sourceHash", "a".repeat(32));
    form.set("requestId", "11111111-1111-4111-8111-111111111111");
    form.set("confirmed", "on");
    form.append("registrationId", "10");
    form.append("position", "1");
    form.append("registrationId", "20");
    form.append("position", "1");
    expect(validateGroupOrder(form).ok).toBe(false);
  });
});
