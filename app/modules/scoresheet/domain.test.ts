import { describe, expect, it } from "vitest";

import {
  beginFastEntry,
  breakCaptainPlaceholderLink,
  buildManualScoresheetDiff,
  buildPrefillSlots,
  buildPublicGamePath,
  calculatePoints,
  canAddPlayerFoul,
  cancelFastEntry,
  completeFastScoreEntry,
  deriveTeamScore,
  duplicateJerseys,
  evaluateDisqualification,
  hasFoulAfterDisqualification,
  isIsoLocalDate,
  isLocalTime,
  isValidSemanticFoulTarget,
  normalizeGameJersey,
  parseFastFoulEntry,
  parseFastPointValue,
  parseFastScoreEntry,
  parseFoulCodes,
  parseFoulNotation,
  parseSemanticFoulList,
  periodLabel,
  resolveCaptainPlaceholder,
  semanticFoulFromLegacyCode,
  sumPenaltyFreeThrows,
  undoFastScoreEntry,
  validateTeamSlots,
} from "./domain";

describe("manual scoresheet domain", () => {
  it("derives points and rejects invalid conversions", () => {
    expect(calculatePoints(3, 2, 4)).toBe(16);
    expect(() => calculatePoints(-1, 0, 0)).toThrow(RangeError);
    expect(() => calculatePoints(0.5, 0, 0)).toThrow(RangeError);
  });

  it("uses the latest eligible lineup before alphabetical fallback", () => {
    const roster = [
      { rosterEntryId: 2, playerName: "Zeca", jerseyNumber: "7" },
      { rosterEntryId: 1, playerName: "Ana", jerseyNumber: "00" },
    ];
    const previous = [{ slotNumber: 3, rosterEntryId: 2, jerseyNumber: "9" }];
    expect(buildPrefillSlots(roster, previous)[0]).toEqual({
      slotNumber: 1,
      rosterEntryId: 2,
      jerseyNumber: "9",
    });
    const fallback = buildPrefillSlots(roster, []);
    expect(fallback.slice(0, 2).map((slot) => slot.rosterEntryId)).toEqual([1, 2]);
    expect(fallback).toHaveLength(12);
  });

  it("preserves 0 and 00 as distinct jerseys while detecting exact duplicates", () => {
    const duplicates = duplicateJerseys([
      { slotNumber: 1, rosterEntryId: 1, jerseyNumber: "00" },
      { slotNumber: 2, rosterEntryId: 2, jerseyNumber: "0" },
      { slotNumber: 3, rosterEntryId: 3, jerseyNumber: "00" },
    ]);
    expect([...duplicates]).toEqual(["00"]);
  });

  it.each([
    ["0", "0"],
    ["00", "00"],
    ["1", "1"],
    ["99", "99"],
    ["01", null],
    ["100", null],
    ["-1", null],
    ["", null],
  ])("normalizes game jersey %j", (value, expected) => {
    expect(normalizeGameJersey(value)).toBe(expected);
  });

  it("parses the fast score grammar without losing 00", () => {
    expect(parseFastPointValue("1")).toBe(1);
    expect(parseFastPointValue("3")).toBe(3);
    expect(parseFastPointValue("0")).toBeNull();
    expect(parseFastScoreEntry("12 2")).toEqual({ jerseyNumber: "12", points: 2 });
    expect(parseFastScoreEntry("00 3")).toEqual({ jerseyNumber: "00", points: 3 });
    expect(parseFastScoreEntry("87 4")).toBeNull();
  });

  it("supports the two-step fast scoring state machine", () => {
    const pending = beginFastEntry("00");
    expect(pending).toEqual({ stage: "value", jerseyNumber: "00" });
    expect(pending && completeFastScoreEntry(pending, "3")).toEqual({
      jerseyNumber: "00",
      points: 3,
    });
    expect(cancelFastEntry()).toEqual({ stage: "jersey", jerseyNumber: "" });
  });

  it("validates required date and optional local time independently", () => {
    expect(isIsoLocalDate("2026-10-06")).toBe(true);
    expect(isIsoLocalDate("2026-02-30")).toBe(false);
    expect(isLocalTime("00:00")).toBe(true);
    expect(isLocalTime("23:59")).toBe(true);
    expect(isLocalTime("24:00")).toBe(false);
  });

  it("keeps captain placeholder linked until the coach is edited manually", () => {
    const linked = resolveCaptainPlaceholder(undefined, {
      rosterEntryId: 7,
      playerName: "Capitão Um",
    });
    expect(linked).toEqual({
      role: "coach",
      name: "Capitão Um",
      origin: "captain_placeholder",
      linkedCaptainRosterEntryId: 7,
    });
    expect(
      resolveCaptainPlaceholder(linked, { rosterEntryId: 8, playerName: "Capitão Dois" }),
    ).toEqual({
      role: "coach",
      name: "Capitão Dois",
      origin: "captain_placeholder",
      linkedCaptainRosterEntryId: 8,
    });
    const manual = breakCaptainPlaceholderLink(linked, "Técnico Manual");
    expect(resolveCaptainPlaceholder(manual, { rosterEntryId: 9, playerName: "Outro" })).toEqual(
      manual,
    );
  });

  it("requires one captain and unique active players/jerseys", () => {
    expect(
      validateTeamSlots([
        {
          slotNumber: 1,
          rosterEntryId: 1,
          jerseyNumber: "00",
          isCaptain: true,
          isStarter: true,
        },
        { slotNumber: 2, rosterEntryId: 2, jerseyNumber: "0" },
      ]),
    ).toEqual([]);
    expect(
      validateTeamSlots([
        { slotNumber: 1, rosterEntryId: 1, jerseyNumber: "7" },
        { slotNumber: 2, rosterEntryId: 1, jerseyNumber: "7" },
      ]),
    ).toEqual(expect.arrayContaining(["duplicate_player", "duplicate_jersey", "captain_required"]));
  });

  it("validates player, bench, staff and team foul targets independently", () => {
    expect(isValidSemanticFoulTarget({ kind: "player", registrationId: 1, rosterEntryId: 7 })).toBe(
      true,
    );
    expect(isValidSemanticFoulTarget({ kind: "bench", registrationId: 1 })).toBe(true);
    expect(
      isValidSemanticFoulTarget({ kind: "staff", registrationId: 1, staffRole: "coach" }),
    ).toBe(true);
    expect(isValidSemanticFoulTarget({ kind: "team", registrationId: 1 })).toBe(true);
    expect(isValidSemanticFoulTarget({ kind: "player", registrationId: 1 })).toBe(false);
    expect(isValidSemanticFoulTarget({ kind: "bench", registrationId: 1, rosterEntryId: 7 })).toBe(
      false,
    );
    expect(isValidSemanticFoulTarget({ kind: "team", registrationId: 1, staffRole: "coach" })).toBe(
      false,
    );
  });

  it("undoes only the most recent fast-score entry", () => {
    const first = {
      side: "home" as const,
      periodNumber: 1,
      rosterEntryId: 1,
      jerseyNumber: "00",
      points: 2 as const,
    };
    const second = {
      side: "home" as const,
      periodNumber: 1,
      rosterEntryId: 2,
      jerseyNumber: "7",
      points: 3 as const,
    };
    expect(undoFastScoreEntry([first, second])).toEqual({ entry: second, remaining: [first] });
    expect(undoFastScoreEntry([])).toBeNull();
  });

  it("builds a readable revision diff while keeping teams as immutable identifiers", () => {
    const base: Parameters<typeof buildManualScoresheetDiff>[0] = {
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
      competitionId: 1,
      game: { date: "2026-10-06", venue: "Ginásio" },
      teams: [
        {
          side: "home" as const,
          registrationId: 10,
          slots: [{ slotNumber: 1, rosterEntryId: 100, jerseyNumber: "00", isCaptain: true }],
        },
        {
          side: "away" as const,
          registrationId: 20,
          slots: [{ slotNumber: 1, rosterEntryId: 200, jerseyNumber: "7", isCaptain: true }],
        },
      ],
      periods: [{ periodNumber: 1, stats: [] }],
      fouls: [],
      officials: [],
    };
    const changed = {
      ...base,
      game: { ...base.game, venue: "Ginásio 2" },
      officials: [{ role: "Árbitro" as const, name: "Ana" }],
    };
    expect(buildManualScoresheetDiff(base, changed).map((item) => item.label)).toEqual([
      "Local",
      "Árbitro",
    ]);
  });

  it("parses semantic foul notation and fast foul input", () => {
    expect(parseFoulNotation("u2")).toEqual({
      type: "U",
      penaltyFtCount: 2,
      originalNotation: "U2",
      rulesVersion: "FIBA_2024",
    });
    expect(parseFastFoulEntry("12U2")).toEqual({
      jerseyNumber: "12",
      foul: {
        type: "U",
        penaltyFtCount: 2,
        originalNotation: "U2",
        rulesVersion: "FIBA_2024",
      },
    });
    expect(parseFastFoulEntry("12 T1")?.foul.type).toBe("T");
    expect(parseFastFoulEntry("87P2")?.foul.penaltyFtCount).toBe(2);
    expect(parseFastFoulEntry("00d")?.jerseyNumber).toBe("00");
    expect(parseFastFoulEntry("12X2")).toBeNull();
  });

  it.each([
    ["C1", "C1"],
    ["c1", "C1"],
    ["B1", "B1"],
    ["b1", "B1"],
  ])("maps FIBA technical notation %s to semantic T", (input, originalNotation) => {
    expect(parseFoulNotation(input)).toEqual({
      type: "T",
      penaltyFtCount: 1,
      originalNotation,
      rulesVersion: "FIBA_2024",
    });
  });

  it.each(["C", "C0", "C2", "B", "B0", "B2", "X1"])(
    "rejects unsupported foul notation %s",
    (input) => {
      expect(parseFoulNotation(input)).toBeNull();
    },
  );

  it("keeps foul penalty separate from semantic type", () => {
    expect(semanticFoulFromLegacyCode("U2")).toEqual({
      type: "U",
      penaltyFtCount: 2,
      originalNotation: "U2",
      rulesVersion: "FIBA_2024",
    });
    expect(parseSemanticFoulList("P2, T1, U2")?.map((foul) => foul.type)).toEqual(["P", "T", "U"]);
    expect(sumPenaltyFreeThrows([{ penaltyFtCount: 2 }, { penaltyFtCount: 1 }])).toBe(3);
  });

  it.each([
    [["T", "T"], "2T"],
    [["U", "U"], "2U"],
    [["T", "U"], "T+U"],
    [["D"], "D"],
  ] as const)("derives GD for %j", (codes, reason) => {
    const result = evaluateDisqualification(
      codes.map((code, index) => ({ periodNumber: 1, sequenceNumber: index + 1, code })),
    );
    expect(result?.reason).toBe(reason);
  });

  it("does not derive GD from insufficient or personal fouls", () => {
    expect(
      evaluateDisqualification([
        { periodNumber: 1, sequenceNumber: 1, code: "P" },
        { periodNumber: 4, sequenceNumber: 1, code: "T" },
      ]),
    ).toBeNull();
  });

  it("counts U2 as one unsportsmanlike foul for GD", () => {
    expect(
      evaluateDisqualification([
        { periodNumber: 1, sequenceNumber: 1, type: "U", penaltyFtCount: 2 },
      ]),
    ).toBeNull();
    expect(
      evaluateDisqualification([
        { periodNumber: 1, sequenceNumber: 1, code: "U2" },
        { periodNumber: 2, sequenceNumber: 1, code: "U" },
      ])?.reason,
    ).toBe("2U");
  });

  it("detects a later foul after GD without rejecting same-period scoring", () => {
    const fouls = [
      { periodNumber: 1, sequenceNumber: 1, type: "T" as const },
      { periodNumber: 2, sequenceNumber: 1, type: "T" as const },
      { periodNumber: 2, sequenceNumber: 2, type: "P" as const },
    ];
    expect(hasFoulAfterDisqualification(fouls)).toBe(true);
    expect(hasFoulAfterDisqualification(fouls.slice(0, 2))).toBe(false);
  });

  it("blocks a new player foul after GD", () => {
    expect(
      canAddPlayerFoul([
        { periodNumber: 1, sequenceNumber: 1, type: "T" },
        { periodNumber: 2, sequenceNumber: 1, type: "T" },
      ]),
    ).toBe(false);
    expect(
      canAddPlayerFoul([{ periodNumber: 1, sequenceNumber: 1, type: "U", penaltyFtCount: 2 }]),
    ).toBe(true);
  });

  it("parses only canonical ordered foul codes", () => {
    expect(parseFoulCodes("p, t, U2")).toEqual(["P", "T", "U2"]);
    expect(parseFoulCodes("X")).toBeNull();
  });

  it("labels regulation and overtime periods", () => {
    expect([1, 4, 5, 6].map(periodLabel)).toEqual(["Q1", "Q4", "OT1", "OT2"]);
  });

  it("derives a team score without accepting a stored total", () => {
    expect(
      deriveTeamScore(
        [
          {
            periodNumber: 1,
            stats: [
              { rosterEntryId: 1, twoPointMade: 2, threePointMade: 1, freeThrowMade: 1, fouls: [] },
              { rosterEntryId: 2, twoPointMade: 9, threePointMade: 0, freeThrowMade: 0, fouls: [] },
            ],
          },
        ],
        new Set([1]),
      ),
    ).toBe(8);
  });

  it("builds the localized public game detail route", () => {
    expect(buildPublicGamePath(2026, "liga-de-desenvolvimento", "sub-15", 40)).toBe(
      "/2026/liga-de-desenvolvimento/sub-15/jogos/40",
    );
  });
});
