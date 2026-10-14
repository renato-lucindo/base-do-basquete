import { data, redirect } from "react-router";
import { AdminArea } from "../components/admin/admin-area";
import { EditionWizard } from "../components/admin/edition-wizard";
import { cloudflareContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";
import {
  disputeName,
  validateEditionWorkflow,
  workflowError,
  workflowInputFromForm,
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
      .select("id,series_id,year,name,description,suggested_starts_on,suggested_ends_on,revision"),
    client.from("competition_competitive_division_types").select("id,season_id,name"),
    client
      .from("competition_competitive_division_values")
      .select("id,season_id,competitive_division_type_id,name,sort_order")
      .order("sort_order"),
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
  let raw: unknown = workflowInputFromForm(form);
  if (intent === "create") {
    try {
      const payload = String(form.get("payload") ?? "");
      if (payload.length > 7000) throw new Error("Payload too large");
      const parsed: unknown = JSON.parse(payload);
      raw =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? { ...parsed, reviewed: form.get("reviewed") === "on" }
          : null;
    } catch {
      raw = null;
    }
  }
  const validation = validateEditionWorkflow(raw, currentYear());
  if (!validation.ok)
    return data(
      { error: validation.error, field: validation.field, review: null, existingSeasonId: null },
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
  if (season && (season.year !== input.year || season.description !== input.description)) {
    return data(
      {
        error: "O contexto da edição mudou. Recarregue antes de adicionar a disputa.",
        field: "form",
        review: null,
        existingSeasonId: null,
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
      },
      { status: 409, headers },
    );
  const selectedDivision = choices.divisions.find(
    (item) => item.id === input.divisionValueId && item.season_id === season?.id,
  );
  if (input.divisionMode === "existing" && !selectedDivision)
    return data(
      {
        error: "Selecione uma divisão dessa edição.",
        field: "divisionValueId",
        review: null,
        existingSeasonId: null,
      },
      { status: 400, headers },
    );
  const divisionType = choices.divisionTypes.find(
    (item) => item.id === selectedDivision?.competitive_division_type_id,
  );
  const name = disputeName(
    season?.name ?? championship?.name ?? input.championshipName ?? "",
    input.categoryKind,
    input.categoryAge,
    input.divisionMode === "new"
      ? `${input.divisionTypeName} ${input.divisionValueName}`
      : selectedDivision
        ? `${divisionType?.name} ${selectedDivision.name}`
        : undefined,
  );
  if (name.length > 160)
    return data(
      {
        error:
          "O nome composto da disputa deve ter até 160 caracteres. Reduza o nome ou a divisão.",
        field: "form",
        review: null,
        existingSeasonId: null,
      },
      { status: 400, headers },
    );
  const review = { ...validation, name };
  if (intent === "review")
    return data({ error: null, field: null, review, existingSeasonId: null }, { headers });
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
      },
      { status: 400, headers },
    );
  }
  const result = await auth.client.rpc(
    input.seasonId ? "admin_add_competition_dispute" : "admin_create_competition_edition",
    { p_request_id: requestId, p_input: { ...input } },
  );
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
      },
      { status: 409, headers },
    );
  }
  throw redirect(`/admin/competitions/${competitionId}`, { headers });
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
