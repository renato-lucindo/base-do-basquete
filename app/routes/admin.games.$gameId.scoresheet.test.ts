import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { loadRevisionRegistrations } from "../modules/scoresheet/revision-context.server";
import { savedFixture } from "../modules/scoresheet/setup-revision.fixture";
import { setupFromSavedScoresheet } from "../modules/scoresheet/setup-revision";
import { action, loader, shouldRevalidate } from "./admin.games.$gameId.scoresheet";

vi.mock("../modules/auth/authorization.server", () => ({ requireAdminAal2: vi.fn() }));
vi.mock("../modules/observability/operation.server", () => ({ logOperationalEvent: vi.fn() }));
vi.mock("../modules/scoresheet/revision-context.server", () => ({
  loadRevisionRegistrations: vi.fn(),
}));
const rpc = vi.fn();
const queries: Array<{ table: string; filters: Record<string, unknown> }> = [];
let payload = savedFixture();
let authorities: Array<{ domain: string; submission_id: number }>;
let snapshotHash = "a".repeat(32);
function from(table: string) {
  const filters: Record<string, unknown> = {};
  queries.push({ table, filters });
  const result = () => {
    const rows: Record<string, unknown> = {
      games: { id: 42, competition_id: 100, status: "final", source: "manual" },
      competitions: { display_name: "Campeonato", status: "draft" },
      game_data_submissions: [
        {
          id: 80,
          submission_version: 2,
          status: "active",
          submitted_at: "2026-10-12",
          submitted_by: "admin",
        },
        {
          id: 79,
          submission_version: 1,
          status: "superseded",
          submitted_at: "2026-10-11",
          submitted_by: "admin",
        },
      ],
      game_data_domain_authority: authorities,
      manual_scoresheet_revisions: [
        {
          submission_id: 80,
          reason: "Correção anterior",
          revised_by: "admin",
          revised_at: "2026-10-12",
        },
      ],
      manual_scoresheet_submission_payloads: { payload, payload_hash: snapshotHash },
    };
    return { data: rows[table], error: null };
  };
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => {
      filters[key] = value;
      return query;
    },
    in: () => query,
    order: () => query,
    single: async () => result(),
    // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are intentionally thenable.
    then: (resolve: (result: unknown) => unknown) => Promise.resolve(result()).then(resolve),
  };
  return query;
}
function args(
  setup = setupFromSavedScoresheet(payload),
  overrides: Record<string, string | undefined> = {},
) {
  setup.revisionReason ||= "Corrigir o local da partida";
  setup.game.venue = "Novo ginásio";
  const form = new FormData();
  for (const [key, value] of Object.entries({
    intent: "revise-manual-v2",
    csrfToken: "token",
    revisionConfirmed: "true",
    baseSubmissionId: "80",
    basePayloadHash: "a".repeat(32),
    setup: JSON.stringify(setup),
    ...overrides,
  }))
    if (value !== undefined) form.set(key, value);
  return {
    request: new Request("https://example.test/admin/games/42/scoresheet", {
      method: "POST",
      headers: { Origin: "https://example.test" },
      body: form,
    }),
    params: { gameId: "42" },
    context: { get: () => ({ env: {} }) },
  } as unknown as Parameters<typeof action>[0];
}
beforeEach(() => {
  vi.clearAllMocks();
  queries.length = 0;
  payload = savedFixture();
  snapshotHash = "a".repeat(32);
  authorities = [
    "official_result",
    "period_scores",
    "participation",
    "player_scoring",
    "player_foul_total",
    "player_foul_timeline",
  ].map((domain) => ({ domain, submission_id: 80 }));
  vi.mocked(requireAdminAal2).mockResolvedValue({
    client: { from, rpc },
    payload: { csrfToken: "token" },
    cookie: null,
  } as unknown as Awaited<ReturnType<typeof requireAdminAal2>>);
  vi.mocked(loadRevisionRegistrations).mockResolvedValue([]);
  rpc.mockResolvedValue({ data: 42, error: null });
});
describe("stage 9 revision route", () => {
  it("passes trusted creation identity, posted CAS base and a stable retry key", async () => {
    const setup = setupFromSavedScoresheet(payload);
    await action(args(setup));
    await action(args(setup));
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
    expect(rpc.mock.calls[0]![1].p_payload).toMatchObject({
      idempotencyKey: payload.idempotencyKey,
      revisionKey: setup.submissionKey,
      gameId: 42,
      baseSubmissionId: 80,
      basePayloadHash: "a".repeat(32),
      roundId: null,
    });
    expect(queries[0]!.filters).toEqual({ game_id: 42, submission_id: 80 });
  });
  it("preserves the draft on CAS conflict and never claims success", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "BD221" } });
    const result = await action(args());
    expect(result).toMatchObject({
      init: { status: 409 },
      data: { error: expect.stringContaining("rascunho foi preservado") },
    });
    expect(result.data).not.toHaveProperty("confirmedGameId");
    expect(
      shouldRevalidate({ actionResult: result.data } as Parameters<typeof shouldRevalidate>[0]),
    ).toBe(false);
  });
  it.each([{ revisionConfirmed: "false" }, { setup: "{}" }, { basePayloadHash: "wrong" }])(
    "rejects invalid intent, setup or CAS before RPC: %o",
    async (fields) => {
      expect(await action(args(undefined, fields))).toHaveProperty("data.error");
      expect(rpc).not.toHaveBeenCalled();
    },
  );
  it("requires a reason, authenticated AAL2 and valid CSRF", async () => {
    const setup = setupFromSavedScoresheet(payload);
    setup.revisionReason = "curto";
    expect(await action(args(setup))).toHaveProperty("data.error");
    await expect(action(args(undefined, { csrfToken: "wrong" }))).rejects.toMatchObject({
      status: 403,
    });
    vi.mocked(requireAdminAal2).mockRejectedValue(new Response("AAL2", { status: 403 }));
    await expect(action(args())).rejects.toMatchObject({ status: 403 });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects participant tampering and mismatched base hash", async () => {
    const setup = setupFromSavedScoresheet(payload);
    setup.registrationIds.home = 999;
    expect(await action(args(setup))).toHaveProperty("data.error");
    snapshotHash = "b".repeat(32);
    expect(await action(args())).toMatchObject({ init: { status: 409 } });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("loads an editable active snapshot and immutable history with no caching", async () => {
    const input = args();
    const result = await loader({
      ...input,
      request: new Request("https://example.test/admin/games/42/scoresheet"),
    });
    expect(result.data).toMatchObject({
      editable: true,
      base: { submissionId: 80, version: 2 },
      history: [{ reason: "Correção anterior" }, { reason: "Criação da súmula" }],
    });
    expect(result.init?.headers).toMatchObject({ "Cache-Control": "private, no-store" });
  });
  it("makes a previous version read-only and rejects cross-game history IDs", async () => {
    const input = args();
    const old = await loader({
      ...input,
      request: new Request("https://example.test/admin/games/42/scoresheet?submission=79"),
    });
    expect(old.data).toMatchObject({ editable: false, base: { submissionId: 79 } });
    await expect(
      loader({
        ...input,
        request: new Request("https://example.test/admin/games/42/scoresheet?submission=999"),
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("does not enable editing when any authority domain points elsewhere", async () => {
    authorities[5]!.submission_id = 90;
    const input = args();
    const result = await loader({
      ...input,
      request: new Request("https://example.test/admin/games/42/scoresheet"),
    });
    expect(result.data.editable).toBe(false);
  });
});
