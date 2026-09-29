import { describe, expect, it } from "vitest";

import type { BoxscoreSnapshotHeader, BoxscoreSnapshotRow } from "./boxscore-statistics-domain";
import {
  boxscorePlayerRow,
  buildBoxscoreStatisticsPage,
  parseBoxscoreStatisticsQuery,
} from "./boxscore-statistics-domain";

const raw = (playerId: number, seconds: number): BoxscoreSnapshotRow => ({
  advanced_games_covered: 2,
  advanced_points: 20,
  assists: 6,
  blocks: 2,
  competition_id: 7,
  created_at: "2026-09-22T00:00:00Z",
  data_profile_id: 3,
  defensive_rebounds: 8,
  foul_games_covered: 2,
  fouls_committed: 4,
  fouls_received: playerId === 2 ? null : 2,
  fouls_received_games_covered: playerId === 2 ? 0 : 2,
  free_throw_attempted: 6,
  free_throw_made: 4,
  games_played: 2,
  jersey_number: "9",
  jersey_varies: false,
  offensive_rebounds: 2,
  official_points: 20,
  per_30_minimum_seconds: 600,
  playoff_games: 0,
  player_id: playerId,
  player_name: `Atleta ${playerId}`,
  player_slug: `atleta-${playerId}`,
  plus_minus: 8,
  publication_id: 11,
  registration_id: 21,
  regular_games: 2,
  scope: "regular",
  scoring_games_covered: 2,
  seconds_covered: seconds,
  statistics_contract: "boxscore",
  steals: 4,
  team_abbreviation: "AZL",
  team_id: 31,
  team_name: "Azul",
  team_slug: "azul",
  three_point_attempted: 8,
  three_point_made: 2,
  turnovers: 2,
  two_point_attempted: 10,
  two_point_made: 5,
  unclassified_games: 0,
});

const header: BoxscoreSnapshotHeader = {
  competition_id: 7,
  created_at: "2026-09-22T00:00:00Z",
  data_profile_id: 3,
  data_profile_version: 2,
  per_30_minimum_seconds: 600,
  playoff_games: 1,
  primary_source: "fiba_boxscore",
  publication_id: 11,
  regular_games: 2,
  schema_version: 1,
  snapshot_kind: "publication",
  source_fingerprint: "a".repeat(32),
  statistics_contract: "boxscore",
  unclassified_games: 1,
};

describe("boxscore statistics server domain", () => {
  it("parses only allowlisted state and disables MIN sorting/filtering per 30", () => {
    const query = parseBoxscoreStatisticsQuery(
      new URLSearchParams(
        "mode=per-30&scope=all&sort=minutes&filters=minutes:%3E:10;points:%3E=:5;drop:%3E:1&compare=2,2,3,evil&page=2",
      ),
    );
    expect(query).toMatchObject({ mode: "per-30", scope: "all", sort: "points", page: 2 });
    expect(query.filters).toEqual([{ metric: "points", operator: ">=", value: 5 }]);
    expect(query.compare).toEqual([2, 3]);
  });

  it("parses repeated team checkboxes and preserves an explicit empty selection", () => {
    expect(
      parseBoxscoreStatisticsQuery(
        new URLSearchParams("team=azul&team=verde&team=azul&team=invalida!"),
      ).teams,
    ).toEqual(["azul", "verde"]);
    expect(parseBoxscoreStatisticsQuery(new URLSearchParams("team=")).teams).toEqual([]);
    expect(parseBoxscoreStatisticsQuery(new URLSearchParams()).teams).toBeNull();
  });

  it("uses the exact 9:59 and 10:00 per-30 boundary", () => {
    expect(boxscorePlayerRow(raw(1, 599), "per-30").metrics.points.status).toBe(
      "insufficient-sample",
    );
    expect(boxscorePlayerRow(raw(1, 600), "per-30").metrics.points).toEqual({
      status: "available",
      value: 60,
    });
  });

  it("uses the minimum sample frozen in the publication row", () => {
    expect(
      boxscorePlayerRow({ ...raw(1, 600), per_30_minimum_seconds: 601 }, "per-30").metrics.points
        .status,
    ).toBe("insufficient-sample");
  });

  it("keeps percentages and per-game plus/minus unchanged in per-30 mode", () => {
    const perGame = boxscorePlayerRow(raw(1, 600), "per-game");
    const per30 = boxscorePlayerRow(raw(1, 600), "per-30");
    expect(per30.metrics.fieldGoalPercentage).toEqual(perGame.metrics.fieldGoalPercentage);
    expect(per30.metrics.threePointPercentage).toEqual(perGame.metrics.threePointPercentage);
    expect(per30.metrics.freeThrowPercentage).toEqual(perGame.metrics.freeThrowPercentage);
    expect(per30.metrics.plusMinus).toEqual(perGame.metrics.plusMinus);
  });

  it("exposes three-point makes, attempts and percentage in every mode", () => {
    const total = boxscorePlayerRow(raw(1, 1200), "total");
    const perGame = boxscorePlayerRow(raw(1, 1200), "per-game");
    expect(total.metrics.threePointersMade).toEqual({ status: "available", value: 2 });
    expect(total.metrics.threePointersAttempted).toEqual({ status: "available", value: 8 });
    expect(total.metrics.threePointPercentage).toEqual({ status: "available", value: 25 });
    expect(perGame.metrics.threePointersMade).toEqual({ status: "available", value: 1 });
  });

  it("preserves unavailable received fouls for Basketball Site-style rows", () => {
    expect(boxscorePlayerRow(raw(2, 1200), "total").metrics.foulsReceived.status).toBe(
      "unavailable",
    );
  });

  it("calculates leaders before pagination and loads compared players outside the page", () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({
      ...raw(index + 1, 1200),
      official_points: index + 1,
      advanced_points: index + 1,
    }));
    const page = buildBoxscoreStatisticsPage(rows, header, {
      ...parseBoxscoreStatisticsQuery(new URLSearchParams("page=1&compare=1")),
      direction: "desc",
    });
    expect(page.rows).toHaveLength(20);
    expect(page.leaders.points).toEqual([25]);
    expect(page.compared[0]?.playerId).toBe(1);
  });

  it("excludes insufficient and unavailable metrics from per-30 filters and leaders", () => {
    const page = buildBoxscoreStatisticsPage([raw(1, 599), raw(2, 1200)], header, {
      ...parseBoxscoreStatisticsQuery(new URLSearchParams("mode=per-30")),
      filters: [{ metric: "points", operator: ">", value: 0 }],
    });
    expect(page.rows.map((row) => row.playerId)).toEqual([2]);
    expect(page.leaders.foulsReceived).toBeUndefined();
  });

  it("filters multiple selected teams", () => {
    const green = {
      ...raw(2, 1200),
      team_id: 32,
      team_name: "Verde",
      team_slug: "verde",
    };
    const page = buildBoxscoreStatisticsPage([raw(1, 1200), green], header, {
      ...parseBoxscoreStatisticsQuery(new URLSearchParams("team=azul&team=verde")),
    });
    const empty = buildBoxscoreStatisticsPage([raw(1, 1200), green], header, {
      ...parseBoxscoreStatisticsQuery(new URLSearchParams("team=")),
    });
    expect(page.rows.map((row) => row.playerId)).toEqual([1, 2]);
    expect(empty.rows).toEqual([]);
  });
});
