import { describe, expect, it } from "vitest";

import {
  advancedColumnPresets,
  compareValues,
  matchesStatisticsSearch,
  nextSort,
  parseColumns,
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
    expect(parseSortKey("drop table", "points")).toBe("points");
    expect(parseSortDirection("asc")).toBe("asc");
    expect(parseSortDirection("sideways")).toBe("desc");
    expect(parseColumns("points,assists,unknown,points", "summary")).toEqual([
      "points",
      "assists",
    ]);
    expect(parseColumns("", "shooting")).toEqual(advancedColumnPresets.shooting);
  });

  it("serializes stable column preferences", () => {
    expect(serializeColumns(["points", "assists", "plusMinus"])).toBe(
      "points,assists,plusMinus",
    );
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
});
