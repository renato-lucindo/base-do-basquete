import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { loader, parseReviewQueueReport } from "./admin.review-queues";

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

function args() {
  return {
    request: new Request("https://example.test/admin/review-queues"),
    params: {},
    context: { get: () => ({ env: {} }) },
  } as unknown as Parameters<typeof loader>[0];
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
    expect(response.init.headers["Cache-Control"]).toBe("private, no-store");
  });
});
