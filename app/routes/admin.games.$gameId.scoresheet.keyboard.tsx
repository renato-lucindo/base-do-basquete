import { data, Link } from "react-router";
import { cloudflareContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";
import { type Sheet, validateSheet } from "../modules/keyboard-scoresheet/domain";
import { type KeyboardContext, KeyboardScoresheet } from "../modules/keyboard-scoresheet/editor";
import {
  SaveFailure,
  type SaveRequest,
  type SaveResult,
  saveSchema,
} from "../modules/keyboard-scoresheet/server";
import type { Json } from "../types/database.generated";
import type { Route } from "./+types/admin.games.$gameId.scoresheet.keyboard";

function gameId(value: string | undefined) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result <= 0)
    throw new Response("Jogo inválido", { status: 400 });
  return result;
}
function headers(cookie: string | null) {
  return { "Cache-Control": "private, no-store", ...(cookie ? { "Set-Cookie": cookie } : {}) };
}
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const auth = await requireAdminAal2(request, context.get(cloudflareContext).env);
  const id = gameId(params.gameId);
  const [gameResult, participantsResult, sheetResult] = await Promise.all([
    auth.client
      .from("games")
      .select("id,competition_id,game_number,matchup_id")
      .eq("id", id)
      .single(),
    auth.client.from("game_participants").select("side,registration_id").eq("game_id", id),
    auth.client
      .from("keyboard_scoresheets")
      .select("document,version,submission_id")
      .eq("game_id", id)
      .maybeSingle(),
  ]);
  if (gameResult.error || !gameResult.data || participantsResult.error)
    throw new Response("Jogo indisponível", { status: 404, headers: headers(auth.cookie) });
  if (sheetResult.error)
    throw new Response("O módulo por teclado aguarda a migration no ambiente de preview.", {
      status: 503,
      headers: headers(auth.cookie),
    });
  const participants = participantsResult.data;
  if (participants.length !== 2 || !gameResult.data.matchup_id)
    throw new Response("Organize o confronto e as duas equipes na agenda.", {
      status: 409,
      headers: headers(auth.cookie),
    });
  const registrationIds = participants.map((p) => p.registration_id);
  const historicalIds = sheetResult.data
    ? validateSheet(sheetResult.data.document).roster.map((slot) => slot.rosterEntryId)
    : [];
  const [rosterResult, registrationsResult, profileResult, historicalResult] = await Promise.all([
    auth.client
      .from("roster_entries")
      .select("id,registration_id,player_id,jersey_number")
      .in("registration_id", registrationIds)
      .eq("status", "active"),
    auth.client
      .from("team_registrations")
      .select("id,team_id,public_name,status")
      .in("id", registrationIds),
    auth.client
      .from("competitions")
      .select("data_profile_id")
      .eq("id", gameResult.data.competition_id)
      .single(),
    historicalIds.length
      ? auth.client.from("roster_entries").select("id,registration_id,player_id,jersey_number").in("id", historicalIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (rosterResult.error || historicalResult.error) throw new Error("Keyboard roster query failed");
  if (profileResult.error || !profileResult.data?.data_profile_id)
    throw new Response("Perfil de dados indisponível.", {
      status: 503,
      headers: headers(auth.cookie),
    });
  const sourceResult = await auth.client
    .from("series_category_data_profiles")
    .select("primary_source")
    .eq("id", profileResult.data.data_profile_id)
    .single();
  if (sourceResult.error || !sourceResult.data)
    throw new Response("Perfil de dados indisponível.", {
      status: 503,
      headers: headers(auth.cookie),
    });
  const requiresFallback = sourceResult.data.primary_source === "fiba_boxscore";
  const roster = [...rosterResult.data, ...historicalResult.data].filter(
    (entry, index, entries) => entries.findIndex((item) => item.id === entry.id) === index,
  );
  let registrations: Array<{
    id: number;
    team_id: number;
    public_name: string | null;
    status: string;
  }>;
  if (registrationsResult.error) {
    if (!["42703", "PGRST204"].includes(registrationsResult.error.code))
      throw new Error("Keyboard registration query failed");
    const legacy = await auth.client
      .from("team_registrations")
      .select("id,team_id,status")
      .in("id", registrationIds);
    if (legacy.error) throw new Error("Legacy keyboard registration query failed");
    registrations = legacy.data.map((row) => ({ ...row, public_name: null }));
  } else {
    registrations = registrationsResult.data;
  }
  const [playersResult, teamsResult] = await Promise.all([
    auth.client
      .from("players")
      .select("id,full_name")
      .in(
        "id",
        roster.map((p) => p.player_id),
      ),
    auth.client
      .from("teams")
      .select("id,name")
      .in(
        "id",
        registrations.map((r) => r.team_id),
      ),
  ]);
  if (playersResult.error || teamsResult.error) throw new Error("Keyboard display query failed");
  const candidates: KeyboardContext["candidates"] = roster.flatMap((r) => {
    const participant = participants.find((p) => p.registration_id === r.registration_id);
    if (!participant || (participant.side !== "home" && participant.side !== "away")) return [];
    return [
      {
        rosterEntryId: r.id,
        registrationId: r.registration_id,
        side: participant.side,
        jersey: r.jersey_number ?? "",
        name: playersResult.data.find((p) => p.id === r.player_id)?.full_name ?? "Atleta",
      },
    ];
  });
  const teamName = (side: "home" | "away") => {
    const registration = registrations.find(
      (r) => r.id === participants.find((p) => p.side === side)?.registration_id,
    );
    return (
      registration?.public_name ||
      teamsResult.data.find((t) => t.id === registration?.team_id)?.name ||
      side
    );
  };
  const initial: Sheet = sheetResult.data
    ? validateSheet(sheetResult.data.document)
    : {
        rulesVersion: "FIBA_2024",
        periods: 4,
        coachPlayer: { home: null, away: null },
        roster: candidates
          .filter((c) => c.jersey)
          .filter((c, _i, array) => array.filter((x) => x.side === c.side).indexOf(c) < 12)
          .map(({ rosterEntryId, registrationId, side, jersey }) => ({
            rosterEntryId,
            registrationId,
            side,
            jersey,
            played: false,
          })),
        events: [],
      };
  const editor: KeyboardContext = {
    gameId: id,
    title: `Jogo ${gameResult.data.game_number ?? id}`,
    teams: { home: teamName("home"), away: teamName("away") },
    candidates,
    initial,
    version: sheetResult.data?.version ?? 0,
    confirmed: Boolean(sheetResult.data?.submission_id),
    requiresFallback,
  };
  return data(
    { editor, csrfToken: auth.payload.csrfToken, competitionId: gameResult.data.competition_id },
    { headers: headers(auth.cookie) },
  );
}
export async function action({ request, params, context }: Route.ActionArgs) {
  assertSameOrigin(request);
  const auth = await requireAdminAal2(request, context.get(cloudflareContext).env);
  const responseHeaders = headers(auth.cookie);
  const form = await request.formData();
  assertCsrfToken(form, auth.payload.csrfToken);
  const raw = form.get("payload");
  if (typeof raw !== "string" || raw.length > 500000)
    return data(
      { error: "Súmula excede o limite de tamanho." },
      { status: 400, headers: responseHeaders },
    );
  let payload: SaveRequest;
  try {
    payload = saveSchema.parse(JSON.parse(raw));
    validateSheet(payload.document, payload.confirm);
  } catch (cause) {
    return data(
      {
        error:
          cause instanceof Error && !("issues" in cause)
            ? cause.message
            : "Revise os dados da súmula.",
      },
      { status: 400, headers: responseHeaders },
    );
  }
  const result = await auth.client.rpc("admin_save_keyboard_scoresheet", {
    p_game_id: gameId(params.gameId),
    p_request_id: payload.requestId,
    p_base_version: payload.baseVersion,
    p_document: payload.document as Json,
    p_confirm: payload.confirm,
    p_reason: payload.reason,
  });
  if (result.error) {
    const code = result.error.code;
    const message =
      code === "BD905"
        ? "A súmula foi alterada em outra aba. Exporte sua cópia e recarregue antes de conciliar."
        : code === "BD906"
          ? "Este jogo já possui outra fonte ativa. Abra o fluxo de reconciliação."
          : code === "BD715"
            ? "Informe um motivo de 10 a 500 caracteres para o fallback emergencial."
            : code === "BD908"
              ? "Informe um motivo de 10 a 500 caracteres para a revisão."
            : code === "BD909"
              ? "O confronto já foi resolvido. Revise a resolução antes de corrigir a súmula."
              : code === "BD903"
                ? "Este módulo exige um jogo de edição manual elegível."
                : "Não foi possível concluir o salvamento. Tente novamente; sua cópia local e a identidade de reenvio estão preservadas.";
    const status =
      code === "BD905" || code === "BD906" || code === "BD909" || code === "BD904"
        ? 409
        : code === "BD401"
          ? 403
          : ["BD902", "BD903", "BD907", "BD908", "BD715"].includes(code)
            ? 400
            : 503;
    return data({ error: message }, { status, headers: responseHeaders });
  }
  return data(result.data, { headers: responseHeaders });
}
export default function Page({ loaderData }: Route.ComponentProps) {
  async function save(payload: SaveRequest): Promise<SaveResult> {
    const form = new FormData();
    form.set("csrfToken", loaderData.csrfToken);
    form.set("payload", JSON.stringify(payload));
    const response = await fetch(
      `/api/admin/games/${loaderData.editor.gameId}/keyboard-scoresheet`,
      { method: "POST", body: form, headers: { Accept: "application/json" } },
    );
    if (response.redirected)
      throw new Error(
        "A sessão precisa de nova autenticação. Exporte sua cópia antes de entrar novamente.",
      );
    const result = (await response.json()) as SaveResult & { error?: string };
    if (!response.ok || result.error)
      throw new SaveFailure(
        result.error ?? "Servidor indisponível. Tente novamente.",
        response.status,
      );
    return result;
  }
  return (
    <main className="admin-area">
      <Link to={`/admin/competitions/${loaderData.competitionId}/scoresheets/new`}>
        Voltar à inclusão de súmula
      </Link>
      <KeyboardScoresheet context={loaderData.editor} onSave={save} />
    </main>
  );
}
