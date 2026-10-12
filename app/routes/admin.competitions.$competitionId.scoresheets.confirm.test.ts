import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { createScoresheetSetup } from "../modules/scoresheet/setup-state";
import { action } from "./admin.competitions.$competitionId.scoresheets.new";

vi.mock("../modules/auth/authorization.server", () => ({ requireAdminAal2: vi.fn() }));
vi.mock("../modules/observability/operation.server", () => ({ logOperationalEvent: vi.fn() }));

const rpc = vi.fn();

function validDraft() {
  const setup = createScoresheetSetup();
  setup.game.date = "2026-10-12";
  setup.registrationIds = { home: 10, away: 20 };
  setup.slots.home[0] = { slotNumber: 1, rosterEntryId: 11, jerseyNumber: "00", isCaptain: true };
  setup.slots.away[0] = { slotNumber: 1, rosterEntryId: 21, jerseyNumber: "7", isCaptain: true };
  setup.staff.home.coach = { role: "coach", name: "Treinador Casa", origin: "manual" };
  setup.staff.away.coach = { role: "coach", name: "Treinador Fora", origin: "manual" };
  setup.stats["home-1-4-two"] = "1";
  return setup;
}

function requestForDraft(setup: unknown, token = "token") {
  const body = new FormData();
  body.set("intent", "confirm-manual-v2");
  body.set("csrfToken", token);
  body.set("setup", JSON.stringify(setup));
  return {
    request: new Request("https://example.test/admin/competitions/100/scoresheets/new", {
      method: "POST",
      headers: { Origin: "https://example.test" },
      body,
    }),
    params: { competitionId: "100" },
    context: { get: () => ({ env: {} }) },
  } as unknown as Parameters<typeof action>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAdminAal2).mockResolvedValue({
    client: { rpc },
    payload: { csrfToken: "token" },
    cookie: null,
  } as unknown as Awaited<ReturnType<typeof requireAdminAal2>>);
});

describe("stage 8 create route", () => {
  it("retries identical submission with the same idempotency key", async () => {
    rpc.mockResolvedValue({ data: 42, error: null });
    const draft = validDraft();
    const first = await action(requestForDraft(draft));
    const second = await action(requestForDraft(draft));
    expect(first).toMatchObject({ data: { confirmedGameId: 42 } });
    expect(second).toMatchObject({ data: { confirmedGameId: 42 } });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls.at(0)?.[1]?.p_payload?.idempotencyKey).toBe(draft.submissionKey);
    expect(rpc.mock.calls.at(1)?.[1]).toEqual(rpc.mock.calls.at(0)?.[1]);
  });

  it("rejects invalid overtime before reaching the database", async () => {
    const draft = validDraft();
    draft.periodCount = 5;
    const result = await action(requestForDraft(draft));
    expect(result).toMatchObject({ data: { error: expect.stringContaining("Q4") } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("requires valid CSRF before committing", async () => {
    await expect(action(requestForDraft(validDraft(), "wrong"))).rejects.toMatchObject({
      status: 403,
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not claim success or clear the draft on a failed RPC", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "BD209" } });
    const result = await action(requestForDraft(validDraft()));
    expect(result).toMatchObject({ data: { error: expect.stringContaining("chave") } });
    expect(result).not.toHaveProperty("data.confirmedGameId");
  });
});
