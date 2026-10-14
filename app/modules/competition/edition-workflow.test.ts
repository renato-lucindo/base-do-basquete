import { describe, expect, it } from "vitest";
import {
  disputeName,
  type EditionBatchWorkflowInput,
  type EditionWorkflowInput,
  masterAges,
  validateEditionBatchWorkflow,
  validateEditionWorkflow,
  workflowInputFromForm,
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
const batchFixture: EditionBatchWorkflowInput = {
  seriesId: 1,
  championshipName: null,
  seasonId: null,
  year: 2026,
  description: null,
  navigationOrder: "category_division",
  disputes: [
    {
      categoryKind: "adult",
      categoryAge: null,
      gender: "male",
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
    },
  ],
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

  it("accepts independent disputes in the same initial batch", () => {
    const result = validateEditionBatchWorkflow(
      {
        ...batchFixture,
        navigationOrder: "division_category",
        disputes: [
          batchFixture.disputes[0],
          {
            ...batchFixture.disputes[0],
            categoryKind: "base",
            categoryAge: 17,
            gender: "female",
            startsOn: "2026-04-01",
            endsOn: "2026-06-30",
            preset: "single_elimination",
            entryCount: 8,
          },
        ],
      },
      2026,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input.navigationOrder).toBe("division_category");
      expect(result.summaries).toHaveLength(2);
    }
  });

  it("rejects duplicate combinations before the batch reaches the database", () => {
    const result = validateEditionBatchWorkflow(
      { ...batchFixture, disputes: [batchFixture.disputes[0], batchFixture.disputes[0]] },
      2026,
    );
    expect(result).toMatchObject({ ok: false, field: "disputes.1.categoryKind" });
  });

  it("enforces one competitive division type for a new edition", () => {
    const first = {
      ...batchFixture.disputes[0],
      divisionMode: "new" as const,
      divisionTypeName: "Série",
      divisionValueName: "Ouro Norte",
    };
    const second = {
      ...first,
      gender: "female" as const,
      divisionTypeName: "Conferência",
      divisionValueName: "Sul",
    };
    expect(
      validateEditionBatchWorkflow({ ...batchFixture, disputes: [first, second] }, 2026),
    ).toMatchObject({ ok: false, field: "disputes.1.divisionTypeName" });
  });

  it("allows different disputes to share the same new division", () => {
    const sharedDivision = {
      ...batchFixture.disputes[0],
      divisionMode: "new" as const,
      divisionTypeName: "Série",
      divisionValueName: "Ouro",
    };
    const result = validateEditionBatchWorkflow(
      {
        ...batchFixture,
        disputes: [
          { ...sharedDivision, categoryKind: "base", categoryAge: 15 },
          {
            ...sharedDivision,
            categoryKind: "base",
            categoryAge: 17,
            gender: "female",
            divisionTypeName: "Serie",
            divisionValueName: "ouro/norte",
          },
        ],
      },
      2026,
    );

    expect(result.ok).toBe(true);
  });

  it("keeps later additions unitary and forbids existing divisions in an initial batch", () => {
    expect(
      validateEditionBatchWorkflow(
        {
          ...batchFixture,
          seasonId: 7,
          seriesId: null,
          disputes: [batchFixture.disputes[0], { ...batchFixture.disputes[0], gender: "female" }],
        },
        2026,
      ),
    ).toMatchObject({ ok: false, field: "disputes" });
    expect(
      validateEditionBatchWorkflow(
        {
          ...batchFixture,
          disputes: [
            {
              ...batchFixture.disputes[0],
              divisionMode: "existing",
              divisionValueId: 10,
            },
          ],
        },
        2026,
      ),
    ).toMatchObject({ ok: false, field: "disputes.0.divisionMode" });
  });
  it.each([
    ["year", { year: 1899 }],
    ["championshipName", { seriesId: null, championshipName: null }],
    ["description", { description: "x".repeat(2001) }],
    ["seriesId", { seriesId: 0, championshipName: null }],
    ["seasonId", { seasonId: 0, championshipName: null }],
  ] as const)("keeps shared %s validation associated with identification", (field, delta) => {
    const result = validateEditionBatchWorkflow({ ...batchFixture, ...delta }, 2026);
    expect(result).toMatchObject({ ok: false, field });
    if (!result.ok) expect(result.error).not.toMatch(/^Disputa /);
  });
  it("keeps an invalid second dispute associated with its own field", () => {
    expect(
      validateEditionBatchWorkflow(
        {
          ...batchFixture,
          disputes: [
            batchFixture.disputes[0],
            {
              ...batchFixture.disputes[0],
              categoryKind: "base",
              categoryAge: 24,
            },
          ],
        },
        2026,
      ),
    ).toMatchObject({ ok: false, field: "disputes.1.categoryAge" });
  });
});
