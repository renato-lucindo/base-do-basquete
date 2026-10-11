import { describe, expect, it } from "vitest";

import { adminDraftKey, createAdminDraft, parseAdminDraft } from "../admin-drafts/schema";
import type { ScoresheetRegistration } from "./editor";
import {
  createScoresheetSetup,
  editSetupCoach,
  linkSetupCaptainToCoach,
  restoreScoresheetSetup,
  selectSetupCaptain,
  selectSetupPlayer,
  selectSetupTeam,
  validateSetupGame,
  validateSetupTeams,
} from "./setup-state";

const registrations: ScoresheetRegistration[] = [
  {
    id: 10,
    teamName: "Mandante",
    previous: [],
    roster: [
      { rosterEntryId: 1, playerName: "Capitão 1", jerseyNumber: "00" },
      { rosterEntryId: 2, playerName: "Capitão 2", jerseyNumber: "0" },
    ],
  },
  {
    id: 20,
    teamName: "Visitante",
    previous: [],
    roster: [{ rosterEntryId: 3, playerName: "Capitã 3", jerseyNumber: "7" }],
  },
];
const [homeRegistration, awayRegistration] = registrations as [
  ScoresheetRegistration,
  ScoresheetRegistration,
];

function validSetup() {
  let setup = createScoresheetSetup();
  setup = selectSetupTeam(setup, "home", homeRegistration);
  setup = selectSetupTeam(setup, "away", awayRegistration);
  setup = { ...setup, game: { ...setup.game, date: "2026-10-11" } };
  setup = selectSetupCaptain(setup, "home", 1, homeRegistration.roster);
  setup = selectSetupCaptain(setup, "away", 1, awayRegistration.roster);
  return setup;
}

