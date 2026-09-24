import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { scheduleLocalParts, scheduleLocalToIso } from "../modules/competition/scheduling";
import {
  action,
  getAssignableRegistrations,
  loader,
  SchedulePrerequisiteNotice,
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

describe("schedule registration prerequisites", () => {
  it("offers only confirmed registrations that do not occupy another position", () => {
    const registrations = [
      { id: 10, status: "confirmed" },
      { id: 20, status: "draft" },
      { id: 30, status: "confirmed" },
    ];
    const entries = [
      { id: 1, seed: 1, registrationId: 10, label: "Semifinal · posição 1" },
      { id: 2, seed: 2, registrationId: null, label: "Semifinal · posição 2" },
    ];

    expect(getAssignableRegistrations(registrations, entries)).toEqual([
      { id: 30, status: "confirmed" },
    ]);
  });

  it("explains where to confirm pending teams before using the agenda", () => {
    const RouterStub = createRoutesStub([
      {
        path: "/",
        Component: () =>
          createElement(SchedulePrerequisiteNotice, {
            competitionId: 100,
            pendingCount: 4,
          }),
      },
    ]);
    const html = renderToStaticMarkup(createElement(RouterStub));

    expect(html).toContain("Confirme as equipes antes de ocupar as posições");
    expect(html).toContain("Há 4 inscrições aguardando confirmação");
    expect(html).toContain('href="/admin/competitions/100"');
    expect(html).toContain("Revisar equipes");
  });
});
