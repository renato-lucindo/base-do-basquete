import { describe, expect, it } from "vitest";

import { matchImportedPlayer } from "./team-import-matching";

describe("team import player matching", () => {
  it("matches by federation registration first", () => {
    expect(
      matchImportedPlayer(
        { name: "Joao", federationRegistration: "123456" },
        [{ id: "1", name: "Outro Nome", federationRegistration: "123456" }],
      ).status,
    ).toBe("COMPATIVEL");
  });

  it("returns conflict for a similar name", () => {
    expect(
      matchImportedPlayer({ name: "Luka Silva" }, [
        { id: "1", name: "Luke Silva" },
      ]).status,
    ).toBe("CONFLITO");
  });
});
