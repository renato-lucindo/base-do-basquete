import { describe, expect, it } from "vitest";
import {
  isRulesetEditRequestId,
  parseRulesetEditorDocument,
  parseRulesetEditResult,
  rulesetEditError,
} from "./ruleset-editor";

const document = {
  revision: { id: 7, competitionId: 100, number: 2, status: "draft", editorRevision: 1 },
  tracks: [{ id: 1, code: "main" }],
  stages: [{ id: 2, trackId: 1, code: "knockout", name: "Mata-mata", order: 1, kind: "knockout" }],
  rounds: [
    {
      id: 3,
      stageId: 2,
      code: "semi",
      name: "Semifinal",
      order: 1,
      role: "semifinal",
      capacity: 4,
      maxMatchups: 2,
      usedMatchups: 1,
    },
  ],
  entries: [{ id: 4, seed: 1 }],
  matchups: [
    {
      id: 5,
      roundId: 3,
      code: "semi_1",
      order: 1,
      home: { slotId: 6, kind: "entry", entrySeed: 1, sourceMatchupId: null },
      away: { slotId: 7, kind: "undefined", entrySeed: null, sourceMatchupId: null },
    },
  ],
  summary: { entries: 4, matchupCapacity: 2, matchups: 1, undefinedOrigins: 1 },
};

describe("ruleset editor contract", () => {
  it("parses a complete draft editor document", () => {
    expect(parseRulesetEditorDocument(document)).toMatchObject({
      revision: { id: 7, editorRevision: 1 },
      summary: { undefinedOrigins: 1 },
      matchups: [{ away: { kind: "undefined" } }],
    });
  });

  it("fails closed for active, partial or invalid documents", () => {
    expect(
      parseRulesetEditorDocument({
        ...document,
        revision: { ...document.revision, status: "active" },
      }),
    ).toBeNull();
    expect(
      parseRulesetEditorDocument({
        ...document,
        rounds: [],
        summary: { ...document.summary, matchups: -1 },
      }),
    ).toBeNull();
    expect(
      parseRulesetEditorDocument({
        ...document,
        matchups: [
          {
            ...document.matchups[0],
            home: { slotId: 6, kind: "entry", entrySeed: null, sourceMatchupId: null },
          },
        ],
      }),
    ).toBeNull();
  });

  it("maps stable errors without leaking database detail", () => {
    expect(rulesetEditError("BR006")).toContain("capacidade");
    expect(rulesetEditError("BR060")).toContain("mudou");
    expect(rulesetEditError("raw SQL error")).not.toContain("SQL");
  });

  it("validates request keys and mutation responses fail closed", () => {
    expect(isRulesetEditRequestId("624f1220-f0b0-44a7-9aa0-fcca0f2d0a01")).toBe(true);
    expect(isRulesetEditRequestId("not-a-uuid")).toBe(false);
    expect(
      parseRulesetEditResult({
        rulesetRevisionId: 7,
        editorRevision: 2,
        operation: "rename_stage",
        entityId: 9,
        outcome: "updated",
      }),
    ).toMatchObject({ editorRevision: 2, outcome: "updated" });
    expect(parseRulesetEditResult({ editorRevision: 2, outcome: "updated" })).toBeNull();
  });
});
