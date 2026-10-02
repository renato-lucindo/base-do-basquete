import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { loader as indexLoader } from "./admin._index";
import { loader as competitionsLoader } from "./admin.competitions";
import { action as playersAction, loader as playersLoader } from "./admin.players";
import { loader as securityLoader } from "./admin.security";
import { action as teamsAction, loader as teamsLoader } from "./admin.teams";

vi.mock("../modules/auth/authorization.server", () => ({ requireAdminAal2: vi.fn() }));

const authorization = vi.mocked(requireAdminAal2);
const client = { from: vi.fn(), rpc: vi.fn() };
function args(request: Request) {
  return { request, params: {}, context: { get: () => ({ env: {} }) } } as unknown as Parameters<
    typeof indexLoader
  >[0] &
    Parameters<typeof competitionsLoader>[0] &
    Parameters<typeof teamsLoader>[0] &
    Parameters<typeof playersLoader>[0] &
    Parameters<typeof securityLoader>[0];
}
function post(path: string, fields: Record<string, string>, origin = "https://example.test") {
  return new Request(`https://example.test/admin/${path}`, {
    method: "POST",
    headers: { Origin: origin },
    body: new URLSearchParams(fields),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authorization.mockResolvedValue({
    client,
    payload: { csrfToken: "test-csrf" },
    cookie: null,
  } as unknown as Awaited<ReturnType<typeof requireAdminAal2>>);
});

describe("administrative area isolation", () => {
  it.each([indexLoader, competitionsLoader, teamsLoader, playersLoader, securityLoader])(
    "authorizes before querying a protected area",
    async (loader) => {
      authorization.mockRejectedValue(new Response(null, { status: 403 }));
      await expect(loader(args(new Request("https://example.test/admin")))).rejects.toMatchObject({
        status: 403,
      });
      expect(client.from).not.toHaveBeenCalled();
      expect(client.rpc).not.toHaveBeenCalled();
    },
  );

  it.each([teamsAction, playersAction])(
    "rejects cross-origin writes before authorization",
    async (action) => {
      await expect(action(args(post("teams", {}, "https://other.test")))).rejects.toMatchObject({
        status: 403,
      });
      expect(authorization).not.toHaveBeenCalled();
    },
  );

  it.each([teamsAction, playersAction])("rejects missing CSRF before writing", async (action) => {
    await expect(action(args(post("teams", { intent: "create-team" })))).rejects.toMatchObject({
      status: 403,
    });
    expect(client.from).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("does not accept athlete mutations through the teams endpoint", async () => {
    await expect(
      teamsAction(args(post("teams", { intent: "create-player", csrfToken: "test-csrf" }))),
    ).rejects.toMatchObject({ status: 400 });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("does not accept team mutations through the athletes endpoint", async () => {
    await expect(
      playersAction(args(post("players", { intent: "create-team", csrfToken: "test-csrf" }))),
    ).rejects.toMatchObject({ status: 400 });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("creates teams through the server RPC without accepting a client slug", async () => {
    client.rpc.mockResolvedValue({ data: { id: 51 }, error: null });
    await expect(
      teamsAction(
        args(
          post("teams", {
            intent: "create-team",
            csrfToken: "test-csrf",
            name: "  Águias   do Sul ",
            abbreviation: " ads ",
            slug: "forged-client-slug",
          }),
        ),
      ),
    ).rejects.toMatchObject({ status: 302 });
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith("admin_create_team", {
      p_name: "Águias do Sul",
      p_abbreviation: "ADS",
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("preserves the private athlete creation RPC and redirects to its own area", async () => {
    client.rpc.mockResolvedValue({ data: { id: 42 }, error: null });
    await expect(
      playersAction(
        args(
          post("players", {
            intent: "create-player",
            csrfToken: "test-csrf",
            name: "Atleta Teste",
            sex: "male",
          }),
        ),
      ),
    ).rejects.toMatchObject({ status: 302 });
    expect(client.rpc).toHaveBeenCalledWith("admin_create_player_with_private_profile", {
      p_full_name: "Atleta Teste",
      p_nickname: undefined,
      p_sex: "male",
      p_allow_similar: false,
    });
  });

  it("redirects the administrative entry point to competitions", async () => {
    let response: unknown;
    try {
      await indexLoader(args(new Request("https://example.test/admin")));
    } catch (error) {
      response = error;
    }
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("Location")).toBe("/admin/competitions");
  });
});
