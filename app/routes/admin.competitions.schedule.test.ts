import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { action, loader } from "./admin.competitions.$competitionId.schedule";
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
    new Request("https://example.test/admin/competitions/100/schedule", {
      method: "POST",
      headers: { Origin: origin },
      body: new URLSearchParams({
        csrfToken: "test-csrf",
        intent: "prepare",
        matchupId: "12",
        expectedRevision: "0",
        scheduledAt: "",
        venue: "",
        ...fields,
      }),
    }),
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: { id: 12 }, error: null });
  client.from.mockReturnValue(query);
  client.rpc.mockResolvedValue({ data: null, error: null });
  auth.mockResolvedValue({
    client,
    payload: { csrfToken: "test-csrf" },
    cookie: null,
  } as unknown as Awaited<ReturnType<typeof requireAdminAal2>>);
});
describe("private schedule boundary", () => {
  it("authorizes before any loader query", async () => {
    auth.mockRejectedValue(new Response(null, { status: 403 }));
    await expect(
      loader(args(new Request("https://example.test/admin/competitions/100/schedule"))),
    ).rejects.toMatchObject({ status: 403 });
    expect(client.from).not.toHaveBeenCalled();
  });
  it("rejects cross origin before auth", async () => {
    await expect(action(post({}, "https://other.test"))).rejects.toMatchObject({ status: 403 });
    expect(auth).not.toHaveBeenCalled();
  });
  it("rejects CSRF before querying or writing", async () => {
    await expect(action(post({ csrfToken: "wrong" }))).rejects.toMatchObject({ status: 403 });
    expect(client.from).not.toHaveBeenCalled();
  });
  it("enforces the edition context before the mutation", async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(action(post())).rejects.toMatchObject({ status: 404 });
    expect(query.eq).toHaveBeenCalledWith("competition_id", 100);
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it("drops forged participants and calls one RPC", async () => {
    await expect(action(post({ homeRegistrationId: "99" }))).resolves.toMatchObject({
      status: 302,
    });
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith("admin_prepare_matchup", {
      p_matchup_id: 12,
      p_expected_revision: 0,
      p_scheduled_at: null,
      p_venue: null,
    });
  });
  it("validates before querying", async () => {
    await action(post({ scheduledAt: "2026-02-30T12:00Z" }));
    expect(client.from).not.toHaveBeenCalled();
  });
  it("does not expose raw SQL", async () => {
    client.rpc.mockResolvedValue({
      data: null,
      error: { code: "BR026", message: "internal SQL detail" },
    });
    const result = await action(post());
    expect(JSON.stringify(result)).not.toContain("internal SQL");
    expect(JSON.stringify(result)).toContain("Recarregue");
  });
  it("resolves only the official submission inside the current edition", async () => {
    await expect(
      action(
        post({
          intent: "resolve",
          officialResultSubmissionId: "34",
        }),
      ),
    ).resolves.toMatchObject({ status: 302 });
    expect(query.eq).toHaveBeenCalledWith("competition_id", 100);
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith("admin_resolve_matchup", {
      p_matchup_id: 12,
      p_expected_submission_id: 34,
    });
  });
  it("rejects a forged result id before querying", async () => {
    await action(post({ intent: "resolve", officialResultSubmissionId: "0" }));
    expect(client.from).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
