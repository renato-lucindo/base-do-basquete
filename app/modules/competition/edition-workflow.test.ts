import { describe, expect, it } from "vitest";
import {
  disputeName,
  masterAges,
  validateEditionWorkflow,
  workflowInputFromForm,
  type EditionWorkflowInput,
} from "./edition-workflow";
const workflowFixture: EditionWorkflowInput = {
  seriesId: null,
  championshipName: "RED",
  seasonId: null,
  categoryKind: "adult",
  categoryAge: null,
  year: 2026,
  gender: "male",
  description: null,
  startsOn: null,
  endsOn: null,
  divisionMode: "none",
  divisionValueId: null,
  divisionTypeName: null,
  divisionValueName: null,
  source: "manual_scoresheet",
  preset: "single_group",
  entryCount: 4,
  expectedProfileId: null,
  reason: null,
  reviewed: false,
};
describe("edition workflow", () => {
  it.each([
    ["adult", null, "RED"],
    ["base", 17, "RED - Sub-17"],
    ["master", 55, "RED - 55+"],
  ] as const)("derives %s names without an Adulto suffix", (kind, age, name) => {
    expect(disputeName("RED", kind, age)).toBe(name);
  });
  it("keeps competitive division independent", () => {
    expect(disputeName("GREEN", "base", 17, "Série Ouro")).toBe("GREEN - Sub-17 · Série Ouro");
    expect(disputeName("RED", "adult", null, "Série Ouro")).toBe("RED - Série Ouro");
  });
  it.each([12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23])(
    "accepts every base age %i",
    (categoryAge) => {
      expect(
        validateEditionWorkflow({ ...workflowFixture, categoryKind: "base", categoryAge }, 2026).ok,
      ).toBe(true);
    },
  );
  it.each(masterAges)("accepts Master %i", (categoryAge) => {
    expect(
      validateEditionWorkflow({ ...workflowFixture, categoryKind: "master", categoryAge }, 2026).ok,
    ).toBe(true);
  });
  it.each([
    { categoryKind: "base", categoryAge: 11 },
    { categoryKind: "base", categoryAge: 24 },
    { categoryKind: "base", categoryAge: 17.5 },
    { categoryKind: "master", categoryAge: 38 },
    { categoryKind: "master", categoryAge: 42 },
    { categoryKind: "master", categoryAge: 57 },
    { categoryKind: "adult", categoryAge: 30 },
    { categoryKind: "master", categoryAge: null },
    { year: 2028 },
    { gender: "" },
    { startsOn: "2026-12-01", endsOn: "2026-01-01" },
    { startsOn: "2026-02-30" },
    { divisionMode: "existing", divisionValueId: 1 },
    { divisionMode: "none", divisionValueName: "Ouro" },
    { displayName: "untrusted" },
  ])("rejects invalid input %j", (delta) => {
    expect(validateEditionWorkflow({ ...workflowFixture, ...delta }, 2026).ok).toBe(false);
  });
  it("accepts optional dates, independent year and inherited edition", () => {
    expect(
      validateEditionWorkflow(
        { ...workflowFixture, year: 2025, startsOn: "2026-12-01", endsOn: "2027-01-01" },
        2026,
      ).ok,
    ).toBe(true);
    expect(
      validateEditionWorkflow({ ...workflowFixture, seasonId: 1, championshipName: null }, 2026).ok,
    ).toBe(true);
  });
  it("does not accept conflicting championship identities", () => {
    expect(validateEditionWorkflow({ ...workflowFixture, seriesId: 1 }, 2026).ok).toBe(false);
    expect(validateEditionWorkflow({ ...workflowFixture, seasonId: 1, seriesId: 1 }, 2026).ok).toBe(
      false,
    );
  });
  it("parses native controls and clears irrelevant fields", () => {
    const form = new FormData();
    form.set("seriesId", "new");
    form.set("championshipName", " RED ");
    form.set("categoryKind", "adult");
    form.set("categoryAge", "17");
    form.set("divisionMode", "none");
    expect(workflowInputFromForm(form)).toMatchObject({
      championshipName: "RED",
      categoryAge: null,
      divisionValueId: null,
    });
  });
});
