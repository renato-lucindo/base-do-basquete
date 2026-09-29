import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import { ManualScoresheetEditor } from "./editor";

function renderEditor() {
  const RouterStub = createRoutesStub([
    {
      path: "/admin/competitions/100/scoresheets/new",
      Component: () => (
        <ManualScoresheetEditor
          competitionId={100}
          competitionName="Liga de teste"
          csrfToken="csrf"
          idempotencyKey="idempotency"
          games={[
            {
              id: 1,
              gameNumber: "1",
              scheduledLocal: "2026-09-24T19:00",
              venue: "Ginásio",
              homeRegistrationId: 10,
              awayRegistrationId: 20,
            },
          ]}
          registrations={[
            { id: 10, teamName: "Mandante", roster: [], previous: [] },
            { id: 20, teamName: "Visitante", roster: [], previous: [] },
          ]}
          requiresFallbackReason={false}
        />
      ),
    },
  ]);

  return renderToStaticMarkup(
    <RouterStub initialEntries={["/admin/competitions/100/scoresheets/new"]} />,
  );
}

describe("manual scoresheet editor", () => {
  it("does not render the final review content before the review step", () => {
    const html = renderEditor();

    expect(html).not.toContain("O jogo será encerrado como final");
    expect(html).not.toContain("Voltar aos lançamentos");
    expect(html).toContain("Continuar para equipes");
    expect(html).toContain('aria-labelledby="scoresheet-step-1-heading"');
    expect(html).toContain('id="scoresheet-step-1-heading"');
    expect(html).toContain('tabindex="-1"');
  });
});
