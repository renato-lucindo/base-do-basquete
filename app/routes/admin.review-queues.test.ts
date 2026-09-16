import { beforeEach, describe, expect, it, vi } from "vitest";

import { cloudflareContext, correlationIdContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import {
  action,
  createMalePreselection,
  filterAndSortPlayers,
  loader,
  parseBulkReviewInput,
  parsePlayerReviewQueue,
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

const playerQueue = {
  queueVersion: 1,
  players: [
    {
      playerId: 12,
      fullName: "Atleta em revisão",
      isActive: true,
      reviewRevision: 1_789_012_345_678_901,
      rosterEntryCount: 3,
      activeRosterEntryCount: 1,
      competitionCount: 2,
      teams: [
        { teamId: 3, name: "Águias" },
        { teamId: 8, name: "Basquete Clube" },
      ],
      competitions: [
        { competitionId: 9, displayName: "Copa Ouro", year: 2026 },
        { competitionId: 10, displayName: "Liga Estadual", year: 2025 },
      ],
    },
  ],
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
        "selected:12": "on",
        "player:12": "female",
        "revision:12": "1789012345678901",
        "selected:13": "on",
        "player:13": "male",
        "revision:13": "1789012345678902",
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
  it("uses male only as the default for explicitly selected players", () => {
    expect(createMalePreselection([2, 13, 54])).toEqual({
      2: "male",
      13: "male",
      54: "male",
    });
  });

  it("whitelists public context and discards private eligibility values", () => {
    const reportParsed = parseReviewQueueReport(report);
    const playersParsed = parsePlayerReviewQueue(playerQueue);
    expect(reportParsed).toMatchObject({
      enforcementReady: false,
      counts: { playerEligibilityPending: 1 },
      competitions: [{ competitionId: 9 }],
    });
    expect(playersParsed?.[0]).toMatchObject({
      playerId: 12,
      fullName: "Atleta em revisão",
      teams: expect.arrayContaining([{ teamId: 3, name: "Águias" }]),
      competitions: expect.arrayContaining([
        { competitionId: 9, displayName: "Copa Ouro", year: 2026 },
      ]),
    });
    expect(JSON.stringify({ reportParsed, playersParsed })).not.toContain("male");
    expect(JSON.stringify({ reportParsed, playersParsed })).not.toContain("sex");
  });

  it("rejects malformed reports instead of presenting an incomplete gate", () => {
    expect(
      parseReviewQueueReport({ ...report, queues: { competitions: [], players: [{}] } }),
    ).not.toBeNull();
    expect(parsePlayerReviewQueue({ queueVersion: 1, players: [{}] })).toBe(null);
  });

  it("accepts only explicit bounded batch choices", () => {
    const form = new FormData();
    form.set("reason", "Revisão cadastral conferida em lote");
    form.set("confirmed", "on");
    form.set("selected:12", "on");
    form.set("player:12", "female");
    form.set("revision:12", "1789012345678901");
    form.set("selected:13", "on");
    form.set("player:13", "male");
    form.set("revision:13", "1789012345678902");
    form.set("ignored", "female");
    expect(parseBulkReviewInput(form)).toEqual({
      reason: "Revisão cadastral conferida em lote",
      reviews: [
        { playerId: 12, sex: "female", expectedRevision: 1_789_012_345_678_901 },
        { playerId: 13, sex: "male", expectedRevision: 1_789_012_345_678_902 },
      ],
    });
  });

  it("rejects missing confirmation, empty selections and invalid private values", () => {
    const form = new FormData();
    form.set("reason", "Revisão cadastral conferida em lote");
    form.set("confirmed", "on");
    expect(parseBulkReviewInput(form)).toBe(null);
    form.set("selected:12", "on");
    form.set("player:12", "unknown");
    form.set("revision:12", "1789012345678901");
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

  it("loads the protected report and contextual value-free player queue", async () => {
    client.rpc.mockImplementation((name) =>
      Promise.resolve({
        data: name === "admin_get_player_review_queue" ? playerQueue : report,
        error: null,
      }),
    );
    const response = (await loader(args())) as unknown as {
      data: { report: { players: Array<Record<string, unknown>> } };
      init: { headers: Record<string, string> };
    };
    expect(client.rpc).toHaveBeenCalledWith("admin_get_classification_backfill_report");
    expect(client.rpc).toHaveBeenCalledWith("admin_get_player_review_queue");
    expect(response.data.report.players[0]).toMatchObject({
      playerId: 12,
      reviewRevision: 1_789_012_345_678_901,
      teams: expect.arrayContaining([{ teamId: 3, name: "Águias" }]),
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
        { playerId: 12, sex: "female", expectedRevision: 1_789_012_345_678_901 },
        { playerId: 13, sex: "male", expectedRevision: 1_789_012_345_678_902 },
      ],
    });
  });

  it("maps a stale concurrent batch to conflict without exposing private data", async () => {
    client.rpc.mockResolvedValue({
      data: null,
      error: { code: "BD409", message: "BDB_PLAYER_REVIEW_STALE" },
    });
    const response = await action(post());
    expect(response).toMatchObject({ init: { status: 409 } });
    expect(JSON.stringify(response)).toContain("Nenhuma escolha foi aplicada");
  });

  it("filters by competition, team and multiple contexts, then sorts by impact", () => {
    const players = parsePlayerReviewQueue(playerQueue);
    expect(players).not.toBe(null);
    expect(
      filterAndSortPlayers(players ?? [], {
        query: "atleta",
        competitionId: "9",
        teamId: "3",
        status: "multiple",
        sort: "impact",
      }).map((player) => player.playerId),
    ).toEqual([12]);
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
