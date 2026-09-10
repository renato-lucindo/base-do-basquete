import { data, Form, redirect } from "react-router";
import { AdminArea } from "../components/admin/admin-area";
import { cloudflareContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";
import type { Route } from "./+types/admin.teams";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function meta() {
  return [{ title: "Equipes — Administração" }];
}
export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const auth = await requireAdminAal2(request, env);
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  const result = await auth.client
    .from("teams")
    .select("id,name,slug,abbreviation")
    .ilike("name", pattern)
    .order("name")
    .limit(50);
  if (result.error) throw new Error("Administrative teams query failed");
  return data(
    {
      csrfToken: auth.payload.csrfToken,
      query,
      teams: result.data,
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

  if (intent !== "create-team") throw new Response("Ação inválida", { status: 400 });
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  if (name.length < 2 || !slugPattern.test(slug)) {
    return data(
      { error: "Informe um nome e um slug minúsculo válido." },
      { status: 400, headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
    );
  }
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

  throw redirect("/admin/teams", {
    headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined,
  });
}
export default function Teams({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <AdminArea title="Equipes">
      {actionData?.error ? (
        <p role="alert" className="form-error">
          {actionData.error}
        </p>
      ) : null}
      <Form method="get" className="inline-admin-form">
        <label>
          Buscar por nome
          <input name="q" maxLength={80} defaultValue={loaderData.query} />
        </label>
        <button className="button button-ghost" type="submit">
          Buscar
        </button>
      </Form>
      <p>Até 50 equipes por busca.</p>
      <ul>
        {loaderData.teams.map((team) => (
          <li key={team.id}>
            {team.name}
            {team.abbreviation ? ` · ${team.abbreviation}` : ""}
          </li>
        ))}
      </ul>
      {loaderData.teams.length === 0 ? <p>Nenhuma equipe encontrada.</p> : null}
      <details open={Boolean(actionData?.error)}>
        <summary>Criar equipe</summary>{" "}
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
      </details>
    </AdminArea>
  );
}
