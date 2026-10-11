import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import { ManualScoresheetSetupWizard } from "./setup-wizard";

describe("stage 5 setup wizard", () => {
  it("presents editable game metadata and never posts draft setup to the server", () => {
    const RouterStub = createRoutesStub([
      {
        path: "/setup",
        Component: () => (
          <ManualScoresheetSetupWizard
            competitionId={100}
            competitionName="Copa ES"
            hasExistingGames={true}
            registrations={[
              { id: 10, teamName: "Mandante", previous: [], roster: [] },
              { id: 20, teamName: "Visitante", previous: [], roster: [] },
            ]}
          />
        ),
      },
    ]);
    const html = renderToStaticMarkup(<RouterStub initialEntries={["/setup"]} />);
    expect(html).toContain("Continuar para equipes");
    expect(html).toContain("Data do jogo (obrigatória)");
    expect(html).toContain("Fase ou rodada (opcional)");
    expect(html).toContain("Oficiais da partida (opcional)");
    expect(html).toContain("Usar capitão como técnico");
    expect(html).toContain("modo=existente");
    expect(html).not.toContain('method="post"');
    expect(html).not.toContain('type="submit"');
  });
});
