import { describe, expect, it } from "vitest";
import {
  editionCreationError,
  editionInputFromForm,
  validateEditionInput,
} from "./edition-creation";

const valid = {
  seriesId: 1,
  categoryId: 2,
  year: 2026,
  name: "Copa teste",
  gender: "female",
  source: "fiba_boxscore",
  preset: "single_elimination",
  entryCount: 5,
  startsOn: null,
  endsOn: null,
  expectedProfileId: null,
  reason: null,
  reviewed: true,
};
describe("edition creation input", () => {
  it("normalizes explicit context and calculates the server review", () => {
    const result = validateEditionInput({ ...valid, name: " Copa teste " }, 2026);
    expect(result).toMatchObject({
      ok: true,
      input: { name: "Copa teste", gender: "female" },
      summary: { rounds: 3, matchups: 4, byes: 3 },
    });
  });
  it.each([1900, 2025, 2026, 2027])("accepts historical/current/next year %i", (year) => {
    expect(validateEditionInput({ ...valid, year }, 2026).ok).toBe(true);
  });
  it.each([
    { year: 1899 },
    { year: 2028 },
    { year: 2026.5 },
    { year: "2026" },
    { gender: null },
    { gender: "misto" },
    { source: "ocr" },
    { seriesId: -1 },
    { categoryId: 0 },
    { entryCount: 17 },
    { entryCount: 1 },
    { preset: "Final" },
    { name: " " },
    { startsOn: "2026-02-30" },
    { startsOn: "2026-05-01", endsOn: "2026-04-30" },
    { startsOn: "01/01/2026" },
    { expectedProfileId: "2" },
    { reviewed: "true" },
    { reason: "curta" },
  ])("rejects invalid context %j", (change) => {
    expect(validateEditionInput({ ...valid, ...change }, 2026).ok).toBe(false);
  });
  it("preserves leap days and does not reinterpret periods", () => {
    expect(
      validateEditionInput(
        { ...valid, year: 2024, startsOn: "2024-02-29", endsOn: "2025-01-01" },
        2026,
      ).ok,
    ).toBe(true);
  });
  it("rejects impossible leap days", () => {
    expect(validateEditionInput({ ...valid, startsOn: "2025-02-29" }, 2026).ok).toBe(false);
  });
  it("never forwards arbitrary fields from the frontend", () => {
    const result = validateEditionInput(
      { ...valid, status: "published", graph: { arbitrary: true } },
      2026,
    );
    expect(result.ok && result.input).not.toHaveProperty("status");
    expect(result.ok && result.input).not.toHaveProperty("graph");
  });
  it("reads form fields without accepting partial numbers", () => {
    const form = new FormData();
    form.set("seriesId", "1abc");
    form.set("year", "2026");
    expect(editionInputFromForm(form)).toMatchObject({
      seriesId: null,
      year: 2026,
      reviewed: false,
    });
  });
  it("maps database codes without leaking raw messages", () => {
    expect(editionCreationError("BR012")).toContain("perfil de dados mudou");
    expect(editionCreationError("unknown")).not.toContain("unknown");
  });
});
