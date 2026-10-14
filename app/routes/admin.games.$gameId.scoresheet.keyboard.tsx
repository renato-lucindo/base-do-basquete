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
  const [rosterResult, registrationsResult] = await Promise.all([
    auth.client
      .from("roster_entries")
      .select("id,registration_id,player_id,jersey_number")
      .in("registration_id", registrationIds)
      .eq("status", "active"),
    auth.client
      .from("team_registrations")
      .select("id,team_id,public_name,status")
      .in("id", registrationIds),
  ]);
  if (rosterResult.error || registrationsResult.error)
    throw new Error("Keyboard roster query failed");
  const [playersResult, teamsResult] = await Promise.all([
    auth.client
      .from("players")
      .select("id,full_name")
      .in(
        "id",
        rosterResult.data.map((p) => p.player_id),
      ),
    auth.client
      .from("teams")
      .select("id,name")
      .in(
        "id",
        registrationsResult.data.map((r) => r.team_id),
      ),
  ]);
  if (playersResult.error || teamsResult.error) throw new Error("Keyboard display query failed");
  const candidates: KeyboardContext["candidates"] = rosterResult.data.flatMap((r) => {
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
    const registration = registrationsResult.data.find(
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
          : code === "BD908"
            ? "Informe um motivo de 10 a 500 caracteres para a revisão."
            : code === "BD909"
              ? "O confronto já foi resolvido. Revise a resolução antes de corrigir a súmula."
              : code === "BD903"
                ? "Este módulo exige um jogo de edição manual elegível."
                : "Não foi possível salvar. Revise os relacionados, faltas e totais; sua cópia local está preservada.";
    return data(
      { error: message },
      { status: code === "BD905" || code === "BD906" ? 409 : 400, headers: responseHeaders },
    );
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
