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
  return data(
    {
      csrfToken: auth.payload.csrfToken,
      competitions: filtered,
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
      <p>Selecione uma edição para organizar equipes, jogos e dados.</p>
      <Form method="get" className="inline-admin-form">
        <label>
          Buscar por nome, série ou categoria
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
      <div className="admin-competition-grid">
        {loaderData.competitions.map((item) => (
          <Link key={item.id} to={`/admin/competitions/${item.id}`}>
            <span>
              {item.year} · {statusLabels[item.status] ?? "Em revisão"}
            </span>
            <strong>{item.display_name}</strong>
            <small>
              {item.seriesName} · {item.categoryName} ·{" "}
              {item.gender_division === "male"
                ? "Masculino"
                : item.gender_division === "female"
                  ? "Feminino"
                  : "Naipe pendente"}
            </small>
          </Link>
        ))}
      </div>
    </AdminArea>
  );
}
