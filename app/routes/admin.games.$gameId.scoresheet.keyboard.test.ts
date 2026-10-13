import { beforeEach, expect, it, vi } from "vitest";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { action } from "./admin.games.$gameId.scoresheet.keyboard";

vi.mock("../modules/auth/authorization.server", () => ({ requireAdminAal2: vi.fn() }));
const rpc = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAdminAal2).mockResolvedValue({
    client: { rpc },
    payload: { csrfToken: "fixture" },
    cookie: "refreshed-cookie",
  } as unknown as Awaited<ReturnType<typeof requireAdminAal2>>);
});
const doc = {
  rulesVersion: "FIBA_2024",
  periods: 4,
  coachPlayer: { home: null, away: null },
  roster: [
    { rosterEntryId: 1, registrationId: 10, side: "home", jersey: "12", played: true },
    { rosterEntryId: 2, registrationId: 20, side: "away", jersey: "12", played: true },
  ],
  events: [],
};
function args(payload: unknown, csrf = "fixture", origin = "https://example.test") {
  const form = new FormData();
  form.set("payload", JSON.stringify(payload));
  form.set("csrfToken", csrf);
  return {
    request: new Request("https://example.test/api/admin/games/42/keyboard-scoresheet", {
      method: "POST",
      headers: { Origin: origin },
      body: form,
    }),
    params: { gameId: "42" },
    context: { get: () => ({ env: {} }) },
  } as unknown as Parameters<typeof action>[0];
}
const request = {
  requestId: "10000000-0000-4000-8000-000000000001",
  baseVersion: 0,
  document: doc,
  confirm: false,
  reason: "",
};
it("rejects cross-origin and invalid CSRF before database writes", async () => {
  await expect(action(args(request, "fixture", "https://attacker.test"))).rejects.toMatchObject({
    status: 403,
  });
  await expect(action(args(request, "wrong"))).rejects.toMatchObject({ status: 403 });
  expect(rpc).not.toHaveBeenCalled();
});
it("revalidates data on the server and rejects forged event targets", async () => {
  const result = await action(
    args({
      ...request,
      document: {
        ...doc,
        events: [{ id: request.requestId, side: "home", period: 1, target: "99", code: "3" }],
      },
    }),
  );
  expect(result).toMatchObject({ init: { status: 400 } });
  expect(rpc).not.toHaveBeenCalled();
});
it("sends only validated source events to the authoritative RPC", async () => {
  rpc.mockResolvedValue({
    data: { version: 1, confirmed: false, requestId: request.requestId },
    error: null,
  });
  const result = await action(args(request));
  expect(rpc).toHaveBeenCalledWith(
    "admin_save_keyboard_scoresheet",
    expect.objectContaining({ p_game_id: 42, p_base_version: 0, p_document: doc }),
  );
  expect(result).toMatchObject({
    data: { version: 1 },
    init: { headers: { "Cache-Control": "private, no-store", "Set-Cookie": "refreshed-cookie" } },
  });
});
it("returns a conflict without overwriting another tab", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "BD905" } });
  expect(await action(args(request))).toMatchObject({
    init: { status: 409 },
    data: { error: expect.stringContaining("outra aba") },
  });
});
