import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { action } from "./admin.competitions.$competitionId.registrations.copy";
vi.mock("../modules/auth/authorization.server", () => ({ requireAdminAal2: vi.fn() }));
const rpc = vi.fn();
const fields = {
  csrfToken: "test-csrf",
  sourceCompetitionId: "7",
  requestId: "f2ed0da8-dd87-44dd-9c3a-6b788711e550",
  registrationId: "11",
  "publicName:11": "Lobos B",
  "player:11": "5",
};
function post(delta = {}, origin = "https://example.test") {
  return {
    request: new Request("https://example.test/admin/competitions/8/registrations/copy", {
      method: "POST",
      headers: { Origin: origin },
      body: new URLSearchParams({ ...fields, ...delta }),
    }),
    params: { competitionId: "8" },
    context: { get: () => ({ env: {} }) },
  } as unknown as Parameters<typeof action>[0];
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAdminAal2).mockResolvedValue({
    client: { rpc },
    payload: { csrfToken: "test-csrf" },
    cookie: null,
  } as never);
});
describe("registration copy HTTP replay", () => {
  it("sends identical retries to the authoritative ledger without a mutable preview", async () => {
    rpc.mockResolvedValue({ data: { registrations: [{ registrationId: 22 }] }, error: null });
    await expect(action(post())).rejects.toMatchObject({ status: 302 });
    await expect(action(post())).rejects.toMatchObject({ status: 302 });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
    expect(rpc).toHaveBeenCalledWith("admin_copy_team_registrations", {
      p_request_id: fields.requestId,
      p_source_competition_id: 7,
      p_target_competition_id: 8,
      p_items: [{ sourceRegistrationId: 11, publicName: "Lobos B", playerIds: [5] }],
    });
  });
  it("preserves authority and rejects divergent replay reported by SQL", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "BD409" } });
    const result = await action(post({ "publicName:11": "Lobos C" }));
    expect(result.init?.status).toBe(409);
  });
  it("checks origin, MFA and CSRF before any RPC", async () => {
    await expect(action(post({}, "https://other.test"))).rejects.toMatchObject({ status: 403 });
    expect(requireAdminAal2).not.toHaveBeenCalled();
    await expect(action(post({ csrfToken: "invalid" }))).rejects.toMatchObject({ status: 403 });
    vi.mocked(requireAdminAal2).mockRejectedValue(new Response(null, { status: 403 }));
    await expect(action(post())).rejects.toMatchObject({ status: 403 });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects malformed player IDs instead of silently dropping them", async () => {
    const result = await action(post({ "player:11": "invalid" }));
    expect(result.init?.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});
