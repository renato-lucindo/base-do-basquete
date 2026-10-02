import { describe, expect, it } from "vitest";
import type { ParsedBoxscore } from "../modules/boxscore/types";

import {
  buildTeamRestrictedMatches,
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
    expect(mapImportError("BD318")).toEqual({
      message: "A resolução das equipes mudou desde a revisão. Recarregue a importação.",
      status: 409,
    });
  });

  it("rejects PDFs outside the two explicit contracts", () => {
    expect(mapImportError("BDB_PDF_UNSUPPORTED_FORMAT")).toEqual({
      message: "O PDF não corresponde aos modelos FIBA/Genius Sports ou Basketball Site.",
      status: 422,
    });
  });

  it("recalculates suggestions only inside the resolved team roster", () => {
    const parsed: ParsedBoxscore = {
      format: "BASKETBALL_SITE" as const,
      parserVersion: "basketball-site-v1",
      competitionName: "Liga",
      gameNumber: null,
      scheduledLocal: "2026-05-09T19:00",
      durationSeconds: null,
      venue: "Ginásio",
      warnings: [],
      teams: [
        {
          name: "Equipe A",
          abbreviation: "A",
          score: 1,
          periodScores: null,
          players: [
            {
              name: "J. Silva",
              jerseyNumber: "7",
              starter: false,
              captain: false,
              didNotPlay: false,
              secondsPlayed: 0,
              fieldGoals: { made: 0, attempted: 0 },
              twoPoints: { made: 0, attempted: 0 },
              threePoints: { made: 0, attempted: 0 },
              freeThrows: { made: 0, attempted: 0 },
              offensiveRebounds: 0,
              defensiveRebounds: 0,
              rebounds: 0,
              assists: 0,
              turnovers: 0,
              steals: 0,
              blocks: 0,
              foulsCommitted: 0,
              foulsReceived: null,
              plusMinus: null,
              efficiency: 0,
              points: 1,
            },
          ],
        },
        { name: "Equipe B", abbreviation: "B", score: 0, periodScores: null, players: [] },
      ],
    };
    const matches = buildTeamRestrictedMatches(
      parsed,
      [
        {
          id: 1,
          teamName: "Equipe A",
          roster: [
            { rosterEntryId: 11, playerId: 21, playerName: "João Silva", jerseyNumber: "7" },
          ],
        },
        {
          id: 2,
          teamName: "Equipe B",
          roster: [
            { rosterEntryId: 12, playerId: 22, playerName: "José Silva", jerseyNumber: "7" },
          ],
        },
      ],
      [{ sourceTeamName: "Equipe A", registrationId: 1 }],
    );
    expect(matches[0]).toMatchObject({ kind: "exact", rosterEntryId: 11, playerId: 21 });
    expect(matches[0]?.alternatives).toHaveLength(1);
  });
});
