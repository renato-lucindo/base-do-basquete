import { describe, expect, it } from "vitest";

import { mapAdminDomainError, normalizeJersey } from "./admin-domain";

describe("admin competition domain", () => {
  it("preserves 0 and 00 without numeric conversion", () => {
    expect(normalizeJersey(" 00 ")).toEqual({ ok: true, value: "00" });
    expect(normalizeJersey("0")).toEqual({ ok: true, value: "0" });
    expect(normalizeJersey("07")).toMatchObject({ ok: false });
    expect(normalizeJersey("100")).toMatchObject({ ok: false });
  });

  it("maps stable database codes without parsing PostgreSQL messages", () => {
    expect(mapAdminDomainError("BD104")).toMatchObject({
      code: "player-conflict",
      field: "player",
    });
    expect(mapAdminDomainError("XX000")).toMatchObject({ code: "unknown" });
  });
});
