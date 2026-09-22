import { describe, expect, it, vi } from "vitest";

import type { CompetitionContext } from "../competition/context";
import { loadBoxscoreStatisticsPage } from "./boxscore-statistics.server";

const boxscoreContext: CompetitionContext = {
  competitionId: 7,
  dataProfile: { id: 3, primarySource: "fiba_boxscore", version: 2 },
  displayName: "Liga 2026",
  genderDivision: "male",
  statisticsMode: "boxscore",
  year: 2026,
  series: { id: 1, name: "Liga", slug: "liga" },
  category: { id: 1, name: "Adulto", slug: "adulto", hasAdvancedStats: true },
};

function headerResultChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => result);
  return chain;
}

function rowsResultChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi
    .fn()
    .mockReturnValueOnce(chain)
    .mockReturnValueOnce(chain)
    .mockResolvedValueOnce(result);
  return chain;
}

describe("boxscore statistics server query", () => {
  it("rejects scoresheet and legacy contexts before touching the database", async () => {
    const client = { from: vi.fn() };
    expect(
      await loadBoxscoreStatisticsPage(
        client as never,
        { ...boxscoreContext, statisticsMode: "scoresheet" },
        new URLSearchParams(),
      ),
    ).toBeNull();
    expect(client.from).not.toHaveBeenCalled();
  });

  it("loads only the current RLS-visible publication and requested allowlisted scope", async () => {
    const header = {
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
      unclassified_games: 0,
    };
    const headerChain = headerResultChain({ data: header, error: null });
    const rowsChain = rowsResultChain({ data: [], error: null });
    const from = vi.fn().mockReturnValueOnce(headerChain).mockReturnValueOnce(rowsChain);
    const result = await loadBoxscoreStatisticsPage(
      { from } as never,
      boxscoreContext,
      new URLSearchParams("scope=playoffs&mode=per-30"),
    );
    expect(result).toMatchObject({
      kind: "boxscore-v2",
      publicationId: 11,
      mode: "per-30",
      scope: "playoffs",
    });
    expect(from).toHaveBeenNthCalledWith(1, "competition_publication_statistics");
    expect(from).toHaveBeenNthCalledWith(2, "competition_player_statistics_publications");
    expect(rowsChain.eq).toHaveBeenCalledWith("scope", "playoffs");
  });

  it("refuses a snapshot from a different profile version", async () => {
    const headerChain = headerResultChain({
      data: {
        competition_id: 7,
        data_profile_id: 3,
        data_profile_version: 1,
        primary_source: "fiba_boxscore",
      },
      error: null,
    });
    const client = { from: vi.fn(() => headerChain) };
    expect(
      await loadBoxscoreStatisticsPage(client as never, boxscoreContext, new URLSearchParams()),
    ).toBeNull();
    expect(client.from).toHaveBeenCalledTimes(1);
  });
});
