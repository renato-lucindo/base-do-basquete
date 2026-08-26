import { describe, expect, it } from "vitest";

import { normalizeAdminPlayerName, sortAdminPlayers } from "./admin-domain";

describe("administrative player domain", () => {
  it("normalizes accents, case and punctuation", () => {
    expect(normalizeAdminPlayerName("  João D'Ávila  ")).toBe("joao d avila");
  });

  it("keeps selected players first and then sorts by name", () => {
    const selected = new Set([2]);
    const players = [
      {
        id: 1,
        fullName: "Bruno",
        nickname: null,
        currentTeamName: null,
        editionJersey: null,
        conflict: null,
      },
      {
        id: 2,
        fullName: "Carlos",
        nickname: null,
        currentTeamName: null,
        editionJersey: null,
        conflict: null,
      },
      {
        id: 3,
        fullName: "Alex",
        nickname: null,
        currentTeamName: null,
        editionJersey: null,
        conflict: null,
      },
    ];

    expect(sortAdminPlayers(players, selected).map((player) => player.id)).toEqual([2, 3, 1]);
  });
});
