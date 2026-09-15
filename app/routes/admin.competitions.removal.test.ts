import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { action } from "./admin.competitions.$competitionId";

vi.mock("../modules/auth/authorization.server", () => ({ requireAdminAal2: vi.fn() }));

const auth = vi.mocked(requireAdminAal2);
const client = { rpc: vi.fn() };

function request(fields: Record<string, string> = {}, origin = "https://example.test") {
  return {
    request: new Request("https://example.test/admin/competitions/100", {
      method: "POST",
      headers: { Origin: origin },
      body: new URLSearchParams({
        csrfToken: "test-csrf",
        intent: "remove-registration",
        registrationId: "55",
        expectedDecision: "withdraw",
        reason: "Preservar todo o histórico competitivo",
        confirmed: "on",
        ...fields,
      }),
    }),
    params: { competitionId: "100" },
    context: { get: () => ({ env: {} }) },
  } as unknown as Parameters<typeof action>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  client.rpc.mockResolvedValue({ data: { outcome: "withdrawn" }, error: null });
  auth.mockResolvedValue({
    client,
    payload: { csrfToken: "test-csrf" },
    cookie: null,
  } as unknown as Awaited<ReturnType<typeof requireAdminAal2>>);
});

describe("registration removal action boundary", () => {
  it("rejects cross origin before authentication", async () => {
    await expect(action(request({}, "https://other.test"))).rejects.toMatchObject({ status: 403 });
    expect(auth).not.toHaveBeenCalled();
  });

  it("rejects CSRF before the database call", async () => {
    await expect(action(request({ csrfToken: "wrong" }))).rejects.toMatchObject({ status: 403 });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("requires explicit impact confirmation", async () => {
    const response = await action(request({ confirmed: "" }));
    expect(response).toMatchObject({ init: { status: 400 } });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("rejects blocked or malformed client decisions", async () => {
    const response = await action(request({ expectedDecision: "blocked" }));
    expect(response).toMatchObject({ init: { status: 400 } });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("rejects the legacy withdrawal path before any RPC", async () => {
    const response = await action(
      request({ intent: "transition-registration", status: "withdrawn" }),
    );
    expect(response).toMatchObject({ init: { status: 400 } });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("passes only identifiers, expected policy and bounded reason to one RPC", async () => {
    await expect(action(request())).rejects.toMatchObject({ status: 302 });
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith("admin_apply_registration_removal", {
      p_registration_id: 55,
      p_expected_decision: "withdraw",
      p_reason: "Preservar todo o histórico competitivo",
    });
  });

  it("maps stable database codes without exposing SQL details", async () => {
    client.rpc.mockResolvedValue({
      data: null,
      error: { code: "BR052", message: "internal SQL detail" },
    });
    const response = await action(request());
    expect(JSON.stringify(response)).toContain("Recarregue");
    expect(JSON.stringify(response)).not.toContain("internal SQL detail");
  });
});
