import { describe, expect, it } from "vitest";

import { buildSetupConfirmation } from "./setup-confirmation";
import { createScoresheetSetup, type ScoresheetSetup } from "./setup-state";
import { FOUL_RULES_VERSION, type SemanticFoulPayload } from "./domain";

function setupFixture(): ScoresheetSetup {
  const setup = createScoresheetSetup();
  setup.game.date = "2026-10-12";
  setup.registrationIds = { home: 10, away: 20 };
  setup.slots.home[0] = { slotNumber: 1, rosterEntryId: 11, jerseyNumber: "00", isCaptain: true };
  setup.slots.away[0] = { slotNumber: 1, rosterEntryId: 21, jerseyNumber: "7", isCaptain: true };
  setup.staff.home.coach = { role: "coach", name: "Treinador Casa", origin: "manual" };
  setup.staff.away.coach = { role: "coach", name: "Treinador Fora", origin: "manual" };
  setup.stats["home-1-4-two"] = "1";
  return setup;
}

function foul(periodNumber: number, sequenceNumber: number): SemanticFoulPayload {
  return {
    periodNumber,
    sequenceNumber,
    type: "T",
    penaltyFtCount: 0,
    originalNotation: "T",
    rulesVersion: FOUL_RULES_VERSION,
    target: { kind: "player", registrationId: 10, rosterEntryId: 11 },
  };
}

describe("stage 8 final confirmation", () => {
  it("builds all periods, stable idempotency, captain, staff and official metadata", () => {
    const setup = setupFixture();
    setup.officials["Árbitro"] = "Árbitro A";
    const { payload, issues } = buildSetupConfirmation(setup, 100);
    expect(issues).toEqual([]);
    expect(payload?.idempotencyKey).toBe(setup.submissionKey);
    expect(payload?.periods).toHaveLength(4);
    expect(payload?.teams[0].slots[0]).toMatchObject({ jerseyNumber: "00", isCaptain: true });
    expect(payload?.teams[1].staff).toEqual([
      { role: "coach", name: "Treinador Fora", origin: "manual" },
    ]);
    expect(payload?.officials).toEqual([{ role: "Árbitro", name: "Árbitro A" }]);
  });

  it("requires an explicitly completed tied Q4 and previous OTs before the next OT", () => {
    const setup = setupFixture();
    setup.periodCount = 5;
    expect(buildSetupConfirmation(setup, 100).issues.join(" ")).toContain(
      "confirme Q4 concluído e empatado",
    );
    setup.stats["away-1-4-two"] = "1";
    setup.stats["home-1-5-free"] = "1";
    expect(buildSetupConfirmation(setup, 100).issues.join(" ")).toContain(
      "confirme Q4 concluído e empatado",
    );
    setup.completedPeriods = [4];
    expect(buildSetupConfirmation(setup, 100).issues).toEqual([]);
    setup.periodCount = 6;
    setup.stats["away-1-5-free"] = "1";
    setup.stats["home-1-6-free"] = "1";
    expect(buildSetupConfirmation(setup, 100).issues.join(" ")).toContain(
      "confirme OT1 concluído e empatado",
    );
    setup.completedPeriods = [4, 5];
    expect(buildSetupConfirmation(setup, 100).issues).toEqual([]);
  });

  it("keeps legacy fouls and semantic quick fouls as separate sequenced events", () => {
    const setup = setupFixture();
    setup.stats["home-1-4-fouls"] = "P,U2";
    setup.fouls = [foul(4, 1)];
    const result = buildSetupConfirmation(setup, 100);
    expect(result.issues).toEqual([]);
    expect(
      result.payload?.fouls.map((item) => [
        item.originalNotation,
        item.periodNumber,
        item.sequenceNumber,
      ]),
    ).toEqual([
      ["P", 4, 1],
      ["U2", 4, 2],
      ["T", 4, 3],
    ]);
  });

  it("rejects late scoring after early GD but permits scoring in the shared Q4/OT group", () => {
    const setup = setupFixture();
    setup.fouls = [foul(2, 1), foul(2, 2)];
    expect(buildSetupConfirmation(setup, 100).issues.join(" ")).toContain(
      "pontos posteriores à GD",
    );
    setup.fouls = [foul(4, 1), foul(4, 2)];
    expect(buildSetupConfirmation(setup, 100).issues).toEqual([]);
    setup.periodCount = 5;
    setup.stats["away-1-4-two"] = "1";
    setup.completedPeriods = [4];
    setup.stats["home-1-5-free"] = "1";
    expect(buildSetupConfirmation(setup, 100).issues).toEqual([]);
  });

  it("blocks incomplete counters, unfinished legacy fouls, and tied final scores", () => {
    const setup = setupFixture();
    setup.stats["home-1-4-two"] = "2x";
    setup.stats["home-1-4-fouls"] = "P,";
    expect(buildSetupConfirmation(setup, 100).issues.join(" ")).toContain("conversões inválidas");
    setup.stats["home-1-4-two"] = "1";
    setup.stats["home-1-4-fouls"] = "";
    setup.stats["away-1-4-two"] = "1";
    expect(buildSetupConfirmation(setup, 100).issues.join(" ")).toContain(
      "placar final está empatado",
    );
  });
});
