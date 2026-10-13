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
import {
  isRulesetEditRequestId,
  parseRulesetEditorDocument,
  parseRulesetEditResult,
  type RulesetEditOperation,
  type RulesetEditorDocument,
  type RulesetEditorOrigin,
  rulesetEditError,
} from "../modules/competition/ruleset-editor";

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
  editor: RulesetEditorDocument | null;
  sources: RulesetCloneSource[];
  includeOtherGender: boolean;
  requestId: string;
  csrfToken: string;
  clonedRevisionId: number | null;
  savedEdit: RulesetEditOperation | null;
}

function id(value: unknown) {
  const text = typeof value === "string" ? value : "";
  const parsed = /^[1-9][0-9]*$/.test(text) ? Number(text) : 0;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function boundedName(value: FormDataEntryValue | null) {
  const name = typeof value === "string" ? value.trim() : "";
  return name.length >= 2 && name.length <= 120 ? name : null;
}

function editOperation(value: FormDataEntryValue | null): RulesetEditOperation | null {
  return value === "rename_stage" ||
    value === "rename_round" ||
    value === "add_matchup" ||
    value === "remove_matchup" ||
    value === "set_origin"
    ? value
    : null;
}

function editInput(operation: RulesetEditOperation, form: FormData) {
  if (operation === "rename_stage") {
    const stageId = id(form.get("stageId"));
    const name = boundedName(form.get("name"));
    return stageId && name ? { stageId, name } : null;
  }
  if (operation === "rename_round") {
    const roundId = id(form.get("roundId"));
    const name = boundedName(form.get("name"));
    return roundId && name ? { roundId, name } : null;
  }
  if (operation === "add_matchup") {
    const roundId = id(form.get("roundId"));
    const code = String(form.get("code") ?? "")
      .trim()
      .toLowerCase();
    return roundId && /^[a-z][a-z0-9_]{1,39}$/.test(code) ? { roundId, code } : null;
  }
  if (operation === "remove_matchup") {
    const matchupId = id(form.get("matchupId"));
    return matchupId && form.get("confirmRemove") === "on" ? { matchupId } : null;
  }
  const slotId = id(form.get("slotId"));
  const kind = form.get("kind");
  if (!slotId) return null;
  if (kind === "undefined") return { slotId, kind };
  if (kind === "entry") {
    const entrySeed = id(form.get("entrySeed"));
    return entrySeed ? { slotId, kind, entrySeed } : null;
  }
  if (kind === "winner") {
    const sourceMatchupId = id(form.get("sourceMatchupId"));
    return sourceMatchupId ? { slotId, kind, sourceMatchupId } : null;
  }
  return null;
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
  let editor: RulesetEditorDocument | null = null;
  if (competition.data.status === "draft" && !draft) {
    const result = await auth.client.rpc("admin_list_ruleset_clone_sources", {
      p_target_competition_id: competitionId,
      p_include_other_gender: includeOtherGender,
    });
    if (result.error) throw new Response("Origens indisponíveis", { status: 503 });
    sources = result.data.map(parseRulesetCloneSource);
    if (sources.some((source) => source === null))
      throw new Response("Contrato de origens inválido", { status: 503 });
  } else if (competition.data.status === "draft" && draft) {
    const result = await auth.client.rpc("admin_get_ruleset_draft_editor", {
      p_competition_id: competitionId,
    });
    editor = parseRulesetEditorDocument(result.data);
    if (result.error || !editor)
      throw new Response("Contrato do editor indisponível", { status: 503 });
  }

  const savedEdit = editOperation(url.searchParams.get("savedEdit"));

  return data(
    {
      competition: competition.data,
      revisions: revisions.data,
      draft,
      editor,
      sources: sources.filter((source) => source !== null),
      includeOtherGender,
      requestId: crypto.randomUUID(),
      csrfToken: auth.payload.csrfToken,
      clonedRevisionId: id(url.searchParams.get("clonedRevision")),
      savedEdit,
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
  const intent = form.get("intent");
  if (intent === "edit-ruleset") {
    const requestId = String(form.get("requestId") ?? "");
    const rulesetRevisionId = id(form.get("rulesetRevisionId"));
    const expectedEditorRevision = id(form.get("expectedEditorRevision"));
    const operation = editOperation(form.get("operation"));
    const input = operation ? editInput(operation, form) : null;
    if (
      !isRulesetEditRequestId(requestId) ||
      !rulesetRevisionId ||
      !expectedEditorRevision ||
      !operation ||
      !input
    ) {
      return data({ error: "Revise os campos da alteração estrutural." }, { status: 400, headers });
    }
    const result = await auth.client.rpc("admin_apply_ruleset_draft_edit", {
      p_request_id: requestId,
      p_ruleset_revision_id: rulesetRevisionId,
      p_expected_editor_revision: expectedEditorRevision,
      p_operation: operation,
      p_input: input,
    });
    const parsed = parseRulesetEditResult(result.data);
    if (result.error || !parsed) {
      return data({ error: rulesetEditError(result.error?.code) }, { status: 400, headers });
    }
    throw redirect(
      `/admin/competitions/${competitionId}/structure?savedEdit=${parsed.operation}#draft-editor`,
      { headers },
    );
  }
  if (intent !== "clone-ruleset") throw new Response("Ação inválida", { status: 400 });

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

function EditHiddenFields({
  loaderData,
  operation,
}: {
  loaderData: StructureLoaderData;
  operation: RulesetEditOperation;
}) {
  if (!loaderData.editor) return null;
  return (
    <>
      <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
      <input type="hidden" name="intent" value="edit-ruleset" />
      <input type="hidden" name="requestId" value={loaderData.requestId} />
      <input type="hidden" name="rulesetRevisionId" value={loaderData.editor.revision.id} />
      <input
        type="hidden"
        name="expectedEditorRevision"
        value={loaderData.editor.revision.editorRevision}
      />
      <input type="hidden" name="operation" value={operation} />
    </>
  );
}

function OriginEditor({
  loaderData,
  origin,
  side,
  roundOrder,
  busy,
}: {
  loaderData: StructureLoaderData;
  origin: RulesetEditorOrigin;
  side: "Mandante" | "Visitante";
  roundOrder: number;
  busy: boolean;
}) {
  const editor = loaderData.editor;
  if (!editor) return null;
  const priorMatchups = editor.matchups.filter((candidate) => {
    const sourceRound = editor.rounds.find((round) => round.id === candidate.roundId);
    return sourceRound && sourceRound.order < roundOrder;
  });
  return (
    <Form method="post" className="ruleset-origin-form">
      <EditHiddenFields loaderData={loaderData} operation="set_origin" />
      <input type="hidden" name="slotId" value={origin.slotId} />
      <strong>{side}</strong>
      <label>
        Origem
        <select name="kind" defaultValue={origin.kind}>
          <option value="undefined">A definir</option>
          <option value="entry">Vaga da edição</option>
          <option value="winner">Vencedor de confronto anterior</option>
        </select>
      </label>
      <label>
        Vaga
        <select name="entrySeed" defaultValue={origin.entrySeed ?? ""}>
          <option value="">Selecione se aplicável</option>
          {editor.entries.map((entry) => (
            <option key={entry.id} value={entry.seed}>
              Cabeça {entry.seed}
            </option>
          ))}
        </select>
      </label>
      <label>
        Confronto anterior
        <select name="sourceMatchupId" defaultValue={origin.sourceMatchupId ?? ""}>
          <option value="">Selecione se aplicável</option>
          {priorMatchups.map((matchup) => (
            <option key={matchup.id} value={matchup.id}>
              {matchup.code}
            </option>
          ))}
        </select>
      </label>
      <button className="button button-secondary" type="submit" disabled={busy}>
        Salvar origem
      </button>
    </Form>
  );
}

function DraftRulesetEditor({
  loaderData,
  busy,
}: {
  loaderData: StructureLoaderData;
  busy: boolean;
}) {
  const editor = loaderData.editor;
  if (!editor) return null;
  return (
    <section className="admin-panel ruleset-editor" id="draft-editor">
      <p className="eyebrow">Rascunho atual</p>
      <h2>Revisão {editor.revision.number}</h2>
      <p>
        A cópia é privada e independente. Cada gravação é validada no servidor e no banco; nada
        desta revisão comanda a edição até uma ativação posterior.
      </p>
      {loaderData.savedEdit ? (
        <p className="form-success">Alteração estrutural salva no rascunho.</p>
      ) : null}
      <dl className="ruleset-summary">
        <div>
          <dt>Vagas</dt>
          <dd>{editor.summary.entries}</dd>
        </div>
        <div>
          <dt>Confrontos</dt>
          <dd>
            {editor.summary.matchups}/{editor.summary.matchupCapacity}
          </dd>
        </div>
        <div>
          <dt>Origens a definir</dt>
          <dd>{editor.summary.undefinedOrigins}</dd>
        </div>
        <div>
          <dt>Versão do editor</dt>
          <dd>{editor.revision.editorRevision}</dd>
        </div>
      </dl>

      {editor.tracks.map((track) => {
        const stages = editor.stages.filter((stage) => stage.trackId === track.id);
        return (
          <section className="ruleset-track" key={track.id}>
            <header>
              <p className="eyebrow">Trilha</p>
              <h3>{track.code}</h3>
            </header>
            {stages.map((stage) => (
              <article className="ruleset-stage" key={stage.id}>
                <Form method="post" className="ruleset-name-form">
                  <EditHiddenFields loaderData={loaderData} operation="rename_stage" />
                  <input type="hidden" name="stageId" value={stage.id} />
                  <label>
                    Nome da etapa
                    <input name="name" defaultValue={stage.name} minLength={2} maxLength={120} />
                  </label>
                  <button className="button button-secondary" type="submit" disabled={busy}>
                    Renomear etapa
                  </button>
                </Form>

                {editor.rounds
                  .filter((round) => round.stageId === stage.id)
                  .map((round) => {
                    const matchups = editor.matchups.filter(
                      (matchup) => matchup.roundId === round.id,
                    );
                    return (
                      <section className="ruleset-round" key={round.id}>
                        <div className="ruleset-round-heading">
                          <Form method="post" className="ruleset-name-form">
                            <EditHiddenFields loaderData={loaderData} operation="rename_round" />
                            <input type="hidden" name="roundId" value={round.id} />
                            <label>
                              Nome da rodada
                              <input
                                name="name"
                                defaultValue={round.name}
                                minLength={2}
                                maxLength={120}
                              />
                            </label>
                            <button
                              className="button button-secondary"
                              type="submit"
                              disabled={busy}
                            >
                              Renomear rodada
                            </button>
                          </Form>
                          <span className="ruleset-capacity">
                            {round.usedMatchups}/{round.maxMatchups} confrontos
                          </span>
                        </div>

                        <div className="ruleset-matchups">
                          {matchups.map((matchup) => (
                            <article className="ruleset-matchup" key={matchup.id}>
                              <header>
                                <div>
                                  <p className="eyebrow">Confronto</p>
                                  <h4>{matchup.code}</h4>
                                </div>
                                <details className="ruleset-remove">
                                  <summary>Remover</summary>
                                  <Form method="post">
                                    <EditHiddenFields
                                      loaderData={loaderData}
                                      operation="remove_matchup"
                                    />
                                    <input type="hidden" name="matchupId" value={matchup.id} />
                                    <label className="checkbox-label">
                                      <input name="confirmRemove" type="checkbox" required />
                                      Confirmo a remoção deste confronto sem dependências.
                                    </label>
                                    <button
                                      className="button button-secondary"
                                      type="submit"
                                      disabled={busy}
                                    >
                                      Remover do rascunho
                                    </button>
                                  </Form>
                                </details>
                              </header>
                              <div className="ruleset-origins">
                                <OriginEditor
                                  loaderData={loaderData}
                                  origin={matchup.home}
                                  side="Mandante"
                                  roundOrder={round.order}
                                  busy={busy}
                                />
                                <OriginEditor
                                  loaderData={loaderData}
                                  origin={matchup.away}
                                  side="Visitante"
                                  roundOrder={round.order}
                                  busy={busy}
                                />
                              </div>
                            </article>
                          ))}
                        </div>

                        {round.usedMatchups < round.maxMatchups ? (
                          <Form method="post" className="ruleset-add-form">
                            <EditHiddenFields loaderData={loaderData} operation="add_matchup" />
                            <input type="hidden" name="roundId" value={round.id} />
                            <label>
                              Código do novo confronto
                              <input
                                name="code"
                                required
                                minLength={2}
                                maxLength={40}
                                pattern="[a-z][a-z0-9_]+"
                                placeholder="ex.: semifinal_3"
                              />
                            </label>
                            <button className="button button-primary" type="submit" disabled={busy}>
                              Adicionar confronto
                            </button>
                          </Form>
                        ) : null}
                      </section>
                    );
                  })}
              </article>
            ))}
          </section>
        );
      })}
    </section>
  );
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
      <section className="admin-note" aria-labelledby="automatic-structure-title">
        <h2 id="automatic-structure-title">Chave automática é opcional</h2>
        <p>
          Use esta estrutura somente quando quiser gerar confrontos por posições ou vencedores de
          jogos anteriores. Para cadastrar os jogos diretamente, use o fluxo manual da agenda.
        </p>
        <Link
          className="button button-secondary"
          to={`/admin/competitions/${competition.id}/schedule`}
        >
          Ir para jogos e agenda
        </Link>
      </section>
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
        <DraftRulesetEditor loaderData={loaderData} busy={busy} />
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
