import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { action, loader } from "./admin.competitions.new";

vi.mock("../modules/auth/authorization.server", () => ({ requireAdminAal2: vi.fn() }));
const auth = vi.mocked(requireAdminAal2);
const client = { from: vi.fn(), rpc: vi.fn() };
function args(request: Request) {
  return { request, params: {}, context: { get: () => ({ env: {} }) } } as unknown as Parameters<
    typeof action
  >[0];
}
function post(fields: Record<string, string>, origin = "https://example.test") {
  return args(
    new Request("https://example.test/admin/competitions/new", {
      method: "POST",
      headers: { Origin: origin },
      body: new URLSearchParams(fields),
    }),
  );
}
const input = {
  seriesId: 1,
  categoryId: 2,
  year: 2026,
  name: "Copa teste",
  gender: "male",
  source: "manual_scoresheet",
  preset: "single_group",
  entryCount: 4,
  startsOn: null,
  endsOn: null,
  expectedProfileId: null,
  reason: null,
  reviewed: false,
};
const create = {
  intent: "create",
  csrfToken: "test-csrf",
  requestId: "f2ed0da8-dd87-44dd-9c3a-6b788711e550",
  payload: JSON.stringify(input),
  reviewed: "on",
};
beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({
    client,
    payload: { csrfToken: "test-csrf" },
    cookie: null,
  } as unknown as Awaited<ReturnType<typeof requireAdminAal2>>);
});
describe("edition wizard actions", () => {
  it("authorizes before loading choices", async () => {
    auth.mockRejectedValue(new Response(null, { status: 403 }));
    await expect(
      loader(args(new Request("https://example.test/admin/competitions/new"))),
    ).rejects.toMatchObject({ status: 403 });
    expect(client.from).not.toHaveBeenCalled();
  });
  it("rejects cross-origin requests before auth", async () => {
    await expect(action(post(create, "https://other.test"))).rejects.toMatchObject({ status: 403 });
    expect(auth).not.toHaveBeenCalled();
  });
  it("requires CSRF before any mutation", async () => {
    await expect(action(post({ ...create, csrfToken: "bad" }))).rejects.toMatchObject({
      status: 403,
    });
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it("does not create an edition while reviewing", async () => {
    await action(
      post({
        intent: "review",
        csrfToken: "test-csrf",
        seriesId: "1",
        categoryId: "2",
        year: "2026",
        name: "Copa teste",
        gender: "male",
        source: "manual_scoresheet",
        preset: "single_group",
        entryCount: "4",
      }),
    );
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { payload: "{" },
    { payload: JSON.stringify({ ...input, entryCount: 200 }) },
    { requestId: "bad" },
    { reviewed: "" },
  ])("rejects invalid confirmation %j before RPC", async (changes) => {
    await action(post({ ...create, ...changes }));
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it("calls exactly one transactional RPC and redirects to the hub", async () => {
    client.rpc.mockResolvedValue({ data: 123, error: null });
    await expect(action(post(create))).rejects.toMatchObject({ status: 302 });
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith("admin_create_competition_from_preset", {
      p_request_id: create.requestId,
      p_input: { ...input, reviewed: true },
    });
    expect(client.from).not.toHaveBeenCalled();
  });
  it("never returns raw database errors", async () => {
    client.rpc.mockResolvedValue({
      data: null,
      error: { code: "BR012", message: "internal SQL detail" },
    });
    const response = await action(post(create));
    expect(JSON.stringify(response)).not.toContain("internal SQL detail");
    expect(JSON.stringify(response)).toContain("perfil de dados mudou");
  });
});
