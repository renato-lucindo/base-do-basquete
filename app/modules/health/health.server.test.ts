import { describe, expect, it } from "vitest";

import { healthResponse } from "./health.server";

describe("healthResponse", () => {
  it("returns a safe preview health payload", async () => {
    const response = healthResponse({ APP_ENV: "preview" }, "health-test");

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Correlation-Id")).toBe("health-test");
    await expect(response.json()).resolves.toEqual({
      environment: "preview",
      service: "base-do-basquete",
      status: "ok",
    });
  });
});
