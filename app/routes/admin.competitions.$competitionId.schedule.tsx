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
  validateResolution,
  validateSchedule,
  validateScheduleBatch,
} from "../modules/competition/scheduling";
import type { Route } from "./+types/admin.competitions.$competitionId.schedule";

interface Schedule {
  entries: { id: number; seed: number; registrationId: number | null; label?: string }[];
  matchups: {
    id: number;
    code: string;
    round: string;
    order: number;
    label?: string;
    homeRegistrationId: number | null;
    awayRegistrationId: number | null;
    revision: number;
    scheduledAt: string | null;
    venue: string | null;
    gameId: number | null;
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

interface ScheduleRegistration {
  id: number;
  status: string;
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

export function getAssignableRegistrations<T extends ScheduleRegistration>(
  registrations: T[],
  entries: Schedule["entries"],
): T[] {
  const assignedRegistrationIds = new Set(
    entries.flatMap((entry) => (entry.registrationId ? [entry.registrationId] : [])),
  );
  return registrations.filter(
    (registration) =>
      registration.status === "confirmed" && !assignedRegistrationIds.has(registration.id),
  );
}

export function SchedulePrerequisiteNotice({
  competitionId,
  pendingCount,
}: {
  competitionId: number;
  pendingCount: number;
}) {
  return (
    <section className="admin-note" aria-labelledby="schedule-prerequisite-title">
      <h2 id="schedule-prerequisite-title">Confirme as equipes antes de ocupar as posições</h2>
      <p>
        {pendingCount === 1
          ? "Há uma inscrição aguardando confirmação."
          : `Há ${pendingCount} inscrições aguardando confirmação.`}{" "}
        A agenda usa somente equipes confirmadas.
      </p>
      <Link className="button button-primary" to={`/admin/competitions/${competitionId}`}>
        Revisar equipes
      </Link>
    </section>
  );
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const auth = await requireAdminAal2(request, context.get(cloudflareContext).env);
  const id = scheduleId(params.competitionId);
  if (!id) throw new Response("Edição não encontrada", { status: 404 });
  const [edition, schedule, registrations, teams] = await Promise.all([
    auth.client.from("competitions").select("id,display_name,status").eq("id", id).single(),
    auth.client.rpc("admin_get_competition_schedule", { p_competition_id: id }),
    auth.client.from("team_registrations").select("id,team_id,status").eq("competition_id", id),
    auth.client.from("teams").select("id,name"),
  ]);
  if (edition.error) throw new Response("Edição não encontrada", { status: 404 });
  if (schedule.error || registrations.error || teams.error)
    throw new Response("Agendamento indisponível. Tente novamente mais tarde.", { status: 503 });
  return data(
    {
      edition: edition.data,
      schedule: schedule.data as unknown as Schedule,
      registrations: registrations.data.map((r) => ({
        ...r,
        name: teams.data.find((t) => t.id === r.team_id)?.name ?? "Equipe",
      })),
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
  if (form.get("intent") === "assign") {
    const entryId = scheduleId(form.get("entryId"));
    const registrationId = scheduleId(form.get("registrationId"));
    if (!entryId || !registrationId)
      return data(
        { error: "Escolha explicitamente uma equipe confirmada." },
        { status: 400, headers },
      );
    const entry = await auth.client
      .from("competition_entries")
      .select("id")
      .eq("id", entryId)
      .eq("competition_id", id)
      .maybeSingle();
    if (entry.error || !entry.data) throw new Response("Vaga não encontrada", { status: 404 });
    code = (
      await auth.client.rpc("admin_assign_competition_entry", {
        p_entry_id: entryId,
        p_registration_id: registrationId,
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
  const { edition, schedule, registrations, csrfToken } = loaderData;
  const busy = useNavigation().state !== "idle";
  const confirmedRegistrations = registrations.filter(
    (registration) => registration.status === "confirmed",
  );
  const pendingRegistrationCount = registrations.length - confirmedRegistrations.length;
  const assignableRegistrations = getAssignableRegistrations(registrations, schedule.entries);
  const name = (id: number | null) =>
    registrations.find((r) => r.id === id)?.name ?? "Vaga pendente";
  return (
    <AdminArea title={`Estrutura e agenda — ${edition.display_name}`}>
      <Link to={`/admin/competitions/${edition.id}`}>Voltar ao hub</Link>
      <p>
        Atribua as equipes às posições explicitamente. Preparar ou agendar não publica a edição.
        Atribuições confirmadas não podem ser trocadas neste fluxo.
      </p>
      {actionData?.error ? <p role="alert">{actionData.error}</p> : null}
      {schedule.entries.length > 0 && confirmedRegistrations.length === 0 ? (
        <SchedulePrerequisiteNotice
          competitionId={edition.id}
          pendingCount={pendingRegistrationCount}
        />
      ) : null}
      <h2>Posições de entrada</h2>
      {!schedule.entries.length ? (
        <p>Esta edição não possui preset operacional. O histórico foi preservado.</p>
      ) : null}
      {schedule.entries.map((entry) => (
        <Form method="post" key={entry.id} className="admin-form">
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <input type="hidden" name="intent" value="assign" />
          <input type="hidden" name="entryId" value={entry.id} />
          {entry.registrationId ? (
            <p>
              {scheduleEntryLabel(entry)}: {name(entry.registrationId)}
            </p>
          ) : (
            <>
              <label>
                {scheduleEntryLabel(entry)}
                <select
                  name="registrationId"
                  required
                  defaultValue=""
                  disabled={assignableRegistrations.length === 0}
                >
                  <option value="" disabled>
                    {assignableRegistrations.length
                      ? "Selecione a equipe"
                      : "Nenhuma equipe confirmada disponível"}
                  </option>
                  {assignableRegistrations.map((registration) => (
                    <option key={registration.id} value={registration.id}>
                      {registration.name}
                    </option>
                  ))}
                </select>
              </label>
              {assignableRegistrations.length === 0 ? (
                <p>Confirme outra equipe no hub para liberar esta posição.</p>
              ) : null}
              <button
                type="submit"
                className="button button-primary"
                disabled={
                  busy || edition.status !== "draft" || assignableRegistrations.length === 0
                }
              >
                Confirmar equipe nesta posição
              </button>
            </>
          )}
        </Form>
      ))}
      <h2>Confrontos e agenda</h2>
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
          {busy ? "Salvando…" : "Salvar jogos selecionados"}
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
                    {name(m.homeRegistrationId)} × {name(m.awayRegistrationId)}
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
                      <span>Aguardando definição das equipes</span>
                    ) : m.gameId ? (
                      <span>Aguardando resultado oficial</span>
                    ) : (
                      <span>Pronto para preparar</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminArea>
  );
}
