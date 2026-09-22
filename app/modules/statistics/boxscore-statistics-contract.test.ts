import { describe, expect, it } from "vitest";

import {
  BOXSCORE_GAME_SCOPES,
  BOXSCORE_STATISTICS_MODES,
  hasMinimumPer30Sample,
  isPublishedBoxscoreProfile,
  normalizePer30,
  parseBoxscoreGameScope,
  parseBoxscoreStatisticsMode,
  scopesForStageKind,
} from "./boxscore-statistics-contract";

describe("public boxscore statistics contract baseline", () => {
  it("freezes all nine mode and scope combinations", () => {
    expect(
      BOXSCORE_STATISTICS_MODES.flatMap((mode) =>
        BOXSCORE_GAME_SCOPES.map((scope) => `${mode}:${scope}`),
      ),
    ).toEqual([
      "per-game:regular",
      "per-game:playoffs",
      "per-game:all",
      "total:regular",
      "total:playoffs",
      "total:all",
      "per-30:regular",
      "per-30:playoffs",
      "per-30:all",
    ]);
  });

  it("uses safe URL defaults for absent or manipulated values", () => {
    expect(parseBoxscoreStatisticsMode(null)).toBe("per-game");
    expect(parseBoxscoreStatisticsMode("per-30")).toBe("per-30");
    expect(parseBoxscoreStatisticsMode("drop table")).toBe("per-game");
    expect(parseBoxscoreGameScope(null)).toBe("regular");
    expect(parseBoxscoreGameScope("all")).toBe("all");
    expect(parseBoxscoreGameScope("stage-42")).toBe("regular");
  });

  it("classifies stages structurally and never treats unclassified games as regular", () => {
    expect(scopesForStageKind("round_robin")).toEqual(["regular", "all"]);
    expect(scopesForStageKind("playoffs")).toEqual(["playoffs", "all"]);
    expect(scopesForStageKind("legacy_unclassified")).toEqual(["all"]);
    expect(scopesForStageKind(null)).toEqual(["all"]);
  });

  it("keeps 9:59 ineligible and makes exactly 10:00 eligible", () => {
    expect(hasMinimumPer30Sample(599)).toBe(false);
    expect(hasMinimumPer30Sample(600)).toBe(true);
    expect(normalizePer30(10, 599)).toBeNull();
    expect(normalizePer30(10, 600)).toBe(30);
    expect(normalizePer30(0, 0)).toBeNull();
  });

  it("admits only an active published boxscore profile", () => {
    expect(isPublishedBoxscoreProfile({ primarySource: "fiba_boxscore", status: "active" })).toBe(
      true,
    );
    expect(
      isPublishedBoxscoreProfile({ primarySource: "manual_scoresheet", status: "active" }),
    ).toBe(false);
    expect(isPublishedBoxscoreProfile({ primarySource: null, status: "pending" })).toBe(false);
    expect(isPublishedBoxscoreProfile({ primarySource: "fiba_boxscore", status: "legacy" })).toBe(
      false,
    );
  });
});
