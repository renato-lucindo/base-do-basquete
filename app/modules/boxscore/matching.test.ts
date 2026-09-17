import { describe, expect, it } from "vitest";

import { nameSimilarity, normalizePersonName, suggestPlayerMatch } from "./matching";

const roster = [
  {
    playerId: 11,
    rosterEntryId: 1,
    registrationId: 101,
    playerName: "Alisson Venâncio do Nascimento",
    jerseyNumber: "2",
    teamName: "IVV",
  },
  {
    playerId: 12,
    rosterEntryId: 2,
    registrationId: 101,
    playerName: "Guilherme Cruz Santos",
    jerseyNumber: "7",
    teamName: "IVV",
  },
  {
    playerId: 13,
    rosterEntryId: 3,
    registrationId: 101,
    playerName: "João Vitor Martins",
    jerseyNumber: "12",
    teamName: "IVV",
  },
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
      playerId: 11,
      rosterEntryId: 1,
      score: 1,
    });
    const duplicate = roster[0];
    if (!duplicate) throw new Error("Fixture incompleta");
    expect(
      suggestPlayerMatch("Alisson Venâncio do Nascimento", "2", [
        ...roster,
        { ...duplicate, playerId: 99, rosterEntryId: 99 },
      ]),
    ).not.toMatchObject({ kind: "exact" });
  });

  it("offers at most three global similar names without preselecting one", () => {
    const result = suggestPlayerMatch("Guilherme Cruz Santo", "7", roster);
    expect(result.kind).toBe("similar");
    expect(result.rosterEntryId).toBeNull();
    expect(result.playerId).toBeNull();
    expect(result.alternatives[0]).toMatchObject({ playerId: 12, rosterEntryId: 2 });
    expect(result.alternatives.length).toBeLessThanOrEqual(3);
    expect(nameSimilarity("Guilherme Cruz Santo", "Guilherme Cruz Santos")).toBeGreaterThan(0.9);
  });

  it("does not leak candidates below the explicit threshold", () => {
    expect(suggestPlayerMatch("Pessoa completamente diferente", "9", roster)).toMatchObject({
      kind: "unmatched",
      playerId: null,
      rosterEntryId: null,
      alternatives: [],
    });
  });

  it("identifies an abbreviated name only by the unique team, jersey and surname", () => {
    expect(suggestPlayerMatch("A. Venâncio do Nascim", "2", roster, "IVV")).toMatchObject({
      kind: "exact",
      playerId: 11,
      rosterEntryId: 1,
    });
  });

  it("does not preselect an abbreviated name when the composite key is ambiguous", () => {
    const duplicate = roster[0];
    if (!duplicate) throw new Error("Fixture incompleta");
    const result = suggestPlayerMatch(
      "A. Venâncio do Nascim",
      "2",
      [...roster, { ...duplicate, playerId: 99, rosterEntryId: 99 }],
      "IVV",
    );
    expect(result.playerId).toBeNull();
    expect(result.rosterEntryId).toBeNull();
  });

  it("does not identify an abbreviated name across another team", () => {
    expect(
      suggestPlayerMatch("A. Venâncio do Nascim", "2", roster, "Saldanha da Gama"),
    ).not.toMatchObject({ kind: "exact" });
    expect(
      suggestPlayerMatch("Alisson Venâncio do Nascimento", "2", roster, "Saldanha da Gama"),
    ).not.toMatchObject({ kind: "exact" });
  });
});
