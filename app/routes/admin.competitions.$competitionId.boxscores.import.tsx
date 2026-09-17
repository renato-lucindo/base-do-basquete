import { data, Form, Link, redirect } from "react-router";
import { cloudflareContext, correlationIdContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";
import {
  createPdfStorageBody,
  extractSupportedBoxscore,
  MAX_PDF_BYTES,
  sha256Bytes,
  validatePdfUpload,
} from "../modules/boxscore/extract.server";
import { suggestPlayerMatch } from "../modules/boxscore/matching";
import { validateParsedBoxscore } from "../modules/boxscore/parser";
import { BoxscoreReviewEditor } from "../modules/boxscore/review-editor";
import type { ParsedBoxscore } from "../modules/boxscore/types";
import { logOperationalEvent } from "../modules/observability/operation.server";
import { buildPublicGamePath } from "../modules/scoresheet/domain";
import type { Json } from "../types/database.generated";
import type { Route } from "./+types/admin.competitions.$competitionId.boxscores.import";

function parseId(value: string | FormDataEntryValue | null): number | null {
  const text = typeof value === "string" ? value : "";
  return /^[1-9][0-9]*$/.test(text) ? Number(text) : null;
}

type PlayerResolution =
  | { action: "existing_roster"; rosterEntryId: number }
  | { action: "add_existing"; playerId: number }
  | { action: "create_new"; eligibilitySex: "male" | "female" };

export function parsePlayerResolution(
  value: FormDataEntryValue | null,
  eligibilitySexValue?: FormDataEntryValue | null,
): PlayerResolution | null {
  const text = typeof value === "string" ? value : "";
  if (text === "new") {
    const eligibilitySex = typeof eligibilitySexValue === "string" ? eligibilitySexValue : "";
    return eligibilitySex === "male" || eligibilitySex === "female"
      ? { action: "create_new", eligibilitySex }
      : null;
  }
  const match = text.match(/^(roster|player):([1-9][0-9]*)$/);
  if (!match) return null;
  const id = Number(match[2]);
  return match[1] === "roster"
    ? { action: "existing_roster", rosterEntryId: id }
    : { action: "add_existing", playerId: id };
}

function normalizeTeam(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function parseEligibilityPlayers(details: string | undefined): string[] {
  if (!details) return [];
  try {
    const parsed = JSON.parse(details) as { players?: unknown };
    if (!Array.isArray(parsed.players)) return [];
    return parsed.players
      .map((item) =>
        item && typeof item === "object" && "sourcePlayerName" in item
          ? String(item.sourcePlayerName).trim()
          : "",
      )
      .filter((name) => name.length >= 2 && name.length <= 160)
      .slice(0, 24);
  } catch {
    return [];
  }
}

export function mapImportError(
  code: string | undefined,
  details?: string,
): { message: string; status: number } {
  const eligibilityPlayers = parseEligibilityPlayers(details);
  const playerSuffix = eligibilityPlayers.length ? `: ${eligibilityPlayers.join("; ")}.` : ".";
  switch (code) {
    case "BD401":
      return { message: "Confirme o segundo fator antes de importar.", status: 403 };
    case "BD304":
      return {
        message: "Limite de cinco uploads em dez minutos atingido. Aguarde e tente novamente.",
        status: 429,
      };
    case "BD309":
      return { message: "Este PDF já foi enviado anteriormente.", status: 409 };
    case "BDB_PDF_SIZE":
      return { message: "O arquivo deve ter no máximo 10 MiB.", status: 413 };
    case "BDB_PDF_TYPE":
    case "BDB_PDF_SIGNATURE":
      return { message: "O arquivo não é um PDF válido.", status: 415 };
    case "BDB_PDF_PAGE_COUNT":
      return { message: "O PDF deve conter de uma a quatro páginas.", status: 400 };
    case "BDB_PDF_NO_TEXT":
      return {
        message: "O PDF não possui camada de texto. Use a súmula manual; OCR não está habilitado.",
        status: 422,
      };
    case "BDB_PDF_TIMEOUT":
      return { message: "A extração excedeu o tempo seguro permitido.", status: 408 };
    case "BD305":
      return { message: "Revise todas as associações de equipe e atleta.", status: 400 };
    case "BD505":
      return { message: "Revise o naipe da edição antes de confirmar a importação.", status: 409 };
    case "BD501":
      return { message: "Revise o dado privado de elegibilidade do novo atleta.", status: 400 };
    case "BD601":
      return {
        message: `Complete a elegibilidade privada antes de confirmar${playerSuffix}`,
        status: 400,
      };
    case "BD602":
      return {
        message: `Atleta não elegível para o naipe desta edição${playerSuffix}`,
        status: 400,
      };
    case "BD104":
      return { message: "O atleta selecionado já está em outra equipe desta edição.", status: 409 };
    case "BD105":
      return {
        message: "A camisa do boxscore já está ocupada no elenco selecionado.",
        status: 409,
      };
    case "BD308":
      return {
        message: "Já existe um atleta com esse nome. Associe o cadastro existente.",
        status: 409,
      };
    case "BD310":
      return { message: "As estatísticas coletivas do PDF são inválidas.", status: 422 };
    case "BD306":
      return { message: "Já existe um jogo com esse número nesta edição.", status: 409 };
    case "BD710":
      return { message: "O jogo precisa estar vinculado a um confronto válido.", status: 409 };
    case "BD711":
      return { message: "O jogo selecionado não está disponível para confirmação.", status: 409 };
    case "BD712":
      return {
        message: "As equipes do PDF não correspondem ao confronto selecionado.",
        status: 409,
      };
    case "BD713":
      return { message: "O PDF diverge do jogo selecionado e permaneceu em revisão.", status: 409 };
    case "BD714":
      return { message: "Este jogo já possui uma confirmação principal.", status: 409 };
    default:
      return { message: "Não foi possível processar este modelo de boxscore.", status: 400 };
  }
}

async function withExtractionDeadline<T>(operation: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("BDB_PDF_TIMEOUT")), 10_000);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function meta() {
  return [{ title: "Importar boxscore — Base do Basquete" }];
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const competitionId = parseId(params.competitionId);
  if (!competitionId) throw new Response("Edição não encontrada", { status: 404 });
  const { env } = context.get(cloudflareContext);
  const auth = await requireAdminAal2(request, env);
  const url = new URL(request.url);
  const importId = parseId(url.searchParams.get("import"));

  const [
    competitionResult,
    registrationsResult,
    teamsResult,
    rosterResult,
    playersResult,
    importsResult,
    gamesResult,
  ] = await Promise.all([
    auth.client
      .from("competitions")
      .select("id,display_name,year,status,series_id,category_id,gender_division")
      .eq("id", competitionId)
      .single(),
    auth.client
      .from("team_registrations")
      .select("id,team_id,status")
      .eq("competition_id", competitionId)
      .eq("status", "confirmed")
      .order("id"),
    auth.client.from("teams").select("id,name,abbreviation").order("name"),
    auth.client
      .from("roster_entries")
      .select("id,registration_id,player_id,jersey_number")
      .eq("competition_id", competitionId)
      .eq("status", "active")
      .order("id"),
    auth.client.from("players").select("id,full_name").eq("is_active", true).order("full_name"),
    auth.client
      .from("boxscore_imports")
      .select("id,source_filename,status,game_id,parser_version,created_at,error_code")
      .eq("competition_id", competitionId)
      .order("created_at", { ascending: false })
      .limit(10),
    auth.client
      .from("games")
      .select("id,game_number,scheduled_at,venue,status,matchup_id")
      .eq("competition_id", competitionId)
      .in("status", ["draft", "scheduled", "live", "final"])
      .not("matchup_id", "is", null)
      .order("scheduled_at", { ascending: true, nullsFirst: false }),
  ]);
  if (
    competitionResult.error ||
    registrationsResult.error ||
    teamsResult.error ||
    rosterResult.error ||
    playersResult.error ||
    importsResult.error ||
    gamesResult.error
  )
    throw new Error("Boxscore import context query failed");
  if (competitionResult.data.status === "archived") {
    throw new Response("Edição indisponível", { status: 409 });
  }

  const teamById = new Map(teamsResult.data.map((team) => [team.id, team]));
  const playerById = new Map(playersResult.data.map((player) => [player.id, player.full_name]));
  const registrations = registrationsResult.data.map((registration) => ({
    id: registration.id,
    teamId: registration.team_id,
    teamName: teamById.get(registration.team_id)?.name ?? "Equipe indisponível",
    abbreviation: teamById.get(registration.team_id)?.abbreviation ?? null,
    roster: rosterResult.data
      .filter((entry) => entry.registration_id === registration.id)
      .map((entry) => ({
        rosterEntryId: entry.id,
        playerId: entry.player_id,
        playerName: playerById.get(entry.player_id) ?? "Atleta indisponível",
        jerseyNumber: entry.jersey_number,
      })),
  }));
  const gameIds = gamesResult.data.map((game) => game.id);
  const [participantsResult, fallbackResult] = gameIds.length
    ? await Promise.all([
        auth.client
          .from("game_participants")
          .select("game_id,registration_id,side")
          .in("game_id", gameIds),
        auth.client
          .from("game_data_submissions")
          .select("game_id")
          .in("game_id", gameIds)
          .eq("source_type", "manual_scoresheet")
          .eq("role", "fallback")
          .eq("status", "active"),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (participantsResult.error || fallbackResult.error) {
    throw new Error("Boxscore game participants query failed");
  }
  const fallbackGameIds = new Set(fallbackResult.data.map((submission) => submission.game_id));
  const registrationById = new Map(
    registrations.map((registration) => [registration.id, registration]),
  );
  const games = gamesResult.data
    .filter((game) => game.status !== "final" || fallbackGameIds.has(game.id))
    .map((game) => {
      const participants = participantsResult.data.filter(
        (participant) => participant.game_id === game.id,
      );
      const homeRegistrationId = participants.find(
        (participant) => participant.side === "home",
      )?.registration_id;
      const awayRegistrationId = participants.find(
        (participant) => participant.side === "away",
      )?.registration_id;
      const home = homeRegistrationId ? registrationById.get(homeRegistrationId) : null;
      const away = awayRegistrationId ? registrationById.get(awayRegistrationId) : null;
      if (!home || !away) return null;
      return {
        id: game.id,
        gameNumber: game.game_number,
        scheduledAt: game.scheduled_at,
        venue: game.venue,
        homeRegistrationId: home.id,
        awayRegistrationId: away.id,
        homeTeamName: home.teamName,
        awayTeamName: away.teamName,
        isLateFallback: game.status === "final",
      };
    })
    .filter((game): game is NonNullable<typeof game> => game !== null);

  let review: null | {
    id: number;
    parsed: ParsedBoxscore;
    matches: Array<{
      source_team_name: string;
      source_player_name: string;
      source_jersey_number: string;
      roster_entry_id: number | null;
      suggested_player_id: number | null;
      suggestion_payload: Json;
      suggestion_kind: string;
      similarity_score: number | null;
    }>;
  } = null;
  if (importId) {
    const [importResult, matchResult] = await Promise.all([
      auth.client
        .from("boxscore_imports")
        .select("id,status,parsed_payload")
        .eq("id", importId)
        .eq("competition_id", competitionId)
        .single(),
      auth.client
        .from("boxscore_import_player_matches")
        .select(
          "source_team_name,source_player_name,source_jersey_number,roster_entry_id,suggested_player_id,suggestion_payload,suggestion_kind,similarity_score",
        )
        .eq("import_id", importId)
        .order("id"),
    ]);
    if (importResult.error || matchResult.error || importResult.data.status !== "review") {
      throw new Response("Importação não disponível para revisão", { status: 404 });
    }
    review = {
      id: importId,
      parsed: importResult.data.parsed_payload as unknown as ParsedBoxscore,
      matches: matchResult.data,
    };
  }

  return data(
    {
      competition: competitionResult.data,
      csrfToken: auth.payload.csrfToken,
      imports: importsResult.data,
      registrations,
      games,
      review,
      refreshedGameId: parseId(url.searchParams.get("refreshed")),
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
  const mode = new URL(request.url).searchParams.get("mode");

  if (mode === "upload") {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > MAX_PDF_BYTES + 65_536) {
      return data({ error: "O arquivo excede o limite de 10 MiB." }, { status: 413 });
    }
    const claim = await auth.client.rpc("admin_claim_boxscore_upload");
    if (claim.error) {
      const mapped = mapImportError(claim.error.code);
      logOperationalEvent({
        correlationId,
        durationMs: Date.now() - startedAt,
        operation: "boxscore.upload",
        outcome: mapped.status < 500 ? "blocked" : "failure",
        status: mapped.status,
        context: { competitionId, errorCode: claim.error.code },
      });
      return data({ error: mapped.message }, { status: mapped.status });
    }
  }

  const formData = await request.formData();
  assertCsrfToken(formData, auth.payload.csrfToken);

  if (mode === "refresh-stats") {
    const importId = parseId(formData.get("importId"));
    if (!importId) return data({ error: "Importação inválida." }, { status: 400 });
    try {
      const importResult = await auth.client
        .from("boxscore_imports")
        .select("id,status,game_id,storage_path,sha256,parser_version")
        .eq("id", importId)
        .eq("competition_id", competitionId)
        .single();
      if (
        importResult.error ||
        importResult.data.status !== "confirmed" ||
        !importResult.data.game_id ||
        importResult.data.parser_version !== "fiba-genius-v1"
      ) {
        return data({ error: "Importação confirmada não encontrada." }, { status: 404 });
      }
      const stored = await auth.client.storage
        .from("boxscore-pdfs")
        .download(importResult.data.storage_path);
      if (stored.error) throw new Error("BDB_PDF_STORAGE_READ");
      const bytes = new Uint8Array(await stored.data.arrayBuffer());
      if (bytes.length > MAX_PDF_BYTES || (await sha256Bytes(bytes)) !== importResult.data.sha256) {
        throw new Error("BDB_PDF_STORED_HASH");
      }
      const parsed = await withExtractionDeadline(extractSupportedBoxscore(bytes));
      const validation = validateParsedBoxscore(parsed);
      if (!validation.valid) throw new Error(validation.issues[0]?.code ?? "BDB_PDF_INVALID");
      const refreshed = await auth.client.rpc("admin_refresh_boxscore_team_statistics", {
        p_import_id: importId,
        p_parsed_payload: parsed as unknown as Json,
        p_validation_payload: validation as unknown as Json,
      });
      if (refreshed.error) {
        const mapped = mapImportError(refreshed.error.code);
        return data({ error: mapped.message }, { status: mapped.status });
      }
      logOperationalEvent({
        correlationId,
        durationMs: Date.now() - startedAt,
        operation: "boxscore.refresh_stats",
        outcome: "success",
        status: 303,
        context: { competitionId, entityId: importId },
      });
      throw redirect(
        `/admin/competitions/${competitionId}/boxscores/import?refreshed=${refreshed.data}`,
        { headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
      );
    } catch (error) {
      if (error instanceof Response) throw error;
      const mapped = mapImportError(error instanceof Error ? error.message : undefined);
      logOperationalEvent({
        correlationId,
        durationMs: Date.now() - startedAt,
        operation: "boxscore.refresh_stats",
        outcome: mapped.status < 500 ? "blocked" : "failure",
        status: mapped.status,
        context: {
          competitionId,
          entityId: importId,
          errorCode: error instanceof Error ? error.message : undefined,
        },
      });
      return data({ error: mapped.message }, { status: mapped.status });
    }
  }

  if (mode === "upload") {
    const uploaded = formData.get("boxscore");
    if (!(uploaded instanceof File)) return data({ error: "Selecione um PDF." }, { status: 400 });
    try {
      const validated = await validatePdfUpload(uploaded);
      const parsed = await withExtractionDeadline(extractSupportedBoxscore(validated.bytes));
      const validation = validateParsedBoxscore(parsed);
      if (!validation.valid) throw new Error(validation.issues[0]?.code ?? "BDB_PDF_INVALID");

      const [registrationsResult, teamsResult, rosterResult, playersResult] = await Promise.all([
        auth.client
          .from("team_registrations")
          .select("id,team_id")
          .eq("competition_id", competitionId)
          .eq("status", "confirmed"),
        auth.client.from("teams").select("id,name,abbreviation"),
        auth.client
          .from("roster_entries")
          .select("id,registration_id,player_id,jersey_number")
          .eq("competition_id", competitionId)
          .eq("status", "active"),
        auth.client.from("players").select("id,full_name").eq("is_active", true),
      ]);
      if (
        registrationsResult.error ||
        teamsResult.error ||
        rosterResult.error ||
        playersResult.error
      ) {
        throw new Error("BDB_PDF_CONTEXT");
      }
      const playerNames = new Map(
        playersResult.data.map((player) => [player.id, player.full_name]),
      );
      const activeRosterByPlayer = new Map(
        rosterResult.data.map((entry) => [entry.player_id, entry]),
      );
      const matches = parsed.teams.flatMap((team) => {
        const selectedTeam = teamsResult.data.find(
          (candidate) =>
            normalizeTeam(candidate.name) === normalizeTeam(team.name) ||
            candidate.abbreviation?.toUpperCase() === team.abbreviation,
        );
        const registration = selectedTeam
          ? registrationsResult.data.find((candidate) => candidate.team_id === selectedTeam.id)
          : undefined;
        const candidates = playersResult.data.map((candidate) => {
          const activeRoster = activeRosterByPlayer.get(candidate.id);
          const activeRegistration = activeRoster
            ? registrationsResult.data.find((item) => item.id === activeRoster.registration_id)
            : undefined;
          const activeTeam = activeRegistration
            ? teamsResult.data.find((item) => item.id === activeRegistration.team_id)
            : undefined;
          return {
            playerId: candidate.id,
            rosterEntryId: activeRoster?.id ?? null,
            registrationId: activeRoster?.registration_id ?? null,
            playerName: playerNames.get(candidate.id) ?? "",
            jerseyNumber: activeRoster?.jersey_number ?? null,
            teamName: activeTeam?.name ?? null,
          };
        });
        return team.players.map((player) => ({
          sourceTeamName: team.name,
          sourcePlayerName: player.name,
          ...suggestPlayerMatch(
            player.name,
            player.jerseyNumber,
            registration ? candidates : [],
            parsed.format === "BASKETBALL_SITE" ? team.name : undefined,
          ),
        }));
      });
      const storagePath = `${competitionId}/${validated.sha256}.pdf`;
      const storage = await auth.client.storage
        .from("boxscore-pdfs")
        .upload(storagePath, createPdfStorageBody(validated.bytes), {
          contentType: "application/pdf",
          upsert: false,
        });
      if (storage.error) {
        const duplicate = /already exists|duplicate/i.test(storage.error.message);
        return data(
          {
            error: duplicate
              ? "Este PDF já foi enviado anteriormente."
              : "Falha ao guardar o PDF privado.",
          },
          { status: duplicate ? 409 : 502 },
        );
      }
      const draft = await auth.client.rpc("admin_create_boxscore_import_draft", {
        p_competition_id: competitionId,
        p_sha256: validated.sha256,
        p_storage_path: storagePath,
        p_source_filename: validated.filename,
        p_file_size_bytes: uploaded.size,
        p_parser_version: parsed.parserVersion,
        p_parsed_payload: parsed as unknown as Json,
        p_validation_payload: validation as unknown as Json,
        p_matches: matches as unknown as Json,
      });
      if (draft.error) {
        const mapped = mapImportError(draft.error.code);
        logOperationalEvent({
          correlationId,
          durationMs: Date.now() - startedAt,
          operation: "boxscore.upload",
          outcome: mapped.status < 500 ? "blocked" : "failure",
          status: mapped.status,
          context: { competitionId, errorCode: draft.error.code },
        });
        return data({ error: mapped.message }, { status: mapped.status });
      }
      logOperationalEvent({
        correlationId,
        durationMs: Date.now() - startedAt,
        operation: "boxscore.upload",
        outcome: "success",
        status: 303,
        context: { competitionId, entityId: draft.data },
      });
      throw redirect(`/admin/competitions/${competitionId}/boxscores/import?import=${draft.data}`, {
        headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined,
      });
    } catch (error) {
      if (error instanceof Response) throw error;
      const mapped = mapImportError(error instanceof Error ? error.message : undefined);
      logOperationalEvent({
        correlationId,
        durationMs: Date.now() - startedAt,
        operation: "boxscore.upload",
        outcome: mapped.status < 500 ? "blocked" : "failure",
        status: mapped.status,
        context: {
          competitionId,
          errorCode: error instanceof Error ? error.message : undefined,
        },
      });
      return data({ error: mapped.message }, { status: mapped.status });
    }
  }

  if (mode === "confirm") {
    const importId = parseId(formData.get("importId"));
    const gameId = parseId(formData.get("gameId"));
    if (!importId) return data({ error: "Importação inválida." }, { status: 400 });
    if (!gameId) return data({ error: "Selecione um jogo estrutural válido." }, { status: 400 });
    const teamCount = Number(formData.get("teamCount"));
    const playerCount = Number(formData.get("playerCount"));
    if (formData.get("confirmImport") !== "yes") {
      return data(
        { error: "Confirme explicitamente a revisão antes de importar." },
        { status: 400 },
      );
    }
    if (teamCount !== 2 || !Number.isInteger(playerCount) || playerCount < 10 || playerCount > 24) {
      return data({ error: "Revisão incompleta." }, { status: 400 });
    }
    const teams = Array.from({ length: teamCount }, (_, index) => ({
      sourceTeamName: String(formData.get(`teamName-${index}`) ?? ""),
      registrationId: parseId(formData.get(`registration-${index}`)),
    }));
    const players = Array.from({ length: playerCount }, (_, index) => {
      const resolution = parsePlayerResolution(
        formData.get(`playerResolution-${index}`),
        formData.get(`playerEligibilitySex-${index}`),
      );
      return {
        sourceTeamName: String(formData.get(`playerTeam-${index}`) ?? ""),
        sourcePlayerName: String(formData.get(`playerName-${index}`) ?? ""),
        ...(resolution ?? { action: null }),
      };
    });
    if (
      teams.some((team) => !team.sourceTeamName || !team.registrationId) ||
      players.some((player) => !player.sourceTeamName || !player.sourcePlayerName || !player.action)
    ) {
      return data({ error: "Associe todas as equipes e todos os atletas." }, { status: 400 });
    }
    const commit = await auth.client.rpc("admin_commit_boxscore_import", {
      p_import_id: importId,
      p_resolution: { gameId, teams, players },
    });
    if (commit.error) {
      const mapped = mapImportError(commit.error.code, commit.error.details);
      logOperationalEvent({
        correlationId,
        durationMs: Date.now() - startedAt,
        operation: "boxscore.commit",
        outcome: mapped.status < 500 ? "blocked" : "failure",
        status: mapped.status,
        context: { competitionId, entityId: importId, errorCode: commit.error.code },
      });
      return data({ error: mapped.message }, { status: mapped.status });
    }
    logOperationalEvent({
      correlationId,
      durationMs: Date.now() - startedAt,
      operation: "boxscore.commit",
      outcome: "success",
      status: 303,
      context: { competitionId, entityId: commit.data },
    });
    const comparison = await auth.client.rpc("admin_get_game_data_conflict", {
      p_game_id: commit.data,
    });
    if (comparison.error) throw new Error("BDB_CONFLICT_QUERY_FAILED");
    const comparisonPayload = comparison.data as {
      domains?: unknown[];
      pendingCount?: number;
    } | null;
    if (comparisonPayload?.domains?.length) {
      throw redirect(`/admin/games/${commit.data}/data-conflict`, {
        headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined,
      });
    }
    const competition = await auth.client
      .from("competitions")
      .select("year,series_id,category_id")
      .eq("id", competitionId)
      .single();
    if (competition.error) throw new Error("Competition context query failed");
    const [series, category] = await Promise.all([
      auth.client
        .from("competition_series")
        .select("slug")
        .eq("id", competition.data.series_id)
        .single(),
      auth.client.from("categories").select("slug").eq("id", competition.data.category_id).single(),
    ]);
    if (series.error || category.error) throw new Error("Competition context query failed");
    throw redirect(
      buildPublicGamePath(competition.data.year, series.data.slug, category.data.slug, commit.data),
      {
        headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined,
      },
    );
  }

  throw new Response("Ação inválida", { status: 400 });
}

export default function BoxscoreImport({ loaderData, actionData }: Route.ComponentProps) {
  const review = loaderData.review;

  return (
    <main className="admin-shell">
      <header className="site-header admin-header">
        <Link className="brand" to={`/admin/competitions/${loaderData.competition.id}`}>
          <span className="brand-mark">B</span>
          <span>Administração</span>
        </Link>
        <span className="environment-pill">
          <span className="status-dot" />
          AAL2
        </span>
      </header>
      <section className="admin-welcome admin-hub">
        <p className="eyebrow">Boxscore em PDF</p>
        <h1>Importar PDF</h1>
        <p>
          {loaderData.competition.display_name}. Aceita exclusivamente os modelos documentados, com
          camada de texto; limite de 10 MiB.
        </p>
        {actionData?.error ? (
          <p className="form-error" role="alert">
            {actionData.error}
          </p>
        ) : null}
        {loaderData.refreshedGameId ? (
          <output className="form-success">
            Estatísticas coletivas recuperadas para o jogo {loaderData.refreshedGameId}.
          </output>
        ) : null}

        <section className="admin-panel">
          <h2>1. Enviar arquivo</h2>
          <Form
            method="post"
            action="?mode=upload"
            encType="multipart/form-data"
            className="inline-admin-form"
          >
            <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
            <label>
              PDF de boxscore compatível
              <input type="file" name="boxscore" accept="application/pdf,.pdf" required />
            </label>
            <button className="button button-primary" type="submit">
              Extrair e revisar
            </button>
          </Form>
        </section>

        {review ? (
          <BoxscoreReviewEditor
            actionError={actionData?.error}
            competitionId={loaderData.competition.id}
            competitionGender={loaderData.competition.gender_division}
            csrfToken={loaderData.csrfToken}
            review={review}
            games={loaderData.games}
            registrations={loaderData.registrations}
          />
        ) : null}

        <section className="admin-panel">
          <h2>Histórico recente</h2>
          {loaderData.imports.length ? (
            <ul className="import-history">
              {loaderData.imports.map((item) => (
                <li key={item.id}>
                  <span>{item.source_filename}</span>
                  <strong>{item.status}</strong>
                  <span>{item.parser_version}</span>
                  {item.status === "review" ? <Link to={`?import=${item.id}`}>Revisar</Link> : null}
                  {item.status === "confirmed" && item.parser_version === "fiba-genius-v1" ? (
                    <Form method="post" action="?mode=refresh-stats">
                      <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
                      <input type="hidden" name="importId" value={item.id} />
                      <button className="button button-secondary" type="submit">
                        Recuperar estatísticas coletivas
                      </button>
                    </Form>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p>Nenhuma importação registrada.</p>
          )}
        </section>
      </section>
    </main>
  );
}
