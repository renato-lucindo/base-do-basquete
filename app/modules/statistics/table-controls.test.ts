import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  advancedColumnPresets,
  compareValues,
  matchesStatisticsSearch,
  nextSort,
  parseColumnPreset,
  parseColumns,
  parsePage,
  parseSortDirection,
  parseSortKey,
  serializeColumns,
} from "./table-controls";

describe("statistics table controls", () => {
  const player = { playerName: "João da Silva", teamName: "Águias do Sul" };

  it("searches athletes and teams without depending on accents or case", () => {
    expect(matchesStatisticsSearch(player, "joao")).toBe(true);
    expect(matchesStatisticsSearch(player, "AGUIAS")).toBe(true);
    expect(matchesStatisticsSearch(player, "norte")).toBe(false);
  });

  it("parses only allowlisted sorting and column preferences", () => {
    expect(parseSortKey("assists", "points")).toBe("assists");
    expect(parseSortKey("twoPointMade", "points")).toBe("twoPointMade");
    expect(parseSortKey("disqualifications", "points")).toBe("disqualifications");
    expect(parseSortKey("drop table", "points")).toBe("points");
    expect(parseSortDirection("asc")).toBe("asc");
    expect(parseSortDirection("sideways")).toBe("desc");
    expect(parseColumns("points,assists,unknown,points", "essentials")).toEqual([
      "points",
      "assists",
    ]);
    expect(parseColumns("", "all")).toEqual(advancedColumnPresets.all);
    expect(parseColumnPreset("anything")).toBe("essentials");
    expect(parsePage("3")).toBe(3);
    expect(parsePage("-1")).toBe(1);
  });

  it("serializes stable column preferences", () => {
    expect(serializeColumns(["points", "assists", "plusMinus"])).toBe("points,assists,plusMinus");
  });

  it("sorts text, numbers and unavailable values deterministically", () => {
    expect(compareValues("Álvaro", "Bruno", "asc")).toBeLessThan(0);
    expect(compareValues(20, 10, "desc")).toBeLessThan(0);
    expect(compareValues(null, 10, "asc")).toBeGreaterThan(0);
    expect(nextSort("points", "desc", "points")).toEqual({
      key: "points",
      direction: "asc",
    });
    expect(nextSort("points", "asc", "player")).toEqual({
      key: "player",
      direction: "asc",
    });
  });

  it("round-trips any non-empty allowlisted column selection", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.constantFrom(...advancedColumnPresets.all), {
          minLength: 1,
          maxLength: advancedColumnPresets.all.length,
        }),
        (columns) => {
          expect(parseColumns(serializeColumns(columns), "essentials")).toEqual(columns);
        },
      ),
    );
  });

  it("parses every positive safe integer page without changing its value", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }), (page) => {
        expect(parsePage(String(page))).toBe(page);
      }),
    );
  });
});
