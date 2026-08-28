import { describe, expect, it } from "vitest";

import {
  mapAdminDomainError,
  normalizeFinalResult,
  normalizeGenderDivision,
  normalizeJersey,
  normalizePrimaryDataSource,
  summarizeDataProfileGameImpact,
} from "./admin-domain";

describe("admin competition domain", () => {
  it("preserves 0 and 00 without numeric conversion", () => {
    expect(normalizeJersey(" 00 ")).toEqual({ ok: true, value: "00" });
    expect(normalizeJersey("0")).toEqual({ ok: true, value: "0" });
    expect(normalizeJersey("07")).toMatchObject({ ok: false });
    expect(normalizeJersey("100")).toMatchObject({ ok: false });
  });

  it("maps stable database codes without parsing PostgreSQL messages", () => {
    expect(mapAdminDomainError("BD104")).toMatchObject({
      code: "player-conflict",
      field: "player",
    });
    expect(mapAdminDomainError("XX000")).toMatchObject({ code: "unknown" });
  });

  it("normalizes authoritative final results", () => {
    expect(normalizeFinalResult("placed", "1", " Campeão ")).toEqual({
      ok: true,
      value: { status: "placed", placement: 1, label: "Campeão" },
    });
    expect(normalizeFinalResult("withdrawn", "", "Ignorado")).toEqual({
      ok: true,
      value: { status: "withdrawn", placement: null, label: null },
    });
    expect(normalizeFinalResult("placed", "", "").ok).toBe(false);
    expect(normalizeFinalResult("disqualified", "2", "").ok).toBe(false);
  });

  it("requires explicit division and primary source without inferred defaults", () => {
    expect(normalizeGenderDivision("")).toMatchObject({
      ok: false,
      error: { field: "genderDivision" },
    });
    expect(normalizeGenderDivision("female")).toEqual({ ok: true, value: "female" });
    expect(normalizePrimaryDataSource("", "", false)).toMatchObject({
      ok: false,
      error: { field: "primarySource" },
    });
    expect(normalizePrimaryDataSource("manual_scoresheet", "", false)).toEqual({
      ok: true,
      value: { source: "manual_scoresheet", changeReason: null },
    });
  });

  it("validates the reason before replacing an active profile", () => {
    expect(normalizePrimaryDataSource("fiba_boxscore", "curta", true)).toMatchObject({
      ok: false,
      error: { field: "changeReason" },
    });
    expect(
      normalizePrimaryDataSource(
        "fiba_boxscore",
        " Cobertura estatística integral documentada. ",
        true,
      ),
    ).toEqual({
      ok: true,
      value: {
        source: "fiba_boxscore",
        changeReason: "Cobertura estatística integral documentada.",
      },
    });
  });

  it("summarizes real game coverage without turning absence into zero", () => {
    expect(
      summarizeDataProfileGameImpact([
        { source: "manual", status: "validated" },
        { source: "boxscore", status: "validated" },
        { source: "seed", status: "scheduled" },
      ]),
    ).toEqual({
      totalGames: 3,
      manualGames: 1,
      boxscoreGames: 1,
      otherGames: 1,
      statuses: [
        { status: "scheduled", count: 1 },
        { status: "validated", count: 2 },
      ],
    });
  });

  it("maps profile mismatch and review errors by stable database code", () => {
    expect(mapAdminDomainError("BD504")).toMatchObject({
      code: "profile-context",
      field: "dataProfile",
    });
    expect(mapAdminDomainError("BD505")).toMatchObject({
      code: "review-required",
      field: "genderDivision",
    });
    expect(mapAdminDomainError("BD506")).toMatchObject({ code: "context-conflict" });
  });
});
