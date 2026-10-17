import { describe, expect, it } from "vitest";
import { usesPreviewPasswordAuth } from "./preview-password.server";
describe("preview password authentication configuration", () => {
  it("preserves MFA when the preview option is absent", () => {
    expect(usesPreviewPasswordAuth({ APP_ENV: "preview" })).toBe(false);
    expect(usesPreviewPasswordAuth({ APP_ENV: "production" })).toBe(false);
  });
  it("enables password authentication only in preview", () => {
    expect(usesPreviewPasswordAuth({ APP_ENV: "preview", PREVIEW_PASSWORD_AUTH: "enabled" })).toBe(
      true,
    );
  });
  it.each([
    { APP_ENV: "production", PREVIEW_PASSWORD_AUTH: "enabled" },
    { APP_ENV: "development", PREVIEW_PASSWORD_AUTH: "enabled" },
    { APP_ENV: "preview", PREVIEW_PASSWORD_AUTH: "" },
    { APP_ENV: "preview", PREVIEW_PASSWORD_AUTH: "true" },
  ])("fails closed for invalid settings %j", (env) => {
    expect(() => usesPreviewPasswordAuth(env)).toThrow(
      "Invalid preview password authentication configuration",
    );
  });
});
