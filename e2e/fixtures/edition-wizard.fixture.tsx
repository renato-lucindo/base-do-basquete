// Isolated component fixture: never an application route, never connected to Supabase.
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider, useActionData } from "react-router";
import {
  EditionWizard,
  type EditionChoices,
  type EditionResult,
} from "../../app/components/admin/edition-wizard";
import {
  disputeName,
  validateEditionWorkflow,
  workflowInputFromForm,
} from "../../app/modules/competition/edition-workflow";
import "../../app/app.css";
const addition = new URLSearchParams(location.search).has("add");
const choices: EditionChoices = {
  available: true,
  selectedSeasonId: addition ? 7 : null,
  csrfToken: "fixture-csrf",
  requestId: "f2ed0da8-dd87-44dd-9c3a-6b788711e550",
  currentYear: 2026,
  series: [{ id: 1, name: "RED" }],
  categories: [{ id: 2, name: "Adulto", age_kind: "adult", age_value: null }],
  profiles: [],
  seasons: [
    {
      id: 7,
      series_id: 1,
      name: "RED",
      year: 2026,
      description: null,
      suggested_starts_on: "2026-11-01",
      suggested_ends_on: null,
    },
  ],
  divisionTypes: [{ id: 3, season_id: 7, name: "Série" }],
  divisions: [
    { id: 4, season_id: 7, competitive_division_type_id: 3, name: "Ouro", sort_order: 1 },
  ],
};
function Fixture() {
  const result = useActionData<EditionResult>();
  return (
    <main className="admin-area">
      <h1>{addition ? "Adicionar disputa" : "Criar edição"}</h1>
      <EditionWizard choices={choices} result={result} />
    </main>
  );
}
const router = createMemoryRouter([
  {
    path: "/",
    element: <Fixture />,
    action: async ({ request }) => {
      const form = await request.formData();
      if (form.get("intent") === "create")
        return {
          error: "Confirmação exercitada apenas na fixture; nenhum banco foi alterado.",
          field: "form",
          review: null,
          existingSeasonId: null,
        };
      const validated = validateEditionWorkflow(workflowInputFromForm(form), 2026);
      if (!validated.ok)
        return {
          error: validated.error,
          field: validated.field,
          review: null,
          existingSeasonId: null,
        };
      const input = validated.input;
      const division =
        input.divisionMode === "new"
          ? `${input.divisionTypeName} ${input.divisionValueName}`
          : input.divisionMode === "existing"
            ? "Série Ouro"
            : undefined;
      return {
        error: null,
        field: null,
        existingSeasonId: null,
        review: {
          ...validated,
          name: disputeName(
            input.championshipName ?? "RED",
            input.categoryKind,
            input.categoryAge,
            division,
          ),
        },
      };
    },
  },
]);
const root = document.getElementById("root");
if (!root) throw new Error("Fixture root missing");
createRoot(root).render(<RouterProvider router={router} />);
