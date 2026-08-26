import { data, Form, Link, redirect } from "react-router";

import type { Route } from "./+types/admin.competitions.$competitionId.boxscores.import";
import { cloudflareContext, correlationIdContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";
import {
  createPdfStorageBody,
  extractFibaGeniusBoxscore,
  MAX_PDF_BYTES,
  sha256Bytes,
  validatePdfUpload,
} from "../modules/boxscore/extract.server";
import { suggestPlayerMatch } from "../modules/boxscore/matching";
import { FIBA_GENIUS_PARSER_VERSION, validateParsedBoxscore } from "../modules/boxscore/parser";
import { BoxscoreReviewEditor } from "../modules/boxscore/review-editor";
import type { ParsedBoxscore } from "../modules/boxscore/types";
import { logOperationalEvent } from "../modules/observability/operation.server";
import { buildPublicGamePath } from "../modules/scoresheet/domain";
import type { Json } from "../types/database.generated";

function parseId(value: string | FormDataEntryValue | null): number | null {
  const text = typeof value === "string" ? value : "";
  return /^[1-9][0-9]*$/.test(text) ? Number(text) : null;
}

type PlayerResolution =
  | { action: "existing_roster"; rosterEntryId: number }
  | { action: "add_existing"; playerId: number }
  | { action: "create_new" };

function parsePlayerResolution(value: FormDataEntryValue | null): PlayerResolution | null {
  const text = typeof value === "string" ? value : "";
  if (text === "new") return { action: "create_new" };
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

function mapImportError(code: string | undefined): { message: string; status: number } {
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
    default:
      return { message: "Não foi possível processar o boxscore FIBA/Genius Sports.", status: 400 };
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
  return [{ title: "Importar boxscore FIBA — Base do Basquete" }];
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
  ] = await Promise.all([
    auth.client
      .from("competitions")
      .select("id,display_name,year,status,series_id,category_id")
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
  ]);
  if (
    competitionResult.error ||
    registrationsResult.error ||
    teamsResult.error ||
    rosterResult.error ||
    playersResult.error ||
    importsResult.error
  )
    throw new Error("Boxscore import context query failed");
  if (competitionResult.data.status !== "published") {
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
        .select("id,status,game_id,storage_path,sha256")
        .eq("id", importId)
        .eq("competition_id", competitionId)
        .single();
      if (
        importResult.error ||
        importResult.data.status !== "confirmed" ||
        !importResult.data.game_id
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
      const parsed = await withExtractionDeadline(extractFibaGeniusBoxscore(bytes));
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
      const parsed = await withExtractionDeadline(extractFibaGeniusBoxscore(validated.bytes));
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
          ...suggestPlayerMatch(player.name, player.jerseyNumber, registration ? candidates : []),
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
        p_parser_version: FIBA_GENIUS_PARSER_VERSION,
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
    if (!importId) return data({ error: "Importação inválida." }, { status: 400 });
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
      const resolution = parsePlayerResolution(formData.get(`playerResolution-${index}`));
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
      p_resolution: { teams, players },
    });
    if (commit.error) {
      const mapped = mapImportError(commit.error.code);
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
        <p className="eyebrow">Boxscore FIBA/Genius Sports</p>
        <h1>Importar PDF</h1>
        <p>
          {loaderData.competition.display_name}. Aceita exclusivamente o modelo documentado, com
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
              PDF FIBA/Genius Sports
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
            csrfToken={loaderData.csrfToken}
            review={review}
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
                  {item.status === "confirmed" &&
                  item.parser_version !== FIBA_GENIUS_PARSER_VERSION ? (
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
