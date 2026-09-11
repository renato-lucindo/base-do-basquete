import { data, Form, Link, redirect, useNavigation } from "react-router";
import { AdminArea } from "../components/admin/admin-area";
import { cloudflareContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";
import { scheduleId, schedulingError, validateSchedule } from "../modules/competition/scheduling";
import type { Route } from "./+types/admin.competitions.$competitionId.schedule";

interface Schedule {
  entries: { id: number; seed: number; registrationId: number | null }[];
  matchups: {
    id: number;
    code: string;
    round: string;
    order: number;
    homeRegistrationId: number | null;
    awayRegistrationId: number | null;
    revision: number;
    scheduledAt: string | null;
    venue: string | null;
    gameId: number | null;
  }[];
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
        p_scheduled_at: parsed.input.scheduledAt,
        p_venue: parsed.input.venue,
      })
    ).error?.code;
  } else throw new Response("Ação inválida", { status: 400 });
  if (code) return data({ error: schedulingError(code) }, { status: 400, headers });
  return redirect(`/admin/competitions/${id}/schedule?saved=1`, { headers });
}
export default function SchedulePage({ loaderData, actionData }: Route.ComponentProps) {
  const { edition, schedule, registrations, csrfToken } = loaderData;
  const busy = useNavigation().state !== "idle";
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
              Posição {entry.seed}: {name(entry.registrationId)}
            </p>
          ) : (
            <>
              <label>
                Posição {entry.seed}
                <select name="registrationId" required defaultValue="">
                  <option value="" disabled>
                    Selecione a equipe
                  </option>
                  {registrations
                    .filter(
                      (r) =>
                        r.status === "confirmed" &&
                        !schedule.entries.some((e) => e.registrationId === r.id),
                    )
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </select>
              </label>
              <button
                type="submit"
                className="button button-primary"
                disabled={busy || edition.status !== "draft"}
              >
                Confirmar equipe nesta posição
              </button>
            </>
          )}
        </Form>
      ))}
      <h2>Confrontos e preparação</h2>
      {schedule.matchups.map((m) => (
        <section key={m.id} className="admin-card">
          <h3>
            {m.round} — confronto {m.order}
          </h3>
          <p>
            {name(m.homeRegistrationId)} × {name(m.awayRegistrationId)}
          </p>
          <p>
            {m.gameId
              ? `Jogo #${m.gameId} preparado`
              : "Preparação privada; sem jogo até as duas vagas estarem resolvidas."}
          </p>
          <Form method="post" className="admin-form">
            <input type="hidden" name="csrfToken" value={csrfToken} />
            <input type="hidden" name="intent" value="prepare" />
            <input type="hidden" name="matchupId" value={m.id} />
            <input type="hidden" name="expectedRevision" value={m.revision} />
            <label>
              Data e horário com fuso (opcional)
              <input
                name="scheduledAt"
                defaultValue={
                  m.scheduledAt ? `${new Date(m.scheduledAt).toISOString().slice(0, 16)}Z` : ""
                }
                placeholder="2026-09-15T19:30-03:00"
                aria-describedby={`time-help-${m.id}`}
              />
            </label>
            <p id={`time-help-${m.id}`}>
              Informe o fuso explicitamente: -03:00 para São Paulo atual ou Z para UTC. O período é
              validado no banco em America/Sao_Paulo.
            </p>
            <label>
              Local (opcional)
              <input name="venue" maxLength={160} defaultValue={m.venue ?? ""} />
            </label>
            <button
              type="submit"
              className="button button-primary"
              disabled={busy || edition.status !== "draft"}
            >
              Salvar preparação privada
            </button>
          </Form>
        </section>
      ))}
    </AdminArea>
  );
}
