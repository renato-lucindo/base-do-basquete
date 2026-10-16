import { beforeEach, describe, expect, it, vi } from "vitest";
import { cloudflareContext } from "../context";
import { createAnonymousSupabaseClient } from "../modules/auth/supabase.server";
import { action } from "./admin.login";

vi.mock("../modules/auth/supabase.server", () => ({ createAnonymousSupabaseClient: vi.fn() }));
vi.mock("../modules/auth/audit.server", () => ({ logAuthEvent: vi.fn() }));
const client = {
  rpc: vi.fn(),
  auth: { signInWithPassword: vi.fn(), signOut: vi.fn(), mfa: { listFactors: vi.fn() } },
};
const env = {
  APP_ENV: "preview",
  SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "test-key",
  SESSION_SECRET: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  PREVIEW_PASSWORD_AUTH: "enabled",
  PREVIEW_AUTH_SECRET: "test-preview-secret",
} as unknown as Env;

function args(environment = env, origin = "https://preview.test") {
  return {
    request: new Request("https://preview.test/admin/login", {
      method: "POST",
      headers: { Origin: origin },
      body: new URLSearchParams({ email: "admin@example.test", password: "test-password" }),
    }),
    params: {},
    context: {
      get: (key: unknown) =>
        key === cloudflareContext ? { env: environment } : "correlation-test",
    },
  } as unknown as Parameters<typeof action>[0];
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(createAnonymousSupabaseClient).mockReturnValue(
    client as unknown as ReturnType<typeof createAnonymousSupabaseClient>,
  );
  client.auth.signInWithPassword.mockResolvedValue({
    data: {
      session: {
        access_token: "test-access",
        refresh_token: "test-refresh",
        expires_at: 1_900_000_000,
      },
    },
    error: null,
  });
  client.rpc.mockResolvedValue({ data: true, error: null });
  client.auth.mfa.listFactors.mockResolvedValue({
    data: { totp: [{ status: "verified" }] },
    error: null,
  });
});

describe("administrator password login", () => {
  it("opens the isolated preview panel after password and database authorization", async () => {
    const response = await action(args()).catch((error: unknown) => error);
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("Location")).toBe("/admin");
    expect((response as Response).headers.get("Set-Cookie")).toContain(
      "HttpOnly; Secure; SameSite=Strict",
    );
    expect(client.rpc).toHaveBeenCalledWith("admin_open_preview_session", {
      p_secret: "test-preview-secret",
    });
    expect(client.auth.mfa.listFactors).not.toHaveBeenCalled();
  });

  it("refuses password login if the isolated database has not enabled the exception", async () => {
    client.rpc.mockImplementation(async (name) => ({
      data: name === "is_current_admin",
      error: null,
    }));
    const response = await action(args());
    expect(response).toMatchObject({ init: { status: 503 } });
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: "global" });
  });

  it("rejects valid credentials belonging to another identity", async () => {
    client.rpc.mockResolvedValue({ data: false, error: null });
    expect(await action(args())).toMatchObject({ init: { status: 400 } });
    expect(client.auth.mfa.listFactors).not.toHaveBeenCalled();
  });

  it("rejects an incorrect password before any authorization probe", async () => {
    client.auth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: "wrong password" },
    });
    expect(await action(args())).toMatchObject({ init: { status: 400 } });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("preserves MFA in production", async () => {
    const response = await action(
      args({
        ...env,
        APP_ENV: "production",
        PREVIEW_PASSWORD_AUTH: undefined,
      } as unknown as Env),
    ).catch((error: unknown) => error);
    expect((response as Response).headers.get("Location")).toBe("/admin/mfa");
    expect(client.rpc).not.toHaveBeenCalledWith("is_current_admin_aal2");
  });

  it("preserves enrollment when no verified factor exists", async () => {
    client.auth.mfa.listFactors.mockResolvedValue({ data: { totp: [] }, error: null });
    const response = await action(args({ ...env, PREVIEW_PASSWORD_AUTH: undefined })).catch(
      (error: unknown) => error,
    );
    expect((response as Response).headers.get("Location")).toBe("/admin/mfa/enroll");
  });

  it("retains the same-origin guard", async () => {
    await expect(action(args(env, "https://evil.test"))).rejects.toBeInstanceOf(Response);
    expect(client.auth.signInWithPassword).not.toHaveBeenCalled();
  });
  it("rejects login before authentication when the preview backend secret is missing", async () => {
    expect(await action(args({ ...env, PREVIEW_AUTH_SECRET: undefined }))).toMatchObject({
      init: { status: 503 },
    });
    expect(client.auth.signInWithPassword).not.toHaveBeenCalled();
  });
});
