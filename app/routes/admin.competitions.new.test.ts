import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { action, loader } from "./admin.competitions.new";
vi.mock("../modules/auth/authorization.server", () => ({ requireAdminAal2: vi.fn() }));
const auth = vi.mocked(requireAdminAal2);
const client = { from: vi.fn(), rpc: vi.fn() };
const tables: Record<string, { data: unknown[] | null; error: unknown }> = {};
function args(request: Request) {
  return { request, params: {}, context: { get: () => ({ env: {} }) } } as unknown as Parameters<
    typeof action
  >[0];
}
const input = {
  seriesId: 1,
  championshipName: null,
  seasonId: null,
  categoryKind: "adult",
  categoryAge: null,
  year: 2026,
  gender: "male",
  description: null,
  startsOn: null,
  endsOn: null,
  divisionMode: "none",
  divisionValueId: null,
  divisionTypeName: null,
  divisionValueName: null,
  source: "manual_scoresheet",
  preset: "single_group",
  entryCount: 4,
  expectedProfileId: null,
  reason: null,
  reviewed: false,
};
const create = {
  intent: "create",
  csrfToken: "csrf-test",
  requestId: "f2ed0da8-dd87-44dd-9c3a-6b788711e550",
  payload: JSON.stringify(input),
  reviewed: "on",
};
function post(fields: Record<string, string>, origin = "https://example.test") {
  return args(
    new Request("https://example.test/admin/competitions/new", {
      method: "POST",
      headers: { Origin: origin },
      body: new URLSearchParams(fields),
    }),
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(tables)) delete tables[key];
  tables.competition_series = { data: [{ id: 1, name: "RED" }], error: null };
  auth.mockResolvedValue({
    client,
    payload: { csrfToken: "csrf-test" },
    cookie: null,
  } as unknown as Awaited<ReturnType<typeof requireAdminAal2>>);
  client.from.mockImplementation((table: string) => {
    const query = Object.assign(Promise.resolve(tables[table] ?? { data: [], error: null }), {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
    });
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);
    return query;
  });
});
describe("edition workflow actions", () => {
  it("authorizes before loading choices", async () => {
    auth.mockRejectedValue(new Response(null, { status: 403 }));
    await expect(
      loader(args(new Request("https://example.test/admin/competitions/new"))),
    ).rejects.toMatchObject({ status: 403 });
    expect(client.from).not.toHaveBeenCalled();
  });
  it("rejects cross-origin before auth and invalid CSRF before RPC", async () => {
    await expect(action(post(create, "https://other.test"))).rejects.toMatchObject({ status: 403 });
    expect(auth).not.toHaveBeenCalled();
    await expect(action(post({ ...create, csrfToken: "bad" }))).rejects.toMatchObject({
      status: 403,
    });
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { payload: "{" },
    { payload: JSON.stringify({ ...input, categoryKind: "master", categoryAge: 38 }) },
    { requestId: "bad" },
    { reviewed: "" },
  ])("rejects invalid confirmation %j", async (delta) => {
    await action(post({ ...create, ...delta }));
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it("reviews without mutation and derives the name", async () => {
    const form = Object.fromEntries(
      Object.entries(input)
        .filter(([, value]) => value !== null)
        .map(([key, value]) => [key, String(value)]),
    );
    const result = await action(post({ ...form, intent: "review", csrfToken: "csrf-test" }));
    expect(JSON.stringify(result)).toContain('"name":"RED"');
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it("calls exactly one transactional RPC", async () => {
    client.rpc.mockResolvedValue({ data: { seasonId: 7, competitionId: 123 }, error: null });
    await expect(action(post(create))).rejects.toMatchObject({ status: 302 });
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith("admin_create_competition_edition", {
      p_request_id: create.requestId,
      p_input: { ...input, reviewed: true },
    });
  });
  it("does not block exact create retries when their edition now exists", async () => {
    tables.competition_seasons = {
      data: [
        {
          id: 7,
          series_id: 1,
          year: 2026,
          name: "RED",
          description: null,
        },
      ],
      error: null,
    };
    client.rpc.mockResolvedValue({ data: { seasonId: 7, competitionId: 123 }, error: null });
    await expect(action(post(create))).rejects.toMatchObject({ status: 302 });
    expect(client.rpc).toHaveBeenCalledOnce();
  });
  it("shows add-dispute action for an existing edition at review", async () => {
    tables.competition_seasons = {
      data: [
        {
          id: 7,
          series_id: 1,
          year: 2026,
          name: "RED",
          description: null,
        },
      ],
      error: null,
    };
    const form = Object.fromEntries(
      Object.entries(input)
        .filter(([, value]) => value !== null)
        .map(([key, value]) => [key, String(value)]),
    );
    const result = await action(post({ ...form, intent: "review", csrfToken: "csrf-test" }));
    expect(JSON.stringify(result)).toContain('"existingSeasonId":7');
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it("adds male and female disputes to the selected edition", async () => {
    tables.competition_seasons = {
      data: [
        {
          id: 7,
          series_id: 1,
          year: 2026,
          name: "RED",
          description: null,
        },
      ],
      error: null,
    };
    client.rpc.mockResolvedValue({ data: { seasonId: 7, competitionId: 124 }, error: null });
    const addition = {
      ...input,
      seasonId: 7,
      seriesId: null,
      categoryKind: "base",
      categoryAge: 17,
    };
    await expect(
      action(post({ ...create, payload: JSON.stringify(addition) })),
    ).rejects.toMatchObject({ status: 302 });
    expect(client.rpc.mock.calls[0]?.[0]).toBe("admin_add_competition_dispute");
    client.rpc.mockClear();
    await expect(
      action(post({ ...create, payload: JSON.stringify({ ...addition, gender: "female" }) })),
    ).rejects.toMatchObject({ status: 302 });
    expect(client.rpc.mock.calls[0]?.[0]).toBe("admin_add_competition_dispute");
  });
  it("never leaks database errors and blocks the unavailable schema", async () => {
    client.rpc.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "internal SQL secret detail" },
    });
    const result = await action(post(create));
    expect(JSON.stringify(result)).not.toContain("secret detail");
    client.rpc.mockClear();
    tables.categories = { data: null, error: { code: "42703" } };
    const unavailable = await action(post(create));
    expect(JSON.stringify(unavailable)).toContain("migration");
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
