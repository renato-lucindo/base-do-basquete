import { data } from "react-router";

import type { Route } from "./+types/api.admin-players";
import { cloudflareContext, correlationIdContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";
import { logOperationalEvent } from "../modules/observability/operation.server";
import type { AdminPlayerSearchResult } from "../modules/players/admin-domain";

function parseId(value: string | FormDataEntryValue | null): number | null {
  const text = typeof value === "string" ? value : "";
  return /^[1-9][0-9]*$/.test(text) ? Number(text) : null;
}

function headers(cookie: string | null | undefined) {
  return cookie ? { "Set-Cookie": cookie } : undefined;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const auth = await requireAdminAal2(request, env);
  const url = new URL(request.url);
  const competitionId = parseId(url.searchParams.get("competitionId"));
  const registrationId = parseId(url.searchParams.get("registrationId"));
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (!competitionId) {
    return data(
      { error: "Edição inválida.", results: [] },
      { status: 400, headers: headers(auth.cookie) },
    );
  }
  if (query.length < 2) {
    return data({ results: [] }, { headers: headers(auth.cookie) });
  }

  const result = await auth.client.rpc("admin_search_players", {
    p_competition_id: competitionId,
    p_query: query,
    p_registration_id: registrationId ?? undefined,
    p_limit: 12,
  });
  if (result.error) {
    return data(
      { error: "Não foi possível pesquisar atletas.", results: [] },
      { status: result.error.code === "BD401" ? 403 : 503, headers: headers(auth.cookie) },
    );
  }

  const results: AdminPlayerSearchResult[] = result.data.map((player) => ({
    id: player.id,
    fullName: player.full_name,
    nickname: player.nickname,
    currentTeamName: player.current_team_name,
    editionJersey: player.edition_jersey,
    conflict:
      player.conflict_registration_id && player.conflict_team_name
        ? {
            registrationId: player.conflict_registration_id,
            teamName: player.conflict_team_name,
          }
        : null,
  }));
  return data({ results }, { headers: headers(auth.cookie) });
}

export async function action({ request, context }: Route.ActionArgs) {
  assertSameOrigin(request);
  const { env } = context.get(cloudflareContext);
  const correlationId = context.get(correlationIdContext);
  const startedAt = Date.now();
  const auth = await requireAdminAal2(request, env);
  const formData = await request.formData();
  assertCsrfToken(formData, auth.payload.csrfToken);
  if (formData.get("intent") !== "create-player") {
    throw new Response("Ação inválida", { status: 400 });
  }

  const fullName = String(formData.get("fullName") ?? "").trim();
  const nickname = String(formData.get("nickname") ?? "").trim();
  const allowSimilar = formData.get("allowSimilar") === "true";
  if (fullName.length < 2 || fullName.length > 160 || nickname.length > 80) {
    return data(
      { error: "Revise o nome e o apelido informados." },
      { status: 400, headers: headers(auth.cookie) },
    );
  }

  const result = await auth.client.rpc("admin_create_player", {
    p_full_name: fullName,
    p_nickname: nickname || undefined,
    p_allow_similar: allowSimilar,
  });
  if (result.error) {
    const duplicate = result.error.code === "BD308";
    const similar = result.error.code === "BD311";
    logOperationalEvent({
      correlationId,
      durationMs: Date.now() - startedAt,
      operation: "player.create",
      outcome: duplicate || similar ? "blocked" : "failure",
      status: duplicate ? 409 : similar ? 422 : 400,
      context: { errorCode: result.error.code },
    });
    return data(
      {
        error: duplicate
          ? "Já existe um atleta com esse nome."
          : similar
            ? "Há um cadastro semelhante. Revise os resultados e confirme para continuar."
            : "Não foi possível criar o atleta.",
        requiresConfirmation: similar,
      },
      { status: duplicate ? 409 : similar ? 422 : 400, headers: headers(auth.cookie) },
    );
  }

  logOperationalEvent({
    correlationId,
    durationMs: Date.now() - startedAt,
    operation: "player.create",
    outcome: "success",
    status: 201,
    context: { entityId: result.data.id },
  });
  return data(
    {
      player: {
        id: result.data.id,
        fullName: result.data.full_name,
        nickname: result.data.nickname,
        currentTeamName: null,
        editionJersey: null,
        conflict: null,
      } satisfies AdminPlayerSearchResult,
    },
    { status: 201, headers: headers(auth.cookie) },
  );
}
