import { describe, expect, it } from "vitest";

import { adminDraftKey, createAdminDraft, parseAdminDraft } from "../admin-drafts/schema";
import { prepareQuickFoul } from "./fast-scoring-panel";
import type { ScoresheetRegistration } from "./editor";
import {
  createScoresheetSetup,
  editSetupCoach,
  linkSetupCaptainToCoach,
  restoreScoresheetSetup,
  selectSetupCaptain,
  selectSetupPlayer,
  selectSetupTeam,
  updateSetupStat,
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
  it("invalidates affected completion confirmations on points, undo and lineup changes", () => {
    const saved = {
      ...validSetup(),
      periodCount: 6,
      completedPeriods: [4, 5, 6],
      stats: { "home-1-5-two": "1" },
    };
    expect(updateSetupStat(saved, "home-1-5-two", "2").completedPeriods).toEqual([4]);
    expect(updateSetupStat(saved, "home-1-5-two", undefined).completedPeriods).toEqual([4]);
    expect(updateSetupStat(saved, "away-1-1-three", "1").completedPeriods).toEqual([]);
    expect(updateSetupStat(saved, "home-1-4-fouls", "U2").completedPeriods).toEqual([4, 5, 6]);
    expect(updateSetupStat(saved, "home-1-5-two", "1")).toBe(saved);
    expect(
      selectSetupPlayer(saved, "home", 1, null, homeRegistration.roster).completedPeriods,
    ).toEqual([]);
    expect(selectSetupTeam(saved, "away", homeRegistration).completedPeriods).toEqual([]);
    expect(restoreScoresheetSetup(saved, registrations)?.completedPeriods).toEqual([4, 5, 6]);
    for (const completedPeriods of [[4, 4], [3], [7]])
      expect(restoreScoresheetSetup({ ...saved, completedPeriods }, registrations)).toBeNull();
  });
  it("restores OT points and empty added periods while retaining legacy drafts", () => {
    const initial = validSetup();
    expect(
      restoreScoresheetSetup({ ...initial, periodCount: undefined }, registrations)?.periodCount,
    ).toBe(4);
    expect(restoreScoresheetSetup({ ...initial, periodCount: 6 }, registrations)?.periodCount).toBe(
      6,
    );
    const ot = { ...initial, periodCount: undefined, stats: { "home-1-12-three": "1" } };
    expect(restoreScoresheetSetup(ot, registrations)).toMatchObject({
      periodCount: 12,
      stats: ot.stats,
    });
    for (const periodCount of [3, 13, 4.5])
      expect(restoreScoresheetSetup({ ...initial, periodCount }, registrations)).toBeNull();
    expect(
      restoreScoresheetSetup({ ...initial, stats: { "home-1-5-fouls": "P" } }, registrations),
    ).toBeNull();
  });
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
      restoreScoresheetSetup({ ...withScores, stats: { "home-1-13-two": "1" } }, registrations),
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

describe("stage 7 semantic foul drafts", () => {
  it("restores GD with Q4/OT scoring but rejects OT points after earlier GD", () => {
    const original = validSetup();
    const gd = prepareQuickFoul([], original.slots.home, 10, 5, "player", "00D", {}, "home");
    if (!gd.ok) throw new Error(gd.message);
    const saved = {
      ...original,
      periodCount: 6,
      fouls: [gd.entry],
      stats: { "home-1-5-two": "1", "home-1-6-free": "1" },
    };
    expect(restoreScoresheetSetup(saved, registrations)).toMatchObject(saved);
    expect(
      restoreScoresheetSetup(
        { ...saved, fouls: [{ ...gd.entry, periodNumber: 3 }] },
        registrations,
      ),
    ).toBeNull();
  });
  it("reconciles legacy and quick fouls with GD and later scores during restore", () => {
    const original = validSetup();
    const disqualified = prepareQuickFoul(
      [],
      original.slots.home,
      10,
      2,
      "player",
      "00D",
      {},
      "home",
    );
    if (!disqualified.ok) throw new Error(disqualified.message);
    expect(
      restoreScoresheetSetup(
        { ...original, fouls: [disqualified.entry], stats: { "home-1-3-two": "1" } },
        registrations,
      ),
    ).toBeNull();
    expect(
      restoreScoresheetSetup(
        { ...original, fouls: [disqualified.entry], stats: { "home-1-2-two": "1" } },
        registrations,
      ),
    ).not.toBeNull();

    const personal = prepareQuickFoul([], original.slots.home, 10, 3, "player", "00P", {}, "home");
    if (!personal.ok) throw new Error(personal.message);
    expect(
      restoreScoresheetSetup(
        {
          ...original,
          fouls: [personal.entry],
          stats: { "home-1-1-fouls": "T", "home-1-2-fouls": "U" },
        },
        registrations,
      ),
    ).toBeNull();
    expect(
      restoreScoresheetSetup(
        { ...original, stats: { "home-1-1-fouls": "D", "home-1-3-fouls": "P" } },
        registrations,
      ),
    ).toBeNull();
    expect(
      restoreScoresheetSetup(
        { ...original, stats: { "home-1-1-fouls": "P", "home-1-3-fouls": "D" } },
        registrations,
      ),
    ).not.toBeNull();

    // Preserve a partial legacy draft so the operator can repair it in the grid.
    expect(
      restoreScoresheetSetup({ ...original, stats: { "home-1-1-fouls": "T,?" } }, registrations)
        ?.stats["home-1-1-fouls"],
    ).toBe("T,?");
  });

  it("restores older drafts without fouls and validates newer semantic events", () => {
    const original = validSetup();
    const legacy = { ...original, fouls: undefined };
    expect(restoreScoresheetSetup(legacy, registrations)?.fouls).toEqual([]);
    const quick = prepareQuickFoul([], original.slots.home, 10, 1, "player", "00u2", {}, "home");
    if (!quick.ok) throw new Error(quick.message);
    const saved = { ...original, step: 3 as const, fouls: [quick.entry] };
    expect(restoreScoresheetSetup(saved, registrations)?.fouls).toEqual(saved.fouls);
    const wrongNotation = structuredClone(saved);
    wrongNotation.fouls[0]!.penaltyFtCount = 0;
    expect(restoreScoresheetSetup(wrongNotation, registrations)).toBeNull();
    const wrongPlayerNotation = structuredClone(saved);
    wrongPlayerNotation.fouls[0]!.originalNotation = "B1";
    wrongPlayerNotation.fouls[0]!.type = "T";
    wrongPlayerNotation.fouls[0]!.penaltyFtCount = 1;
    expect(restoreScoresheetSetup(wrongPlayerNotation, registrations)).toBeNull();
    const unknownRegistration = structuredClone(saved);
    unknownRegistration.fouls[0]!.target.registrationId = 99;
    expect(restoreScoresheetSetup(unknownRegistration, registrations)).toBeNull();
    const unselectedPlayer = structuredClone(saved);
    unselectedPlayer.fouls[0]!.target.rosterEntryId = 999;
    expect(restoreScoresheetSetup(unselectedPlayer, registrations)).toBeNull();
    const invalidPeriod = structuredClone(saved);
    invalidPeriod.fouls[0]!.periodNumber = 5;
    expect(restoreScoresheetSetup(invalidPeriod, registrations)).toBeNull();
    const duplicateSequence = { ...saved, fouls: [quick.entry, { ...quick.entry }] };
    expect(restoreScoresheetSetup(duplicateSequence, registrations)).toBeNull();
  });

  it("rejects player fouls after GD and drops fouls only for affected player or team", () => {
    const original = validSetup();
    const playerD = prepareQuickFoul([], original.slots.home, 10, 1, "player", "00D", {}, "home");
    if (!playerD.ok) throw new Error(playerD.message);
    const later = {
      ...playerD.entry,
      sequenceNumber: 2,
      type: "P" as const,
      originalNotation: "P",
      penaltyFtCount: 0,
    };
    expect(
      restoreScoresheetSetup({ ...original, fouls: [playerD.entry, later] }, registrations),
    ).toBeNull();
    const bench = prepareQuickFoul(
      [playerD.entry],
      original.slots.home,
      10,
      1,
      "bench",
      "B1",
      {},
      "home",
    );
    if (!bench.ok) throw new Error(bench.message);
    const away = prepareQuickFoul(
      [playerD.entry, bench.entry],
      original.slots.away,
      20,
      1,
      "player",
      "7P",
      {},
      "away",
    );
    if (!away.ok) throw new Error(away.message);
    const saved = { ...original, fouls: [playerD.entry, bench.entry, away.entry] };
    expect(restoreScoresheetSetup(saved, registrations)).not.toBeNull();
    const replacedPlayer = selectSetupPlayer(saved, "home", 1, null, homeRegistration.roster);
    expect(replacedPlayer.fouls).toEqual([bench.entry, away.entry]);
    const changedTeam = selectSetupTeam(saved, "home", awayRegistration);
    expect(changedTeam.fouls).toEqual([away.entry]);
  });
});
