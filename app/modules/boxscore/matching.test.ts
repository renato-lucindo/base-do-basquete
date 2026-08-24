import { describe, expect, it } from "vitest";

import { nameSimilarity, normalizePersonName, suggestPlayerMatch } from "./matching";

const roster = [
  { rosterEntryId: 1, playerName: "Alisson Venâncio do Nascimento", jerseyNumber: "2" },
  { rosterEntryId: 2, playerName: "Guilherme Cruz Santos", jerseyNumber: "7" },
  { rosterEntryId: 3, playerName: "João Vitor Martins", jerseyNumber: "12" },
];

describe("boxscore player matching", () => {
  it("normalizes accents, punctuation and spacing deterministically", () => {
    expect(normalizePersonName("  Alisson  Venâncio-do Nascimento ")).toBe(
      "alisson venancio do nascimento",
    );
  });

  it("selects only a unique exact match automatically", () => {
    expect(suggestPlayerMatch("ALISSON VENANCIO DO NASCIMENTO", "2", roster)).toMatchObject({
      kind: "exact",
      rosterEntryId: 1,
      score: 1,
    });
    const duplicate = roster[0];
    if (!duplicate) throw new Error("Fixture incompleta");
    expect(
      suggestPlayerMatch("Alisson Venâncio do Nascimento", "2", [...roster, duplicate]),
    ).not.toMatchObject({ kind: "exact" });
  });

  it("offers at most three roster-scoped similar names without confirming them", () => {
    const result = suggestPlayerMatch("Guilherme Cruz Santo", "7", roster);
    expect(result.kind).toBe("similar");
    expect(result.rosterEntryId).toBe(2);
    expect(result.alternatives.length).toBeLessThanOrEqual(3);
    expect(nameSimilarity("Guilherme Cruz Santo", "Guilherme Cruz Santos")).toBeGreaterThan(0.9);
  });

  it("does not leak candidates below the explicit threshold", () => {
    expect(suggestPlayerMatch("Pessoa completamente diferente", "9", roster)).toMatchObject({
      kind: "unmatched",
      rosterEntryId: null,
      alternatives: [],
    });
  });
});
