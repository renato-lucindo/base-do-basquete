import { useEffect, useRef } from "react";
import { data, Form, Link, redirect } from "react-router";

import { AdminArea } from "../components/admin/admin-area";
import { cloudflareContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";
import type { Json } from "../types/database.generated";
import type { Route } from "./+types/admin.competitions.$competitionId.registrations.copy";

type CopyConflict =
  | "already_registered"
  | "eligibility_pending"
  | "gender_incompatible"
  | "player_inactive";

interface CopyPreviewPlayer {
  playerId: number;
  fullName: string;
  jerseyNumber: string | null;
  conflict: CopyConflict | null;
}

interface CopyPreviewRegistration {
  sourceRegistrationId: number;
  teamId: number;
  teamName: string;
  publicName: string;
  publicNameConflict: boolean;
  players: CopyPreviewPlayer[];
}

interface CopyPreview {
  sourceCompetitionId: number;
  targetCompetitionId: number;
  registrations: CopyPreviewRegistration[];
}

function parseId(value: unknown): number | null {
  const text = typeof value === "string" ? value : "";
  return /^[1-9][0-9]*$/.test(text) ? Number(text) : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function parseRegistrationCopyPreview(value: Json | null): CopyPreview | null {
  const root = record(value);
  const sourceCompetitionId = parseId(String(root?.sourceCompetitionId ?? ""));
  const targetCompetitionId = parseId(String(root?.targetCompetitionId ?? ""));
  if (!root || !sourceCompetitionId || !targetCompetitionId || !Array.isArray(root.registrations)) {
    return null;
  }
  const registrations: CopyPreviewRegistration[] = [];
  for (const rawRegistration of root.registrations) {
    const registration = record(rawRegistration);
    const sourceRegistrationId = parseId(String(registration?.sourceRegistrationId ?? ""));
    const teamId = parseId(String(registration?.teamId ?? ""));
    if (
      !registration ||
      !sourceRegistrationId ||
      !teamId ||
      typeof registration.teamName !== "string" ||
      typeof registration.publicName !== "string" ||
      typeof registration.publicNameConflict !== "boolean" ||
      !Array.isArray(registration.players)
    ) {
      return null;
    }
    const players: CopyPreviewPlayer[] = [];
    for (const rawPlayer of registration.players) {
      const player = record(rawPlayer);
      const playerId = parseId(String(player?.playerId ?? ""));
      const conflict = player?.conflict;
      if (
        !player ||
        !playerId ||
        typeof player.fullName !== "string" ||
        (player.jerseyNumber !== null && typeof player.jerseyNumber !== "string") ||
        (conflict !== null &&
          conflict !== "already_registered" &&
          conflict !== "eligibility_pending" &&
          conflict !== "gender_incompatible" &&
          conflict !== "player_inactive")
      ) {
        return null;
      }
      players.push({
        playerId,
        fullName: player.fullName,
        jerseyNumber: player.jerseyNumber as string | null,
        conflict: conflict as CopyConflict | null,
      });
    }
    registrations.push({
      sourceRegistrationId,
      teamId,
      teamName: registration.teamName,
      publicName: registration.publicName,
      publicNameConflict: registration.publicNameConflict,
      players,
    });
  }
  return { sourceCompetitionId, targetCompetitionId, registrations };
}

function conflictLabel(conflict: CopyConflict) {
  switch (conflict) {
    case "already_registered":
      return "já está inscrito nesta disputa";
    case "eligibility_pending":
      return "cadastro privado ainda precisa de revisão";
    case "gender_incompatible":
      return "não é compatível com o naipe desta disputa";
    case "player_inactive":
      return "cadastro de atleta está inativo";
  }
}

function buildCopyItems(formData: FormData) {
  const selectedRegistrationIds = formData.getAll("registrationId").map(parseId);
  if (!selectedRegistrationIds.length || selectedRegistrationIds.some((id) => id === null)) {
    return { ok: false as const, error: "Selecione ao menos uma inscrição para copiar." };
  }
  if (new Set(selectedRegistrationIds).size !== selectedRegistrationIds.length) {
    return { ok: false as const, error: "A seleção de inscrições contém itens duplicados." };
  }

  const items = [];
  for (const registrationId of selectedRegistrationIds) {
    const publicName = String(formData.get(`publicName:${registrationId}`) ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (publicName.length < 2 || publicName.length > 120) {
      return { ok: false as const, error: "Revise o nome público da inscrição selecionada." };
    }
    const selectedPlayerIds = formData.getAll(`player:${registrationId}`).map(parseId);
    if (
      new Set(selectedPlayerIds).size !== selectedPlayerIds.length ||
      selectedPlayerIds.some((playerId) => playerId === null)
    ) {
      return { ok: false as const, error: "A seleção de atletas não corresponde à prévia atual." };
    }
    items.push({
      sourceRegistrationId: registrationId,
      publicName,
      playerIds: selectedPlayerIds,
    });
  }
  return { ok: true as const, items };
}

function mapCopyError(code: string | undefined) {
  switch (code) {
    case "BD104":
      return "Um atleta selecionado passou a pertencer a outra inscrição. Refaça a prévia.";
    case "BD601":
      return "Um atleta selecionado ainda possui elegibilidade pendente. Exclua-o da cópia.";
    case "BD602":
      return "Um atleta selecionado não é compatível com o naipe de destino.";
    case "BD409":
      return "O contexto ou um nome público mudou desde a prévia. Revise novamente.";
    case "BD404":
      return "Uma inscrição ou disputa selecionada não existe mais.";
    default:
      return "Não foi possível copiar as inscrições. Refaça a prévia e tente novamente.";
  }
}

export function meta() {
  return [{ title: "Copiar inscrições — Base do Basquete" }];
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const competitionId = parseId(params.competitionId);
  if (!competitionId) throw new Response("Disputa não encontrada", { status: 404 });
  const auth = await requireAdminAal2(request, context.get(cloudflareContext).env);
  const competitionResult = await auth.client
    .from("competitions")
    .select("id,display_name,season_id")
    .eq("id", competitionId)
    .maybeSingle();
  if (competitionResult.error || !competitionResult.data) {
    throw new Response("Disputa não encontrada", { status: 404 });
  }
  const competition = competitionResult.data;
  const peersResult = competition.season_id
    ? await auth.client
        .from("competitions")
        .select("id,display_name,category_id,gender_division")
        .eq("season_id", competition.season_id)
        .neq("id", competitionId)
        .order("display_name")
    : { data: [], error: null };
  if (peersResult.error) throw new Error("Registration copy source query failed");

  const sourceCompetitionId = parseId(new URL(request.url).searchParams.get("source"));
  let preview: CopyPreview | null = null;
  let previewError: string | null = null;
  if (sourceCompetitionId) {
    const sourceAllowed = peersResult.data.some((item) => item.id === sourceCompetitionId);
    if (!sourceAllowed) {
      previewError = "A disputa de origem não pertence à mesma edição.";
    } else {
      const previewResult = await auth.client.rpc("admin_preview_registration_copy", {
        p_source_competition_id: sourceCompetitionId,
        p_target_competition_id: competitionId,
      });
      preview = previewResult.error ? null : parseRegistrationCopyPreview(previewResult.data);
      if (previewResult.error || !preview) {
        previewError = "Não foi possível preparar a cópia. Revise o contexto das disputas.";
      }
    }
  }

  return data(
    {
      competition,
      csrfToken: auth.payload.csrfToken,
      peers: peersResult.data,
      sourceCompetitionId,
      preview,
      previewError,
      requestId: preview ? crypto.randomUUID() : null,
    },
    { headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
  );
}

export async function action({ request, params, context }: Route.ActionArgs) {
  assertSameOrigin(request);
  const competitionId = parseId(params.competitionId);
  if (!competitionId) throw new Response("Disputa não encontrada", { status: 404 });
  const auth = await requireAdminAal2(request, context.get(cloudflareContext).env);
  const formData = await request.formData();
  assertCsrfToken(formData, auth.payload.csrfToken);
  const sourceCompetitionId = parseId(formData.get("sourceCompetitionId"));
  const requestId = String(formData.get("requestId") ?? "");
  if (!sourceCompetitionId || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(requestId)) {
    return data({ error: "A prévia expirou. Recarregue antes de confirmar." }, { status: 400 });
  }

  // The authoritative RPC checks replay before mutable eligibility/membership.
  // Re-reading the preview here would reject an already successful retry.
  const selection = buildCopyItems(formData);
  if (!selection.ok) return data({ error: selection.error }, { status: 400 });

  const result = await auth.client.rpc("admin_copy_team_registrations", {
    p_request_id: requestId,
    p_source_competition_id: sourceCompetitionId,
    p_target_competition_id: competitionId,
    p_items: selection.items as unknown as Json,
  });
  if (result.error) {
    return data({ error: mapCopyError(result.error.code) }, { status: 409 });
  }
  throw redirect(`/admin/competitions/${competitionId}?copyCompleted=1#teams`, {
    headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined,
  });
}

export default function RegistrationCopy({ loaderData, actionData }: Route.ComponentProps) {
  const actionErrorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (actionData?.error) actionErrorRef.current?.focus();
  }, [actionData]);

  return (
    <AdminArea title="Copiar equipes e elencos">
      <p>
        Destino: <strong>{loaderData.competition.display_name}</strong>. A prévia não altera dados;
        a confirmação cria novas inscrições e novos vínculos de elenco.
      </p>
      <p>
        <Link to={`/admin/competitions/${loaderData.competition.id}`}>
          Voltar ao hub da disputa
        </Link>
      </p>

      <section className="admin-panel">
        <h2>1. Escolher disputa de origem</h2>
        <Form method="get" className="inline-admin-form">
          <label>
            Disputa da mesma edição
            <select name="source" defaultValue={loaderData.sourceCompetitionId ?? ""} required>
              <option value="" disabled>
                Selecione
              </option>
              {loaderData.peers.map((peer) => (
                <option key={peer.id} value={peer.id}>
                  {peer.display_name}
                </option>
              ))}
            </select>
          </label>
          <button className="button button-primary" type="submit">
            Gerar prévia
          </button>
        </Form>
        {loaderData.peers.length === 0 ? (
          <p>Não há outra disputa nesta edição para copiar.</p>
        ) : null}
        {loaderData.previewError ? (
          <p role="alert" className="form-error">
            {loaderData.previewError}
          </p>
        ) : null}
      </section>

      {loaderData.preview && loaderData.requestId ? (
        <section className="admin-panel">
          <h2>2. Revisar e confirmar</h2>
          <p>
            Selecione as inscrições e atletas desejados. Atletas incompatíveis ficam fora da seleção
            e mostram o motivo.
          </p>
          {actionData?.error ? (
            <p ref={actionErrorRef} role="alert" tabIndex={-1} className="form-error">
              {actionData.error}
            </p>
          ) : null}
          <Form method="post" className="admin-form">
            <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
            <input
              type="hidden"
              name="sourceCompetitionId"
              value={loaderData.preview.sourceCompetitionId}
            />
            <input type="hidden" name="requestId" value={loaderData.requestId} />
            {loaderData.preview.registrations.map((registration) => (
              <fieldset key={registration.sourceRegistrationId} className="admin-panel">
                {(() => {
                  const publicNameConflictId = `public-name-conflict-${registration.sourceRegistrationId}`;
                  return (
                    <>
                      <legend>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            name="registrationId"
                            value={registration.sourceRegistrationId}
                            defaultChecked={!registration.publicNameConflict}
                          />
                          {registration.publicName}
                        </label>
                      </legend>
                      <p>Cadastro global: {registration.teamName}</p>
                      <label>
                        Nome público no destino
                        <input
                          name={`publicName:${registration.sourceRegistrationId}`}
                          defaultValue={registration.publicName}
                          minLength={2}
                          maxLength={120}
                          aria-describedby={
                            registration.publicNameConflict ? publicNameConflictId : undefined
                          }
                          aria-invalid={registration.publicNameConflict || undefined}
                          required
                        />
                      </label>
                      {registration.publicNameConflict ? (
                        <p id={publicNameConflictId} role="alert">
                          Esse nome já existe no destino. Altere-o antes de selecionar.
                        </p>
                      ) : null}
                      {registration.players.length ? (
                        <div>
                          <strong>Elenco</strong>
                          {registration.players.map((player) => (
                            <label className="checkbox-label" key={player.playerId}>
                              <input
                                type="checkbox"
                                name={`player:${registration.sourceRegistrationId}`}
                                value={player.playerId}
                                defaultChecked={!player.conflict}
                                disabled={Boolean(player.conflict)}
                              />
                              {player.fullName}
                              {player.jerseyNumber ? ` · camisa ${player.jerseyNumber}` : ""}
                              {player.conflict ? ` — ${conflictLabel(player.conflict)}` : ""}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p>Esta inscrição não possui atletas ativos para copiar.</p>
                      )}
                    </>
                  );
                })()}
              </fieldset>
            ))}
            {loaderData.preview.registrations.length ? (
              <button className="button button-primary" type="submit">
                Confirmar cópia selecionada
              </button>
            ) : (
              <p>Nenhuma inscrição disponível na origem.</p>
            )}
          </Form>
        </section>
      ) : null}
    </AdminArea>
  );
}
