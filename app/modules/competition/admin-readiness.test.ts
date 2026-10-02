import { describe, expect, it } from "vitest";
import { resolveCompetitionReadiness } from "./admin-readiness";

describe("competition admin readiness", () => {
  it("guides the administrator through teams, rosters, schedule, results and publication", () => {
    const readiness = resolveCompetitionReadiness({
      competitionId: 20,
      status: "draft",
      primarySource: "manual_scoresheet",
      registrationCount: 4,
      draftRegistrationCount: 2,
      rosteredRegistrationCount: 1,
      gameCount: 0,
      finalGameCount: 0,
    });

    expect(readiness.next).toMatchObject({ key: "teams", state: "current" });
    expect(readiness.steps.map((step) => step.state)).toEqual([
      "current",
      "pending",
      "pending",
      "pending",
      "pending",
    ]);
  });

  it("moves the next action to results when teams, rosters and agenda are ready", () => {
    const readiness = resolveCompetitionReadiness({
      competitionId: 20,
      status: "draft",
      primarySource: "fiba_boxscore",
      registrationCount: 4,
      draftRegistrationCount: 0,
      rosteredRegistrationCount: 4,
      gameCount: 3,
      finalGameCount: 1,
    });

    expect(readiness.next).toMatchObject({
      key: "results",
      href: "/admin/competitions/20/boxscores/import",
      actionLabel: "Importar resultados",
    });
  });

  it("routes the results step through data configuration while the source is undefined", () => {
    const readiness = resolveCompetitionReadiness({
      competitionId: 20,
      status: "draft",
      primarySource: null,
      registrationCount: 2,
      draftRegistrationCount: 0,
      rosteredRegistrationCount: 2,
      gameCount: 1,
      finalGameCount: 0,
    });

    expect(readiness.next).toMatchObject({
      key: "results",
      href: "/admin/competitions/20/data-profile",
      actionLabel: "Definir fonte dos jogos",
    });
  });

  it("has no next action for published or archived editions", () => {
    for (const status of ["published", "archived"]) {
      const readiness = resolveCompetitionReadiness({
        competitionId: 20,
        status,
        primarySource: "manual_scoresheet",
        registrationCount: 0,
        draftRegistrationCount: 0,
        rosteredRegistrationCount: 0,
        gameCount: 0,
        finalGameCount: 0,
      });

      expect(readiness.next).toBeNull();
      expect(readiness.steps.every((step) => step.state === "complete")).toBe(true);
    }
  });
});
