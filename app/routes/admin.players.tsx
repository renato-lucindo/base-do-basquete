import { useEffect, useRef } from "react";
import { data, Form, Link, redirect } from "react-router";
import { AdminArea } from "../components/admin/admin-area";
import { PlayerEligibilitySexField } from "../components/admin/player-private-fields";
import { cloudflareContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";
import type { Route } from "./+types/admin.players";
export function meta() {
  return [{ title: "Atletas — Administração" }];
}
export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const auth = await requireAdminAal2(request, env);
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  const result = await auth.client
    .from("players")
    .select("id,full_name,slug")
    .ilike("full_name", pattern)
    .order("full_name")
    .limit(50);
  if (result.error) throw new Error("Administrative players query failed");
  return data(
    {
      csrfToken: auth.payload.csrfToken,
      query,
      players: result.data,
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

  if (intent !== "create-player") throw new Response("Ação inválida", { status: 400 });
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
  throw redirect(`/admin/players?savedPlayer=${result.data.id}`, {
    headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined,
  });
}
export default function Players({ loaderData, actionData }: Route.ComponentProps) {
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
    <AdminArea title="Atletas">
      {actionData?.error ? (
        <p role="alert" className="form-error">
          {actionData.error}
        </p>
      ) : null}
      {loaderData.savedPlayerId ? (
        <output className="form-success">
          Atleta criado.{" "}
          <Link to={`/admin/players/${loaderData.savedPlayerId}/private-profile`}>
            Abrir formulário protegido
          </Link>
        </output>
      ) : null}
      <Form method="get" className="inline-admin-form">
        <label>
          Buscar por nome
          <input name="q" maxLength={80} defaultValue={loaderData.query} />
        </label>
        <button className="button button-ghost" type="submit">
          Buscar
        </button>
      </Form>
      <p>Até 50 atletas por busca. Consulte os cadastros existentes antes de criar um novo.</p>
      <section>
        <h2>Criar atleta</h2>{" "}
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
    </AdminArea>
  );
}
