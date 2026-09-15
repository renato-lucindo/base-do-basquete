import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { action } from "./admin.competitions.$competitionId.structure";

vi.mock("../modules/auth/authorization.server", () => ({ requireAdminAal2: vi.fn() }));

const auth = vi.mocked(requireAdminAal2);
const client = { rpc: vi.fn() };

function args(fields: Record<string, string> = {}, origin = "https://example.test") {
  return {
    request: new Request("https://example.test/admin/competitions/100/structure", {
      method: "POST",
      headers: { Origin: origin },
      body: new URLSearchParams({
        csrfToken: "csrf",
        intent: "clone-ruleset",
        requestId: "40dde5c7-46b2-4241-995d-4e42223bbdf2",
        sourceRevisionId: "12",
        confirmIndependent: "on",
        ...fields,
      }),
    }),
    params: { competitionId: "100" },
    context: { get: () => ({ env: {} }) },
  } as unknown as Parameters<typeof action>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  client.rpc.mockResolvedValue({ data: { rulesetRevisionId: 42 }, error: null });
  auth.mockResolvedValue({
    client,
    payload: { csrfToken: "csrf" },
    cookie: null,
  } as unknown as Awaited<ReturnType<typeof requireAdminAal2>>);
});

describe("ruleset clone action", () => {
  it("rejects cross origin before authentication", async () => {
    await expect(action(args({}, "https://other.test"))).rejects.toMatchObject({ status: 403 });
    expect(auth).not.toHaveBeenCalled();
  });

  it("rejects CSRF before any RPC", async () => {
    await expect(action(args({ csrfToken: "wrong" }))).rejects.toMatchObject({ status: 403 });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("requires a valid source, request key and explicit confirmation", async () => {
    expect(await action(args({ sourceRevisionId: "0" }))).toMatchObject({ init: { status: 400 } });
    expect(await action(args({ requestId: "not-a-uuid" }))).toMatchObject({
      init: { status: 400 },
    });
    expect(await action(args({ confirmIndependent: "" }))).toMatchObject({
      init: { status: 400 },
    });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("passes identifiers and cross-gender acknowledgement to one RPC", async () => {
    await expect(action(args({ allowGenderRecompile: "on" }))).rejects.toMatchObject({
      status: 302,
    });
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith("admin_clone_competition_ruleset", {
      p_request_id: "40dde5c7-46b2-4241-995d-4e42223bbdf2",
      p_target_competition_id: 100,
      p_source_revision_id: 12,
      p_allow_gender_recompile: true,
    });
  });

  it("rejects malformed success payloads", async () => {
    client.rpc.mockResolvedValue({ data: { rulesetRevisionId: -1 }, error: null });
    const response = await action(args());
    expect(response).toMatchObject({ init: { status: 400 } });
  });

  it("maps stable database errors without exposing SQL details", async () => {
    client.rpc.mockResolvedValue({
      data: null,
      error: { code: "BR057", message: "internal SQL details" },
    });
    const response = await action(args());
    expect(JSON.stringify(response)).toContain("outro naipe");
    expect(JSON.stringify(response)).not.toContain("internal SQL details");
  });
});
