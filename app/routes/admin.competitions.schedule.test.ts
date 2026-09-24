import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { scheduleLocalParts, scheduleLocalToIso } from "../modules/competition/scheduling";
import {
  action,
  loader,
  scheduleEntryLabel,
  scheduleMatchupLabel,
} from "./admin.competitions.$competitionId.schedule";

vi.mock("../modules/auth/authorization.server", () => ({ requireAdminAal2: vi.fn() }));
const auth = vi.mocked(requireAdminAal2);
const client = { from: vi.fn(), rpc: vi.fn() };
const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
function args(request: Request) {
  return {
    request,
    params: { competitionId: "100" },
    context: { get: () => ({ env: {} }) },
  } as unknown as Parameters<typeof action>[0];
}
function post(fields: Record<string, string> = {}, origin = "https://example.test") {
  return args(
    new Request("https://example.test/admin/competitions/100/schedule", {
      method: "POST",
      headers: { Origin: origin },
      body: new URLSearchParams({
        csrfToken: "test-csrf",
        intent: "prepare",
        matchupId: "12",
        expectedRevision: "0",
        scheduledDate: "",
        scheduledTime: "",
        venue: "",
        ...fields,
      }),
    }),
  );
}
function batchPost() {
  const body = new URLSearchParams({
    csrfToken: "test-csrf",
    intent: "prepare-batch",
    "revision-12": "0",
    "date-12": "2026-09-15",
    "time-12": "19:30",
    "venue-12": "Quadra A",
    "revision-13": "2",
    "date-13": "2026-09-16",
    "time-13": "20:00",
    "venue-13": "Quadra B",
    bulkDate: "",
    bulkTime: "",
    bulkVenue: "Ginásio Central",
  });
  body.append("selectedMatchupId", "12");
  body.append("selectedMatchupId", "13");
  return args(
    new Request("https://example.test/admin/competitions/100/schedule", {
      method: "POST",
      headers: { Origin: "https://example.test" },
      body,
    }),
  );
}
function manualPost(fields: Record<string, string> = {}) {
  return post({
    intent: "create-manual",
    requestId: "40dde5c7-46b2-4241-995d-4e42223bbdf2",
    roundId: "7",
    homeRegistrationId: "21",
    awayRegistrationId: "22",
    scheduledDate: "2026-09-15",
    scheduledTime: "19:30",
    venue: "Ginásio Central",
    ...fields,
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: { id: 12 }, error: null });
  client.from.mockReturnValue(query);
  client.rpc.mockResolvedValue({ data: null, error: null });
  auth.mockResolvedValue({
    client,
    payload: { csrfToken: "test-csrf" },
    cookie: null,
  } as unknown as Awaited<ReturnType<typeof requireAdminAal2>>);
});
describe("private schedule boundary", () => {
  it("authorizes before any loader query", async () => {
    auth.mockRejectedValue(new Response(null, { status: 403 }));
    await expect(
      loader(args(new Request("https://example.test/admin/competitions/100/schedule"))),
    ).rejects.toMatchObject({ status: 403 });
    expect(client.from).not.toHaveBeenCalled();
  });
  it("rejects cross origin before auth", async () => {
    await expect(action(post({}, "https://other.test"))).rejects.toMatchObject({ status: 403 });
    expect(auth).not.toHaveBeenCalled();
  });
  it("rejects CSRF before querying or writing", async () => {
    await expect(action(post({ csrfToken: "wrong" }))).rejects.toMatchObject({ status: 403 });
    expect(client.from).not.toHaveBeenCalled();
  });
  it("enforces the edition context before the mutation", async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(action(post())).rejects.toMatchObject({ status: 404 });
    expect(query.eq).toHaveBeenCalledWith("competition_id", 100);
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it("drops forged participants and calls one RPC", async () => {
    await expect(action(post({ homeRegistrationId: "99" }))).resolves.toMatchObject({
      status: 302,
    });
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith("admin_prepare_matchup", {
      p_matchup_id: 12,
      p_expected_revision: 0,
      p_scheduled_at: null,
      p_venue: null,
    });
  });
  it("creates and schedules a manual game through one transactional RPC", async () => {
    await expect(action(manualPost())).resolves.toMatchObject({ status: 302 });
    expect(client.from).not.toHaveBeenCalled();
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith("admin_create_manual_matchup", {
      p_request_id: "40dde5c7-46b2-4241-995d-4e42223bbdf2",
      p_competition_id: 100,
      p_round_id: 7,
      p_home_registration_id: 21,
      p_away_registration_id: 22,
      p_scheduled_at: "2026-09-15T22:30:00.000Z",
      p_venue: "Ginásio Central",
    });
  });
  it("creates a manual game without requiring a structural round", async () => {
    await expect(action(manualPost({ roundId: "" }))).resolves.toMatchObject({ status: 302 });
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith("admin_create_manual_matchup", {
      p_request_id: "40dde5c7-46b2-4241-995d-4e42223bbdf2",
      p_competition_id: 100,
      p_round_id: null,
      p_home_registration_id: 21,
      p_away_registration_id: 22,
      p_scheduled_at: "2026-09-15T22:30:00.000Z",
      p_venue: "Ginásio Central",
    });
  });
  it("rejects an invalid manual game before any database call", async () => {
    const result = await action(manualPost({ awayRegistrationId: "21" }));
    expect(result).toMatchObject({ init: { status: 400 } });
    expect(client.from).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).toContain("diferentes");
  });
  it("updates teams only after checking the matchup belongs to the edition", async () => {
    await expect(
      action(
        post({
          intent: "update-participants",
          expectedHomeRegistrationId: "21",
          expectedAwayRegistrationId: "22",
          homeRegistrationId: "23",
          awayRegistrationId: "24",
        }),
      ),
    ).resolves.toMatchObject({ status: 302 });
    expect(query.eq).toHaveBeenCalledWith("competition_id", 100);
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith("admin_update_manual_matchup_participants", {
      p_matchup_id: 12,
      p_expected_home_registration_id: 21,
      p_expected_away_registration_id: 22,
      p_home_registration_id: 23,
      p_away_registration_id: 24,
    });
  });
  it("saves selected schedule rows through one transactional batch RPC", async () => {
    await expect(action(batchPost())).resolves.toMatchObject({ status: 302 });
    expect(client.from).not.toHaveBeenCalled();
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith("admin_prepare_matchups_batch", {
      p_competition_id: 100,
      p_items: [
        {
          matchupId: 12,
          expectedRevision: 0,
          scheduledAt: "2026-09-15T22:30:00.000Z",
          venue: "Ginásio Central",
        },
        {
          matchupId: 13,
          expectedRevision: 2,
          scheduledAt: "2026-09-16T23:00:00.000Z",
          venue: "Ginásio Central",
        },
      ],
    });
  });
  it("validates before querying", async () => {
    await action(post({ scheduledDate: "2026-02-30", scheduledTime: "12:00" }));
    expect(client.from).not.toHaveBeenCalled();
  });
  it("does not expose raw SQL", async () => {
    client.rpc.mockResolvedValue({
      data: null,
      error: { code: "BR026", message: "internal SQL detail" },
    });
    const result = await action(post());
    expect(JSON.stringify(result)).not.toContain("internal SQL");
    expect(JSON.stringify(result)).toContain("Recarregue");
  });
  it("resolves only the official submission inside the current edition", async () => {
    await expect(
      action(
        post({
          intent: "resolve",
          officialResultSubmissionId: "34",
        }),
      ),
    ).resolves.toMatchObject({ status: 302 });
    expect(query.eq).toHaveBeenCalledWith("competition_id", 100);
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith("admin_resolve_matchup", {
      p_matchup_id: 12,
      p_expected_submission_id: 34,
    });
  });
  it("rejects a forged result id before querying", async () => {
    await action(post({ intent: "resolve", officialResultSubmissionId: "0" }));
    expect(client.from).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
  });
});

