import { describe, expect, it } from "vitest";

import { parseTeamImportText } from "./team-import-domain";

describe("team text import", () => {
  it("parses partial player data", () => {
    const [player] = parseTeamImportText("23 - Mike - \"MJ\" - 2000 - SG");

    expect(player).toMatchObject({
      jerseyNumber: "23",
      name: "Mike",
      nickname: "MJ",
      birthYear: 2000,
      positions: ["Ala Armador"],
    });
  });

  it("keeps optional fields empty", () => {
    expect(parseTeamImportText("4 - João")[0]).toMatchObject({
      jerseyNumber: "4",
      name: "João",
    });
  });
});
