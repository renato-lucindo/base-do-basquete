import { describe, expect, it } from "vitest";
import { normalizeTeamCreationInput, parseTeamSelection } from "./team-creation";

describe("team creation input", () => {
  it("normalizes the public name and optional abbreviation without asking for a slug", () => {
    expect(normalizeTeamCreationInput("  Águias   do Sul ", " ads ")).toEqual({
      ok: true,
      input: { name: "Águias do Sul", abbreviation: "ADS" },
    });
  });

  it("rejects malformed abbreviations", () => {
    expect(normalizeTeamCreationInput("Águias", "A")).toMatchObject({ ok: false });
    expect(normalizeTeamCreationInput("Águias", "A-G")).toMatchObject({ ok: false });
  });

  it("parses the searchable datalist selection by its stable identifier", () => {
    expect(parseTeamSelection("42 — Associação Azul")).toBe(42);
    expect(parseTeamSelection("42-Equipe")).toBe(42);
    expect(parseTeamSelection("Associação Azul")).toBeNull();
    expect(parseTeamSelection("0 — inválida")).toBeNull();
  });
});
