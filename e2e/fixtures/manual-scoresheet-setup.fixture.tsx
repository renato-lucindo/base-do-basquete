// Fixture isolada do componente: não é rota da aplicação e não acessa Supabase.
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router";
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
    ],
  },
  {
    id: 20,
    teamName: "Equipe Vermelha",
    previous: [],
    roster: [{ rosterEntryId: 3, playerName: "Carla Atleta", jerseyNumber: "9" }],
  },
];

const router = createMemoryRouter([
  {
    path: "/",
    element: (
      <ManualScoresheetSetupWizard
        competitionId={100}
        competitionName="Campeonato fixture"
        hasExistingGames={false}
        registrations={registrations}
      />
    ),
  },
]);
const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");
createRoot(root).render(<RouterProvider router={router} />);
