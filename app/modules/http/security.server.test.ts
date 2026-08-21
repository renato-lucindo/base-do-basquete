import { describe, expect, it } from "vitest";

import { applySecurityHeaders } from "./security.server";

describe("applySecurityHeaders", () => {
  it("applies defensive headers without changing the response body", async () => {
    const response = applySecurityHeaders(
      new Response("ok", { headers: { "Content-Type": "text/html; charset=utf-8" } }),
      "correlation-test",
    );

    expect(response.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Correlation-Id")).toBe("correlation-test");
    expect(await response.text()).toBe("ok");
  });
});
