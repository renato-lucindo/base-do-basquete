import { data, Form, Link, redirect, useNavigation } from "react-router";
import { AdminArea } from "../components/admin/admin-area";
import { cloudflareContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";
import { scheduleId } from "../modules/competition/scheduling";
import {
  type PublicationReview,
  publicationBlocker,
  publicationError,
  validatePublication,
} from "../modules/competition/publication";
import type { Route } from "./+types/admin.competitions.$competitionId.publication";

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const auth = await requireAdminAal2(request, context.get(cloudflareContext).env);
  const competitionId = scheduleId(params.competitionId);
  if (!competitionId) throw new Response("Edição não encontrada", { status: 404 });
  const [edition, review] = await Promise.all([
    auth.client
      .from("competitions")
      .select("id,display_name,status,starts_on")
      .eq("id", competitionId)
      .single(),
    auth.client.rpc("admin_get_publication_review", { p_competition_id: competitionId }),
  ]);
  if (edition.error) throw new Response("Edição não encontrada", { status: 404 });
  if (review.error)
    throw new Response("Revisão editorial indisponível. Tente novamente.", { status: 503 });
  return data(
    {
      edition: edition.data,
      review: review.data as unknown as PublicationReview,
      csrfToken: auth.payload.csrfToken,
    },
    { headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
  );
}

export async function action({ request, params, context }: Route.ActionArgs) {
  assertSameOrigin(request);
  const auth = await requireAdminAal2(request, context.get(cloudflareContext).env);
  const competitionId = scheduleId(params.competitionId);
  if (!competitionId) throw new Response("Edição não encontrada", { status: 404 });
  const form = await request.formData();
  assertCsrfToken(form, auth.payload.csrfToken);
  const headers = auth.cookie ? { "Set-Cookie": auth.cookie } : undefined;
  const parsed = validatePublication(form);
  if (!parsed.ok) return data({ error: parsed.error }, { status: 400, headers });
  const edition = await auth.client
    .from("competitions")
    .select("id")
    .eq("id", competitionId)
    .maybeSingle();
  if (edition.error || !edition.data) throw new Response("Edição não encontrada", { status: 404 });
  const result = await auth.client.rpc("admin_publish_competition", {
    p_competition_id: competitionId,
    p_expected_version: parsed.input.expectedVersion,
    p_confirmed: true,
  });
  if (result.error)
    return data({ error: publicationError(result.error.code) }, { status: 400, headers });
  return redirect(`/admin/competitions/${competitionId}/publication?saved=1`, { headers });
}

export default function PublicationPage({ loaderData, actionData }: Route.ComponentProps) {
  const { edition, review, csrfToken } = loaderData;
  const busy = useNavigation().state !== "idle";
  return (
    <AdminArea title={`Revisão e publicação — ${edition.display_name}`}>
      <Link to={`/admin/competitions/${edition.id}`}>Voltar ao hub</Link>
      <p>
        A publicação é manual e versionada. Alterações esportivas posteriores ficam privadas até uma
        nova confirmação.
      </p>
      {actionData?.error ? <p role="alert">{actionData.error}</p> : null}
      <section className="admin-card" aria-labelledby="publication-summary">
        <h2 id="publication-summary">Resumo calculado no servidor</h2>
        <dl>
          <div>
            <dt>Versão pública atual</dt>
            <dd>{review.currentVersion || "Ainda não publicada"}</dd>
          </div>
          <div>
            <dt>Equipes confirmadas</dt>
            <dd>{review.confirmedTeams}</dd>
          </div>
          <div>
            <dt>Jogos elegíveis</dt>
            <dd>{review.eligibleGames}</dd>
          </div>
          <div>
            <dt>Posições pendentes</dt>
            <dd>{review.unassignedEntries}</dd>
          </div>
        </dl>
        {review.blockers.length ? (
          <>
            <h3>Pendências</h3>
            <ul>
              {review.blockers.map((blocker) => (
                <li key={blocker}>{publicationBlocker(blocker)}</li>
              ))}
            </ul>
          </>
        ) : review.changed ? (
          <p>A versão {review.nextVersion} está pronta para confirmação.</p>
        ) : (
          <p>A versão pública já corresponde ao estado revisado.</p>
        )}
      </section>
      <Form method="post" className="admin-form">
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <input type="hidden" name="expectedVersion" value={review.currentVersion} />
        <label>
          <input type="checkbox" name="confirmed" value="yes" required />
          Revisei o resumo e confirmo a publicação explícita desta versão.
        </label>
        <button
          type="submit"
          className="button button-primary"
          disabled={busy || !review.canPublish || !review.changed}
        >
          Publicar versão {review.nextVersion}
        </button>
      </Form>
    </AdminArea>
  );
}
