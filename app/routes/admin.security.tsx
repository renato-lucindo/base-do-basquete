import { data, Form } from "react-router";
import { AdminArea } from "../components/admin/admin-area";
import { cloudflareContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { usesPreviewPasswordAuth } from "../modules/auth/preview-password.server";
import type { Route } from "./+types/admin.security";
export function meta() {
  return [{ title: "Segurança — Administração" }];
}
export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const auth = await requireAdminAal2(request, env);
  return data(
    { csrfToken: auth.payload.csrfToken, passwordOnlyPreview: usesPreviewPasswordAuth(env) },
    { headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
  );
}
export default function Security({ loaderData }: Route.ComponentProps) {
  return (
    <AdminArea title="Segurança">
      <p>
        {loaderData.passwordOnlyPreview
          ? "Acesso por senha autorizado neste ambiente de preview."
          : "Autenticação em dois fatores verificada. Esta sessão pode acessar a administração."}
      </p>
      <Form method="post" action="/admin/logout">
        <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
        <button className="button button-ghost" type="submit">
          Encerrar todas as sessões
        </button>
      </Form>
    </AdminArea>
  );
}
