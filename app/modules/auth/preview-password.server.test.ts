import { describe, expect, it } from "vitest";
import { usesPreviewPasswordAuth } from "./preview-password.server";

const projectRef = "abcdefghijklmnopqrst";
const preview = {
  APP_ENV: "preview",
  SUPABASE_URL: `https://${projectRef}.supabase.co`,
  PREVIEW_PASSWORD_AUTH_PROJECT_REF: projectRef,
};

describe("preview password authentication configuration", () => {
  it("keeps MFA by default in preview and production", () => {
    expect(
      usesPreviewPasswordAuth({ ...preview, PREVIEW_PASSWORD_AUTH_PROJECT_REF: undefined }),
    ).toBe(false);
    expect(
      usesPreviewPasswordAuth({ APP_ENV: "production", SUPABASE_URL: preview.SUPABASE_URL }),
    ).toBe(false);
  });

  it("accepts only an explicitly configured isolated preview origin", () => {
    expect(usesPreviewPasswordAuth(preview)).toBe(true);
  });

  it.each([
    { APP_ENV: "production" },
    { APP_ENV: "development" },
    { PREVIEW_PASSWORD_AUTH_PROJECT_REF: "" },
    { PREVIEW_PASSWORD_AUTH_PROJECT_REF: "not-a-project" },
    { SUPABASE_URL: "https://anotherprojectrefabcd.supabase.co" },
    { SUPABASE_URL: `http://${projectRef}.supabase.co` },
    { SUPABASE_URL: `https://${projectRef}.supabase.co/extra` },
    { SUPABASE_URL: `https://${projectRef}.supabase.co?redirect=evil` },
    { SUPABASE_URL: `https://user:pass@${projectRef}.supabase.co` },
    { SUPABASE_URL: `https://${projectRef}.supabase.co:444` },
    { SUPABASE_URL: "invalid" },
  ])("fails closed for invalid configuration %j", (delta) => {
    expect(() => usesPreviewPasswordAuth({ ...preview, ...delta })).toThrow(
      "Invalid preview password authentication configuration",
    );
  });

  it.each(["yjnbemfeyjhxhomprlnm", "payumtvegfqfejmowxiy"])(
    "rejects the existing project %s",
    (ref) => {
      expect(() =>
        usesPreviewPasswordAuth({
          ...preview,
          PREVIEW_PASSWORD_AUTH_PROJECT_REF: ref,
          SUPABASE_URL: `https://${ref}.supabase.co`,
        }),
      ).toThrow();
    },
  );
});
