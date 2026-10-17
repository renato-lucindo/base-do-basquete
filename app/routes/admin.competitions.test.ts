import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { loader } from "./admin.competitions";

vi.mock("../modules/auth/authorization.server", () => ({ requireAdminAal2: vi.fn() }));
vi.mock("../modules/auth/audit.server", () => ({ recordAuthAuditEvent: vi.fn() }));

const auth = vi.mocked(requireAdminAal2);
const selections: string[] = [];
const client = { from: vi.fn() };
let seasonError: string | null;
let legacyError: string | null;

const records: Record<string, unknown[]> = {
  competitions: [
    {
      id: 11,
      display_name: "Taça",
      year: 2026,
      status: "draft",
      series_id: 1,
      category_id: 3,
      gender_division: "male",
    },
  ],
  competition_series: [{ id: 1, name: "Taça" }],
  categories: [{ id: 3, name: "Adulto" }],
  competition_seasons: [{ id: 8, dispute_navigation_order: "division_category" }],
  competition_dispute_contexts: [
    {
      competition_id: 11,
      season_id: 8,
      season_name: "Temporada",
      category_name: "Adulto",
      gender_division: "male",
      competitive_division_type_name: null,
      competitive_division_value_name: null,
      competitive_division_sort_order: null,
    },
  ],
};

function args() {
  return {
    request: new Request("https://example.test/admin/competitions"),
    params: {},
    context: { get: () => ({ env: {} }) },
  } as unknown as Parameters<typeof loader>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  selections.length = 0;
  seasonError = null;
  legacyError = null;
  auth.mockResolvedValue({
    client,
    payload: { csrfToken: "csrf" },
    cookie: null,
  } as unknown as Awaited<ReturnType<typeof requireAdminAal2>>);
  client.from.mockImplementation((table: string) => ({
    select: (columns: string) => {
      selections.push(`${table}:${columns}`);
      const code =
        table === "competition_seasons"
          ? columns.includes("dispute_navigation_order")
            ? seasonError
            : legacyError
          : null;
      const response = code
        ? { data: null, error: { code } }
        : { data: records[table] ?? [], error: null };
      const query = Object.assign(Promise.resolve(response), { order: vi.fn() });
      query.order.mockReturnValue(query);
      return query;
    },
  }));
});

describe("admin competitions with legacy preview schema", () => {
  it("falls back to the default navigation when the migration column is absent", async () => {
    seasonError = "42703";
    const result = await loader(args());
    expect(result.data.groups).toMatchObject([
      { seasonId: 8, navigationOrder: "category_division" },
    ]);
    expect(selections).toContain("competition_seasons:id");
  });

  it("keeps the stored preference when the migration is present", async () => {
    const result = await loader(args());
    expect(result.data.groups).toMatchObject([
      { seasonId: 8, navigationOrder: "division_category" },
    ]);
    expect(selections).not.toContain("competition_seasons:id");
  });

  it.each(["42501", "PGRST301"])("does not hide a database failure (%s)", async (code) => {
    seasonError = code;
    await expect(loader(args())).rejects.toThrow("Administrative dashboard query failed");
    expect(selections).not.toContain("competition_seasons:id");
  });

  it("fails if even the legacy season query fails", async () => {
    seasonError = "PGRST204";
    legacyError = "42501";
    await expect(loader(args())).rejects.toThrow("Administrative dashboard query failed");
  });
});
