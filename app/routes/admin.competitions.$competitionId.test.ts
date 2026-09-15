import { describe, expect, it } from "vitest";
import { normalizeRegistrationRemoval } from "../modules/competition/admin-domain";
import {
  mapRosterActionFailure,
  parseRegistrationRemovalDecision,
  parseRosterActionEntries,
} from "./admin.competitions.$competitionId";

describe("admin competition roster action", () => {
  it("parses only player identifiers and normalized jersey values", () => {
    const formData = new FormData();
    formData.append("playerId", "41");
    formData.append("jersey-41", " 00 ");
    formData.append("playerId", "42");
    formData.append("jersey-42", "");

    expect(parseRosterActionEntries(formData)).toEqual({
      ok: true,
      entries: [
        { playerId: 41, jerseyNumber: "00" },
        { playerId: 42, jerseyNumber: null },
      ],
    });
  });

  it("rejects malformed player and jersey inputs before the RPC", () => {
    const invalidPlayer = new FormData();
    invalidPlayer.append("playerId", "0");
    expect(parseRosterActionEntries(invalidPlayer)).toEqual({
      ok: false,
      error: "Atleta inválido.",
    });

    const invalidJersey = new FormData();
    invalidJersey.append("playerId", "41");
    invalidJersey.append("jersey-41", "07");
    expect(parseRosterActionEntries(invalidJersey)).toMatchObject({ ok: false });
  });

  it("returns only stable eligibility decisions to the route client", () => {
    const pending = mapRosterActionFailure("BD601");
    const incompatible = mapRosterActionFailure("BD602");

    expect(pending).toMatchObject({ status: 400, outcome: "failure" });
    expect(incompatible).toEqual({
      message: "Atleta não elegível para o naipe desta edição.",
      outcome: "failure",
      status: 400,
    });
    expect(JSON.stringify([pending, incompatible])).not.toMatch(/\b(male|female)\b/);
  });
});

describe("admin registration removal input", () => {
  it("accepts only complete policy payloads from the database", () => {
    expect(
      parseRegistrationRemovalDecision({
        decision: "withdraw",
        reasonCode: "roster_history_preserved",
        dependencies: {
          rosterEntries: 2,
          structureAssignments: 0,
          matchups: 0,
          games: 0,
          placements: 0,
          resolutions: 0,
          publicationSnapshots: 0,
        },
      }),
    ).toEqual({
      decision: "withdraw",
      reasonCode: "roster_history_preserved",
      dependencies: {
        rosterEntries: 2,
        structureAssignments: 0,
        matchups: 0,
        games: 0,
        placements: 0,
        resolutions: 0,
        publicationSnapshots: 0,
      },
    });
    expect(parseRegistrationRemovalDecision({ decision: "remove" })).toBeNull();
    expect(
      parseRegistrationRemovalDecision({
        decision: "remove",
        reasonCode: "bad",
        dependencies: { games: -1 },
      }),
    ).toBeNull();
  });

  it("accepts only the server decisions that can mutate", () => {
    expect(normalizeRegistrationRemoval("remove", "Criada por engano")).toEqual({
      ok: true,
      value: { decision: "remove", reason: "Criada por engano" },
    });
    expect(normalizeRegistrationRemoval("withdraw", "Preservar todo o histórico")).toMatchObject({
      ok: true,
    });
    expect(normalizeRegistrationRemoval("blocked", "Tentativa inválida")).toMatchObject({
      ok: false,
    });
  });

  it("requires a bounded administrator reason", () => {
    expect(normalizeRegistrationRemoval("remove", "curta")).toMatchObject({ ok: false });
    expect(normalizeRegistrationRemoval("remove", "x".repeat(501))).toMatchObject({ ok: false });
  });
});
