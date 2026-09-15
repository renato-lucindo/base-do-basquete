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

describe("draft ruleset editor action", () => {
  const editorFields = {
    intent: "edit-ruleset",
    requestId: "624f1220-f0b0-44a7-9aa0-fcca0f2d0a01",
    rulesetRevisionId: "42",
    expectedEditorRevision: "3",
    operation: "set_origin",
    slotId: "55",
    kind: "entry",
    entrySeed: "4",
    sourceMatchupId: "999",
  };

  it("builds the mutation payload from operation-specific fields", async () => {
    client.rpc.mockResolvedValue({
      data: {
        rulesetRevisionId: 42,
        editorRevision: 4,
        operation: "set_origin",
        entityId: 55,
        outcome: "updated",
      },
      error: null,
    });
    await expect(action(args(editorFields))).rejects.toMatchObject({ status: 302 });
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith("admin_apply_ruleset_draft_edit", {
      p_request_id: "624f1220-f0b0-44a7-9aa0-fcca0f2d0a01",
      p_ruleset_revision_id: 42,
      p_expected_editor_revision: 3,
      p_operation: "set_origin",
      p_input: { slotId: 55, kind: "entry", entrySeed: 4 },
    });
  });

  it("rejects malformed identifiers and operations before the RPC", async () => {
    expect(await action(args({ ...editorFields, rulesetRevisionId: "0" }))).toMatchObject({
      init: { status: 400 },
    });
    expect(await action(args({ ...editorFields, operation: "publish" }))).toMatchObject({
      init: { status: 400 },
    });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("requires an explicit confirmation before matchup removal", async () => {
    const response = await action(
      args({
        ...editorFields,
        operation: "remove_matchup",
        matchupId: "91",
        confirmRemove: "",
      }),
    );
    expect(response).toMatchObject({ init: { status: 400 } });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("maps editor errors without exposing database detail", async () => {
    client.rpc.mockResolvedValue({
      data: null,
      error: { code: "BR060", message: "sensitive SQL detail" },
    });
    const response = await action(args(editorFields));
    expect(JSON.stringify(response)).toContain("mudou");
    expect(JSON.stringify(response)).not.toContain("sensitive SQL detail");
  });
});
