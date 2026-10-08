import { useEffect, useRef } from "react";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { AdminArea } from "../components/admin/admin-area";
import { cloudflareContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";
import {
  competitionTimeZone,
  scheduleId,
  scheduleLocalParts,
  schedulingError,
  validateManualMatchup,
  validateManualParticipants,
  validateResolution,
  validateSchedule,
  validateScheduleBatch,
} from "../modules/competition/scheduling";
import type { Route } from "./+types/admin.competitions.$competitionId.schedule";

interface Schedule {
  rounds: { id: number; name: string; stage: string; label: string; order: number }[];
  entries: { id: number; seed: number; registrationId: number | null; label?: string }[];
  matchups: {
    id: number;
    code: string | null;
    round: string;
    order: number;
    label?: string;
    manual: boolean;
    homeRegistrationId: number | null;
    awayRegistrationId: number | null;
    revision: number;
    scheduledAt: string | null;
    venue: string | null;
    gameId: number | null;
    gameStatus: string | null;
    participantsEditable: boolean;
    officialResultSubmissionId: number | null;
    readyToSchedule: boolean;
    readyToResolve: boolean;
    resolution: {
      winnerRegistrationId: number;
      loserRegistrationId: number;
      homeScore: number;
      awayScore: number;
      resolvedAt: string;
    } | null;
  }[];
}

export function scheduleEntryLabel(entry: Schedule["entries"][number]): string {
  return entry.label?.trim() || `Posição ${entry.seed}`;
}

export function scheduleMatchupLabel(matchup: Schedule["matchups"][number]): string {
  return (
    matchup.label?.trim() ||
    `${matchup.round?.trim() || "Confronto"} · confronto ${matchup.order || matchup.code || matchup.id}`
  );
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const auth = await requireAdminAal2(request, context.get(cloudflareContext).env);
  const id = scheduleId(params.competitionId);
  if (!id) throw new Response("Edição não encontrada", { status: 404 });
  const [edition, schedule, registrations] = await Promise.all([
    auth.client.from("competitions").select("id,display_name,status").eq("id", id).single(),
    auth.client.rpc("admin_get_competition_schedule", { p_competition_id: id }),
    auth.client
      .from("team_registrations")
      .select("id,team_id,public_name,status")
      .eq("competition_id", id),
  ]);
  if (edition.error) throw new Response("Edição não encontrada", { status: 404 });
  if (schedule.error || registrations.error)
    throw new Response("Agendamento indisponível. Tente novamente mais tarde.", { status: 503 });
  return data(
    {
      edition: edition.data,
      schedule: schedule.data as unknown as Schedule,
      registrations: registrations.data.map((r) => ({
        ...r,
        name: r.public_name,
      })),
      requestId: crypto.randomUUID(),
      csrfToken: auth.payload.csrfToken,
    },
    { headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
  );
}
export async function action({ request, params, context }: Route.ActionArgs) {
  assertSameOrigin(request);
  const auth = await requireAdminAal2(request, context.get(cloudflareContext).env);
  const id = scheduleId(params.competitionId);
  if (!id) throw new Response("Edição não encontrada", { status: 404 });
  const form = await request.formData();
  assertCsrfToken(form, auth.payload.csrfToken);
  const headers = auth.cookie ? { "Set-Cookie": auth.cookie } : undefined;
  let code: string | undefined;
  if (form.get("intent") === "create-manual") {
    const parsed = validateManualMatchup(form);
    if (!parsed.ok) return data({ error: parsed.error }, { status: 400, headers });
    code = (
      await auth.client.rpc("admin_create_manual_matchup", {
        p_request_id: parsed.input.requestId,
        p_competition_id: id,
        p_round_id: parsed.input.roundId,
        p_home_registration_id: parsed.input.homeRegistrationId,
        p_away_registration_id: parsed.input.awayRegistrationId,
        p_scheduled_at: parsed.input.scheduledAt as string,
        p_venue: parsed.input.venue as string,
      })
    ).error?.code;
  } else if (form.get("intent") === "update-participants") {
    const parsed = validateManualParticipants(form);
    if (!parsed.ok) return data({ error: parsed.error }, { status: 400, headers });
    const matchup = await auth.client
      .from("matchups")
      .select("id")
      .eq("id", parsed.input.matchupId)
      .eq("competition_id", id)
      .maybeSingle();
    if (matchup.error || !matchup.data)
      throw new Response("Confronto não encontrado", { status: 404 });
    code = (
      await auth.client.rpc("admin_update_manual_matchup_participants", {
        p_matchup_id: parsed.input.matchupId,
        p_expected_home_registration_id: parsed.input.expectedHomeRegistrationId,
        p_expected_away_registration_id: parsed.input.expectedAwayRegistrationId,
        p_home_registration_id: parsed.input.homeRegistrationId,
        p_away_registration_id: parsed.input.awayRegistrationId,
      })
    ).error?.code;
  } else if (form.get("intent") === "prepare-batch") {
    const parsed = validateScheduleBatch(form);
    if (!parsed.ok) return data({ error: parsed.error }, { status: 400, headers });
    code = (
      await auth.client.rpc("admin_prepare_matchups_batch", {
        p_competition_id: id,
        p_items: parsed.input.items,
      })
    ).error?.code;
  } else if (form.get("intent") === "prepare") {
    const parsed = validateSchedule(form);
    if (!parsed.ok) return data({ error: parsed.error }, { status: 400, headers });
    const m = await auth.client
      .from("matchups")
      .select("id")
      .eq("id", parsed.input.matchupId)
      .eq("competition_id", id)
      .maybeSingle();
    if (m.error || !m.data) throw new Response("Confronto não encontrado", { status: 404 });
    code = (
      await auth.client.rpc("admin_prepare_matchup", {
        p_matchup_id: parsed.input.matchupId,
        p_expected_revision: parsed.input.expectedRevision,
        // Postgres accepts null for function parameters; Supabase typegen does not
        // encode parameter nullability, so keep the cast at this RPC boundary.
        p_scheduled_at: parsed.input.scheduledAt as string,
        p_venue: parsed.input.venue as string,
      })
    ).error?.code;
  } else if (form.get("intent") === "resolve") {
    const parsed = validateResolution(form);
    if (!parsed.ok) return data({ error: parsed.error }, { status: 400, headers });
    const matchup = await auth.client
      .from("matchups")
      .select("id")
      .eq("id", parsed.input.matchupId)
      .eq("competition_id", id)
      .maybeSingle();
    if (matchup.error || !matchup.data)
      throw new Response("Confronto não encontrado", { status: 404 });
    code = (
      await auth.client.rpc("admin_resolve_matchup", {
        p_matchup_id: parsed.input.matchupId,
        p_expected_submission_id: parsed.input.submissionId,
      })
    ).error?.code;
  } else throw new Response("Ação inválida", { status: 400 });
  if (code) return data({ error: schedulingError(code) }, { status: 400, headers });
  return redirect(`/admin/competitions/${id}/schedule?saved=1`, { headers });
}
export default function SchedulePage({ loaderData, actionData }: Route.ComponentProps) {
  const { edition, schedule, registrations, requestId, csrfToken } = loaderData;
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const actionErrorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (navigation.state === "idle" && actionData?.error) actionErrorRef.current?.focus();
  }, [actionData, navigation.state]);
  const confirmedRegistrations = registrations.filter(
    (registration) => registration.status === "confirmed",
  );
  const rounds = schedule.rounds ?? [];
  const name = (id: number | null) =>
    registrations.find((r) => r.id === id)?.name ?? "Equipe a definir";
  const canCreateManual = edition.status !== "archived" && confirmedRegistrations.length >= 2;
  return (
    <AdminArea title={`Jogos e agenda — ${edition.display_name}`}>
      <Link to={`/admin/competitions/${edition.id}`}>Voltar ao hub</Link>
      <p>
        Crie os jogos manualmente e, se quiser, já informe data, horário e local. Classificação e
        posições não são pré-requisitos para a agenda.
      </p>
      {actionData?.error ? (
        <p id="schedule-action-error" ref={actionErrorRef} role="alert" tabIndex={-1}>
          {actionData.error}
        </p>
      ) : null}

      <section className="admin-panel" aria-labelledby="manual-matchup-title">
        <p className="eyebrow">Fluxo padrão</p>
        <h2 id="manual-matchup-title">Novo jogo</h2>
        <p>
          Escolha as equipes. Fase/rodada, data, horário e local são opcionais: sem data e horário,
          o jogo fica em rascunho para ser concluído depois nesta mesma agenda.
        </p>
        {confirmedRegistrations.length < 2 ? (
          <p>
            São necessárias duas equipes confirmadas.{" "}
            <Link to={`/admin/competitions/${edition.id}`}>Revisar equipes no hub</Link>.
          </p>
        ) : null}
        <Form method="post" className="admin-manual-matchup-form">
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <input type="hidden" name="intent" value="create-manual" />
          <input type="hidden" name="requestId" value={requestId} />
          <label>
            Fase e rodada (opcional)
            <select name="roundId" defaultValue="">
              <option value="">Agenda geral</option>
              {rounds.map((round) => (
                <option key={round.id} value={round.id}>
                  {round.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Equipe mandante
            <select
              name="homeRegistrationId"
              required
              defaultValue=""
              disabled={confirmedRegistrations.length < 2}
            >
              <option value="" disabled>
                Selecione a equipe
              </option>
              {confirmedRegistrations.map((registration) => (
                <option key={registration.id} value={registration.id}>
                  {registration.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Equipe visitante
            <select
              name="awayRegistrationId"
              required
              defaultValue=""
              disabled={confirmedRegistrations.length < 2}
            >
              <option value="" disabled>
                Selecione a equipe
              </option>
              {confirmedRegistrations.map((registration) => (
                <option key={registration.id} value={registration.id}>
                  {registration.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Data
            <input name="scheduledDate" type="date" />
          </label>
          <label>
            Horário
            <input name="scheduledTime" type="time" />
          </label>
          <label>
            Local
            <input name="venue" maxLength={160} />
          </label>
          <button
            type="submit"
            className="button button-primary"
            disabled={busy || !canCreateManual}
          >
            {busy ? "Criando…" : "Criar jogo"}
          </button>
        </Form>
      </section>

      <section className="admin-note" aria-labelledby="automatic-bracket-title">
        <h2 id="automatic-bracket-title">Geração automática (opcional)</h2>
        <p>
          Use classificação, posições e progressão entre confrontos somente quando quiser que o
          sistema monte ou avance uma chave automaticamente.
        </p>
        <Link
          className="button button-secondary"
          to={`/admin/competitions/${edition.id}/structure`}
        >
          Configurar classificação e chave automática
        </Link>
      </section>

      <h2>Agenda</h2>
      <p>
        Edite um jogo por linha. Data e horário usam {competitionTimeZone}; o servidor faz a
        conversão para o instante canônico.
      </p>
      <Form id="schedule-batch" method="post" className="admin-panel admin-schedule-batch-tools">
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <input type="hidden" name="intent" value="prepare-batch" />
        <fieldset>
          <legend>Aplicar valores às linhas selecionadas</legend>
          <p>
            Preencha somente o que deseja repetir. Os valores informados aqui substituem o campo
            correspondente das linhas marcadas.
          </p>
          <div className="admin-schedule-bulk-grid">
            <label>
              Data
              <input name="bulkDate" type="date" />
            </label>
            <label>
              Horário
              <input name="bulkTime" type="time" />
            </label>
            <label>
              Local
              <input name="bulkVenue" maxLength={160} />
            </label>
          </div>
        </fieldset>
        <button
          type="submit"
          className="button button-primary"
          disabled={
            busy ||
            edition.status === "archived" ||
            !schedule.matchups.some((matchup) => matchup.readyToSchedule || matchup.gameId !== null)
          }
        >
          {busy ? "Salvando…" : "Salvar agenda selecionada"}
        </button>
      </Form>
      <div className="admin-schedule-table-wrap">
        <table className="admin-schedule-table">
          <caption>Agenda de jogos</caption>
          <thead>
            <tr>
              <th scope="col">Salvar</th>
              <th scope="col">Confronto</th>
              <th scope="col">Equipes</th>
              <th scope="col">Data</th>
              <th scope="col">Horário</th>
              <th scope="col">Local</th>
              <th scope="col">Situação</th>
            </tr>
          </thead>
          <tbody>
            {schedule.matchups.map((m) => {
              const localSchedule = scheduleLocalParts(m.scheduledAt);
              const canPrepare = m.readyToSchedule || m.gameId !== null;
              const matchupLabel = scheduleMatchupLabel(m);
              return (
                <tr key={m.id}>
                  <td>
                    <input
                      form="schedule-batch"
                      type="checkbox"
                      name="selectedMatchupId"
                      value={m.id}
                      defaultChecked={canPrepare}
                      disabled={!canPrepare || edition.status === "archived"}
                      aria-label={`Salvar ${matchupLabel}`}
                    />
                    <input
                      form="schedule-batch"
                      type="hidden"
                      name={`revision-${m.id}`}
                      value={m.revision}
                    />
                  </td>
                  <th scope="row">
                    {matchupLabel}
                    {m.gameId ? <small>Jogo #{m.gameId}</small> : null}
                  </th>
                  <td>
                    <span>
                      {name(m.homeRegistrationId)} × {name(m.awayRegistrationId)}
                    </span>
                    {m.manual && m.participantsEditable ? (
                      <details>
                        <summary>Trocar equipes</summary>
                        <Form method="post" className="admin-form">
                          <input type="hidden" name="csrfToken" value={csrfToken} />
                          <input type="hidden" name="intent" value="update-participants" />
                          <input type="hidden" name="matchupId" value={m.id} />
                          <input
                            type="hidden"
                            name="expectedHomeRegistrationId"
                            value={m.homeRegistrationId ?? ""}
                          />
                          <input
                            type="hidden"
                            name="expectedAwayRegistrationId"
                            value={m.awayRegistrationId ?? ""}
                          />
                          <label>
                            Mandante de {matchupLabel}
                            <select
                              name="homeRegistrationId"
                              defaultValue={m.homeRegistrationId ?? ""}
                              required
                            >
                              {confirmedRegistrations.map((registration) => (
                                <option key={registration.id} value={registration.id}>
                                  {registration.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Visitante de {matchupLabel}
                            <select
                              name="awayRegistrationId"
                              defaultValue={m.awayRegistrationId ?? ""}
                              required
                            >
                              {confirmedRegistrations.map((registration) => (
                                <option key={registration.id} value={registration.id}>
                                  {registration.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button className="button button-secondary" type="submit" disabled={busy}>
                            Salvar equipes
                          </button>
                        </Form>
                      </details>
                    ) : m.manual ? (
                      <small> Equipes protegidas pelo histórico do jogo.</small>
                    ) : (
                      <small> Chave automática.</small>
                    )}
                  </td>
                  <td>
                    <input
                      form="schedule-batch"
                      name={`date-${m.id}`}
                      type="date"
                      defaultValue={localSchedule.date}
                      disabled={!canPrepare}
                      aria-label={`Data de ${matchupLabel}`}
                    />
                  </td>
                  <td>
                    <input
                      form="schedule-batch"
                      name={`time-${m.id}`}
                      type="time"
                      defaultValue={localSchedule.time}
                      disabled={!canPrepare}
                      aria-label={`Horário de ${matchupLabel}`}
                    />
                  </td>
                  <td>
                    <input
                      form="schedule-batch"
                      name={`venue-${m.id}`}
                      maxLength={160}
                      defaultValue={m.venue ?? ""}
                      disabled={!canPrepare}
                      aria-label={`Local de ${matchupLabel}`}
                    />
                  </td>
                  <td>
                    {m.resolution ? (
                      <span>
                        {m.resolution.homeScore} × {m.resolution.awayScore} · classificado:{" "}
                        {name(m.resolution.winnerRegistrationId)}
                      </span>
                    ) : m.readyToResolve && m.officialResultSubmissionId ? (
                      <Form method="post" className="inline-admin-form">
                        <input type="hidden" name="csrfToken" value={csrfToken} />
                        <input type="hidden" name="intent" value="resolve" />
                        <input type="hidden" name="matchupId" value={m.id} />
                        <input
                          type="hidden"
                          name="officialResultSubmissionId"
                          value={m.officialResultSubmissionId}
                        />
                        <button type="submit" className="button button-ghost" disabled={busy}>
                          Confirmar progressão
                        </button>
                      </Form>
                    ) : !canPrepare ? (
                      <span>Aguardando definição automática das equipes</span>
                    ) : m.gameStatus === "draft" ? (
                      <span>Rascunho</span>
                    ) : m.gameStatus === "scheduled" ? (
                      <span>Agendado</span>
                    ) : m.gameStatus === "live" ? (
                      <span>Em andamento</span>
                    ) : m.gameStatus === "final" ? (
                      <span>Finalizado</span>
                    ) : m.gameId ? (
                      <span>Aguardando resultado</span>
                    ) : (
                      <span>Pronto para agendar</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p>
        <Link
          className="button button-primary"
          to={`/admin/competitions/${edition.id}/publication`}
        >
          Revisar publicação da edição
        </Link>
      </p>
    </AdminArea>
  );
}
