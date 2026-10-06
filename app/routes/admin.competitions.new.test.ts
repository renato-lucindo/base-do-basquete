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

const dispute = {
  categoryKind: "adult",
  categoryAge: null,
  gender: "male",
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
};

const input = {
  seriesId: 1,
  championshipName: null,
  seasonId: null,
  year: 2026,
  description: null,
  navigationOrder: "category_division",
  disputes: [dispute],
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

function season() {
  return {
    id: 7,
    series_id: 1,
    year: 2026,
    name: "RED",
    description: null,
    suggested_starts_on: null,
    suggested_ends_on: null,
    revision: 1,
    dispute_navigation_order: "category_division",
  };
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
    {
      payload: JSON.stringify({
        ...input,
        disputes: [{ ...dispute, categoryKind: "master", categoryAge: 38 }],
      }),
    },
    { requestId: "bad" },
    { reviewed: "" },
  ])("rejects invalid confirmation %j", async (delta) => {
    await action(post({ ...create, ...delta }));
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("reviews without mutation and derives the dispute name", async () => {
    const result = await action(
      post({ intent: "review", csrfToken: "csrf-test", payload: JSON.stringify(input) }),
    );
    expect(JSON.stringify(result)).toContain('"name":"RED"');
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("calls exactly one transactional batch RPC", async () => {
    client.rpc.mockResolvedValue({
      data: { seasonId: 7, competitionId: 123, competitionIds: [123] },
      error: null,
    });
    await expect(action(post(create))).rejects.toMatchObject({ status: 302 });
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith("admin_create_competition_edition_batch", {
      p_request_id: create.requestId,
      p_input: { ...input, disputes: [{ ...dispute }], reviewed: true },
    });
  });

  it("reviews two disputes and submits one atomic batch", async () => {
    const multi = {
      ...input,
      navigationOrder: "division_category",
      disputes: [
        dispute,
        {
          ...dispute,
          categoryKind: "base",
          categoryAge: 17,
          gender: "female",
          preset: "single_elimination",
          entryCount: 8,
        },
      ],
    };
    const review = await action(
      post({ intent: "review", csrfToken: "csrf-test", payload: JSON.stringify(multi) }),
    );
    expect(JSON.stringify(review)).toContain("RED - Sub-17");
    expect(client.rpc).not.toHaveBeenCalled();

    client.rpc.mockResolvedValue({
      data: { seasonId: 7, competitionId: 123, competitionIds: [123, 124] },
      error: null,
    });
    await expect(action(post({ ...create, payload: JSON.stringify(multi) }))).rejects.toMatchObject(
      { status: 302 },
    );
    expect(client.rpc.mock.calls[0]?.[0]).toBe("admin_create_competition_edition_batch");
  });

  it("does not block exact create retries when their edition now exists", async () => {
    tables.competition_seasons = { data: [season()], error: null };
    client.rpc.mockResolvedValue({
      data: { seasonId: 7, competitionId: 123, competitionIds: [123] },
      error: null,
    });
    await expect(action(post(create))).rejects.toMatchObject({ status: 302 });
    expect(client.rpc).toHaveBeenCalledOnce();
  });

  it("shows add-dispute action for an existing edition at review", async () => {
    tables.competition_seasons = { data: [season()], error: null };
    const result = await action(
      post({ intent: "review", csrfToken: "csrf-test", payload: JSON.stringify(input) }),
    );
    expect(JSON.stringify(result)).toContain('"existingSeasonId":7');
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("keeps later additions on the existing single-dispute RPC", async () => {
    tables.competition_seasons = { data: [season()], error: null };
    client.rpc.mockResolvedValue({ data: { seasonId: 7, competitionId: 124 }, error: null });
    const addition = {
      ...input,
      seasonId: 7,
      seriesId: null,
      disputes: [{ ...dispute, categoryKind: "base", categoryAge: 17 }],
    };
    await expect(
      action(post({ ...create, payload: JSON.stringify(addition) })),
    ).rejects.toMatchObject({ status: 302 });
    expect(client.rpc.mock.calls[0]?.[0]).toBe("admin_add_competition_dispute");
  });

  it("links a duplicate existing dispute instead of hiding the conflict", async () => {
    tables.competition_seasons = { data: [season()], error: null };
    tables.categories = {
      data: [{ id: 20, name: "Adulto", age_kind: "adult", age_value: null }],
      error: null,
    };
    tables.competition_dispute_contexts = {
      data: [
        {
          competition_id: 123,
          season_id: 7,
          category_id: 20,
          gender_division: "male",
          competitive_division_value_id: null,
        },
      ],
      error: null,
    };
    const addition = { ...input, seasonId: 7, seriesId: null };
    const result = await action(
      post({ intent: "review", csrfToken: "csrf-test", payload: JSON.stringify(addition) }),
    );
    expect(JSON.stringify(result)).toContain('"existingCompetitionId":123');
    expect(client.rpc).not.toHaveBeenCalled();
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
