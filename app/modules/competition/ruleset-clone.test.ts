import { describe, expect, it } from "vitest";
import {
  isRulesetCloneRequestId,
  parseRulesetCloneResult,
  parseRulesetCloneSource,
  rulesetCloneError,
} from "./ruleset-clone";

const source = {
  source_revision_id: 12,
  source_competition_id: 8,
  display_name: "Copa 2025",
  edition_year: 2025,
  gender_division: "male",
  revision_number: 2,
  source_kind: "edition",
  preset_key: null,
  entry_count: 8,
  gender_mismatch: false,
  structure_summary: { tracks: 1, stages: 2, rounds: 4, entries: 8, matchups: 7 },
};

describe("ruleset clone boundary", () => {
  it("parses the complete database source contract", () => {
    expect(parseRulesetCloneSource(source)).toMatchObject({
      revisionId: 12,
      competitionId: 8,
      displayName: "Copa 2025",
      entryCount: 8,
      genderMismatch: false,
      structure: { rounds: 4, matchups: 7 },
    });
  });

  it("fails closed for incomplete, negative or unsupported sources", () => {
    expect(parseRulesetCloneSource({ ...source, gender_division: null })).toBeNull();
    expect(
      parseRulesetCloneSource({
        ...source,
        structure_summary: { ...source.structure_summary, matchups: -1 },
      }),
    ).toBeNull();
    expect(parseRulesetCloneSource({ ...source, structure_summary: {} })).toBeNull();
  });

  it("accepts only UUID v4 request keys and positive result identifiers", () => {
    expect(isRulesetCloneRequestId("40dde5c7-46b2-4241-995d-4e42223bbdf2")).toBe(true);
    expect(isRulesetCloneRequestId("40dde5c7-46b2-1241-995d-4e42223bbdf2")).toBe(false);
    expect(parseRulesetCloneResult({ rulesetRevisionId: 42 })).toBe(42);
    expect(parseRulesetCloneResult({ rulesetRevisionId: -1 })).toBeNull();
  });

  it("maps stable errors without exposing database details", () => {
    expect(rulesetCloneError("BR057")).toContain("outro naipe");
    expect(rulesetCloneError("BR058")).toContain("rascunho");
    expect(rulesetCloneError("internal SQL")).not.toContain("SQL");
  });
});
