import { data, redirect } from "react-router";
import { AdminArea } from "../components/admin/admin-area";
import { EditionWizard } from "../components/admin/edition-wizard";
import { cloudflareContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";
import {
  disputeName,
  singleWorkflowInput,
  validateEditionBatchWorkflow,
  workflowError,
} from "../modules/competition/edition-workflow";
import type { Route } from "./+types/admin.competitions.new";

function currentYear() {
  return Number(
    new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "America/Sao_Paulo" }).format(
      new Date(),
    ),
  );
}
export function meta() {
  return [{ title: "Criar edição ou disputa — Administração" }];
}
export async function loadWorkflowChoices(
  client: Awaited<ReturnType<typeof requireAdminAal2>>["client"],
) {
  const results = await Promise.all([
    client.from("competition_series").select("id,name").eq("is_active", true).order("name"),
    client.from("categories").select("id,name,age_kind,age_value").eq("is_active", true),
    client
      .from("series_category_data_profiles")
      .select("id,series_id,category_id,gender_division,primary_source,version")
      .eq("status", "active"),
    client
      .from("competition_seasons")
      .select(
        "id,series_id,year,name,description,suggested_starts_on,suggested_ends_on,revision,dispute_navigation_order",
      ),
    client.from("competition_competitive_division_types").select("id,season_id,name"),
    client
      .from("competition_competitive_division_values")
      .select("id,season_id,competitive_division_type_id,name,sort_order")
      .order("sort_order"),
    client
      .from("competition_dispute_contexts")
      .select("competition_id,season_id,category_id,gender_division,competitive_division_value_id"),
  ]);
  const error = results.find((result) => result.error)?.error;
  if (error && !["PGRST205", "42P01", "42703"].includes(error.code))
    throw new Error("Edition choices unavailable");
  return {
    available: !error,
    series: results[0].data ?? [],
    categories: results[1].data ?? [],
    profiles: results[2].data ?? [],
    seasons: results[3].data ?? [],
    divisionTypes: results[4].data ?? [],
    divisions: results[5].data ?? [],
    contexts: results[6].data ?? [],
  };
}
export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const auth = await requireAdminAal2(request, env);
  const choices = await loadWorkflowChoices(auth.client);
  const rawSeason = new URL(request.url).searchParams.get("seasonId");
  if (rawSeason !== null && !/^[1-9]\d{0,8}$/.test(rawSeason))
    throw new Response("Edição inválida", { status: 400 });
  let selectedSeasonId = rawSeason ? Number(rawSeason) : null;
  if (
    choices.available &&
    selectedSeasonId &&
    !choices.seasons.some((season) => season.id === selectedSeasonId)
  ) {
    const resolution = await auth.client.rpc("admin_resolve_competition_season_id", {
      p_season_id: selectedSeasonId,
    });
    if (
      resolution.error ||
      typeof resolution.data !== "number" ||
      !choices.seasons.some((season) => season.id === resolution.data)
    )
      throw new Response("Edição não encontrada", { status: 404 });
    selectedSeasonId = resolution.data;
  }
  return data(
    {
      ...choices,
      selectedSeasonId,
      csrfToken: auth.payload.csrfToken,
      requestId: crypto.randomUUID(),
      currentYear: currentYear(),
    },
    { headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
  );
}
export async function action({ request, context }: Route.ActionArgs) {
  assertSameOrigin(request);
  const { env } = context.get(cloudflareContext);
  const auth = await requireAdminAal2(request, env);
  const form = await request.formData();
  assertCsrfToken(form, auth.payload.csrfToken);
  const intent = form.get("intent");
  if (intent !== "review" && intent !== "create")
    throw new Response("Ação inválida", { status: 400 });
  const headers = auth.cookie ? { "Set-Cookie": auth.cookie } : undefined;
  let raw: unknown = null;
  try {
    const payload = String(form.get("payload") ?? "");
    if (payload.length > 60_000) throw new Error("Payload too large");
    const parsed: unknown = JSON.parse(payload);
    raw =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? { ...parsed, reviewed: intent === "create" && form.get("reviewed") === "on" }
        : null;
  } catch {
    raw = null;
  }
  const validation = validateEditionBatchWorkflow(raw, currentYear());
  if (!validation.ok)
    return data(
      {
        error: validation.error,
        field: validation.field,
        review: null,
        existingSeasonId: null,
        existingCompetitionId: null,
      },
      { status: 400, headers },
    );
  const choices = await loadWorkflowChoices(auth.client);
  if (!choices.available)
    return data(
      {
        error: "O novo fluxo aguarda aplicação autorizada da migration. Nenhum dado foi criado.",
        field: "form",
        review: null,
        existingSeasonId: null,
        existingCompetitionId: null,
      },
      { status: 409, headers },
    );
  const input = validation.input;
  let season = choices.seasons.find((item) => item.id === input.seasonId);
  if (input.seasonId && !season) {
    const resolution = await auth.client.rpc("admin_resolve_competition_season_id", {
      p_season_id: input.seasonId,
    });
    if (!resolution.error && typeof resolution.data === "number")
      season = choices.seasons.find((item) => item.id === resolution.data);
  }
  const championship = choices.series.find(
    (item) => item.id === (season?.series_id ?? input.seriesId),
  );
  if ((input.seasonId && !season) || ((input.seriesId || season) && !championship))
    throw new Response("Contexto indisponível", { status: 404 });
  if (
    season &&
    (season.year !== input.year ||
      season.description !== input.description ||
      season.dispute_navigation_order !== input.navigationOrder)
  ) {
    return data(
      {
        error: "O contexto da edição mudou. Recarregue antes de adicionar a disputa.",
        field: "form",
        review: null,
        existingSeasonId: null,
        existingCompetitionId: null,
      },
      { status: 409, headers },
    );
  }
  const existing = !season
    ? choices.seasons.find((item) => item.series_id === input.seriesId && item.year === input.year)
    : null;
  if (existing && intent === "review")
    return data(
      {
        error: "Essa edição já existe. Adicione uma disputa nela.",
        field: "year",
        review: null,
        existingSeasonId: existing.id,
        existingCompetitionId: null,
      },
      { status: 409, headers },
    );
  const reviewDisputes = [];
  for (const [index, dispute] of input.disputes.entries()) {
    const selectedDivision = choices.divisions.find(
      (item) => item.id === dispute.divisionValueId && item.season_id === season?.id,
    );
    if (dispute.divisionMode === "existing" && !selectedDivision)
      return data(
        {
          error: `Disputa ${index + 1}: selecione uma divisão dessa edição.`,
          field: `disputes.${index}.divisionValueId`,
          review: null,
          existingSeasonId: null,
          existingCompetitionId: null,
        },
        { status: 400, headers },
      );
    const divisionType = choices.divisionTypes.find(
      (item) => item.id === selectedDivision?.competitive_division_type_id,
    );
    const category = choices.categories.find(
      (item) =>
        item.age_kind === dispute.categoryKind &&
        item.age_value === (dispute.categoryKind === "adult" ? null : dispute.categoryAge),
    );
    const existingDispute =
      season && category && dispute.divisionMode !== "new"
        ? choices.contexts.find(
            (item) =>
              item.season_id === season.id &&
              item.category_id === category.id &&
              item.gender_division === dispute.gender &&
              item.competitive_division_value_id === (selectedDivision?.id ?? null),
          )
        : null;
    if (existingDispute)
      return data(
        {
          error: `Disputa ${index + 1}: essa combinação já existe na edição.`,
          field: `disputes.${index}.categoryKind`,
          review: null,
          existingSeasonId: null,
          existingCompetitionId: existingDispute.competition_id,
        },
        { status: 409, headers },
      );
    const name = disputeName(
      season?.name ?? championship?.name ?? input.championshipName ?? "",
      dispute.categoryKind,
      dispute.categoryAge,
      dispute.divisionMode === "new"
        ? `${dispute.divisionTypeName} ${dispute.divisionValueName}`
        : selectedDivision
          ? `${divisionType?.name} ${selectedDivision.name}`
          : undefined,
    );
    if (name.length > 160)
      return data(
        {
          error: `Disputa ${index + 1}: o nome composto deve ter até 160 caracteres.`,
          field: `disputes.${index}.divisionValueName`,
          review: null,
          existingSeasonId: null,
          existingCompetitionId: null,
        },
        { status: 400, headers },
      );
    const summary = validation.summaries[index];
    if (!summary) throw new Error("Edition batch validation summary missing");
    reviewDisputes.push({ input: dispute, name, summary });
  }
  const review = { input, disputes: reviewDisputes };
  if (intent === "review")
    return data(
      {
        error: null,
        field: null,
        review,
        existingSeasonId: null,
        existingCompetitionId: null,
      },
      { headers },
    );
  const requestId = String(form.get("requestId") ?? "");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId) ||
    !input.reviewed
  ) {
    return data(
      {
        error: "Confirme a revisão ou recarregue o formulário.",
        field: "reviewed",
        review,
        existingSeasonId: null,
        existingCompetitionId: null,
      },
      { status: 400, headers },
    );
  }
  const firstDispute = input.disputes[0];
  if (!firstDispute) throw new Error("Validated edition batch is empty");
  const result = input.seasonId
    ? await auth.client.rpc("admin_add_competition_dispute", {
        p_request_id: requestId,
        p_input: { ...singleWorkflowInput(input, firstDispute) },
      })
    : await auth.client.rpc("admin_create_competition_edition_batch", {
        p_request_id: requestId,
        p_input: {
          ...input,
          disputes: input.disputes.map((dispute) => ({ ...dispute })),
        },
      });
  const resultObject =
    result.data && typeof result.data === "object" && !Array.isArray(result.data)
      ? result.data
      : null;
  const competitionId = resultObject?.competitionId;
  if (
    result.error ||
    typeof competitionId !== "number" ||
    !Number.isSafeInteger(competitionId) ||
    competitionId < 1
  ) {
    return data(
      {
        error: workflowError(result.error?.code, result.error?.message),
        field: "form",
        review,
        existingSeasonId:
          result.error?.message === "BDB_COMPETITION_SEASON_CONFLICT"
            ? (existing?.id ?? null)
            : null,
        existingCompetitionId: null,
      },
      { status: 409, headers },
    );
  }
  throw redirect(
    input.seasonId || input.disputes.length === 1
      ? `/admin/competitions/${competitionId}`
      : "/admin/competitions",
    { headers },
  );
}
export default function NewCompetition({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <AdminArea title={loaderData.selectedSeasonId ? "Adicionar disputa" : "Criar edição"}>
      <EditionWizard
        key={loaderData.selectedSeasonId ?? "create"}
        choices={loaderData}
        result={actionData}
      />
    </AdminArea>
  );
}
