import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { action } from "./admin.competitions.$competitionId.boxscores.import";

vi.mock("../modules/auth/authorization.server", () => ({ requireAdminAal2: vi.fn() }));
vi.mock("../modules/observability/operation.server", () => ({
  logOperationalEvent: vi.fn(),
}));

const auth = vi.mocked(requireAdminAal2);
const rpc = vi.fn();
const from = vi.fn();
const client = { from, rpc };

function query(result: unknown) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.single.mockResolvedValue(result);
  return builder;
}

function actionArgs(fields: Record<string, string>) {
  return {
    request: new Request(
      "https://example.test/admin/competitions/20/boxscores/import?mode=create-game",
      {
        method: "POST",
        headers: { Origin: "https://example.test" },
        body: new URLSearchParams({
          csrfToken: "test-csrf",
          importId: "24",
          manualMatchupRequestId: "40dde5c7-46b2-4241-995d-4e42223bbdf2",
          homeRegistrationId: "189",
          awayRegistrationId: "190",
          ...fields,
        }),
      },
    ),
    params: { competitionId: "20" },
    context: { get: () => ({ env: {} }) },
  } as unknown as Parameters<typeof action>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({
    client,
    payload: { csrfToken: "test-csrf" },
    cookie: null,
  } as unknown as Awaited<ReturnType<typeof requireAdminAal2>>);
  from.mockImplementation((table: string) => {
    if (table === "boxscore_imports") {
      return query({ data: { id: 24, status: "review" }, error: null });
    }
    if (table === "boxscore_team_resolutions") {
      return query({
        data: { registration_1_id: 189, registration_2_id: 190 },
        error: null,
      });
    }
    throw new Error(`Unexpected table: ${table}`);
  });
  rpc.mockResolvedValue({ data: { matchupId: 10, gameId: 64 }, error: null });
});

describe("boxscore manual game creation", () => {
  it("creates the resolved pair through the transactional manual-matchup RPC", async () => {
    await expect(action(actionArgs({}))).rejects.toMatchObject({ status: 302 });

    expect(rpc).toHaveBeenCalledExactlyOnceWith("admin_create_manual_matchup", {
      p_request_id: "40dde5c7-46b2-4241-995d-4e42223bbdf2",
      p_competition_id: 20,
      p_round_id: null,
      p_home_registration_id: 189,
      p_away_registration_id: 190,
      p_scheduled_at: null,
      p_venue: null,
    });
  });

  it("preserves the explicit home-team choice", async () => {
    await expect(
      action(actionArgs({ homeRegistrationId: "190", awayRegistrationId: "189" })),
    ).rejects.toMatchObject({ status: 302 });

    expect(rpc).toHaveBeenCalledExactlyOnceWith(
      "admin_create_manual_matchup",
      expect.objectContaining({
        p_home_registration_id: 190,
        p_away_registration_id: 189,
      }),
    );
  });

  it("rejects participants outside the audited team resolution", async () => {
    const result = await action(actionArgs({ awayRegistrationId: "191" }));

    expect(result).toMatchObject({ init: { status: 409 } });
    expect(JSON.stringify(result)).toContain("resolução das equipes mudou");
    expect(rpc).not.toHaveBeenCalled();
  });
});
