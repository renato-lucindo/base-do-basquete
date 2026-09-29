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
  validateResolution,
  validateSchedule,
} from "../modules/competition/scheduling";
import type { Route } from "./+types/admin.competitions.$competitionId.schedule";

interface Schedule {
  entries: { id: number; seed: number; registrationId: number | null; label: string }[];
  matchups: {
    id: number;
    code: string;
    round: string;
    order: number;
    label: string;
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

export function scheduleFieldAccessibleName(field: string, matchupLabel: string) {
  return `${field} — ${matchupLabel}`;
}

interface ScheduleRegistration {
  id: number;
  status: string;
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
  let affectedMatchupId: number | null = null;
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
  } else if (form.get("intent") === "prepare") {
    affectedMatchupId = scheduleId(form.get("matchupId"));
    const parsed = validateSchedule(form);
    if (!parsed.ok)
      return data({ error: parsed.error, matchupId: affectedMatchupId }, { status: 400, headers });
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
    affectedMatchupId = scheduleId(form.get("matchupId"));
    const parsed = validateResolution(form);
    if (!parsed.ok)
      return data({ error: parsed.error, matchupId: affectedMatchupId }, { status: 400, headers });
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
  if (code)
    return data(
      { error: schedulingError(code), matchupId: affectedMatchupId },
      { status: 400, headers },
    );
  return redirect(`/admin/competitions/${id}/schedule?saved=1`, { headers });
}
export default function SchedulePage({ loaderData, actionData }: Route.ComponentProps) {
  const { edition, schedule, registrations, csrfToken } = loaderData;
  const busy = useNavigation().state !== "idle";
  const actionErrorRef = useRef<HTMLParagraphElement>(null);
  const errorMatchupId =
    actionData && "matchupId" in actionData && typeof actionData.matchupId === "number"
      ? actionData.matchupId
      : null;
  const errorMatchupLabel = schedule.matchups.find(({ id }) => id === errorMatchupId)?.label;
  useEffect(() => {
    if (actionData?.error) actionErrorRef.current?.focus();
  }, [actionData?.error]);
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
      {actionData?.error ? (
        <p id="schedule-action-error" ref={actionErrorRef} role="alert" tabIndex={-1}>
          {errorMatchupLabel ? `${errorMatchupLabel}: ` : ""}
          {actionData.error}
        </p>
      ) : null}
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
              {entry.label}: {name(entry.registrationId)}
            </p>
          ) : (
            <>
              <label>
                {entry.label}
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
      <h2>Confrontos e preparação</h2>
      {schedule.matchups.map((m) => {
        const localSchedule = scheduleLocalParts(m.scheduledAt);
        const canPrepare = m.readyToSchedule || m.gameId !== null;
        return (
          <section key={m.id} className="admin-card" aria-labelledby={`matchup-${m.id}`}>
            <h3 id={`matchup-${m.id}`}>{m.label}</h3>
            <p>
              {name(m.homeRegistrationId)} × {name(m.awayRegistrationId)}
            </p>
            <p>
              {m.gameId
                ? `Jogo #${m.gameId} preparado`
                : "Preparação privada; sem jogo até as duas vagas estarem resolvidas."}
            </p>
            {m.resolution ? (
              <p>
                Resultado confirmado: {m.resolution.homeScore} × {m.resolution.awayScore}.
                Classificado: {name(m.resolution.winnerRegistrationId)}.
              </p>
            ) : m.readyToResolve && m.officialResultSubmissionId ? (
              <Form method="post" className="admin-form">
                <input type="hidden" name="csrfToken" value={csrfToken} />
                <input type="hidden" name="intent" value="resolve" />
                <input type="hidden" name="matchupId" value={m.id} />
                <input
                  type="hidden"
                  name="officialResultSubmissionId"
                  value={m.officialResultSubmissionId}
                />
                <p>
                  Há um resultado oficial principal ativo. A equipe classificada será calculada no
                  banco.
                </p>
                <button type="submit" className="button button-primary" disabled={busy}>
                  Confirmar progressão pelo resultado oficial
                </button>
              </Form>
            ) : m.gameId ? (
              <p>
                O confronto será liberado para progressão somente após o resultado oficial ativo.
              </p>
            ) : null}
            {!canPrepare ? (
              <p className="admin-note">
                Este confronto ainda depende da definição das duas equipes nas posições anteriores.
              </p>
            ) : null}
            <Form
              method="post"
              className="admin-form"
              aria-label={`Preparar ${m.label}`}
              aria-describedby={errorMatchupId === m.id ? "schedule-action-error" : undefined}
            >
              <input type="hidden" name="csrfToken" value={csrfToken} />
              <input type="hidden" name="intent" value="prepare" />
              <input type="hidden" name="matchupId" value={m.id} />
              <input type="hidden" name="expectedRevision" value={m.revision} />
              <label>
                Data (opcional)
                <input
                  aria-label={scheduleFieldAccessibleName("Data (opcional)", m.label)}
                  name="scheduledDate"
                  type="date"
                  defaultValue={localSchedule.date}
                  disabled={!canPrepare}
                />
              </label>
              <label>
                Horário (opcional)
                <input
                  aria-label={scheduleFieldAccessibleName("Horário (opcional)", m.label)}
                  name="scheduledTime"
                  type="time"
                  defaultValue={localSchedule.time}
                  disabled={!canPrepare}
                  aria-describedby={`time-help-${m.id}`}
                />
              </label>
              <p id={`time-help-${m.id}`}>
                Horário oficial da competição: {competitionTimeZone}. O servidor converte a data e a
                hora para o instante canônico.
              </p>
              <label>
                Local (opcional)
                <input
                  aria-label={scheduleFieldAccessibleName("Local (opcional)", m.label)}
                  name="venue"
                  maxLength={160}
                  defaultValue={m.venue ?? ""}
                  disabled={!canPrepare}
                />
              </label>
              <button
                type="submit"
                className="button button-primary"
                disabled={busy || edition.status === "archived" || !canPrepare}
              >
                Salvar preparação
              </button>
            </Form>
          </section>
        );
      })}
    </AdminArea>
  );
}
