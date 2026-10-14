import { describe, expect, it } from "vitest";

import { buildTeamImportReview } from "./team-import-review";

describe("team import review", () => {
  it("creates confirmation rows from matches", () => {
    const rows = buildTeamImportReview(
      [{ jerseyNumber: "4", federationRegistration: null, name: "João", nickname: null, birthDate: null, birthYear: null, heightCm: null, weightKg: null, positions: [], dominantHand: null }],
      [{ playerId: "player-1", status: "COMPATIVEL" }],
    );

    expect(rows[0]).toMatchObject({ status: "Encontrado compatibilidade", suggestedPlayerId: "player-1" });
  });
});
