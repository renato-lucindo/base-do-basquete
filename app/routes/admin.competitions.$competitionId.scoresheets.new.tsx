import { data, Link, redirect } from "react-router";
import { cloudflareContext, correlationIdContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";
import { normalizeJersey } from "../modules/competition/admin-domain";
import { logOperationalEvent } from "../modules/observability/operation.server";
import {
  buildPublicGamePath,
  deriveTeamScore,
  evaluateDisqualification,
  type FoulInput,
  type ManualScoresheetPayload,
  type PeriodPayload,
  parseFoulCodes,
  parseNonnegativeInteger,
  type TeamPayload,
  type TeamSide,
} from "../modules/scoresheet/domain";
import { ManualScoresheetEditor } from "../modules/scoresheet/editor";
import { ManualScoresheetSetupWizard } from "../modules/scoresheet/setup-wizard";
import { buildSetupConfirmation } from "../modules/scoresheet/setup-confirmation";
import { parseScoresheetSetup } from "../modules/scoresheet/setup-state";
import type { Json } from "../types/database.generated";
import type { Route } from "./+types/admin.competitions.$competitionId.scoresheets.new";

function parseId(value: string | FormDataEntryValue | null): number | null {
  const text = typeof value === "string" ? value : "";
  return /^[1-9][0-9]*$/.test(text) ? Number(text) : null;
}

function badRequest(message: string) {
  return data({ error: message }, { status: 400 });
}

function saoPauloLocalInput(instant: string | null): string {
  if (!instant) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}`;
}

export interface ScoresheetUnavailableIssue {
  action: "hub" | "schedule";
  message: string;
}

export function describeScoresheetUnavailability({
  hasStructuralGames,
  hasMinimumConfirmedRegistrations,
  hasMinimumRegistrationsWithRoster,
  hasIncompleteParticipants,
  hasUnconfirmedParticipant,
  hasParticipantWithoutRoster,
}: {
  hasStructuralGames: boolean;
  hasMinimumConfirmedRegistrations: boolean;
  hasMinimumRegistrationsWithRoster: boolean;
  hasIncompleteParticipants: boolean;
  hasUnconfirmedParticipant: boolean;
  hasParticipantWithoutRoster: boolean;
}): ScoresheetUnavailableIssue {
  if (!hasMinimumConfirmedRegistrations) {
    return {
      action: "hub",
      message: "Confirme pelo menos duas equipes antes de preencher uma súmula.",
    };
  }
  if (!hasMinimumRegistrationsWithRoster) {
    return {
      action: "hub",
      message: "Adicione atletas ao elenco de pelo menos duas equipes confirmadas.",
    };
  }
  if (!hasStructuralGames) {
    return {
      action: "schedule",
      message: "Organize um confronto na agenda antes de preencher a súmula.",
    };
  }
  if (hasUnconfirmedParticipant) {
    return {
      action: "hub",
      message: "Confirme as equipes do confronto antes de preencher a súmula.",
    };
  }
  if (hasParticipantWithoutRoster) {
    return {
      action: "hub",
      message: "Adicione atletas aos elencos das equipes do confronto.",
    };
  }
  return {
    action: "schedule",
    message: hasIncompleteParticipants
      ? "Defina mandante e visitante para o confronto na agenda."
      : "Revise na agenda as equipes e o confronto dos jogos que ainda estão em andamento.",
  };
}

function mapScoresheetError(code: string | undefined): string {
  switch (code) {
    case "BD401":
      return "Confirme o segundo fator antes de salvar.";
    case "BD202":
      return "A edição ou uma das equipes não está mais elegível.";
    case "BD203":
      return "Revise data, hora, local e número do jogo.";
    case "BD204":
      return "Um atleta não pertence mais ao elenco selecionado.";
    case "BD205":
      return "Há atleta, camisa ou número de jogo duplicado.";
    case "BD206":
      return "Revise períodos, conversões, faltas e prorrogações.";
    case "BD207":
      return "Existem dados posteriores à desqualificação por GD.";
    case "BD208":
      return "O jogo está empatado. Adicione uma prorrogação antes de encerrar.";
    case "BD209":
      return "A chave desta submissão já foi usada com outro conteúdo.";
    case "BD216":
      return "Selecione exatamente um capitão em cada equipe.";
    case "BD217":
      return "Revise a comissão técnica das equipes.";
    case "BD218":
      return "Revise os oficiais da partida.";
    case "BD219":
      return "Revise as faltas anotadas para a partida.";
    case "BD710":
      return "O jogo precisa estar vinculado a um confronto válido.";
    case "BD711":
      return "O jogo selecionado não está disponível para confirmação.";
    case "BD712":
      return "As equipes não correspondem ao confronto do jogo selecionado.";
    case "BD713":
      return "Os dados divergem do jogo selecionado e permaneceram sem confirmação.";
    case "BD714":
      return "Este jogo já possui uma confirmação principal.";
    case "BD715":
      return "Informe um motivo com 10 a 500 caracteres para a súmula emergencial.";
    default:
      return "Não foi possível salvar a súmula.";
  }
}

export function meta() {
  return [{ title: "Nova súmula manual — Base do Basquete" }];
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const wizardMode =
    new URL(request.url).searchParams.get("modo") === "existente" ? "existing" : "setup";
  const competitionId = parseId(params.competitionId);
  if (!competitionId) throw new Response("Edição não encontrada", { status: 404 });
  const { env } = context.get(cloudflareContext);
  const auth = await requireAdminAal2(request, env);

  const competitionResult = await auth.client
    .from("competitions")
    .select("id,display_name,status,data_profile_id")
    .eq("id", competitionId)
    .limit(1);
  if (competitionResult.error) throw new Error("Manual scoresheet context query failed");
  const competition = competitionResult.data[0];
  if (!competition || competition.status === "archived") {
    throw new Response("Edição indisponível", { status: 404 });
  }

  const profileResult = competition.data_profile_id
    ? await auth.client
        .from("series_category_data_profiles")
        .select("primary_source")
        .eq("id", competition.data_profile_id)
        .single()
    : { data: null, error: null };
  if (profileResult.error) throw new Error("Manual scoresheet profile query failed");
  const requiresFallbackReason = profileResult.data?.primary_source === "fiba_boxscore";

  const [registrationsResult, teamsResult, rosterResult, prefillResult, gamesResult] =
    await Promise.all([
      auth.client
        .from("team_registrations")
        .select("id,team_id")
        .eq("competition_id", competitionId)
        .eq("status", "confirmed")
        .order("id"),
      auth.client.from("teams").select("id,name").eq("is_active", true).order("name"),
      auth.client
        .from("roster_entries")
        .select("id,registration_id,player_id,jersey_number")
        .eq("competition_id", competitionId)
        .eq("status", "active")
        .order("id"),
      auth.client
        .from("manual_scoresheet_prefill")
        .select("registration_id,slot_number,roster_entry_id,jersey_number")
        .eq("competition_id", competitionId)
        .order("slot_number"),
      auth.client
        .from("games")
        .select("id,game_number,scheduled_at,venue,status,matchup_id")
        .eq("competition_id", competitionId)
        .in("status", ["draft", "scheduled", "live"])
        .not("matchup_id", "is", null)
        .order("scheduled_at", { ascending: true, nullsFirst: false }),
    ]);

  if (
    registrationsResult.error ||
    teamsResult.error ||
    rosterResult.error ||
    prefillResult.error ||
    gamesResult.error
  ) {
    throw new Error("Manual scoresheet context query failed");
  }

  const rosterPlayerIds = [...new Set(rosterResult.data.map((entry) => entry.player_id))];
  const playersResult = rosterPlayerIds.length
    ? await auth.client.from("players").select("id,full_name").in("id", rosterPlayerIds)
    : { data: [], error: null };
  if (playersResult.error) throw new Error("Manual scoresheet player query failed");

  const teamNames = new Map(teamsResult.data.map((team) => [team.id, team.name]));
  const playerNames = new Map(playersResult.data.map((player) => [player.id, player.full_name]));
  const registrations = registrationsResult.data
    .map((registration) => ({
      id: registration.id,
      teamName: teamNames.get(registration.team_id) ?? "Equipe indisponível",
      roster: rosterResult.data
        .filter((entry) => entry.registration_id === registration.id)
        .map((entry) => ({
          rosterEntryId: entry.id,
          playerName: playerNames.get(entry.player_id) ?? "Atleta indisponível",
          jerseyNumber: entry.jersey_number,
        })),
      previous: prefillResult.data
        .filter((entry) => entry.registration_id === registration.id)
        .filter(
          (
            entry,
          ): entry is {
            registration_id: number;
            slot_number: number;
            roster_entry_id: number;
            jersey_number: string;
          } =>
            entry.registration_id !== null &&
            entry.slot_number !== null &&
            entry.roster_entry_id !== null &&
            entry.jersey_number !== null,
        )
        .map((entry) => ({
          slotNumber: entry.slot_number,
          rosterEntryId: entry.roster_entry_id,
          jerseyNumber: entry.jersey_number,
        })),
    }))
    .filter((registration) => registration.roster.length > 0)
    .sort((left, right) => left.teamName.localeCompare(right.teamName, "pt-BR"));

  const gameIds = gamesResult.data.map((game) => game.id);
  const participantsResult = gameIds.length
    ? await auth.client
        .from("game_participants")
        .select("game_id,registration_id,side")
        .in("game_id", gameIds)
    : { data: [], error: null };
  if (participantsResult.error) throw new Error("Manual scoresheet game participants query failed");
  const availableRegistrationIds = new Set(registrations.map((registration) => registration.id));
  const games = gamesResult.data
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
      if (
        !homeRegistrationId ||
        !awayRegistrationId ||
        !availableRegistrationIds.has(homeRegistrationId) ||
        !availableRegistrationIds.has(awayRegistrationId)
      ) {
        return null;
      }
      return {
        id: game.id,
        gameNumber: game.game_number,
        scheduledLocal: saoPauloLocalInput(game.scheduled_at),
        venue: game.venue ?? "Local a definir",
        homeRegistrationId,
        awayRegistrationId,
      };
    })
    .filter((game): game is NonNullable<typeof game> => game !== null);

  const confirmedRegistrationIds = new Set(
    registrationsResult.data.map((registration) => registration.id),
  );
  const registrationsWithRosterIds = new Set(registrations.map((registration) => registration.id));
  const structuralGameIds = new Set(gamesResult.data.map((game) => game.id));
  const structuralParticipants = participantsResult.data.filter((participant) =>
    structuralGameIds.has(participant.game_id),
  );
  const hasIncompleteParticipants = gamesResult.data.some((game) => {
    const participants = structuralParticipants.filter(
      (participant) => participant.game_id === game.id,
    );
    return (
      !participants.some((participant) => participant.side === "home") ||
      !participants.some((participant) => participant.side === "away")
    );
  });
  const hasUnconfirmedParticipant = structuralParticipants.some(
    (participant) => !confirmedRegistrationIds.has(participant.registration_id),
  );
  const hasParticipantWithoutRoster = structuralParticipants.some(
    (participant) =>
      confirmedRegistrationIds.has(participant.registration_id) &&
      !registrationsWithRosterIds.has(participant.registration_id),
  );
  const unavailableIssue =
    games.length === 0
      ? describeScoresheetUnavailability({
          hasStructuralGames: gamesResult.data.length > 0,
          hasMinimumConfirmedRegistrations: registrationsResult.data.length >= 2,
          hasMinimumRegistrationsWithRoster: registrations.length >= 2,
          hasIncompleteParticipants,
          hasUnconfirmedParticipant,
          hasParticipantWithoutRoster,
        })
      : null;

  return data(
    {
      competition,
      csrfToken: auth.payload.csrfToken,
      idempotencyKey: crypto.randomUUID(),
      games,
      registrations,
      wizardMode,
      requiresFallbackReason,
      unavailableIssue,
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

  if (formData.get("intent") === "confirm-manual-v2") {
    const raw = formData.get("setup");
    if (typeof raw !== "string" || raw.length > 150_000)
      return badRequest("O rascunho é inválido ou excede o tamanho permitido.");
    let decoded: unknown;
    try {
      decoded = JSON.parse(raw);
    } catch {
      return badRequest("O rascunho enviado é inválido.");
    }
    const setup = parseScoresheetSetup(decoded);
    if (!setup) return badRequest("Revise os dados do rascunho antes de confirmar.");
    const confirmation = buildSetupConfirmation(setup, competitionId);
    if (!confirmation.payload) return badRequest(confirmation.issues.join(" "));
    const result = await auth.client.rpc("admin_create_manual_scoresheet_v2", {
      p_payload: confirmation.payload as unknown as Json,
    });
    if (result.error) {
      logOperationalEvent({
        correlationId,
        durationMs: Date.now() - startedAt,
        operation: "scoresheet.v2.confirm",
        outcome: "failure",
        status: 400,
        context: { competitionId, errorCode: result.error.code },
      });
      return data(
        { error: mapScoresheetError(result.error.code) },
        { status: result.error.code === "BD401" ? 403 : 400 },
      );
    }
    logOperationalEvent({
      correlationId,
      durationMs: Date.now() - startedAt,
      operation: "scoresheet.v2.confirm",
      outcome: "success",
      status: 200,
      context: { competitionId, entityId: result.data },
    });
    return data(
      { confirmedGameId: result.data },
      { headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
    );
  }

  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  const gameId = parseId(formData.get("gameId"));
  const scheduledLocal = String(formData.get("scheduledLocal") ?? "");
  const venue = String(formData.get("venue") ?? "").trim();
  const rawGameNumber = String(formData.get("gameNumber") ?? "").trim();
  const fallbackReason = String(formData.get("fallbackReason") ?? "").trim();
  const periodCount = parseId(formData.get("periodCount"));
  if (!gameId) return badRequest("Selecione um jogo estrutural válido.");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)
  ) {
    return badRequest("A submissão expirou. Recarregue o editor.");
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(scheduledLocal)) {
    return badRequest("Informe data e hora válidas.");
  }
  if (!venue || venue.length > 160 || rawGameNumber.length > 40) {
    return badRequest("Revise local e número do jogo.");
  }
  if (!periodCount || periodCount < 4 || periodCount > 12) {
    return badRequest("A grade deve conter Q1–Q4 e somente OTs sequenciais.");
  }

  const registrationIds = {
    home: parseId(formData.get("homeRegistrationId")),
    away: parseId(formData.get("awayRegistrationId")),
  };
  if (
    !registrationIds.home ||
    !registrationIds.away ||
    registrationIds.home === registrationIds.away
  ) {
    return badRequest("Mandante e visitante devem ser equipes diferentes.");
  }

  const teams: TeamPayload[] = [];
  const activeSlots: Array<{ side: TeamSide; slotNumber: number; rosterEntryId: number }> = [];
  for (const side of ["home", "away"] as const) {
    const selectedPlayers = new Set<number>();
    const jerseys = new Set<string>();
    const teamSlots: TeamPayload["slots"] = [];
    for (let slotNumber = 1; slotNumber <= 12; slotNumber += 1) {
      const rosterEntryId = parseId(formData.get(`${side}Player${slotNumber}`));
      if (!rosterEntryId) continue;
      const jersey = normalizeJersey(String(formData.get(`${side}Jersey${slotNumber}`) ?? ""));
      if (!jersey.ok || jersey.value === null) return badRequest("Revise os números de camisa.");
      if (selectedPlayers.has(rosterEntryId) || jerseys.has(jersey.value)) {
        return badRequest("Não repita atleta ou camisa dentro da equipe.");
      }
      selectedPlayers.add(rosterEntryId);
      jerseys.add(jersey.value);
      teamSlots.push({ slotNumber, rosterEntryId, jerseyNumber: jersey.value });
      activeSlots.push({ side, slotNumber, rosterEntryId });
    }
    if (teamSlots.length === 0)
      return badRequest("Cada equipe precisa de ao menos um relacionado.");
    teams.push({ side, registrationId: registrationIds[side] as number, slots: teamSlots });
  }

  const periods: PeriodPayload[] = [];
  const foulsBySlot = new Map<string, FoulInput[]>();
  for (let periodNumber = 1; periodNumber <= periodCount; periodNumber += 1) {
    const stats = [];
    for (const slot of activeSlots) {
      const readStat = (field: string) => {
        const value = formData.get(`stat-${slot.side}-${slot.slotNumber}-${periodNumber}-${field}`);
        return value === null ? 0 : parseNonnegativeInteger(value);
      };
      const twoPointMade = readStat("two");
      const threePointMade = readStat("three");
      const freeThrowMade = readStat("free");
      const fouls = parseFoulCodes(
        formData.get(`stat-${slot.side}-${slot.slotNumber}-${periodNumber}-fouls`),
      );
      if (twoPointMade === null || threePointMade === null || freeThrowMade === null || !fouls) {
        return badRequest("Use apenas inteiros de 0 a 99 e códigos de falta válidos.");
      }
      stats.push({
        rosterEntryId: slot.rosterEntryId,
        twoPointMade,
        threePointMade,
        freeThrowMade,
        fouls,
      });
      const key = `${slot.side}-${slot.slotNumber}`;
      const accumulated = foulsBySlot.get(key) ?? [];
      fouls.forEach((code, index) => {
        accumulated.push({ periodNumber, sequenceNumber: index + 1, code });
      });
      foulsBySlot.set(key, accumulated);
    }
    periods.push({ periodNumber, stats });
  }

  for (const slot of activeSlots) {
    const disqualification = evaluateDisqualification(
      foulsBySlot.get(`${slot.side}-${slot.slotNumber}`) ?? [],
    );
    if (!disqualification) continue;
    for (const period of periods) {
      if (period.periodNumber <= disqualification.periodNumber) continue;
      const stat = period.stats.find((item) => item.rosterEntryId === slot.rosterEntryId);
      if (
        stat &&
        (stat.twoPointMade > 0 ||
          stat.threePointMade > 0 ||
          stat.freeThrowMade > 0 ||
          stat.fouls.length > 0)
      ) {
        return badRequest("Remova estatísticas e faltas posteriores à desqualificação por GD.");
      }
    }
  }

  const homeTeam = teams.find((team) => team.side === "home");
  const awayTeam = teams.find((team) => team.side === "away");
  if (!homeTeam || !awayTeam) return badRequest("Selecione mandante e visitante.");
  const homeRoster = new Set(homeTeam.slots.map((slot) => slot.rosterEntryId));
  const awayRoster = new Set(awayTeam.slots.map((slot) => slot.rosterEntryId));
  for (let checkpoint = 4; checkpoint < periodCount; checkpoint += 1) {
    const completed = periods.slice(0, checkpoint);
    if (deriveTeamScore(completed, homeRoster) !== deriveTeamScore(completed, awayRoster)) {
      return badRequest("Uma prorrogação só pode existir se o placar anterior estiver empatado.");
    }
  }
  if (deriveTeamScore(periods, homeRoster) === deriveTeamScore(periods, awayRoster)) {
    return badRequest("O jogo está empatado. Adicione uma prorrogação antes de encerrar.");
  }

  const payload: ManualScoresheetPayload = {
    idempotencyKey,
    competitionId,
    gameId,
    ...(fallbackReason ? { fallbackReason } : {}),
    gameNumber: rawGameNumber || null,
    scheduledLocal,
    venue,
    teams: [homeTeam, awayTeam],
    periods,
  };
  const result = await auth.client.rpc("admin_create_manual_scoresheet", {
    p_payload: payload as unknown as Json,
  });
  if (result.error) {
    const status = result.error.code === "BD401" ? 403 : 400;
    logOperationalEvent({
      correlationId,
      durationMs: Date.now() - startedAt,
      operation: "scoresheet.save",
      outcome: status === 403 ? "blocked" : "failure",
      status,
      context: { competitionId, errorCode: result.error.code },
    });
    return data(
      { error: mapScoresheetError(result.error.code) },
      {
        status,
        headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined,
      },
    );
  }

  logOperationalEvent({
    correlationId,
    durationMs: Date.now() - startedAt,
    operation: "scoresheet.save",
    outcome: "success",
    status: 303,
    context: { competitionId, entityId: result.data },
  });

  const competitionResult = await auth.client
    .from("competitions")
    .select("year,series_id,category_id")
    .eq("id", competitionId)
    .single();
  if (competitionResult.error) throw new Error("Manual scoresheet redirect context failed");
  const [seriesResult, categoryResult] = await Promise.all([
    auth.client
      .from("competition_series")
      .select("slug")
      .eq("id", competitionResult.data.series_id)
      .single(),
    auth.client
      .from("categories")
      .select("slug")
      .eq("id", competitionResult.data.category_id)
      .single(),
  ]);
  if (seriesResult.error || categoryResult.error) {
    throw new Error("Manual scoresheet redirect context failed");
  }

  throw redirect(
    buildPublicGamePath(
      competitionResult.data.year,
      seriesResult.data.slug,
      categoryResult.data.slug,
      result.data,
    ),
    { headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
  );
}

export function ScoresheetUnavailableState({
  competitionId,
  issue,
  requiresFallbackReason,
}: {
  competitionId: number;
  issue: ScoresheetUnavailableIssue;
  requiresFallbackReason: boolean;
}) {
  const hubPath = `/admin/competitions/${competitionId}`;
  const primaryPath = issue.action === "schedule" ? `${hubPath}/schedule` : hubPath;
  const primaryLabel = issue.action === "schedule" ? "Abrir agenda" : "Revisar equipes e elencos";
  return (
    <main className="admin-shell">
      <header className="site-header admin-header">
        <Link className="brand" to={hubPath}>
          <span className="brand-mark">B</span>
          <span>Voltar ao hub</span>
        </Link>
        <span className="environment-pill">
          <span className="status-dot" />
          AAL2
        </span>
      </header>
      <section className="admin-welcome">
        <p className="eyebrow">{requiresFallbackReason ? "Súmula emergencial" : "Súmula manual"}</p>
        <h1>Nenhum jogo disponível</h1>
        <p>{issue.message}</p>
        {requiresFallbackReason ? (
          <p className="admin-note">
            Nesta edição, a súmula manual é usada somente como fallback auditado enquanto o boxscore
            principal não está disponível.
          </p>
        ) : null}
        <div className="wizard-actions">
          <Link className="button button-primary" to={primaryPath}>
            {primaryLabel}
          </Link>
          {issue.action === "schedule" ? (
            <Link className="button button-ghost" to={hubPath}>
              Voltar ao hub
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export default function NewManualScoresheet({ loaderData, actionData }: Route.ComponentProps) {
  if (loaderData.wizardMode === "setup") {
    if (loaderData.registrations.length < 2) {
      return (
        <main className="admin-shell">
          <section className="admin-welcome">
            <h1>Equipes insuficientes</h1>
            <p>
              É necessário ter duas equipes confirmadas com atletas inscritos para configurar a
              súmula.
            </p>
          </section>
        </main>
      );
    }
    return (
      <ManualScoresheetSetupWizard
        competitionId={loaderData.competition.id}
        competitionName={loaderData.competition.display_name}
        registrations={loaderData.registrations}
        hasExistingGames={loaderData.games.length > 0}
        csrfToken={loaderData.csrfToken}
        requiresFallbackReason={loaderData.requiresFallbackReason}
      />
    );
  }
  if (loaderData.unavailableIssue) {
    return (
      <ScoresheetUnavailableState
        competitionId={loaderData.competition.id}
        issue={loaderData.unavailableIssue}
        requiresFallbackReason={loaderData.requiresFallbackReason}
      />
    );
  }

  return (
    <ManualScoresheetEditor
      actionError={actionData && "error" in actionData ? actionData.error : undefined}
      competitionId={loaderData.competition.id}
      competitionName={loaderData.competition.display_name}
      csrfToken={loaderData.csrfToken}
      idempotencyKey={loaderData.idempotencyKey}
      games={loaderData.games}
      registrations={loaderData.registrations}
      requiresFallbackReason={loaderData.requiresFallbackReason}
    />
  );
}
