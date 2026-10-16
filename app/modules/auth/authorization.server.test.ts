import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdminAal2 } from "./authorization.server";
import { createSessionCookie, sealSession } from "./session.server";
import { createAuthenticatedSupabaseClient } from "./supabase.server";

vi.mock("./supabase.server", () => ({ createAuthenticatedSupabaseClient: vi.fn() }));

const session = {
  access_token: "test-access",
  refresh_token: "test-refresh",
  expires_at: 1_900_000_000,
};
const client = {
  rpc: vi.fn(),
  auth: {
    setSession: vi.fn(),
    getUser: vi.fn(),
    signOut: vi.fn(),
    mfa: { getAuthenticatorAssuranceLevel: vi.fn(), listFactors: vi.fn() },
  },
};
const env = {
  APP_ENV: "preview",
  SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "test-key",
  SESSION_SECRET: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  PREVIEW_PASSWORD_AUTH_PROJECT_REF: "abcdefghijklmnopqrst",
} as unknown as Env;

async function request() {
  const sealed = await sealSession(
    {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at,
      csrfToken: "csrf-test",
    },
    env.SESSION_SECRET,
  );
  return new Request("https://preview.test/admin/competitions", {
    headers: { Cookie: createSessionCookie(sealed) },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(createAuthenticatedSupabaseClient).mockReturnValue(
    client as unknown as ReturnType<typeof createAuthenticatedSupabaseClient>,
  );
  client.rpc.mockResolvedValue({ data: true, error: null });
  client.auth.setSession.mockResolvedValue({ data: { session }, error: null });
  client.auth.getUser.mockResolvedValue({ data: { user: { id: "admin" } }, error: null });
  client.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal1" },
    error: null,
  });
  client.auth.mfa.listFactors.mockResolvedValue({
    data: { totp: [{ status: "verified" }] },
    error: null,
  });
});

async function expectRedirect(promise: Promise<unknown>, location: string) {
  const response = await promise.catch((error: unknown) => error);
  expect(response).toBeInstanceOf(Response);
  expect((response as Response).headers.get("Location")).toBe(location);
}

describe("administrator request authorization", () => {
  it("accepts a restored preview session only after the dedicated database probe", async () => {
    const auth = await requireAdminAal2(await request(), env);
    expect(auth.user.id).toBe("admin");
    expect(client.rpc.mock.calls.map(([name]) => name)).toEqual([
      "is_current_admin",
      "is_current_admin_aal2",
    ]);
    expect(client.auth.mfa.getAuthenticatorAssuranceLevel).not.toHaveBeenCalled();
    expect(auth.session.access_token).toBe(session.access_token);
  });

  it("denies preview access when the database exception is disabled", async () => {
    client.rpc.mockImplementation(async (name) => ({
      data: name === "is_current_admin",
      error: null,
    }));
    await expectRedirect(requireAdminAal2(await request(), env), "/admin/login");
  });

  it("rejects an unregistered identity and never probes preview access", async () => {
    client.rpc.mockResolvedValue({ data: false, error: null });
    await expectRedirect(requireAdminAal2(await request(), env), "/admin/login");
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(client.rpc).toHaveBeenCalledTimes(1);
  });

  it("rejects a missing cookie without a database request", async () => {
    await expectRedirect(
      requireAdminAal2(new Request("https://preview.test/admin"), env),
      "/admin/login",
    );
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("rejects a session the auth server cannot verify", async () => {
    client.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: "expired" } });
    await expectRedirect(requireAdminAal2(await request(), env), "/admin/login");
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("fails closed when the preview authorization RPC is unavailable", async () => {
    client.rpc.mockImplementation(async (name) => ({
      data: true,
      error: name === "is_current_admin_aal2" ? { message: "missing" } : null,
    }));
    await expect(requireAdminAal2(await request(), env)).rejects.toThrow(
      "Administrator authorization check failed",
    );
  });

  it.each(["preview", "production"])(
    "requires MFA in %s without explicit configuration",
    async (environment) => {
      const defaults = {
        ...env,
        APP_ENV: environment,
        PREVIEW_PASSWORD_AUTH_PROJECT_REF: undefined,
      } as unknown as Env;
      await expectRedirect(requireAdminAal2(await request(), defaults), "/admin/mfa");
      expect(client.rpc).not.toHaveBeenCalledWith("is_current_admin_aal2");
    },
  );

  it("accepts the existing AAL2 flow after the strict database probe", async () => {
    client.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal2" },
      error: null,
    });
    await requireAdminAal2(await request(), {
      ...env,
      PREVIEW_PASSWORD_AUTH_PROJECT_REF: undefined,
    });
    expect(client.rpc).toHaveBeenCalledWith("is_current_admin_aal2");
  });

  it("rejects a production Worker configured with the preview exception", async () => {
    await expect(
      requireAdminAal2(await request(), { ...env, APP_ENV: "production" } as unknown as Env),
    ).rejects.toThrow("Invalid preview password authentication configuration");
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
