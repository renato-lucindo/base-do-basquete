import { describe, expect, it } from "vitest";

import {
  mapRosterActionFailure,
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
