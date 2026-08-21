import { describe, expect, it } from "vitest";

import { assertCsrfToken, assertSameOrigin, constantTimeEqual } from "./csrf.server";

describe("request forgery protection", () => {
  it("requires a matching request origin", () => {
    expect(() =>
      assertSameOrigin(
        new Request("https://example.test/admin", {
          headers: { Origin: "https://example.test" },
          method: "POST",
        }),
      ),
    ).not.toThrow();
    expect(() =>
      assertSameOrigin(
        new Request("https://example.test/admin", {
          headers: { Origin: "https://attacker.test" },
          method: "POST",
        }),
      ),
    ).toThrow();
  });

  it("compares and validates CSRF tokens", () => {
    expect(constantTimeEqual("same", "same")).toBe(true);
    expect(constantTimeEqual("same", "different")).toBe(false);

    const formData = new FormData();
    formData.set("csrfToken", "expected");
    expect(() => assertCsrfToken(formData, "expected")).not.toThrow();
    expect(() => assertCsrfToken(formData, "wrong")).toThrow();
  });
});
