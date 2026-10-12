import { FOUL_RULES_VERSION, type ManualScoresheetV2Payload } from "./domain";
import { buildSetupConfirmation } from "./setup-confirmation";
import { createScoresheetSetup } from "./setup-state";
export function savedFixture(): ManualScoresheetV2Payload {
  const setup = createScoresheetSetup();
  setup.game = { date: "2026-10-12", time: "20:00", venue: "Ginásio", notes: "Original" };
  setup.registrationIds = { home: 10, away: 20 };
  setup.slots.home[0] = {
    slotNumber: 1,
    rosterEntryId: 11,
    jerseyNumber: "00",
    isCaptain: true,
    isStarter: true,
  };
  setup.slots.away[0] = { slotNumber: 1, rosterEntryId: 21, jerseyNumber: "7", isCaptain: true };
  setup.staff.home.coach = {
    role: "coach",
    name: "Casa",
    origin: "captain_placeholder",
    linkedCaptainRosterEntryId: 11,
  };
  setup.staff.away.coach = { role: "coach", name: "Fora", origin: "manual" };
  setup.staff.away.assistant = "Assistente";
  setup.officials["Árbitro"] = "Árbitro";
  setup.stats["home-1-4-two"] = "1";
  setup.fouls = [
    {
      periodNumber: 4,
      sequenceNumber: 1,
      target: { kind: "player", registrationId: 10, rosterEntryId: 11 },
      type: "T",
      penaltyFtCount: 1,
      originalNotation: "T1",
      rulesVersion: FOUL_RULES_VERSION,
    },
  ];
  return {
    ...buildSetupConfirmation(setup, 100).payload!,
    roundId: null,
    fallbackReason: "Súmula emergencial autorizada",
  };
}
