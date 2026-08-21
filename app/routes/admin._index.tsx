import { data, Form, Link, redirect } from "react-router";

import type { Route } from "./+types/admin._index";
import { cloudflareContext, correlationIdContext } from "../context";
import { recordAuthAuditEvent } from "../modules/auth/audit.server";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function meta() {
  return [{ title: "Administração — Base do Basquete" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const correlationId = context.get(correlationIdContext);
  const auth = await requireAdminAal2(request, env);
  await recordAuthAuditEvent(auth.client, "admin_access", correlationId);

  const [competitionsResult, seriesResult, categoriesResult, teamsResult, playersResult] =
    await Promise.all([
      auth.client
        .from("competitions")
        .select("id,display_name,year,status,series_id,category_id")
        .order("year", { ascending: false })
        .order("id", { ascending: false }),
      auth.client.from("competition_series").select("id,name"),
      auth.client.from("categories").select("id,name"),
      auth.client.from("teams").select("id,name,slug,abbreviation").order("name"),
      auth.client.from("players").select("id,full_name,slug").order("full_name"),
    ]);

  if (
    competitionsResult.error ||
    seriesResult.error ||
    categoriesResult.error ||
    teamsResult.error ||
    playersResult.error
  ) {
    throw new Error("Administrative dashboard query failed");
  }

  const seriesNames = new Map(seriesResult.data.map((row) => [row.id, row.name]));
  const categoryNames = new Map(categoriesResult.data.map((row) => [row.id, row.name]));
  const competitions = competitionsResult.data.map((competition) => ({
    ...competition,
    seriesName: seriesNames.get(competition.series_id) ?? "Série indisponível",
    categoryName: categoryNames.get(competition.category_id) ?? "Categoria indisponível",
  }));

  return data(
    {
      csrfToken: auth.payload.csrfToken,
      competitions,
      teams: teamsResult.data,
      players: playersResult.data,
    },
    { headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
  );
}

export async function action({ request, context }: Route.ActionArgs) {
  assertSameOrigin(request);
  const { env } = context.get(cloudflareContext);
  const auth = await requireAdminAal2(request, env);
  const formData = await request.formData();
  assertCsrfToken(formData, auth.payload.csrfToken);
  const intent = formData.get("intent");
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();

  if (name.length < 2 || !slugPattern.test(slug)) {
    return data(
      { error: "Informe um nome e um slug minúsculo válido." },
      { status: 400, headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
    );
  }

  if (intent === "create-team") {
    const abbreviation = String(formData.get("abbreviation") ?? "")
      .trim()
      .toUpperCase();
    const { error } = await auth.client.from("teams").insert({
      name,
      slug,
      abbreviation: abbreviation || null,
      is_public: false,
    });
    if (error) {
      return data(
        { error: error.code === "23505" ? "Essa equipe já existe." : "Falha ao criar equipe." },
        { status: 400, headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
      );
    }
  } else if (intent === "create-player") {
    const { error } = await auth.client.from("players").insert({
      full_name: name,
      slug,
      is_public: false,
    });
    if (error) {
      return data(
        { error: error.code === "23505" ? "Esse atleta já existe." : "Falha ao criar atleta." },
        { status: 400, headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
      );
    }
  } else {
    throw new Response("Ação inválida", { status: 400 });
  }

  throw redirect("/admin", {
    headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined,
  });
}

export default function AdminDashboard({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <main className="admin-shell">
      <header className="site-header admin-header">
        <a className="brand" href="/" aria-label="Base do Basquete — página inicial">
          <span className="brand-mark" aria-hidden="true">
            BB
          </span>
          <span>Base do Basquete</span>
        </a>
        <span className="environment-pill">
          <span className="status-dot" />
          Sessão aal2
        </span>
      </header>

      <section className="admin-welcome admin-dashboard" aria-labelledby="admin-title">
        <p className="eyebrow">Administração segura</p>
        <h1 id="admin-title">Escolha uma edição.</h1>
        <p>O contexto é explícito antes de inscrições, elencos, jogos ou importações.</p>
        {actionData?.error ? <p className="form-error">{actionData.error}</p> : null}

        <div className="admin-competition-grid">
          {loaderData.competitions.map((competition) => (
            <Link key={competition.id} to={`/admin/competitions/${competition.id}`}>
              <span>
                {competition.year} · {competition.status}
              </span>
              <strong>{competition.seriesName}</strong>
              <small>{competition.categoryName}</small>
            </Link>
          ))}
        </div>

        <div className="admin-global-grid">
          <section>
            <h2>Gestão global de equipes</h2>
            <p>{loaderData.teams.length} cadastradas</p>
            <Form method="post" className="compact-admin-form">
              <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
              <input type="hidden" name="intent" value="create-team" />
              <label>
                Nome
                <input required name="name" />
              </label>
              <label>
                Slug
                <input required name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" />
              </label>
              <label>
                Sigla
                <input name="abbreviation" maxLength={8} />
              </label>
              <button className="button button-primary" type="submit">
                Criar equipe
              </button>
            </Form>
          </section>
          <section>
            <h2>Gestão global de atletas</h2>
            <p>{loaderData.players.length} cadastrados</p>
            <Form method="post" className="compact-admin-form">
              <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
              <input type="hidden" name="intent" value="create-player" />
              <label>
                Nome completo
                <input required name="name" />
              </label>
              <label>
                Slug
                <input required name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" />
              </label>
              <button className="button button-primary" type="submit">
                Criar atleta
              </button>
            </Form>
          </section>
        </div>

        <Form method="post" action="/admin/logout">
          <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
          <button className="button button-ghost" type="submit">
            Encerrar todas as sessões
          </button>
        </Form>
      </section>
    </main>
  );
}
