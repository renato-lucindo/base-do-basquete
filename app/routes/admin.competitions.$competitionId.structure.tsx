import {
  type ActionFunctionArgs,
  data,
  Form,
  Link,
  type LoaderFunctionArgs,
  redirect,
  useNavigation,
} from "react-router";
import { AdminArea } from "../components/admin/admin-area";
import { cloudflareContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";
import {
  isRulesetCloneRequestId,
  parseRulesetCloneResult,
  parseRulesetCloneSource,
  type RulesetCloneSource,
  rulesetCloneError,
} from "../modules/competition/ruleset-clone";

interface RevisionSummary {
  id: number;
  revision_number: number;
  status: string;
  structure_kind: string;
  cloned_from_revision_id: number | null;
  cloned_from_gender_division: string | null;
  gender_recompiled: boolean;
}

interface StructureLoaderData {
  competition: {
    id: number;
    display_name: string;
    year: number;
    status: string;
    gender_division: string | null;
  };
  revisions: RevisionSummary[];
  draft: RevisionSummary | null;
  sources: RulesetCloneSource[];
  includeOtherGender: boolean;
  requestId: string;
  csrfToken: string;
  clonedRevisionId: number | null;
}

function id(value: unknown) {
  const text = typeof value === "string" ? value : "";
  const parsed = /^[1-9][0-9]*$/.test(text) ? Number(text) : 0;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function meta() {
  return [{ title: "Estrutura da edição — Administração" }];
}

export async function loader({ request, params, context }: LoaderFunctionArgs) {
  const competitionId = id(params.competitionId);
  if (!competitionId) throw new Response("Edição não encontrada", { status: 404 });
  const auth = await requireAdminAal2(request, context.get(cloudflareContext).env);
  const [competition, revisions] = await Promise.all([
    auth.client
      .from("competitions")
      .select("id,display_name,year,status,gender_division")
      .eq("id", competitionId)
      .maybeSingle(),
    auth.client
      .from("competition_ruleset_revisions")
      .select(
        "id,revision_number,status,structure_kind,cloned_from_revision_id,cloned_from_gender_division,gender_recompiled",
      )
      .eq("competition_id", competitionId)
      .order("revision_number", { ascending: false }),
  ]);
  if (competition.error || !competition.data)
    throw new Response("Edição não encontrada", { status: 404 });
  if (revisions.error) throw new Response("Estrutura indisponível", { status: 503 });

  const url = new URL(request.url);
  const includeOtherGender = url.searchParams.get("includeOtherGender") === "1";
  const draft = revisions.data.find((revision) => revision.status === "draft") ?? null;
  let sources: Array<RulesetCloneSource | null> = [];
  if (competition.data.status === "draft" && !draft) {
    const result = await auth.client.rpc("admin_list_ruleset_clone_sources", {
      p_target_competition_id: competitionId,
      p_include_other_gender: includeOtherGender,
    });
    if (result.error) throw new Response("Origens indisponíveis", { status: 503 });
    sources = result.data.map(parseRulesetCloneSource);
    if (sources.some((source) => source === null))
      throw new Response("Contrato de origens inválido", { status: 503 });
  }

  return data(
    {
      competition: competition.data,
      revisions: revisions.data,
      draft,
      sources: sources.filter((source) => source !== null),
      includeOtherGender,
      requestId: crypto.randomUUID(),
      csrfToken: auth.payload.csrfToken,
      clonedRevisionId: id(url.searchParams.get("clonedRevision")),
    },
    { headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
  );
}

export async function action({ request, params, context }: ActionFunctionArgs) {
  assertSameOrigin(request);
  const competitionId = id(params.competitionId);
  if (!competitionId) throw new Response("Edição não encontrada", { status: 404 });
  const auth = await requireAdminAal2(request, context.get(cloudflareContext).env);
  const form = await request.formData();
  assertCsrfToken(form, auth.payload.csrfToken);
  const headers = auth.cookie ? { "Set-Cookie": auth.cookie } : undefined;
  if (form.get("intent") !== "clone-ruleset") throw new Response("Ação inválida", { status: 400 });

  const sourceRevisionId = id(form.get("sourceRevisionId"));
  const requestId = String(form.get("requestId") ?? "");
  if (!sourceRevisionId || !isRulesetCloneRequestId(requestId)) {
    return data({ error: "Selecione novamente uma origem válida." }, { status: 400, headers });
  }
  if (form.get("confirmIndependent") !== "on") {
    return data(
      { error: "Confirme que será criada uma revisão privada e independente." },
      { status: 400, headers },
    );
  }

  const result = await auth.client.rpc("admin_clone_competition_ruleset", {
    p_request_id: requestId,
    p_target_competition_id: competitionId,
    p_source_revision_id: sourceRevisionId,
    p_allow_gender_recompile: form.get("allowGenderRecompile") === "on",
  });
  const revisionId = parseRulesetCloneResult(result.data);
  if (result.error || !revisionId) {
    return data({ error: rulesetCloneError(result.error?.code) }, { status: 400, headers });
  }
  throw redirect(`/admin/competitions/${competitionId}/structure?clonedRevision=${revisionId}`, {
    headers,
  });
}

export default function CompetitionStructure({
  loaderData,
  actionData,
}: {
  loaderData: StructureLoaderData;
  actionData?: { error: string };
}) {
  const busy = useNavigation().state !== "idle";
  const { competition, draft } = loaderData;
  return (
    <AdminArea title={`Estrutura — ${competition.display_name}`}>
      <Link to={`/admin/competitions/${competition.id}`}>Voltar ao hub</Link>
      <p>
        Revisões ativas e publicadas são somente leitura. Toda alteração começa em um rascunho
        privado e independente.
      </p>
      {actionData?.error ? <p className="form-error">{actionData.error}</p> : null}
      {loaderData.clonedRevisionId ? (
        <p className="form-success">
          Revisão #{loaderData.clonedRevisionId} clonada sem equipes, jogos ou resultados.
        </p>
      ) : null}

      <section className="admin-panel">
        <p className="eyebrow">Revisões</p>
        <h2>Histórico estrutural</h2>
        <ul className="import-history">
          {loaderData.revisions.map((revision) => (
            <li key={revision.id}>
              <span>Revisão {revision.revision_number}</span>
              <strong>{revision.status === "draft" ? "rascunho privado" : revision.status}</strong>
              <small>
                {revision.cloned_from_revision_id
                  ? `Clone independente da revisão ${revision.cloned_from_revision_id}`
                  : "Origem preservada"}
              </small>
            </li>
          ))}
        </ul>
      </section>

      {competition.status !== "draft" ? (
        <section className="admin-panel">
          <h2>Estrutura bloqueada</h2>
          <p>Esta edição não está em rascunho. O histórico permanece disponível sem edição.</p>
        </section>
      ) : draft ? (
        <section className="admin-panel" id="draft-editor">
          <p className="eyebrow">Rascunho atual</p>
          <h2>Revisão {draft.revision_number}</h2>
          <p>
            A cópia é independente e ainda não comanda a edição. O editor estrutural será exibido
            nesta área.
          </p>
        </section>
      ) : (
        <section className="admin-panel">
          <p className="eyebrow">Nova revisão privada</p>
          <h2>Clonar uma estrutura compatível</h2>
          <p>
            O clone copia trilhas, etapas, rodadas, vagas e confrontos. Equipes inscritas, jogos,
            resultados e publicações nunca são copiados.
          </p>
          <p>
            {loaderData.includeOtherGender ? (
              <Link to={`/admin/competitions/${competition.id}/structure`}>
                Mostrar somente o mesmo naipe
              </Link>
            ) : (
              <Link to={`/admin/competitions/${competition.id}/structure?includeOtherGender=1`}>
                Incluir origens de outro naipe
              </Link>
            )}
          </p>
          {loaderData.sources.length ? (
            <Form method="post" className="admin-form ruleset-clone-form">
              <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
              <input type="hidden" name="intent" value="clone-ruleset" />
              <input type="hidden" name="requestId" value={loaderData.requestId} />
              <label>
                Template ou edição anterior
                <select name="sourceRevisionId" required defaultValue="">
                  <option value="" disabled>
                    Selecione a origem
                  </option>
                  {loaderData.sources.map((source) => (
                    <option key={source.revisionId} value={source.revisionId}>
                      {source.displayName} · {source.year} ·{" "}
                      {source.gender === "male" ? "Masculino" : "Feminino"} · {source.entryCount}{" "}
                      vagas{source.genderMismatch ? " · outro naipe" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                Origens de outro naipe exigem recompilação explícita. A estrutura esportiva é
                validada novamente no banco para esta edição.
              </p>
              <label className="checkbox-label">
                <input name="allowGenderRecompile" type="checkbox" />
                Autorizo recompilar se a origem selecionada for de outro naipe.
              </label>
              <label className="checkbox-label">
                <input name="confirmIndependent" type="checkbox" required />
                Confirmo a criação de uma revisão privada independente, sem equipes nem jogos.
              </label>
              <button className="button button-primary" type="submit" disabled={busy}>
                {busy ? "Clonando…" : "Criar revisão a partir da origem"}
              </button>
            </Form>
          ) : (
            <p>Não há estrutura ativa compatível com esta série, categoria e filtro de naipe.</p>
          )}
        </section>
      )}
    </AdminArea>
  );
}
