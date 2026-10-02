import { data, Form, redirect } from "react-router";
import { AdminArea } from "../components/admin/admin-area";
import { cloudflareContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";
import { normalizeTeamCreationInput } from "../modules/competition/team-creation";
import type { Route } from "./+types/admin.teams";

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
  const normalized = normalizeTeamCreationInput(formData.get("name"), formData.get("abbreviation"));
  if (!normalized.ok) {
    return data(
      { error: normalized.error },
      { status: 400, headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
    );
  }
  const { error } = await auth.client.rpc("admin_create_team", {
    p_name: normalized.input.name,
    p_abbreviation: normalized.input.abbreviation as string,
  });
  if (error) {
    return data(
      {
        error:
          error.code === "BD102" ? "Revise o nome e a sigla da equipe." : "Falha ao criar equipe.",
      },
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
      <ul className="admin-team-list">
        {loaderData.teams.map((team) => (
          <li key={team.id}>
            <strong>{team.name}</strong>
            {team.abbreviation ? <small>{team.abbreviation}</small> : null}
          </li>
        ))}
      </ul>
      {loaderData.teams.length === 0 ? <p>Nenhuma equipe encontrada.</p> : null}
      <section className="admin-panel">
        <h2>Cadastrar equipe</h2>
        <p>Informe apenas os dados públicos. O endereço técnico é gerado no servidor.</p>
        <Form method="post" className="compact-admin-form">
          <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
          <input type="hidden" name="intent" value="create-team" />
          <label>
            Nome
            <input required name="name" minLength={2} maxLength={120} />
          </label>
          <label>
            Sigla
            <input name="abbreviation" maxLength={8} pattern="[A-Za-z0-9]{2,8}" />
          </label>
          <p>O endereço técnico é gerado automaticamente e colisões são resolvidas no servidor.</p>
          <button className="button button-primary" type="submit">
            Criar equipe
          </button>
        </Form>
      </section>
    </AdminArea>
  );
}
