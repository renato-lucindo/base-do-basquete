import { data, Form, Link, redirect, useNavigation } from "react-router";

import { RosterEditor } from "../components/admin/roster-editor";
import { cloudflareContext, correlationIdContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";
import {
  mapAdminDomainError,
  normalizeFinalResult,
  normalizeJersey,
} from "../modules/competition/admin-domain";
import { logOperationalEvent } from "../modules/observability/operation.server";
import type { Route } from "./+types/admin.competitions.$competitionId";

function parseId(value: string | FormDataEntryValue | null): number | null {
  const text = typeof value === "string" ? value : "";
  return /^[1-9][0-9]*$/.test(text) ? Number(text) : null;
}

export function meta() {
  return [{ title: "Hub da edição — Base do Basquete" }];
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const competitionId = parseId(params.competitionId);
  if (!competitionId) throw new Response("Edição não encontrada", { status: 404 });
  const { env } = context.get(cloudflareContext);
  const auth = await requireAdminAal2(request, env);

  const competitionResult = await auth.client
    .from("competitions")
    .select("id,display_name,year,status,series_id,category_id")
    .eq("id", competitionId)
    .limit(1);
  if (competitionResult.error) throw new Error("Competition hub query failed");
  const competition = competitionResult.data[0];
  if (!competition) throw new Response("Edição não encontrada", { status: 404 });

  const [
    seriesResult,
    categoryResult,
    registrationsResult,
    teamsResult,
    playerCountResult,
    gamesResult,
    placementsResult,
  ] = await Promise.all([
    auth.client.from("competition_series").select("name").eq("id", competition.series_id).single(),
    auth.client.from("categories").select("name").eq("id", competition.category_id).single(),
    auth.client
      .from("team_registrations")
      .select("id,team_id,status,confirmed_at")
      .eq("competition_id", competitionId)
      .order("id"),
    auth.client
      .from("teams")
      .select("id,name,slug,abbreviation,is_active")
      .eq("is_active", true)
      .order("name"),
    auth.client.from("players").select("id", { count: "exact", head: true }).eq("is_active", true),
    auth.client
      .from("games")
      .select("id", { count: "exact", head: true })
      .eq("competition_id", competitionId),
    auth.client
      .from("final_placements")
      .select("id,registration_id,result_status,placement,result_label,confirmed_at")
      .eq("competition_id", competitionId),
  ]);

  if (
    seriesResult.error ||
    categoryResult.error ||
    registrationsResult.error ||
    teamsResult.error ||
    playerCountResult.error ||
    gamesResult.error ||
    placementsResult.error
  )
    throw new Error("Competition hub query failed");

  const registrationIds = registrationsResult.data.map((registration) => registration.id);
  const rosterResult = registrationIds.length
    ? await auth.client
        .from("roster_entries")
        .select("registration_id,player_id,jersey_number,status")
        .in("registration_id", registrationIds)
        .eq("status", "active")
    : { data: [], error: null };
  if (rosterResult.error) throw new Error("Competition roster query failed");

  const teamIds = registrationsResult.data.map((registration) => registration.team_id);
  const previousRegistrationsResult = teamIds.length
    ? await auth.client
        .from("team_registrations")
        .select("id,team_id,competition_id,updated_at")
        .in("team_id", teamIds)
        .neq("competition_id", competitionId)
        .in("status", ["confirmed", "completed"])
        .order("updated_at", { ascending: false })
    : { data: [], error: null };
  if (previousRegistrationsResult.error) throw new Error("Previous roster query failed");
  const latestPreviousByTeam = new Map<number, (typeof previousRegistrationsResult.data)[number]>();
  for (const registration of previousRegistrationsResult.data) {
    if (!latestPreviousByTeam.has(registration.team_id)) {
      latestPreviousByTeam.set(registration.team_id, registration);
    }
  }
  const previousRegistrationIds = [...latestPreviousByTeam.values()].map(({ id }) => id);
  const previousRosterResult = previousRegistrationIds.length
    ? await auth.client
        .from("roster_entries")
        .select("registration_id,player_id,jersey_number,status")
        .in("registration_id", previousRegistrationIds)
        .eq("status", "active")
    : { data: [], error: null };
  if (previousRosterResult.error) throw new Error("Previous roster entries query failed");

  const playerIds = [
    ...new Set(
      [...rosterResult.data, ...previousRosterResult.data].map((entry) => entry.player_id),
    ),
  ];
  let rosterPlayers: Array<{ id: number; full_name: string; nickname: string | null }> = [];
  if (playerIds.length) {
    const rosterPlayersResult = await auth.client
      .from("players")
      .select("id,full_name,nickname")
      .in("id", playerIds);
    if (rosterPlayersResult.error) {
      // The shared preview database can lag behind a draft PR. Keep the hub
      // usable without exposing more player data while the nickname migration
      // is still pending there.
      const compatiblePlayersResult = await auth.client
        .from("players")
        .select("id,full_name")
        .in("id", playerIds);
      if (compatiblePlayersResult.error) throw new Error("Roster players query failed");
      rosterPlayers = compatiblePlayersResult.data.map((player) => ({
        ...player,
        nickname: null,
      }));
    } else {
      rosterPlayers = rosterPlayersResult.data;
    }
  }
  const previousCompetitionIds = [
    ...new Set([...latestPreviousByTeam.values()].map(({ competition_id }) => competition_id)),
  ];
  const previousCompetitionsResult = previousCompetitionIds.length
    ? await auth.client
        .from("competitions")
        .select("id,display_name")
        .in("id", previousCompetitionIds)
    : { data: [], error: null };
  if (previousCompetitionsResult.error) throw new Error("Previous competition query failed");

  const teamNames = new Map(teamsResult.data.map((team) => [team.id, team.name]));
  const registrationById = new Map(
    registrationsResult.data.map((registration) => [registration.id, registration]),
  );
  const currentRosterByPlayer = new Map(rosterResult.data.map((entry) => [entry.player_id, entry]));
  const playerById = new Map(rosterPlayers.map((player) => [player.id, player]));
  const previousCompetitionNames = new Map(
    previousCompetitionsResult.data.map((item) => [item.id, item.display_name]),
  );
  const registrations = registrationsResult.data.map((registration) => ({
    ...registration,
    teamName: teamNames.get(registration.team_id) ?? "Equipe indisponível",
    roster: rosterResult.data
      .filter((entry) => entry.registration_id === registration.id)
      .flatMap((entry) => {
        const player = playerById.get(entry.player_id);
        return player
          ? [
              {
                id: player.id,
                fullName: player.full_name,
                nickname: player.nickname,
                currentTeamName: teamNames.get(registration.team_id) ?? null,
                editionJersey: entry.jersey_number,
                conflict: null,
                jerseyNumber: entry.jersey_number ?? "",
              },
            ]
          : [];
      }),
    suggestedRoster: (() => {
      const previous = latestPreviousByTeam.get(registration.team_id);
      if (!previous) return [];
      return previousRosterResult.data
        .filter((entry) => entry.registration_id === previous.id)
        .flatMap((entry) => {
          const player = playerById.get(entry.player_id);
          const currentEntry = currentRosterByPlayer.get(entry.player_id);
          const conflictRegistration = currentEntry
            ? registrationById.get(currentEntry.registration_id)
            : null;
          return player
            ? [
                {
                  id: player.id,
                  fullName: player.full_name,
                  nickname: player.nickname,
                  currentTeamName: null,
                  editionJersey: entry.jersey_number,
                  conflict:
                    currentEntry && currentEntry.registration_id !== registration.id
                      ? {
                          registrationId: currentEntry.registration_id,
                          teamName:
                            (conflictRegistration && teamNames.get(conflictRegistration.team_id)) ??
                            "outra equipe",
                        }
                      : null,
                  jerseyNumber: entry.jersey_number ?? "",
                },
              ]
            : [];
        });
    })(),
    suggestionLabel: (() => {
      const previous = latestPreviousByTeam.get(registration.team_id);
      return previous
        ? `Elenco de ${previousCompetitionNames.get(previous.competition_id) ?? "edição anterior"}`
        : null;
    })(),
    finalPlacement:
      placementsResult.data.find((placement) => placement.registration_id === registration.id) ??
      null,
  }));
  const registeredTeamIds = new Set(registrations.map((registration) => registration.team_id));

  return data(
    {
      csrfToken: auth.payload.csrfToken,
      competition: {
        ...competition,
        seriesName: seriesResult.data.name,
        categoryName: categoryResult.data.name,
      },
      registrations,
      availableTeams: teamsResult.data.filter((team) => !registeredTeamIds.has(team.id)),
      playerCount: playerCountResult.count ?? 0,
      gameCount: gamesResult.count ?? 0,
      savedRosterId: parseId(new URL(request.url).searchParams.get("savedRoster")),
    },
    { headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
  );
}

export async function action({ request, params, context }: Route.ActionArgs) {
  assertSameOrigin(request);
  const competitionId = parseId(params.competitionId);
  if (!competitionId) throw new Response("Edição não encontrada", { status: 404 });
  const { env } = context.get(cloudflareContext);
  const correlationId = context.get(correlationIdContext);
  const startedAt = Date.now();
  const auth = await requireAdminAal2(request, env);
  const formData = await request.formData();
  assertCsrfToken(formData, auth.payload.csrfToken);
  const intent = formData.get("intent");

  let result: { error: { code?: string } | null };
  if (intent === "register-team") {
    const teamId = parseId(formData.get("teamId"));
    if (!teamId) return data({ error: "Selecione uma equipe." }, { status: 400 });
    result = await auth.client.rpc("admin_create_team_registration", {
      p_competition_id: competitionId,
      p_team_id: teamId,
    });
  } else if (intent === "transition-registration") {
    const registrationId = parseId(formData.get("registrationId"));
    const status = String(formData.get("status") ?? "");
    if (!registrationId) return data({ error: "Inscrição inválida." }, { status: 400 });
    result = await auth.client.rpc("admin_transition_team_registration", {
      p_registration_id: registrationId,
      p_status: status,
    });
  } else if (intent === "replace-roster") {
    const registrationId = parseId(formData.get("registrationId"));
    if (!registrationId) return data({ error: "Inscrição inválida." }, { status: 400 });
    const entries: Array<{ playerId: number; jerseyNumber: string | null }> = [];
    for (const value of formData.getAll("playerId")) {
      const playerId = parseId(value);
      if (!playerId) return data({ error: "Atleta inválido." }, { status: 400 });
      const jersey = normalizeJersey(String(formData.get(`jersey-${playerId}`) ?? ""));
      if (!jersey.ok) return data({ error: jersey.error.message }, { status: 400 });
      entries.push({ playerId, jerseyNumber: jersey.value });
    }
    result = await auth.client.rpc("admin_replace_roster", {
      p_registration_id: registrationId,
      p_entries: entries,
    });
  } else if (intent === "confirm-placement") {
    const registrationId = parseId(formData.get("registrationId"));
    if (!registrationId) return data({ error: "Inscrição inválida." }, { status: 400 });
    const normalized = normalizeFinalResult(
      String(formData.get("resultStatus") ?? ""),
      String(formData.get("placement") ?? ""),
      String(formData.get("resultLabel") ?? ""),
    );
    if (!normalized.ok) return data({ error: normalized.error.message }, { status: 400 });
    result = await auth.client.rpc("admin_confirm_final_placement", {
      p_registration_id: registrationId,
      p_result_status: normalized.value.status,
      p_placement: normalized.value.placement ?? undefined,
      p_result_label: normalized.value.label ?? undefined,
    });
  } else {
    throw new Response("Ação inválida", { status: 400 });
  }

  if (result.error) {
    const mapped = mapAdminDomainError(result.error.code);
    const status = mapped.code === "authorization" ? 403 : 400;
    if (intent === "replace-roster") {
      logOperationalEvent({
        correlationId,
        durationMs: Date.now() - startedAt,
        operation: "roster.replace",
        outcome: mapped.code === "authorization" ? "blocked" : "failure",
        status,
        context: { competitionId, errorCode: result.error.code },
      });
    }
    return data(
      { error: mapped.message },
      {
        status,
        headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined,
      },
    );
  }
  if (intent === "replace-roster") {
    logOperationalEvent({
      correlationId,
      durationMs: Date.now() - startedAt,
      operation: "roster.replace",
      outcome: "success",
      status: 303,
      context: { competitionId },
    });
  }
  throw redirect(
    intent === "replace-roster"
      ? `/admin/competitions/${competitionId}?savedRoster=${formData.get("registrationId")}`
      : `/admin/competitions/${competitionId}`,
    {
      headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined,
    },
  );
}

export default function CompetitionHub({ loaderData, actionData }: Route.ComponentProps) {
  const { competition } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";
  return (
    <main className="admin-shell">
      <header className="site-header admin-header">
        <Link className="brand" to="/admin">
          <span className="brand-mark">B</span>
          <span>Administração</span>
        </Link>
        <span className="environment-pill">
          <span className="status-dot" />
          AAL2
        </span>
      </header>
      <section className="admin-welcome admin-hub">
        <p className="eyebrow">Hub da edição</p>
        <h1>{competition.display_name}</h1>
        <p>
          {competition.seriesName} · {competition.year} · {competition.categoryName} ·{" "}
          {competition.status}
        </p>
        {actionData?.error ? <p className="form-error">{actionData.error}</p> : null}

        <div className="admin-status-grid">
          <article>
            <span>Equipes</span>
            <strong>{loaderData.registrations.length}</strong>
          </article>
          <article>
            <span>Atletas disponíveis</span>
            <strong>{loaderData.playerCount}</strong>
          </article>
          <article>
            <span>Jogos</span>
            <strong>{loaderData.gameCount}</strong>
          </article>
        </div>

        <section className="admin-panel">
          <h2>Inscrever equipe</h2>
          <Form method="post" className="inline-admin-form">
            <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
            <input type="hidden" name="intent" value="register-team" />
            <label>
              Equipe
              <select name="teamId" required defaultValue="">
                <option value="" disabled>
                  Selecione
                </option>
                {loaderData.availableTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="button button-primary" type="submit">
              Criar inscrição
            </button>
          </Form>
        </section>

        <div className="registration-list">
          {loaderData.registrations.map((registration) => (
            <article className="registration-card" key={registration.id}>
              <div>
                <span>{registration.status}</span>
                <h2>{registration.teamName}</h2>
                <p>{registration.roster.length} atletas ativos</p>
              </div>
              {registration.status === "draft" || registration.status === "confirmed" ? (
                <Form method="post" className="inline-admin-form">
                  <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
                  <input type="hidden" name="intent" value="transition-registration" />
                  <input type="hidden" name="registrationId" value={registration.id} />
                  <label>
                    Estado
                    <select name="status" defaultValue="">
                      <option value="" disabled>
                        Alterar para
                      </option>
                      {registration.status === "draft" ? (
                        <option value="confirmed">Confirmada</option>
                      ) : (
                        <option value="completed">Concluída</option>
                      )}
                      <option value="withdrawn">Retirada</option>
                    </select>
                  </label>
                  <button className="button button-ghost" type="submit">
                    Atualizar
                  </button>
                </Form>
              ) : null}
              {registration.status !== "withdrawn" && registration.status !== "completed" ? (
                <RosterEditor
                  competitionId={competition.id}
                  csrfToken={loaderData.csrfToken}
                  registrationId={registration.id}
                  teamName={registration.teamName}
                  currentRoster={registration.roster}
                  suggestedRoster={registration.suggestedRoster}
                  suggestionLabel={registration.suggestionLabel}
                  saved={loaderData.savedRosterId === registration.id}
                />
              ) : null}
              {registration.status !== "draft" ? (
                <Form method="post" className="inline-admin-form final-result-form">
                  <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
                  <input type="hidden" name="intent" value="confirm-placement" />
                  <input type="hidden" name="registrationId" value={registration.id} />
                  <label>
                    Resultado final
                    <select
                      name="resultStatus"
                      required
                      defaultValue={registration.finalPlacement?.result_status ?? ""}
                    >
                      <option value="" disabled>
                        Selecione
                      </option>
                      <option value="placed">Classificada</option>
                      <option value="withdrawn">Retirada</option>
                      <option value="disqualified">Desclassificada</option>
                    </select>
                  </label>
                  <label>
                    Colocação
                    <input
                      name="placement"
                      type="number"
                      min="1"
                      step="1"
                      defaultValue={registration.finalPlacement?.placement ?? ""}
                      placeholder="Somente classificada"
                    />
                  </label>
                  <label>
                    Rótulo editorial
                    <input
                      name="resultLabel"
                      minLength={2}
                      maxLength={80}
                      defaultValue={registration.finalPlacement?.result_label ?? ""}
                      placeholder="Ex.: Campeã estadual"
                    />
                  </label>
                  <button className="button button-primary" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Confirmando…" : "Confirmar resultado final"}
                  </button>
                  {registration.finalPlacement?.confirmed_at ? (
                    <small>
                      Confirmado: {registration.finalPlacement.result_status}
                      {registration.finalPlacement.placement
                        ? ` · ${registration.finalPlacement.placement}º lugar`
                        : ""}
                    </small>
                  ) : null}
                </Form>
              ) : null}
            </article>
          ))}
        </div>

        <section className="admin-action-grid">
          <article>
            <h2>Súmula manual</h2>
            <p>Fluxo isolado da importação, usando esta edição.</p>
            <Link
              className="button button-primary"
              to={`/admin/competitions/${competition.id}/scoresheets/new`}
            >
              Criar jogo e preencher súmula
            </Link>
          </article>
          <article>
            <h2>Importar boxscore</h2>
            <p>Somente FIBA/Genius Sports, usando esta edição.</p>
            <Link
              className="button button-primary"
              to={`/admin/competitions/${competition.id}/boxscores/import`}
            >
              Enviar e revisar PDF
            </Link>
          </article>
        </section>
      </section>
    </main>
  );
}