describe("manual scoresheet stage 5 setup", () => {
  it("requires two different confirmed teams and a real date; other metadata is optional", () => {
    expect(validateSetupGame(createScoresheetSetup(), registrations)).toHaveLength(2);
    const setup = validSetup();
    expect(validateSetupGame(setup, registrations)).toEqual([]);
    expect(validateSetupTeams(setup, registrations)).toEqual([]);
    expect(setup.slots.home).toHaveLength(12);
    expect(setup.slots.home.slice(0, 2).map((slot) => slot.jerseyNumber)).toEqual(["00", "0"]);
    expect(
      validateSetupGame({ ...setup, game: { ...setup.game, date: "2026-02-30" } }, registrations),
    ).toContain("Informe uma data de jogo válida.");
  });

  it("retains the captain-as-coach link when captain changes, until manually edited", () => {
    let setup = validSetup();
    setup = linkSetupCaptainToCoach(setup, "home", homeRegistration.roster);
    expect(setup.staff.home.coach).toMatchObject({
      name: "Capitão 1",
      origin: "captain_placeholder",
      linkedCaptainRosterEntryId: 1,
    });
    setup = selectSetupCaptain(setup, "home", 2, homeRegistration.roster);
    expect(setup.staff.home.coach).toMatchObject({
      name: "Capitão 2",
      linkedCaptainRosterEntryId: 2,
    });
    setup = editSetupCoach(setup, "home", "Técnica cadastrada");
    setup = selectSetupCaptain(setup, "home", 1, homeRegistration.roster);
    expect(setup.staff.home.coach).toEqual({
      role: "coach",
      name: "Técnica cadastrada",
      origin: "manual",
    });
    setup = linkSetupCaptainToCoach(setup, "home", homeRegistration.roster);
    setup = selectSetupPlayer(setup, "home", 1, null, homeRegistration.roster);
    expect(setup.staff.home.coach).toBeNull();
  });

  it("preserves spaces while typing coach names and breaks the captain link", () => {
    let setup = linkSetupCaptainToCoach(validSetup(), "home", homeRegistration.roster);
    for (const letter of "Ana Silva") {
      setup = editSetupCoach(
        setup,
        "home",
        (setup.staff.home.coach?.origin === "manual" ? setup.staff.home.coach.name : "") + letter,
      );
    }
    expect(setup.staff.home.coach).toEqual({ role: "coach", name: "Ana Silva", origin: "manual" });
    setup = editSetupCoach(setup, "home", "Ana Silva ");
    expect(setup.staff.home.coach?.name).toBe("Ana Silva ");
    setup = editSetupCoach(setup, "home", "");
    expect(setup.staff.home.coach).toBeNull();
  });

  it("limits selection to registered players and rejects duplicate jerseys", () => {
    let setup = validSetup();
    expect(selectSetupPlayer(setup, "home", 3, 3, homeRegistration.roster)).toEqual(setup);
    expect(selectSetupPlayer(setup, "home", 3, 1, homeRegistration.roster)).toEqual(setup);
    setup = {
      ...setup,
      slots: {
        ...setup.slots,
        home: setup.slots.home.map((slot) =>
          slot.slotNumber === 2 ? { ...slot, jerseyNumber: "00" } : slot,
        ),
      },
    };
    expect(
      validateSetupTeams(setup, registrations).some((error) => error.includes("camisas repetidos")),
    ).toBe(true);
  });

  it("restores only the correct local editor version and existing registered rosters", () => {
    let setup = validSetup();
    setup = linkSetupCaptainToCoach(setup, "home", homeRegistration.roster);
    setup = {
      ...setup,
      step: 2,
      game: {
        ...setup.game,
        time: "19:30",
        venue: "Ginásio Municipal",
        gameNumber: "42",
        phaseRound: "Final",
        notes: "Quadra principal",
      },
      staff: {
        ...setup.staff,
        away: {
          coach: { role: "coach", name: "Treinadora", origin: "manual" },
          assistant: "Auxiliar",
        },
      },
      officials: { ...setup.officials, Árbitro: "Árbitro principal" },
    };
    const version = "v3-setup";
    const identity = {
      flow: "manual-scoresheet" as const,
      competitionId: 88,
      editorVersion: version,
    };
    expect(adminDraftKey("manual-scoresheet", 88, undefined, version)).not.toBe(
      adminDraftKey("manual-scoresheet", 88),
    );
    const stored = createAdminDraft(identity.flow, identity.competitionId, setup, {
      editorVersion: version,
    });
    const read = parseAdminDraft(JSON.stringify(stored), identity);
    expect(read.status).toBe("available");
    if (read.status !== "available") throw new Error("draft unavailable");
    expect(restoreScoresheetSetup(read.draft.data, registrations)).toEqual(setup);
    expect(
      parseAdminDraft(JSON.stringify(stored), { ...identity, editorVersion: "v2" }).status,
    ).toBe("incompatible");
    expect(restoreScoresheetSetup(setup, registrations.slice(0, 1))).toBeNull();
    const tampered = structuredClone(setup);
    const tamperedSlot = tampered.slots.home.at(0);
    if (!tamperedSlot) throw new Error("missing test slot");
    tamperedSlot.rosterEntryId = 999;
    expect(restoreScoresheetSetup(tampered, registrations)).toBeNull();
    const staleCaptain = structuredClone(setup);
    const linkedCoach = staleCaptain.staff.home.coach;
    if (!linkedCoach) throw new Error("missing captain placeholder");
    linkedCoach.name = "Nome divergente";
    expect(restoreScoresheetSetup(staleCaptain, registrations)).toBeNull();
  });
});

describe("stage 6 draft statistics", () => {
  it("restores legacy setup drafts and preserves valid counters", () => {
    const initial = validSetup();
    const legacy = { ...initial, stats: undefined };
    expect(restoreScoresheetSetup(legacy, registrations)?.stats).toEqual({});
    const withScores = {
      ...initial,
      step: 3,
      stats: { "home-1-1-two": "2", "away-1-4-free": "1" },
    };
    expect(restoreScoresheetSetup(withScores, registrations)?.stats).toEqual(withScores.stats);
    expect(
      restoreScoresheetSetup(
        { ...withScores, stats: { "home-1-1-two": "texto incompleto" } },
        registrations,
      )?.stats,
    ).toEqual({ "home-1-1-two": "texto incompleto" });
    expect(
      restoreScoresheetSetup({ ...withScores, stats: { "home-1-5-two": "1" } }, registrations),
    ).toBeNull();
    expect(
      restoreScoresheetSetup({ ...withScores, stats: { "home-9-1-two": "1" } }, registrations),
    ).toBeNull();
  });

  it("drops only the changed team or player counters", () => {
    let setup = validSetup();
    setup = {
      ...setup,
      stats: { "home-1-1-two": "1", "home-2-1-free": "2", "away-1-1-three": "1" },
    };
    setup = selectSetupPlayer(setup, "home", 1, null, homeRegistration.roster);
    expect(setup.stats).toEqual({ "home-2-1-free": "2", "away-1-1-three": "1" });
    setup = selectSetupTeam(setup, "away", homeRegistration);
    expect(setup.stats).toEqual({ "home-2-1-free": "2" });
  });
});
