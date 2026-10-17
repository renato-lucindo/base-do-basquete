import { data, Form, Link } from "react-router";
import { AdminArea } from "../components/admin/admin-area";
import { AdminEditionList, competitionStatusLabels } from "../components/admin/admin-edition-list";
import { cloudflareContext, correlationIdContext } from "../context";
import { recordAuthAuditEvent } from "../modules/auth/audit.server";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import type { Route } from "./+types/admin.competitions";

async function loadNavigationBySeason(
  client: Awaited<ReturnType<typeof requireAdminAal2>>["client"],
) {
  const current = await client.from("competition_seasons").select("id,dispute_navigation_order");
  if (!current.error)
    return new Map(current.data.map((row) => [row.id, row.dispute_navigation_order]));

  // The shared preview database can still have the season schema from before
  // the multi-dispute migration. Keep the edition list available there.
  if (!["42703", "PGRST204"].includes(current.error.code))
    throw new Error("Administrative dashboard query failed");
  const legacy = await client.from("competition_seasons").select("id");
  if (legacy.error) throw new Error("Administrative dashboard query failed");
  return new Map(legacy.data.map((row) => [row.id, "category_division"]));
}

export function meta() {
  return [{ title: "Competições — Administração" }];
}
export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const correlationId = context.get(correlationIdContext);
  const auth = await requireAdminAal2(request, env);
  await recordAuthAuditEvent(auth.client, "admin_access", correlationId);

  const [competitionsResult, seriesResult, categoriesResult, navigationBySeason] =
    await Promise.all([
      auth.client
        .from("competitions")
        .select("id,display_name,year,status,series_id,category_id,gender_division")
        .order("year", { ascending: false })
        .order("id", { ascending: false }),
      auth.client.from("competition_series").select("id,name"),
      auth.client.from("categories").select("id,name"),
      loadNavigationBySeason(auth.client),
    ]);

  if (competitionsResult.error || seriesResult.error || categoriesResult.error) {
    throw new Error("Administrative dashboard query failed");
  }

  const seriesNames = new Map(seriesResult.data.map((row) => [row.id, row.name]));
  const categoryNames = new Map(categoriesResult.data.map((row) => [row.id, row.name]));
  const competitions = competitionsResult.data.map((competition) => ({
    ...competition,
    seriesName: seriesNames.get(competition.series_id) ?? "Série indisponível",
    categoryName: categoryNames.get(competition.category_id) ?? "Categoria indisponível",
  }));

  const contexts = await auth.client
    .from("competition_dispute_contexts")
    .select(
      "competition_id,season_id,season_name,category_name,gender_division,competitive_division_type_name,competitive_division_value_name,competitive_division_sort_order",
    );
  if (contexts.error && !["PGRST205", "42P01"].includes(contexts.error.code))
    throw new Error("Edition grouping unavailable");
  const contextById = new Map((contexts.data ?? []).map((row) => [row.competition_id, row]));

  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim().slice(0, 80);
  const year = params.get("year") ?? "";
  const status = params.get("status") ?? "";
  const enriched = competitions.map((competition) => {
    const dimension = contextById.get(competition.id);
    const divisionLabel =
      dimension?.competitive_division_type_name && dimension.competitive_division_value_name
        ? `${dimension.competitive_division_type_name} ${dimension.competitive_division_value_name}`
        : null;
    return {
      ...competition,
      seasonId: dimension?.season_id ?? null,
      seasonName: dimension?.season_name ?? competition.seriesName,
      dimensionCategoryName: dimension?.category_name ?? competition.categoryName,
      dimensionGender: dimension?.gender_division ?? competition.gender_division,
      divisionLabel,
      divisionSortOrder: dimension?.competitive_division_sort_order ?? null,
    };
  });
  const years = [...new Set(enriched.map((item) => item.year))];
  const filtered = enriched.filter(
    (item) =>
      (!year || String(item.year) === year) &&
      (!status || item.status === status) &&
      [item.display_name, item.seriesName, item.dimensionCategoryName, item.divisionLabel]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(query.toLocaleLowerCase("pt-BR")),
  );
  const groups = new Map<
    string,
    {
      name: string;
      year: number;
      seasonId: number | null;
      navigationOrder: string;
      competitions: typeof enriched;
    }
  >();
  for (const competition of filtered) {
    const key = competition.seasonId
      ? String(competition.seasonId)
      : `legacy-${competition.series_id}-${competition.year}`;
    const group = groups.get(key) ?? {
      name: competition.seasonName,
      year: competition.year,
      seasonId: competition.seasonId,
      navigationOrder: competition.seasonId
        ? (navigationBySeason.get(competition.seasonId) ?? "category_division")
        : "category_division",
      competitions: [],
    };
    group.competitions.push(competition);
    groups.set(key, group);
  }
  return data(
    {
      csrfToken: auth.payload.csrfToken,
      competitions: filtered,
      groups: [...groups.entries()].map(([id, group]) => ({ id, ...group })),
      years,
      query,
      year,
      status,
    },
    { headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
  );
}

export default function Competitions({ loaderData }: Route.ComponentProps) {
  return (
    <AdminArea title="Competições">
      <p>
        Cada edição reúne as disputas de um campeonato e ano. Categoria, naipe e divisão identificam
        cada disputa.
      </p>
      <Link className="button" to="/admin/competitions/new">
        Criar edição
      </Link>
      <Form method="get" className="inline-admin-form">
        <label>
          Buscar por nome, campeonato ou categoria
          <input name="q" maxLength={80} defaultValue={loaderData.query} />
        </label>
        <label>
          Ano
          <select name="year" defaultValue={loaderData.year}>
            <option value="">Todos</option>
            {loaderData.years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
        <label>
          Situação
          <select name="status" defaultValue={loaderData.status}>
            <option value="">Todas</option>
            {Object.entries(competitionStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="button button-ghost" type="submit">
          Filtrar
        </button>
      </Form>
      {loaderData.competitions.length === 0 ? (
        <p>Nenhuma edição encontrada com esses filtros.</p>
      ) : null}
      <AdminEditionList groups={loaderData.groups} />
    </AdminArea>
  );
}
