import { useEffect, useRef } from "react";
import { data, Form, Link, redirect } from "react-router";

import { PlayerEligibilitySexField } from "../components/admin/player-private-fields";
import type { Route } from "./+types/admin._index";
import { cloudflareContext, correlationIdContext } from "../context";
import { recordAuthAuditEvent } from "../modules/auth/audit.server";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function meta() {
  return [{ title: "Administração — Base do Basquete" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const correlationId = context.get(correlationIdContext);
  const auth = await requireAdminAal2(request, env);
  await recordAuthAuditEvent(auth.client, "admin_access", correlationId);

  const [competitionsResult, seriesResult, categoriesResult, teamsResult, playersResult] =
    await Promise.all([
      auth.client
        .from("competitions")
        .select("id,display_name,year,status,series_id,category_id")
        .order("year", { ascending: false })
        .order("id", { ascending: false }),
      auth.client.from("competition_series").select("id,name"),
      auth.client.from("categories").select("id,name"),
      auth.client.from("teams").select("id,name,slug,abbreviation").order("name"),
      auth.client.from("players").select("id,full_name,slug").order("full_name"),
    ]);

  if (
    competitionsResult.error ||
    seriesResult.error ||
    categoriesResult.error ||
    teamsResult.error ||
    playersResult.error
  ) {
    throw new Error("Administrative dashboard query failed");
  }

  const seriesNames = new Map(seriesResult.data.map((row) => [row.id, row.name]));
  const categoryNames = new Map(categoriesResult.data.map((row) => [row.id, row.name]));
  const competitions = competitionsResult.data.map((competition) => ({
    ...competition,
    seriesName: seriesNames.get(competition.series_id) ?? "Série indisponível",
    categoryName: categoryNames.get(competition.category_id) ?? "Categoria indisponível",
  }));

  return data(
    {
      csrfToken: auth.payload.csrfToken,
      competitions,
      teams: teamsResult.data,
      players: playersResult.data,
      savedPlayerId: Number(new URL(request.url).searchParams.get("savedPlayer")) || null,
    },
    { headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
  );
}

export async function action({ request, context }: Route.ActionArgs) {
  assertSameOrigin(request);
  const { env } = context.get(cloudflareContext);
  const auth = await requireAdminAal2(request, env);
  const formData = await request.formData();
  assertCsrfToken(formData, auth.payload.csrfToken);
  const intent = formData.get("intent");

  if (intent === "create-team") {
    const name = String(formData.get("name") ?? "").trim();
    const slug = String(formData.get("slug") ?? "").trim();
    if (name.length < 2 || !slugPattern.test(slug)) {
      return data(
        { error: "Informe um nome e um slug minúsculo válido." },
        { status: 400, headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
      );
    }
    const abbreviation = String(formData.get("abbreviation") ?? "")
      .trim()
      .toUpperCase();
    const { error } = await auth.client.from("teams").insert({
      name,
      slug,
      abbreviation: abbreviation || null,
      is_public: false,
    });
    if (error) {
      return data(
        { error: error.code === "23505" ? "Essa equipe já existe." : "Falha ao criar equipe." },
        { status: 400, headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
      );
    }
  } else if (intent === "create-player") {
    const fullName = String(formData.get("name") ?? "").trim();
    const nickname = String(formData.get("nickname") ?? "").trim();
    const sex = String(formData.get("sex") ?? "");
    const allowSimilar = formData.get("allowSimilar") === "true";
    if (
      fullName.length < 2 ||
      fullName.length > 160 ||
      nickname.length > 80 ||
      (sex !== "male" && sex !== "female")
    ) {
      return data(
        {
          error: "Revise o nome, o apelido e a escolha explícita de elegibilidade.",
          playerError: true,
        },
        { status: 400, headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
      );
    }
    const result = await auth.client.rpc("admin_create_player_with_private_profile", {
      p_full_name: fullName,
      p_nickname: nickname || undefined,
      p_sex: sex,
      p_allow_similar: allowSimilar,
    });
    if (result.error) {
      const duplicate = result.error.code === "BD308";
      const similar = result.error.code === "BD311";
      const migrationPending = result.error.code === "42883" || result.error.code === "PGRST202";
      return data(
        {
          error: migrationPending
            ? "A criação privada estará disponível após aplicar a migração desta versão."
            : duplicate
              ? "Já existe um atleta com esse nome."
              : similar
                ? "Há um cadastro semelhante. Revise os atletas existentes antes de confirmar."
                : "Falha ao criar atleta.",
          requiresPlayerConfirmation: similar,
          playerError: true,
        },
        {
          status: migrationPending ? 503 : duplicate ? 409 : similar ? 422 : 400,
          headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined,
        },
      );
    }
    throw redirect(`/admin?savedPlayer=${result.data.id}`, {
      headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined,
    });
  } else {
    throw new Response("Ação inválida", { status: 400 });
  }

  throw redirect("/admin", {
    headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined,
  });
}

export default function AdminDashboard({ loaderData, actionData }: Route.ComponentProps) {
  const requiresPlayerConfirmation = Boolean(
    actionData &&
      "requiresPlayerConfirmation" in actionData &&
      actionData.requiresPlayerConfirmation,
  );
  const playerNameRef = useRef<HTMLInputElement>(null);
  const playerError = Boolean(actionData && "playerError" in actionData && actionData.playerError);
  useEffect(() => {
    if (playerError) playerNameRef.current?.focus();
  }, [playerError]);
  return (
    <main className="admin-shell">
      <header className="site-header admin-header">
        <a className="brand" href="/" aria-label="Base do Basquete — página inicial">
          <span className="brand-mark" aria-hidden="true">
            B
          </span>
          <span>Base do Basquete</span>
        </a>
        <span className="environment-pill">
          <span className="status-dot" />
          Sessão aal2
        </span>
      </header>

      <section className="admin-welcome admin-dashboard" aria-labelledby="admin-title">
        <p className="eyebrow">Administração segura</p>
        <h1 id="admin-title">Escolha uma edição.</h1>
        <p>O contexto é explícito antes de inscrições, elencos, jogos ou importações.</p>
        {actionData?.error ? <p className="form-error">{actionData.error}</p> : null}
        {loaderData.savedPlayerId ? (
          <output className="form-success">
            Atleta criado com o cadastro privado concluído.{" "}
            <Link to={`/admin/players/${loaderData.savedPlayerId}/private-profile`}>
              Abrir formulário protegido
            </Link>
            .
          </output>
        ) : null}

        <div className="admin-competition-grid">
          {loaderData.competitions.map((competition) => (
            <Link key={competition.id} to={`/admin/competitions/${competition.id}`}>
              <span>
                {competition.year} · {competition.status}
              </span>
              <strong>{competition.seriesName}</strong>
              <small>{competition.categoryName}</small>
            </Link>
          ))}
        </div>

        <div className="admin-global-grid">
          <section>
            <h2>Gestão global de equipes</h2>
            <p>{loaderData.teams.length} cadastradas</p>
            <Form method="post" className="compact-admin-form">
              <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
              <input type="hidden" name="intent" value="create-team" />
              <label>
                Nome
                <input required name="name" />
              </label>
              <label>
                Slug
                <input required name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" />
              </label>
              <label>
                Sigla
                <input name="abbreviation" maxLength={8} />
              </label>
              <button className="button button-primary" type="submit">
                Criar equipe
              </button>
            </Form>
          </section>
          <section>
            <h2>Gestão global de atletas</h2>
            <p>{loaderData.players.length} cadastrados</p>
            <Form method="post" className="compact-admin-form">
              <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
              <input type="hidden" name="intent" value="create-player" />
              <label>
                Nome completo
                <input ref={playerNameRef} required name="name" />
              </label>
              <label>
                Apelido <small>opcional</small>
                <input name="nickname" maxLength={80} />
              </label>
              <PlayerEligibilitySexField />
              <input type="hidden" name="allowSimilar" value={String(requiresPlayerConfirmation)} />
              {requiresPlayerConfirmation ? (
                <p className="admin-warning">
                  Confirme somente depois de verificar que não é um atleta já cadastrado.
                </p>
              ) : null}
              <button className="button button-primary" type="submit">
                {requiresPlayerConfirmation ? "Confirmar novo cadastro" : "Criar atleta"}
              </button>
            </Form>
            <details className="player-private-links">
              <summary>Formulários privados dos atletas</summary>
              <ul>
                {loaderData.players.map((player) => (
                  <li key={player.id}>
                    <span>{player.full_name}</span>
                    <Link to={`/admin/players/${player.id}/private-profile`}>Abrir</Link>
                  </li>
                ))}
              </ul>
            </details>
          </section>
        </div>

        <Form method="post" action="/admin/logout">
          <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
          <button className="button button-ghost" type="submit">
            Encerrar todas as sessões
          </button>
        </Form>
      </section>
    </main>
  );
}
