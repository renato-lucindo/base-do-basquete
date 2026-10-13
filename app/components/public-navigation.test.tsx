import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import type { CompetitionContext } from "../modules/competition/context";
import { PublicFooter, PublicHeader } from "./public-navigation";

const context: CompetitionContext = {
  competitionId: 7,
  dataProfile: { id: 3, primarySource: "fiba_boxscore", version: 2 },
  displayName: "Liga 2026",
  genderDivision: "male",
  statisticsMode: "boxscore",
  year: 2026,
  series: { id: 1, name: "Liga", slug: "liga" },
  category: { id: 1, name: "Adulto", slug: "adulto", hasAdvancedStats: true },
};

describe("public navigation", () => {
  it("uses classification as the canonical entry and keeps overview out of the tabs", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/2026/liga/adulto/masculino/classificacao"]}>
        <PublicHeader context={context} contexts={[context]} resource="classificacao" />
      </MemoryRouter>,
    );

    expect(html).toContain('href="/2026/liga/adulto/masculino/classificacao"');
    expect(html).toContain(">Classificação</a>");
    expect(html).not.toContain(">Visão geral</a>");
  });

  it("credits the data collection and site development in the public footer", () => {
    const html = renderToStaticMarkup(<PublicFooter />);

    expect(html).toContain("Dados coletados pela equipe de estatística da FECABA.");
    expect(html).toContain("Site desenvolvido por Renato Lucindo.");
  });
});
