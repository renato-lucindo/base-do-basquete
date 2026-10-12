// Fixture isolada do componente: não é rota da aplicação e não acessa Supabase.
import { createRoot } from "react-dom/client";
import { createMemoryRouter, Link, RouterProvider, useParams } from "react-router";
import type { ScoresheetRegistration } from "../../app/modules/scoresheet/editor";
import { ManualScoresheetSetupWizard } from "../../app/modules/scoresheet/setup-wizard";
import "../../app/app.css";

const registrations: ScoresheetRegistration[] = [
  {
    id: 10,
    teamName: "Equipe Azul",
    previous: [],
    roster: [
      { rosterEntryId: 1, playerName: "Ana Atleta", jerseyNumber: "7" },
      { rosterEntryId: 2, playerName: "Bruna Atleta", jerseyNumber: "8" },
      { rosterEntryId: 4, playerName: "Davi Atleta", jerseyNumber: "12" },
      { rosterEntryId: 5, playerName: "Eva Atleta", jerseyNumber: "00" },
    ],
  },
  {
    id: 20,
    teamName: "Equipe Vermelha",
    previous: [],
    roster: [{ rosterEntryId: 3, playerName: "Carla Atleta", jerseyNumber: "9" }],
  },
];

function FixtureWizard() {
  const { competitionId } = useParams();
  const id = Number(competitionId);
  return (
    <>
      <nav aria-label="Navegação de teste">
        <Link to="/competition/100">Competição 100</Link>
        <Link to="/competition/200">Competição 200</Link>
        <Link to="/done">Sair da configuração</Link>
      </nav>
      <ManualScoresheetSetupWizard
        competitionId={id}
        competitionName={"Campeonato fixture " + id}
        hasExistingGames={false}
        registrations={registrations}
        csrfToken="fixture-csrf"
      />
    </>
  );
}

const router = createMemoryRouter(
  [
    {
      path: "/competition/:competitionId",
      Component: FixtureWizard,
      action: async ({ request }) => {
        const form = await request.formData();
        if (form.get("intent") !== "confirm-manual-v2" || form.get("csrfToken") !== "fixture-csrf")
          return { error: "Requisição de teste inválida" };
        const setup = JSON.parse(String(form.get("setup")));
        const keys = JSON.parse(
          sessionStorage.getItem("fixture-submission-keys") ?? "[]",
        ) as string[];
        sessionStorage.setItem(
          "fixture-submission-keys",
          JSON.stringify([...keys, setup.submissionKey]),
        );
        if (sessionStorage.getItem("fixture-fail-confirm") === "1")
          return { error: "Falha de gravação simulada" };
        return { confirmedGameId: 42 };
      },
    },
    {
      path: "/done",
      element: (
        <>
          <p>Outra tela</p>
          <Link to="/competition/100">Voltar à competição 100</Link>
        </>
      ),
    },
  ],
  { initialEntries: ["/competition/100"] },
);
const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");
createRoot(root).render(<RouterProvider router={router} />);
