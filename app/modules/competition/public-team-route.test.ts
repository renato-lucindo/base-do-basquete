import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompetitionContext } from "./context";
import { loadPublicDetailPayload } from "./public-route-data.server";
import { loadPublicSportsCore } from "../statistics/public-sports.server";

vi.mock("../statistics/public-sports.server", () => ({ loadPublicSportsCore: vi.fn() }));
const context = { competitionId: 77 } as CompetitionContext;
function client() {
  const tables: Record<string, Array<Record<string, unknown>>> = {
    teams: [{ id: 1, name: "Lobos", slug: "lobos", abbreviation: "LOB", is_public: true }],
    team_registrations: [
      { id: 22, team_id: 1, competition_id: 77, public_name: "Lobos", status: "confirmed" },
      { id: 23, team_id: 1, competition_id: 77, public_name: "Lobos B", status: "confirmed" },
    ],
  };
  return {
    from: (table: string) => {
      let rows = tables[table] ?? [];
      const query = {
        select: () => query,
        order: () => query,
        limit: () => query,
        eq: (key: string, value: unknown) => {
          rows = rows.filter((row) => row[key] === value);
          return query;
        },
        in: (key: string, values: unknown[]) => {
          rows = rows.filter((row) => values.includes(row[key]));
          return query;
        },
        maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
        // biome-ignore lint/suspicious/noThenProperty: Supabase builders are thenable.
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: rows, error: null }).then(resolve),
      };
      return query;
    },
  };
}
beforeEach(() => {
  vi.mocked(loadPublicSportsCore).mockResolvedValue({
    teams: [
      { id: 22, name: "Lobos", slug: "inscricao-22", abbreviation: "LOB" },
      { id: 23, name: "Lobos B", slug: "inscricao-23", abbreviation: "LOB" },
    ],
    games: [],
    standings: [],
    teamStatistics: [],
  });
});
describe("public team routes after independent registrations", () => {
  it.each([
    ["lobos", 22],
    ["inscricao-22", 22],
    ["inscricao-23", 23],
  ] as const)("resolves %s to the selected registration", async (slug, id) => {
    const result = await loadPublicDetailPayload(client() as never, context, "equipes", slug, [
      context,
    ]);
    expect(result?.teamProfile?.team.id).toBe(id);
    expect(result?.teamProfile?.team.slug).toBe(`inscricao-${id}`);
  });
  it("rejects a registration from a different dispute", async () => {
    const other = { competitionId: 78 } as CompetitionContext;
    expect(
      await loadPublicDetailPayload(client() as never, other, "equipes", "inscricao-23", [other]),
    ).toBeNull();
  });

  it.each(["lobos", "inscricao-22"])(
    "resolves %s against the actual unchanged legacy snapshot",
    async (slug) => {
      const actual = await vi.importActual<typeof import("../statistics/public-sports.server")>(
        "../statistics/public-sports.server",
      );
      vi.mocked(loadPublicSportsCore).mockImplementationOnce(actual.loadPublicSportsCore);
      const snapshot = {
        schemaVersion: 1,
        teams: [{ id: 1, registrationId: 22, name: "Lobos", slug: "lobos", abbreviation: "LOB" }],
        games: [],
      };
      const api = { ...client(), rpc: vi.fn().mockResolvedValue({ data: snapshot, error: null }) };
      const result = await loadPublicDetailPayload(api as never, context, "equipes", slug, [
        context,
      ]);
      expect(result?.teamProfile?.team).toMatchObject({
        id: 1,
        registrationId: 22,
        name: "Lobos",
        slug: "lobos",
      });
      expect(snapshot.teams[0]?.slug).toBe("lobos");
    },
  );
});
