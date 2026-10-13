import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { action } from "./admin.competitions.$competitionId.boxscores.import";

vi.mock("../modules/auth/authorization.server", () => ({ requireAdminAal2: vi.fn() }));
vi.mock("../modules/observability/operation.server", () => ({ logOperationalEvent: vi.fn() }));

const auth = vi.mocked(requireAdminAal2);
const rpc = vi.fn();

function actionArgs(fields: Record<string, string> = {}) {
  const body: Record<string, string> = {
    csrfToken: "test-csrf",
    importId: "24",
    targetMode: "create",
    manualMatchupRequestId: "40dde5c7-46b2-4241-995d-4e42223bbdf2",
    homeRegistrationId: "189",
    scheduledDate: "2026-05-09",
    scheduledTime: "19:00",
    venue: "Ginásio",
    teamCount: "2",
    playerCount: "10",
    confirmImport: "yes",
    "teamName-0": "Equipe A",
    "registration-0": "189",
    "teamName-1": "Equipe B",
    "registration-1": "190",
    ...fields,
  };
  for (let index = 0; index < 10; index += 1) {
    body[`playerTeam-${index}`] = index < 5 ? "Equipe A" : "Equipe B";
    body[`playerName-${index}`] = `Atleta ${index + 1}`;
    body[`playerResolution-${index}`] = `roster:${100 + index}`;
  }
  return {
    request: new Request(
      "https://example.test/admin/competitions/20/boxscores/import?import=24&mode=confirm",
      {
        method: "POST",
        headers: { Origin: "https://example.test" },
        body: new URLSearchParams(body),
      },
    ),
    params: { competitionId: "20" },
    context: { get: () => ({ env: {} }) },
  } as unknown as Parameters<typeof action>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({
    client: { rpc },
    payload: { csrfToken: "test-csrf" },
    cookie: null,
  } as unknown as Awaited<ReturnType<typeof requireAdminAal2>>);
  rpc.mockResolvedValue({ data: null, error: { code: "BD713", message: "conflict" } });
});

describe("atomic boxscore target", () => {
  it("sends new-game creation only to the final transactional commit", async () => {
    const result = await action(actionArgs());
    expect(result).toMatchObject({ init: { status: 409 } });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("admin_commit_boxscore_import_v2", {
      p_import_id: 24,
      p_resolution: expect.objectContaining({
        teams: expect.any(Array),
        players: expect.any(Array),
      }),
      p_target: {
        mode: "create",
        requestId: "40dde5c7-46b2-4241-995d-4e42223bbdf2",
        homeRegistrationId: 189,
        scheduledAt: "2026-05-09T22:00:00.000Z",
        venue: "Ginásio",
      },
    });
  });

  it("requires explicit approval before replacing metadata on an existing game", async () => {
    await action(
      actionArgs({ targetMode: "existing", gameId: "64", applyReviewedMetadata: "yes" }),
    );
    expect(rpc).toHaveBeenCalledWith(
      "admin_commit_boxscore_import_v2",
      expect.objectContaining({
        p_target: expect.objectContaining({
          mode: "existing",
          gameId: 64,
          applyReviewedMetadata: true,
        }),
      }),
    );
  });

  it("keeps the review when schedule metadata is invalid", async () => {
    const result = await action(actionArgs({ scheduledDate: "2026-02-30" }));
    expect(result).toMatchObject({ init: { status: 400 } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("redirects with 303 to explicit publication after the confirmed import", async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === "admin_commit_boxscore_import_v2") return { data: 129, error: null };
      if (name === "admin_get_game_data_conflict") {
        return { data: { domains: [], pendingCount: 0 }, error: null };
      }
      return { data: null, error: { code: "PGRST202" } };
    });

    let response: Response | null = null;
    try {
      await action(actionArgs());
    } catch (error) {
      response = error as Response;
    }

    expect(response?.status).toBe(303);
    expect(response?.headers.get("Location")).toBe(
      "/admin/competitions/20/publication?importedGame=129",
    );
  });

  it("redirects data conflicts with 303 after the confirmation POST", async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === "admin_commit_boxscore_import_v2") return { data: 129, error: null };
      if (name === "admin_get_game_data_conflict") {
        return { data: { domains: [{ domain: "score" }], pendingCount: 1 }, error: null };
      }
      return { data: null, error: { code: "PGRST202" } };
    });

    let response: Response | null = null;
    try {
      await action(actionArgs());
    } catch (error) {
      response = error as Response;
    }

    expect(response?.status).toBe(303);
    expect(response?.headers.get("Location")).toBe("/admin/games/129/data-conflict");
  });
});
