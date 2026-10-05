import { data, Form, Link } from "react-router";
import { AdminArea } from "../components/admin/admin-area";
import { cloudflareContext, correlationIdContext } from "../context";
import { recordAuthAuditEvent } from "../modules/auth/audit.server";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import type { Route } from "./+types/admin.competitions";

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  review: "Aguardando validação",
  published: "Publicada",
  archived: "Arquivada",
};
export function meta() {
  return [{ title: "Competições — Administração" }];
}
export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const correlationId = context.get(correlationIdContext);
  const auth = await requireAdminAal2(request, env);
  await recordAuthAuditEvent(auth.client, "admin_access", correlationId);

  const [competitionsResult, seriesResult, categoriesResult] = await Promise.all([
    auth.client
      .from("competitions")
      .select("id,display_name,year,status,series_id,category_id,gender_division")
      .order("year", { ascending: false })
      .order("id", { ascending: false }),
    auth.client.from("competition_series").select("id,name"),
    auth.client.from("categories").select("id,name"),
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
    .select("competition_id,season_id,season_name");
  if (contexts.error && !["PGRST205", "42P01"].includes(contexts.error.code))
    throw new Error("Edition grouping unavailable");
  const contextById = new Map((contexts.data ?? []).map((row) => [row.competition_id, row]));

  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim().slice(0, 80);
  const year = params.get("year") ?? "";
  const status = params.get("status") ?? "";
  const years = [...new Set(competitions.map((item) => item.year))];
  const filtered = competitions.filter(
    (item) =>
      (!year || String(item.year) === year) &&
      (!status || item.status === status) &&
      [item.display_name, item.seriesName, item.categoryName]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(query.toLocaleLowerCase("pt-BR")),
  );
  const groups = new Map<
    string,
    {
      name: string;
      year: number;
      gender: string | null;
      seasonId: number | null;
      competitions: typeof competitions;
    }
  >();
  for (const competition of filtered) {
    const dimension = contextById.get(competition.id);
    const key = dimension?.season_id
      ? String(dimension.season_id)
      : `legacy-${competition.series_id}-${competition.year}-${competition.gender_division}`;
    const group = groups.get(key) ?? {
      name: dimension?.season_name ?? competition.seriesName,
      year: competition.year,
      gender: competition.gender_division,
      seasonId: dimension?.season_id ?? null,
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
        Cada edição reúne as disputas de um campeonato, ano e naipe. Abra uma disputa para organizar
        equipes, jogos e dados.
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
            {Object.entries(statusLabels).map(([value, label]) => (
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
      <div className="admin-edition-list">
        {loaderData.groups.map((group) => (
          <section key={group.id} aria-label={`${group.name} ${group.year}`}>
            <h2>
              {group.name} · {group.year} ·{" "}
              {group.gender === "male"
                ? "Masculino"
                : group.gender === "female"
                  ? "Feminino"
                  : "Naipe pendente"}
            </h2>
            {group.seasonId ? (
              <Link to={`/admin/competitions/new?seasonId=${group.seasonId}`}>
                Adicionar disputa
              </Link>
            ) : null}
            <ul>
              {group.competitions.map((item) => (
                <li key={item.id}>
                  <Link to={`/admin/competitions/${item.id}`}>{item.display_name}</Link> ·{" "}
                  {item.categoryName} · {statusLabels[item.status] ?? "Em revisão"}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </AdminArea>
  );
}
