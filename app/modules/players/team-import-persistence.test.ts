import { describe, expect, it } from "vitest";

import { createPersistencePlan } from "./team-import-persistence";

describe("team import persistence plan", () => {
  it("creates actions from confirmations", () => {
    expect(createPersistencePlan([
      {
        player: { name: "João" } as never,
        decision: "create",
      },
    ])).toEqual([{ type: "create", name: "João" }]);
  });
});
