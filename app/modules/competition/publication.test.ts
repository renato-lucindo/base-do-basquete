import { describe, expect, it } from "vitest";
import { publicationBlocker, publicationError, validatePublication } from "./publication";

describe("versioned publication input", () => {
  it("requires an explicit confirmation and safe expected version", () => {
    const form = new FormData();
    form.set("expectedVersion", "2");
    form.set("confirmed", "yes");
    expect(validatePublication(form)).toEqual({ ok: true, input: { expectedVersion: 2 } });
  });

  it.each(["", "-1", "1.2", "01", "9007199254740992"])(
    "rejects invalid expected version %s",
    (version) => {
      const form = new FormData();
      form.set("expectedVersion", version);
      form.set("confirmed", "yes");
      expect(validatePublication(form).ok).toBe(false);
    },
  );

  it("does not accept an unchecked confirmation", () => {
    const form = new FormData();
    form.set("expectedVersion", "0");
    expect(validatePublication(form).ok).toBe(false);
  });

  it("maps only stable errors and blockers", () => {
    expect(publicationBlocker("BEFORE_STARTS_ON")).toContain("data inicial");
    expect(publicationError("BR041")).toContain("Recarregue");
    expect(publicationError("raw SQL secret")).not.toContain("SQL");
  });
});
