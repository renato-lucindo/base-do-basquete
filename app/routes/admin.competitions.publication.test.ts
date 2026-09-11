import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { action, loader } from "./admin.competitions.$competitionId.publication";

vi.mock("../modules/auth/authorization.server", () => ({ requireAdminAal2: vi.fn() }));
const auth = vi.mocked(requireAdminAal2);
const client = { from: vi.fn(), rpc: vi.fn() };
const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };

function args(request: Request) {
  return {
    request,
    params: { competitionId: "100" },
    context: { get: () => ({ env: {} }) },
  } as unknown as Parameters<typeof action>[0];
}

function post(fields: Record<string, string> = {}, origin = "https://example.test") {
  return args(
    new Request("https://example.test/admin/competitions/100/publication", {
      method: "POST",
      headers: { Origin: origin },
      body: new URLSearchParams({
        csrfToken: "test-csrf",
        expectedVersion: "1",
        confirmed: "yes",
        ...fields,
      }),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: { id: 100 }, error: null });
  client.from.mockReturnValue(query);
  client.rpc.mockResolvedValue({ data: 9, error: null });
  auth.mockResolvedValue({
    client,
    payload: { csrfToken: "test-csrf" },
    cookie: null,
  } as unknown as Awaited<ReturnType<typeof requireAdminAal2>>);
});

describe("publication boundary", () => {
  it("authorizes before loader queries", async () => {
    auth.mockRejectedValue(new Response(null, { status: 403 }));
    await expect(
      loader(args(new Request("https://example.test/admin/competitions/100/publication"))),
    ).rejects.toMatchObject({ status: 403 });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("rejects cross origin before auth", async () => {
    await expect(action(post({}, "https://other.test"))).rejects.toMatchObject({ status: 403 });
    expect(auth).not.toHaveBeenCalled();
  });

  it("rejects CSRF before a query", async () => {
    await expect(action(post({ csrfToken: "wrong" }))).rejects.toMatchObject({ status: 403 });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("requires explicit confirmation before querying", async () => {
    const result = await action(post({ confirmed: "" }));
    expect(JSON.stringify(result)).toContain("Confirme");
    expect(client.from).not.toHaveBeenCalled();
  });

  it("publishes only the current route edition through one RPC", async () => {
    await expect(action(post())).resolves.toMatchObject({ status: 302 });
    expect(query.eq).toHaveBeenCalledWith("id", 100);
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith("admin_publish_competition", {
      p_competition_id: 100,
      p_expected_version: 1,
      p_confirmed: true,
    });
  });

  it("does not expose a raw database error", async () => {
    client.rpc.mockResolvedValue({
      data: null,
      error: { code: "BR041", message: "raw SQL secret" },
    });
    const result = await action(post());
    expect(JSON.stringify(result)).not.toContain("raw SQL secret");
    expect(JSON.stringify(result)).toContain("Recarregue");
  });
});
