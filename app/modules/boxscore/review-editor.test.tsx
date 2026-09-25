import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import { BoxscoreReviewEditor } from "./review-editor";
import type { ParsedBoxscore } from "./types";

const parsed: ParsedBoxscore = {
  format: "FIBA_GENIUS_SPORTS",
  parserVersion: "test",
  competitionName: "Liga de teste",
  gameNumber: "5205816",
  scheduledLocal: "2026-05-09T19:00",
  durationSeconds: null,
  venue: "Ginásio",
  teams: [
    {
      name: "Saldanha da Gama",
      abbreviation: "SAL",
      score: 59,
      periodScores: [10, 20, 15, 14],
      players: [],
    },
    {
      name: "Santo Antônio Basquete",
      abbreviation: "SAN",
      score: 40,
      periodScores: [8, 12, 9, 11],
      players: [],
    },
  ],
  warnings: [],
};

function renderEditor(resolved: boolean, actionError?: string) {
  const RouterStub = createRoutesStub([
    {
      path: "/admin/competitions/20/boxscores/import",
      Component: () => (
        <BoxscoreReviewEditor
          actionError={actionError}
          competitionId={20}
          competitionGender="male"
          csrfToken="csrf"
          games={[]}
          manualMatchupRequestId="40dde5c7-46b2-4241-995d-4e42223bbdf2"
          preferredGameId={null}
          review={{
            id: 26,
            parsed,
            resolvedTeams: resolved
              ? [
                  { sourceTeamName: "Saldanha da Gama", registrationId: 189 },
                  { sourceTeamName: "Santo Antônio Basquete", registrationId: 190 },
                ]
              : [],
            matches: [],
          }}
          registrations={
            resolved
              ? [
                  {
                    id: 189,
                    teamId: 1,
                    teamName: "Saldanha da Gama",
                    abbreviation: "SAL",
                    roster: [],
                  },
                  {
                    id: 190,
                    teamId: 2,
                    teamName: "Santo Antônio Basquete",
                    abbreviation: "SAN",
                    roster: [],
                  },
                ]
              : []
          }
          teamCandidates={[]}
        />
      ),
    },
  ]);

  return renderToStaticMarkup(
    <RouterStub initialEntries={["/admin/competitions/20/boxscores/import?import=26"]} />,
  );
}

describe("boxscore review editor", () => {
  it("preserves the import id in every review POST target", () => {
    const resolvedHtml = renderEditor(true);
    const unresolvedHtml = renderEditor(false);

    expect(resolvedHtml).toContain(
      'action="/admin/competitions/20/boxscores/import?import=26&amp;mode=confirm"',
    );
    expect(resolvedHtml).toContain('formAction="?import=26&amp;mode=create-game"');
    expect(unresolvedHtml).toContain('formAction="?import=26&amp;mode=resolve-teams"');
  });

  it("shows a create-game failure beside the active review controls with plain terminology", () => {
    const error = "A criação de jogos está temporariamente indisponível neste ambiente.";
    const html = renderEditor(true, error);

    expect(html.indexOf(error)).toBeGreaterThan(-1);
    expect(html.indexOf(error)).toBeLessThan(html.indexOf("Criar jogo e continuar"));
    expect(html).toContain("ainda não existe um jogo desta edição entre elas");
    expect(html).not.toContain("jogo estrutural elegível");
  });
});
