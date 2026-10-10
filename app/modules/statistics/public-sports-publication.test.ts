import { describe, expect, it, vi } from "vitest";
import type { CompetitionContext } from "../competition/context";
import { loadPublicSportsCore } from "./public-sports.server";

const context = { competitionId: 77 } as CompetitionContext;

describe("published sports snapshot", () => {
  it("uses only the current versioned snapshot and preserves missing scheduled scores", async () => {
    const from = vi.fn(() => {
      throw new Error("base tables must not be queried when a snapshot exists");
    });
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          schemaVersion: 1,
          teams: [
            { id: 1, name: "Azul", slug: "azul", abbreviation: "AZL" },
            { id: 2, name: "Ouro", slug: "ouro", abbreviation: null },
          ],
          games: [
            {
              id: 9,
              label: "Jogo 9",
              status: "scheduled",
              scheduledAt: "2026-09-12T22:00:00Z",
              venue: "Ginásio",
              home: { id: 1, name: "Azul", slug: "azul", abbreviation: "AZL" },
              away: { id: 2, name: "Ouro", slug: "ouro", abbreviation: null },
              homeScore: null,
              awayScore: null,
              trackCode: "main",
              stageCode: "knockout",
              stageName: "Eliminatória simples",
              roundCode: "final",
              roundName: "Final",
              roundOrder: 2,
              matchupCode: "final_match_1",
              matchupOrder: 1,
            },
          ],
        },
        error: null,
      }),
      from,
    };
    const result = await loadPublicSportsCore(client as never, context);
    expect(client.rpc).toHaveBeenCalledWith("public_get_competition_publication", {
      p_competition_id: 77,
    });
    expect(from).not.toHaveBeenCalled();
    expect(result.games[0]).toMatchObject({
      homeScore: null,
      awayScore: null,
      structure: { roundName: "Final", matchupOrder: 1 },
    });
    expect(result.standings.every((row) => row.games === 0)).toBe(true);
    expect(result.teamStatistics.every((row) => row.reboundsPerGame === null)).toBe(true);
  });

  it("keeps the approved publication independent of subsequently changed live authority", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        schemaVersion: 1,
        teams: [
          { id: 1, name: "Azul", slug: "azul" },
          { id: 2, name: "Ouro", slug: "ouro" },
        ],
        games: [
          {
            id: 9,
            label: "Jogo 9",
            status: "final",
            home: { id: 1, name: "Azul", slug: "azul" },
            away: { id: 2, name: "Ouro", slug: "ouro" },
            homeScore: 50,
            awayScore: 40,
          },
        ],
      },
      error: null,
    });
    const from = vi.fn(() => {
      throw new Error("unpublished authority data must stay private");
    });
    const result = await loadPublicSportsCore({ rpc, from } as never, context);
    expect(result.games[0]?.homeScore).toBe(50);
    expect(result.games[0]?.awayScore).toBe(40);
    expect(result.teamStatistics.every((row) => row.freeThrowPercentage === null)).toBe(true);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects an invalid snapshot without exposing its contents", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: { secret: "do not expose" }, error: null }),
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }),
        }),
      })),
    };
    const result = await loadPublicSportsCore(client as never, context);
    expect(result).toEqual({ games: [], standings: [], teamStatistics: [], teams: [] });
  });

  it("uses the legacy read model while the publication RPC is not deployed", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "PGRST202", message: "function is not in the schema cache" },
      }),
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }),
        }),
      })),
    };
    const result = await loadPublicSportsCore(client as never, context);
    expect(result).toEqual({ games: [], standings: [], teamStatistics: [], teams: [] });
  });
});
