import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import type { CompetitionContext, GenderDivision } from "../modules/competition/context";
import { PublicGenderSelection } from "./public-gender-selection";

function context(competitionId: number, genderDivision: GenderDivision | null): CompetitionContext {
  return {
    competitionId,
    dataProfile: genderDivision
      ? { id: competitionId + 100, primarySource: "fiba_boxscore", version: 1 }
      : null,
    displayName: `Liga 2026 ${competitionId}`,
    genderDivision,
    statisticsMode: genderDivision ? "boxscore" : "legacy",
    year: 2026,
    series: { id: 1, name: "Liga", slug: "liga" },
    category: { id: 2, name: "Adulto", slug: "adulto", hasAdvancedStats: true },
  };
}

function renderSelection(contexts: CompetitionContext[], resource: "jogadores" | "jogos") {
  return renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(PublicGenderSelection, { contexts, resource })),
  );
}

describe("PublicGenderSelection", () => {
  it("offers explicit canonical links for both genders", () => {
    const markup = renderSelection([context(1, "male"), context(2, "female")], "jogadores");

    expect(markup).toContain("/2026/liga/adulto/masculino/jogadores");
    expect(markup).toContain("/2026/liga/adulto/feminino/jogadores");
    expect(markup).toContain("Nenhuma opção foi escolhida automaticamente");
  });

  it("does not create a self-link for an edition whose gender is still under review", () => {
    const markup = renderSelection([context(3, null), context(1, "male")], "jogos");

    expect(markup).toContain('aria-disabled="true"');
    expect(markup.match(/href=/g)).toHaveLength(1);
  });
});
