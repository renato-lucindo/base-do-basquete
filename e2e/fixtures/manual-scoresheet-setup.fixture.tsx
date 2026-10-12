// Fixture isolada do componente: não é rota da aplicação e não acessa Supabase.
import { createRoot } from "react-dom/client";
import { createMemoryRouter, Link, RouterProvider, useParams } from "react-router";
import type { ScoresheetRegistration } from "../../app/modules/scoresheet/editor";
import { ManualScoresheetSetupWizard } from "../../app/modules/scoresheet/setup-wizard";
import { buildSetupConfirmation } from "../../app/modules/scoresheet/setup-confirmation";
import { createScoresheetSetup } from "../../app/modules/scoresheet/setup-state";
import { SavedScoresheetHistoryView } from "../../app/modules/scoresheet/saved-snapshot";
import { FOUL_RULES_VERSION } from "../../app/modules/scoresheet/domain";
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
        requiresFallbackReason={id === 200}
      />
    </>
  );
}

const saved = createScoresheetSetup();
saved.game = { date: "2026-10-12", venue: "Ginásio original", notes: "Versão original" };
saved.registrationIds = { home: 10, away: 20 };
saved.slots.home[0] = { slotNumber: 1, rosterEntryId: 1, jerseyNumber: "7", isCaptain: true };
saved.slots.away[0] = { slotNumber: 1, rosterEntryId: 3, jerseyNumber: "9", isCaptain: true };
saved.staff.home.coach = { role: "coach", name: "Treinador Azul", origin: "manual" };
saved.staff.away.coach = { role: "coach", name: "Treinador Vermelho", origin: "manual" };
saved.stats["home-1-4-two"] = "1";
saved.fouls = [
  {
    periodNumber: 4,
    sequenceNumber: 1,
    type: "T",
    penaltyFtCount: 1,
    originalNotation: "T1",
    rulesVersion: FOUL_RULES_VERSION,
    target: { kind: "player", registrationId: 10, rosterEntryId: 1 },
  },
];
const savedPayload = buildSetupConfirmation(saved, 100).payload!;

function FixtureRevision() {
  const { submissionId } = useParams();
  return (
    <>
      <nav aria-label="Versões de teste">
        <Link to="/revision/80">Versão ativa</Link>
        {" · "}
        <Link to="/revision/81">Versão atualizada</Link>
        {" · "}
        <Link to="/history/79">Consultar versão anterior</Link>
      </nav>
      <ManualScoresheetSetupWizard
        competitionId={100}
        competitionName="Campeonato fixture"
        registrations={registrations}
        hasExistingGames={false}
        csrfToken="fixture-csrf"
        revision={{
          gameId: 42,
          submissionId: Number(submissionId),
          version: Number(submissionId) - 78,
          payloadHash: "a".repeat(32),
          payload: savedPayload,
        }}
      />
    </>
  );
}
const router = createMemoryRouter(
  [
    {
      path: "/revision/:submissionId",
      Component: FixtureRevision,
      action: async ({ request }) => {
        const form = await request.formData();
        const setup = JSON.parse(String(form.get("setup")));
        const keys = JSON.parse(
          sessionStorage.getItem("fixture-submission-keys") ?? "[]",
        ) as string[];
        sessionStorage.setItem(
          "fixture-submission-keys",
          JSON.stringify([...keys, setup.submissionKey]),
        );
        if (
          form.get("intent") !== "revise-manual-v2" ||
          form.get("revisionConfirmed") !== "true" ||
          setup.revisionReason.trim().length < 10
        )
          return { error: "Confirmação inválida" };
        if (sessionStorage.getItem("fixture-fail-confirm") === "1")
          return { error: "Outra versão foi salva. Seu rascunho foi preservado." };
        return { confirmedGameId: 42 };
      },
      shouldRevalidate: () => false,
    },
    {
      path: "/history/:submissionId",
      element: (
        <>
          <SavedScoresheetHistoryView
            title="Versão anterior — somente consulta"
            payload={savedPayload}
            registrations={registrations}
          />
          <nav aria-label="Navegação de versões">
            <Link to="/revision/80">Abrir versão ativa</Link>
          </nav>
        </>
      ),
    },
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
  {
    initialEntries: [
      new URLSearchParams(window.location.search).has("revision")
        ? "/revision/80"
        : "/competition/100",
    ],
  },
);
const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");
createRoot(root).render(<RouterProvider router={router} />);
