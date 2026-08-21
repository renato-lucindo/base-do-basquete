import { data, Form, Link, redirect } from "react-router";

import type { Route } from "./+types/admin.competitions.$competitionId";
import { cloudflareContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";
import { mapAdminDomainError, normalizeJersey } from "../modules/competition/admin-domain";

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
    playersResult,
    gamesResult,
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
    auth.client
      .from("players")
      .select("id,full_name,slug,is_active")
      .eq("is_active", true)
      .order("full_name"),
    auth.client
      .from("games")
      .select("id", { count: "exact", head: true })
      .eq("competition_id", competitionId),
  ]);

  if (
    seriesResult.error ||
    categoryResult.error ||
    registrationsResult.error ||
    teamsResult.error ||
    playersResult.error ||
    gamesResult.error
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

  const teamNames = new Map(teamsResult.data.map((team) => [team.id, team.name]));
  const registrations = registrationsResult.data.map((registration) => ({
    ...registration,
    teamName: teamNames.get(registration.team_id) ?? "Equipe indisponível",
    roster: rosterResult.data.filter((entry) => entry.registration_id === registration.id),
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
      players: playersResult.data,
      gameCount: gamesResult.count ?? 0,
    },
    { headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
  );
}

export async function action({ request, params, context }: Route.ActionArgs) {
  assertSameOrigin(request);
  const competitionId = parseId(params.competitionId);
  if (!competitionId) throw new Response("Edição não encontrada", { status: 404 });
  const { env } = context.get(cloudflareContext);
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
  } else {
    throw new Response("Ação inválida", { status: 400 });
  }

  if (result.error) {
    const mapped = mapAdminDomainError(result.error.code);
    return data(
      { error: mapped.message },
      {
        status: mapped.code === "authorization" ? 403 : 400,
        headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined,
      },
    );
  }
  throw redirect(`/admin/competitions/${competitionId}`, {
    headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined,
  });
}

export default function CompetitionHub({ loaderData, actionData }: Route.ComponentProps) {
  const { competition } = loaderData;
  return (
    <main className="admin-shell">
      <header className="site-header admin-header">
        <Link className="brand" to="/admin">
          <span className="brand-mark">BB</span>
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
            <strong>{loaderData.players.length}</strong>
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
                <Form method="post" className="roster-form">
                  <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
                  <input type="hidden" name="intent" value="replace-roster" />
                  <input type="hidden" name="registrationId" value={registration.id} />
                  <fieldset>
                    <legend>Elenco completo</legend>
                    {loaderData.players.map((player) => {
                      const current = registration.roster.find(
                        (entry) => entry.player_id === player.id,
                      );
                      return (
                        <label key={player.id}>
                          <input
                            type="checkbox"
                            name="playerId"
                            value={player.id}
                            defaultChecked={Boolean(current)}
                          />
                          <span>{player.full_name}</span>
                          <input
                            aria-label={`Camisa de ${player.full_name}`}
                            name={`jersey-${player.id}`}
                            defaultValue={current?.jersey_number ?? ""}
                            placeholder="Camisa"
                          />
                        </label>
                      );
                    })}
                  </fieldset>
                  <button className="button button-primary" type="submit">
                    Salvar elenco em uma transação
                  </button>
                </Form>
              ) : null}
            </article>
          ))}
        </div>

        <section className="admin-action-grid">
          <article>
            <h2>Súmula manual</h2>
            <p>Fluxo isolado da importação, usando esta edição.</p>
            <span>Disponível no WP-07</span>
          </article>
          <article>
            <h2>Importar boxscore</h2>
            <p>Somente FIBA/Genius Sports, usando esta edição.</p>
            <span>Disponível no WP-09</span>
          </article>
        </section>
      </section>
    </main>
  );
}
