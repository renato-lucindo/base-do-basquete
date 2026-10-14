// Isolated component fixture: never an application route, never connected to Supabase.
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider, useActionData } from "react-router";
import { AdminEditionList } from "../../app/components/admin/admin-edition-list";
import {
  EditionWizard,
  type EditionChoices,
  type EditionResult,
} from "../../app/components/admin/edition-wizard";
import {
  disputeName,
  validateEditionBatchWorkflow,
} from "../../app/modules/competition/edition-workflow";
import "../../app/app.css";
const addition = new URLSearchParams(location.search).has("add");
const table = new URLSearchParams(location.search).has("table");
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
      dispute_navigation_order: "category_division",
    },
  ],
  divisionTypes: [{ id: 3, season_id: 7, name: "Série" }],
  divisions: [
    { id: 4, season_id: 7, competitive_division_type_id: 3, name: "Ouro", sort_order: 1 },
  ],
  contexts: [],
};
function Fixture() {
  const result = useActionData<EditionResult>();
  if (table)
    return (
      <main className="admin-area">
        <h1>Competições</h1>
        <AdminEditionList
          groups={[
            {
              id: "7",
              name: "Copa Metropolitana",
              year: 2026,
              seasonId: 7,
              navigationOrder: "division_category",
              competitions: [
                {
                  id: 11,
                  display_name: "Copa Metropolitana - Sub-15 · Série Ouro",
                  status: "draft",
                  dimensionCategoryName: "Sub-15",
                  dimensionGender: "female",
                  divisionLabel: "Série Ouro",
                  divisionSortOrder: 1,
                },
                {
                  id: 12,
                  display_name: "Copa Metropolitana - Sub-17 · Série Prata",
                  status: "published",
                  dimensionCategoryName: "Sub-17",
                  dimensionGender: "male",
                  divisionLabel: "Série Prata",
                  divisionSortOrder: 2,
                },
              ],
            },
          ]}
        />
      </main>
    );
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
          existingCompetitionId: null,
        };
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(String(form.get("payload") ?? ""));
      } catch {
        parsed = null;
      }
      const validated = validateEditionBatchWorkflow(parsed, 2026);
      if (!validated.ok)
        return {
          error: validated.error,
          field: validated.field,
          review: null,
          existingSeasonId: null,
          existingCompetitionId: null,
        };
      const input = validated.input;
      return {
        error: null,
        field: null,
        existingSeasonId: null,
        existingCompetitionId: null,
        review: {
          input,
          disputes: input.disputes.map((dispute, index) => {
            const summary = validated.summaries[index];
            if (!summary) throw new Error("Fixture validation summary missing");
            return {
              input: dispute,
              summary,
              name: disputeName(
                input.championshipName ?? "RED",
                dispute.categoryKind,
                dispute.categoryAge,
                dispute.divisionMode === "new"
                  ? `${dispute.divisionTypeName} ${dispute.divisionValueName}`
                  : dispute.divisionMode === "existing"
                    ? "Série Ouro"
                    : undefined,
              ),
            };
          }),
        },
      };
    },
  },
]);
const root = document.getElementById("root");
if (!root) throw new Error("Fixture root missing");
createRoot(root).render(<RouterProvider router={router} />);
