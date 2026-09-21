import { describe, expect, it } from "vitest";
import {
  compilePreset,
  PresetError,
  type PresetKey,
  validateCompiledPreset,
} from "./ruleset-presets";

function at<T>(items: T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`Missing test fixture item ${index}`);
  return item;
}

describe("versioned competition presets", () => {
  for (const key of ["single_group", "single_elimination"] as const) {
    for (let count = 2; count <= 16; count += 1) {
      it(`${key} compiles ${count} entries with no fictional games`, () => {
        const result = compilePreset(key, count);
        expect(() => validateCompiledPreset(result)).not.toThrow();
        const matches = result.rounds.flatMap((round) => round.matchups);
        expect(matches).toHaveLength(
          key === "single_group" ? (count * (count - 1)) / 2 : count - 1,
        );
        expect(
          matches.every((match) => match.format === "single_game" && match.maxGames === 1),
        ).toBe(true);
        expect(compilePreset(key, count)).toEqual(result);
        if (key === "single_group") {
          const pairs = matches.map((match) => {
            if (match.home.kind !== "entry" || match.away.kind !== "entry")
              throw new Error("origin");
            return [match.home.seed, match.away.seed].sort((a, b) => a - b).join(":");
          });
          expect(new Set(pairs).size).toBe(matches.length);
          for (let seed = 1; seed <= count; seed += 1) {
            expect(
              matches.filter(
                (match) =>
                  (match.home.kind === "entry" && match.home.seed === seed) ||
                  (match.away.kind === "entry" && match.away.seed === seed),
              ),
            ).toHaveLength(count - 1);
            expect(
              result.rounds.flatMap((round) => round.byes).filter((bye) => bye === seed),
            ).toHaveLength(count % 2);
          }
        } else {
          const byes = result.rounds.flatMap((round) => round.byes);
          const expectedByes = 2 ** Math.ceil(Math.log2(count)) - count;
          expect([...byes].sort((a, b) => a - b)).toEqual(
            Array.from({ length: expectedByes }, (_, index) => index + 1),
          );
          expect(result.rounds.at(-1)?.role).toBe("final");
          expect(result.rounds.at(-1)?.matchups).toHaveLength(1);
        }
      });
    }
  }

  it.each([null, undefined, "Final", "Grupo único", "single_group_v2", {}, 1])(
    "rejects unrecognized preset %s without inferring from names",
    (value) => expect(() => compilePreset(value, 4)).toThrow("invalid-preset"),
  );
  it.each([null, undefined, "4", 0, 1, 17, -1, 2.5, Number.NaN, Infinity, {}])(
    "rejects invalid entry count %s",
    (value) => expect(() => compilePreset("single_group", value)).toThrow("invalid-entry-count"),
  );

  it("returns independent copies, not a mutable shared template", () => {
    const first = compilePreset("single_elimination", 4);
    at(first.rounds, 0).matchups.pop();
    expect(at(compilePreset("single_elimination", 4).rounds, 0).matchups).toHaveLength(2);
  });
  it("allows descriptive codes but never changes the typed role", () => {
    const preset = compilePreset("single_group", 4);
    at(preset.rounds, 0).code = "final";
    expect(() => validateCompiledPreset(preset)).not.toThrow();
    at(preset.rounds, 0).role = "final";
    expect(() => validateCompiledPreset(preset)).toThrow("invalid-round");
  });
  it("refuses a third semifinal and a second final even with changed declared capacity", () => {
    for (const role of ["semifinal", "final"]) {
      const preset = compilePreset("single_elimination", 4);
      const round = preset.rounds.find((candidate) => candidate.role === role);
      if (!round) throw new Error("round");
      round.matchups.push({ ...at(round.matchups, 0), code: "extra_match" });
      round.capacity += 2;
      round.maxMatchups += 1;
      expect(() => validateCompiledPreset(preset)).toThrow("invalid-round");
    }
  });
  it("refuses forward, self and cyclic references", () => {
    for (const target of ["final_match_1", "semifinal_match_1", "missing"]) {
      const preset = compilePreset("single_elimination", 4);
      at(at(preset.rounds, 0).matchups, 0).home = { kind: "winner", matchupCode: target };
      expect(() => validateCompiledPreset(preset)).toThrow("invalid-source");
    }
  });
  it("refuses consuming the same winner twice", () => {
    const preset = compilePreset("single_elimination", 4);
    const final = at(at(preset.rounds, 1).matchups, 0);
    final.away = final.home;
    expect(() => validateCompiledPreset(preset)).toThrow("source-reused");
  });
  it("refuses using the same team twice in a knockout round", () => {
    const preset = compilePreset("single_elimination", 4);
    const matches = at(preset.rounds, 0).matchups;
    at(matches, 1).home = at(matches, 0).home;
    expect(() => validateCompiledPreset(preset)).toThrow("source-reused");
  });
  it.each(["single_group", "single_elimination"] satisfies PresetKey[])(
    "%s refuses a duplicated matchup identifier",
    (key) => {
      const preset = compilePreset(key, 4);
      const matches = at(preset.rounds, 0).matchups;
      at(matches, 1).code = at(matches, 0).code;
      expect(() => validateCompiledPreset(preset)).toThrow("invalid-matchup");
    },
  );
  it("refuses a round-robin pair repeated in another round", () => {
    const preset = compilePreset("single_group", 4);
    at(preset.rounds, 1).matchups = at(preset.rounds, 0).matchups.map((match, index) => ({
      ...match,
      code: `duplicate_${index}`,
    }));
    expect(() => validateCompiledPreset(preset)).toThrow("source-reused");
  });
  it("refuses adding games to the single-game contract", () => {
    const preset = compilePreset("single_elimination", 4);
    Object.assign(at(at(preset.rounds, 0).matchups, 0), { maxGames: 3 });
    expect(() => validateCompiledPreset(preset)).toThrow("invalid-matchup");
  });
  it("refuses incomplete graphs", () => {
    const preset = compilePreset("single_elimination", 4);
    preset.rounds.pop();
    expect(() => validateCompiledPreset(preset)).toThrow("incomplete-structure");
  });
  it("has stable typed error codes without data or SQL details", () => {
    try {
      compilePreset("bad", 4);
      throw new Error("expected rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(PresetError);
      expect(error).toMatchObject({ code: "invalid-preset" });
    }
  });
});
