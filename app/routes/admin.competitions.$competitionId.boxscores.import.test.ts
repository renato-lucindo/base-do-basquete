import { describe, expect, it } from "vitest";

import {
  mapImportError,
  parseEligibilityPlayers,
  parsePlayerResolution,
  parseTeamResolution,
} from "./admin.competitions.$competitionId.boxscores.import";

describe("boxscore import eligibility decisions", () => {
  it("requires an explicit private value only when creating a player", () => {
    expect(parsePlayerResolution("new", null)).toBeNull();
    expect(parsePlayerResolution("new", "male")).toEqual({
      action: "create_new",
      eligibilitySex: "male",
    });
    expect(parsePlayerResolution("player:42", "female")).toEqual({
      action: "add_existing",
      playerId: 42,
    });
    expect(parsePlayerResolution("roster:51", "female")).toEqual({
      action: "existing_roster",
      rosterEntryId: 51,
    });
  });

  it("returns pending athletes without transporting private values", () => {
    const details = JSON.stringify({
      players: [
        { sourcePlayerName: "Atleta Um", sourceTeamName: "Equipe A", sex: "female" },
        { sourcePlayerName: "Atleta Dois", sourceTeamName: "Equipe B", sex: "male" },
      ],
    });

    expect(parseEligibilityPlayers(details)).toEqual(["Atleta Um", "Atleta Dois"]);
    const mapped = mapImportError("BD601", details);
    expect(mapped).toEqual({
      message: "Complete a elegibilidade privada antes de confirmar: Atleta Um; Atleta Dois.",
      status: 400,
    });
    expect(JSON.stringify(mapped)).not.toMatch(/\b(male|female|sex)\b/);
  });

  it("falls back safely for malformed details and incompatible decisions", () => {
    expect(parseEligibilityPlayers("not-json")).toEqual([]);
    expect(mapImportError("BD602", "not-json")).toEqual({
      message: "Atleta não elegível para o naipe desta edição.",
      status: 400,
    });
  });

  it("parses only explicit team-resolution actions", () => {
    expect(parseTeamResolution("registration:41")).toEqual({
      action: "existing_registration",
      registrationId: 41,
    });
    expect(parseTeamResolution("team:52")).toEqual({
      action: "register_existing_team",
      teamId: 52,
    });
    expect(parseTeamResolution("new")).toEqual({ action: "create_team" });
    expect(parseTeamResolution("team:0")).toBeNull();
    expect(parseTeamResolution("registration:any")).toBeNull();
  });

  it("maps team-resolution conflicts to reviewable messages", () => {
    expect(mapImportError("BD315").status).toBe(409);
    expect(mapImportError("BD316").status).toBe(409);
    expect(mapImportError("BD317")).toEqual({
      message: "A equipe selecionada não corresponde ao nome ou à sigla do boxscore.",
      status: 409,
    });
  });
});
