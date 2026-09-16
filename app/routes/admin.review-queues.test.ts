import { beforeEach, describe, expect, it, vi } from "vitest";

import { cloudflareContext, correlationIdContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import {
  action,
  loader,
  parseBulkReviewInput,
  parseReviewQueueReport,
} from "./admin.review-queues";

vi.mock("../modules/auth/authorization.server", () => ({ requireAdminAal2: vi.fn() }));

const authorization = vi.mocked(requireAdminAal2);
const client = { rpc: vi.fn() };

const report = {
  reportVersion: 2,
  counts: {
    competitionGenderPending: 1,
    competitionProfilePending: 1,
    playerEligibilityPending: 1,
  },
  queues: {
    competitions: [
      {
        competitionId: 9,
        displayName: "Edição pendente",
        year: 2026,
        genderReviewRequired: true,
        profileReviewRequired: true,
        gameCount: 2,
        manualGameCount: 1,
        boxscoreGameCount: 1,
        seedGameCount: 0,
      },
    ],
    players: [
      {
        playerId: 12,
        fullName: "Atleta em revisão",
        isActive: true,
        rosterEntryCount: 3,
        activeRosterEntryCount: 1,
        competitionCount: 2,
        sex: "male",
      },
    ],
  },
  enforcementReady: false,
};

function context() {
  return {
    get(key: unknown) {
      if (key === cloudflareContext) return { env: {} };
      if (key === correlationIdContext) return "test-correlation";
      throw new Error("Unexpected context key");
    },
  };
}

function args(request = new Request("https://example.test/admin/review-queues")) {
  return {
    request,
    params: {},
    context: context(),
  } as unknown as Parameters<typeof loader>[0];
}

function post(fields: Record<string, string> = {}, origin = "https://example.test") {
  return args(
    new Request("https://example.test/admin/review-queues", {
      method: "POST",
      headers: { Origin: origin },
      body: new URLSearchParams({
        csrfToken: "test-csrf",
        reason: "Revisão cadastral conferida em lote",
        confirmed: "on",
        "player:12": "female",
        "player:13": "male",
        ...fields,
      }),
    }),
  ) as unknown as Parameters<typeof action>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  authorization.mockResolvedValue({
    client,
    payload: { csrfToken: "test-csrf" },
    cookie: null,
  } as unknown as Awaited<ReturnType<typeof requireAdminAal2>>);
});

describe("administrative review queues", () => {
  it("whitelists value-free queue fields and discards private eligibility values", () => {
    const parsed = parseReviewQueueReport(report);
    expect(parsed).toMatchObject({
      enforcementReady: false,
      counts: { playerEligibilityPending: 1 },
      competitions: [{ competitionId: 9 }],
      players: [{ playerId: 12, fullName: "Atleta em revisão" }],
    });
    expect(JSON.stringify(parsed)).not.toContain("male");
    expect(JSON.stringify(parsed)).not.toContain("sex");
  });

  it("rejects malformed reports instead of presenting an incomplete gate", () => {
    expect(parseReviewQueueReport({ ...report, queues: { competitions: [], players: [{}] } })).toBe(
      null,
    );
  });

  it("accepts only explicit bounded batch choices", () => {
    const form = new FormData();
    form.set("reason", "Revisão cadastral conferida em lote");
    form.set("confirmed", "on");
    form.set("player:12", "female");
    form.set("player:13", "male");
    form.set("ignored", "female");
    expect(parseBulkReviewInput(form)).toEqual({
      reason: "Revisão cadastral conferida em lote",
      reviews: [
        { playerId: 12, sex: "female" },
        { playerId: 13, sex: "male" },
      ],
    });
  });

  it("rejects missing confirmation, empty selections and invalid private values", () => {
    const form = new FormData();
    form.set("reason", "Revisão cadastral conferida em lote");
    form.set("confirmed", "on");
    expect(parseBulkReviewInput(form)).toBe(null);
    form.set("player:12", "unknown");
    expect(parseBulkReviewInput(form)).toBe(null);
    form.set("player:12", "female");
    form.delete("confirmed");
    expect(parseBulkReviewInput(form)).toBe(null);
  });

  it("requires AAL2 before reading the report", async () => {
    authorization.mockRejectedValue(new Response(null, { status: 403 }));
    await expect(loader(args())).rejects.toMatchObject({ status: 403 });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("loads only the protected value-free reconciliation report", async () => {
    client.rpc.mockResolvedValue({ data: report, error: null });
    const response = (await loader(args())) as unknown as {
      data: { report: { players: Array<Record<string, unknown>> } };
      init: { headers: Record<string, string> };
    };
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith("admin_get_classification_backfill_report");
    expect(response.data.report.players[0]).toEqual({
      playerId: 12,
      fullName: "Atleta em revisão",
      isActive: true,
      rosterEntryCount: 3,
      activeRosterEntryCount: 1,
      competitionCount: 2,
    });
    expect(response.data).toMatchObject({ csrfToken: "test-csrf", savedCount: null });
    expect(response.init.headers["Cache-Control"]).toBe("private, no-store");
  });

  it("rejects cross-origin batch submissions before authentication", async () => {
    await expect(action(post({}, "https://other.test"))).rejects.toMatchObject({ status: 403 });
    expect(authorization).not.toHaveBeenCalled();
  });

  it("requires a valid CSRF token before the batch RPC", async () => {
    await expect(action(post({ csrfToken: "wrong" }))).rejects.toMatchObject({ status: 403 });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("rejects incomplete batches without calling the database", async () => {
    const response = await action(post({ confirmed: "" }));
    expect(response).toMatchObject({ init: { status: 400 } });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("sends explicit choices to one transactional RPC and redirects", async () => {
    client.rpc.mockResolvedValue({
      data: [{ reviewed_count: 2, remaining_pending: 41, enforcement_ready: false }],
      error: null,
    });
    await expect(action(post())).rejects.toMatchObject({ status: 302 });
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith("admin_bulk_set_player_sex", {
      p_reason: "Revisão cadastral conferida em lote",
      p_reviews: [
        { playerId: 12, sex: "female" },
        { playerId: 13, sex: "male" },
      ],
    });
  });

  it("does not expose raw database errors or private values", async () => {
    client.rpc.mockResolvedValue({
      data: null,
      error: { code: "BD501", message: "female internal SQL detail" },
    });
    const response = await action(post());
    expect(JSON.stringify(response)).not.toContain("internal SQL detail");
    expect(JSON.stringify(response)).not.toContain("female");
  });
});
