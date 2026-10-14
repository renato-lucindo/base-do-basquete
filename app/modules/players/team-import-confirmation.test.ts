import { describe, expect, it } from "vitest";

import { buildImportConfirmation } from "./team-import-confirmation";

describe("team import confirmation", () => {
  it("applies user decisions before persistence", () => {
    const result = buildImportConfirmation(
      [{
        jerseyNumber: "4",
        federationRegistration: null,
        name: "João",
        nickname: null,
        birthDate: null,
        birthYear: null,
        heightCm: null,
        weightKg: null,
        positions: [],
        dominantHand: null,
      }],
      { 0: "existing" },
    );

    expect(result[0].decision).toBe("existing");
  });
});