describe("schedule local date and time", () => {
  it("converts Sao Paulo wall time to the canonical instant", () => {
    expect(scheduleLocalToIso("2026-09-15", "19:30")).toBe("2026-09-15T22:30:00.000Z");
    expect(scheduleLocalParts("2026-09-15T22:30:00.000Z")).toEqual({
      date: "2026-09-15",
      time: "19:30",
    });
  });

  it("rejects invalid or incomplete local values", () => {
    expect(scheduleLocalToIso("2026-02-30", "12:00")).toBeNull();
    expect(scheduleLocalToIso("2026-09-15", "25:00")).toBeNull();
  });
});

describe("schedule labels", () => {
  it("keeps accessible labels when the shared RPC still returns the previous contract", () => {
    expect(scheduleEntryLabel({ id: 1, seed: 3, registrationId: null })).toBe("Posição 3");
    expect(
      scheduleMatchupLabel({
        id: 12,
        code: "SF-1",
        round: "Semifinal",
        order: 1,
        manual: false,
        homeRegistrationId: null,
        awayRegistrationId: null,
        revision: 0,
        scheduledAt: null,
        venue: null,
        gameId: null,
        gameStatus: null,
        participantsEditable: false,
        officialResultSubmissionId: null,
        readyToSchedule: false,
        readyToResolve: false,
        resolution: null,
      }),
    ).toBe("Semifinal · confronto 1");
  });
});
