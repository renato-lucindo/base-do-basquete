import { type Ref, useEffect, useRef, useState } from "react";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { AdminNavigation } from "../components/admin/admin-area";
import { RegistrationAccordion } from "../components/admin/registration-accordion";
import { RosterEditor } from "../components/admin/roster-editor";
import { cloudflareContext, correlationIdContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";
import {
  mapAdminDomainError,
  normalizeFinalResult,
  normalizeJersey,
  normalizeRegistrationRemoval,
} from "../modules/competition/admin-domain";
import { logOperationalEvent } from "../modules/observability/operation.server";
import type { Route } from "./+types/admin.competitions.$competitionId";

function parseId(value: string | FormDataEntryValue | null): number | null {
  const text = typeof value === "string" ? value : "";
  return /^[1-9][0-9]*$/.test(text) ? Number(text) : null;
}

export function DraftRegistrationSelector({
  error,
  errorRef,
  registrations,
}: {
  error?: string | null;
  errorRef?: Ref<HTMLParagraphElement>;
  registrations: Array<{ id: number; teamName: string }>;
}) {
  return (
    <>
      <fieldset aria-describedby={error ? "confirm-registrations-error" : undefined}>
        <legend>Inscrições em rascunho</legend>
        {registrations.map((registration) => (
          <label className="checkbox-label" key={registration.id}>
            <input type="checkbox" name="registrationId" value={registration.id} defaultChecked />
            {registration.teamName}
          </label>
        ))}
      </fieldset>
      {error ? (
        <p
          className="form-error"
          id="confirm-registrations-error"
          ref={errorRef}
          role="alert"
          tabIndex={-1}
        >
          {error}
        </p>
      ) : null}
    </>
  );
}

type CompetitionPrimarySource = "manual_scoresheet" | "fiba_boxscore" | null;

interface CompetitionDataAction {
  label: string;
  description: string;
  enabled: boolean;
}

export function resolveCompetitionDataActions({
  status,
  primarySource,
  gameCount,
}: {
  status: string;
  primarySource: CompetitionPrimarySource;
  gameCount: number;
}): { scoresheet: CompetitionDataAction | null; boxscore: CompetitionDataAction | null } {
  if (status === "archived" || !primarySource) return { scoresheet: null, boxscore: null };
  const hasGame = gameCount > 0;
  if (primarySource === "manual_scoresheet") {
    return {
      scoresheet: {
        label: "Registrar súmula",
        description: hasGame
          ? "Registre o resultado e os dados básicos no jogo já organizado."
          : "Organize ao menos um confronto na agenda antes de registrar a súmula.",
        enabled: hasGame,
      },
      boxscore: {
        label: "Importar boxscore suplementar",
        description: hasGame
          ? "Use um PDF compatível para enriquecer um jogo existente após revisão."
          : "Organize ao menos um confronto na agenda antes de importar um PDF.",
        enabled: hasGame,
      },
    };
  }
  return {
    scoresheet: {
      label: "Registrar súmula emergencial",
      description: hasGame
        ? "Use somente quando o boxscore principal ainda não estiver disponível; o motivo será auditado."
        : "Organize ao menos um confronto na agenda antes de usar o fallback emergencial.",
      enabled: hasGame,
    },
    boxscore: {
      label: "Importar boxscore",
      description: hasGame
        ? "Envie e revise o PDF da fonte principal para um jogo existente."
        : "Organize ao menos um confronto na agenda antes de importar o boxscore.",
      enabled: hasGame,
    },
  };
}

export function parseRegistrationRemovalDecision(value: unknown): {
  decision: "remove" | "withdraw" | "blocked";
  reasonCode: string;
  dependencies: Record<string, number>;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    (record.decision !== "remove" &&
      record.decision !== "withdraw" &&
      record.decision !== "blocked") ||
    typeof record.reasonCode !== "string" ||
    !record.dependencies ||
    typeof record.dependencies !== "object" ||
    Array.isArray(record.dependencies)
  ) {
    return null;
  }
  const rawDependencies = record.dependencies as Record<string, unknown>;
  const requiredDependencies = [
    "rosterEntries",
    "structureAssignments",
    "matchups",
    "games",
    "placements",
    "resolutions",
    "publicationSnapshots",
  ] as const;
  const dependencyEntries = requiredDependencies.map(
    (dependency) => [dependency, rawDependencies[dependency]] as const,
  );
  if (
    dependencyEntries.some(
      ([, count]) => typeof count !== "number" || !Number.isSafeInteger(count) || count < 0,
    )
  ) {
    return null;
  }
  const dependencies = Object.fromEntries(dependencyEntries) as Record<string, number>;
  return { decision: record.decision, reasonCode: record.reasonCode, dependencies };
}

export function parseRosterActionEntries(
  formData: FormData,
):
  | { ok: true; entries: Array<{ playerId: number; jerseyNumber: string | null }> }
  | { ok: false; error: string } {
  const entries: Array<{ playerId: number; jerseyNumber: string | null }> = [];
  for (const value of formData.getAll("playerId")) {
    const playerId = parseId(value);
    if (!playerId) return { ok: false, error: "Atleta inválido." };
    const jersey = normalizeJersey(String(formData.get(`jersey-${playerId}`) ?? ""));
    if (!jersey.ok) return { ok: false, error: jersey.error.message };
    entries.push({ playerId, jerseyNumber: jersey.value });
  }
  return { ok: true, entries };
}

export function mapRosterActionFailure(code: string | undefined) {
  const mapped = mapAdminDomainError(code);
  return {
    message: mapped.message,
    outcome: mapped.code === "authorization" ? ("blocked" as const) : ("failure" as const),
    status: mapped.code === "authorization" ? 403 : 400,
  };
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
    .select("id,display_name,year,status,series_id,category_id,gender_division,data_profile_id")
    .eq("id", competitionId)
    .limit(1);
  if (competitionResult.error) throw new Error("Competition hub query failed");
  const competition = competitionResult.data[0];
  if (!competition) throw new Response("Edição não encontrada", { status: 404 });

  const profileResult = competition.data_profile_id
    ? await auth.client
        .from("series_category_data_profiles")
        .select("primary_source")
        .eq("id", competition.data_profile_id)
        .single()
    : { data: null, error: null };
  if (profileResult.error) throw new Error("Competition data profile query failed");

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
      .select("id,game_number", { count: "exact" })
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
  const removalDecisionResults = await Promise.all(
    registrationIds.map((registrationId) =>
      auth.client.rpc("admin_get_registration_removal_decision", {
        p_registration_id: registrationId,
      }),
    ),
  );
  if (removalDecisionResults.some((result) => result.error)) {
    throw new Error("Registration removal policy query failed");
  }
  const removalDecisions = new Map(
    registrationIds.map((registrationId, index) => [
      registrationId,
      parseRegistrationRemovalDecision(removalDecisionResults[index]?.data),
    ]),
  );
  const rosterResult = registrationIds.length
    ? await auth.client
        .from("roster_entries")
        .select("registration_id,player_id,jersey_number,status")
        .in("registration_id", registrationIds)
        .eq("status", "active")
    : { data: [], error: null };
  if (rosterResult.error) throw new Error("Competition roster query failed");

  const competitionGameIds = gamesResult.data.map((game) => game.id);
  const fallbackResult = competitionGameIds.length
    ? await auth.client
        .from("game_data_submissions")
        .select("id,game_id,fallback_finalized_at")
        .in("game_id", competitionGameIds)
        .eq("source_type", "manual_scoresheet")
        .eq("role", "fallback")
        .eq("status", "active")
        .order("submitted_at", { ascending: false })
    : { data: [], error: null };
  if (fallbackResult.error) throw new Error("Competition source fallback query failed");
  const gameNumbers = new Map(gamesResult.data.map((game) => [game.id, game.game_number]));
  const sourceFallbacks = fallbackResult.data.map((fallback) => ({
    ...fallback,
    gameNumber: gameNumbers.get(fallback.game_id) ?? null,
  }));

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
    removalDecision: removalDecisions.get(registration.id) ?? null,
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
      dataActions: resolveCompetitionDataActions({
        status: competition.status,
        primarySource:
          profileResult.data?.primary_source === "manual_scoresheet" ||
          profileResult.data?.primary_source === "fiba_boxscore"
            ? profileResult.data.primary_source
            : null,
        gameCount: gamesResult.count ?? 0,
      }),
      sourceFallbacks,
      savedRosterId: parseId(new URL(request.url).searchParams.get("savedRoster")),
      changedRegistrationId: parseId(new URL(request.url).searchParams.get("changedRegistration")),
      registrationOutcome: new URL(request.url).searchParams.get("registrationOutcome"),
      confirmedBatch: parseId(new URL(request.url).searchParams.get("confirmedBatch")),
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
  } else if (intent === "confirm-registrations") {
    const registrationIds = formData.getAll("registrationId").map((value) => parseId(value));
    if (
      registrationIds.length === 0 ||
      registrationIds.some((registrationId) => registrationId === null)
    ) {
      return data(
        {
          error: "Selecione ao menos uma inscrição em rascunho.",
          intent: "confirm-registrations",
        },
        { status: 400 },
      );
    }
    const validIds = registrationIds as number[];
    const bulkResult = await auth.client.rpc("admin_confirm_team_registrations", {
      p_competition_id: competitionId,
      p_registration_ids: validIds,
    });
    if (bulkResult.error) {
      result = bulkResult;
    } else {
      throw redirect(`/admin/competitions/${competitionId}?confirmedBatch=${validIds.length}`, {
        headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined,
      });
    }
  } else if (intent === "transition-registration") {
    const registrationId = parseId(formData.get("registrationId"));
    const status = String(formData.get("status") ?? "");
    if (!registrationId) return data({ error: "Inscrição inválida." }, { status: 400 });
    if (status !== "confirmed" && status !== "completed") {
      return data(
        { error: "Use a revisão de retirada para alterar a participação da equipe." },
        { status: 400 },
      );
    }
    result = await auth.client.rpc("admin_transition_team_registration", {
      p_registration_id: registrationId,
      p_status: status,
    });
  } else if (intent === "replace-roster") {
    const registrationId = parseId(formData.get("registrationId"));
    if (!registrationId) return data({ error: "Inscrição inválida." }, { status: 400 });
    const parsed = parseRosterActionEntries(formData);
    if (!parsed.ok) return data({ error: parsed.error }, { status: 400 });
    result = await auth.client.rpc("admin_replace_roster", {
      p_registration_id: registrationId,
      p_entries: parsed.entries,
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
  } else if (intent === "remove-registration") {
    const registrationId = parseId(formData.get("registrationId"));
    if (!registrationId) return data({ error: "Inscrição inválida." }, { status: 400 });
    if (formData.get("confirmed") !== "on") {
      return data(
        { error: "Confirme que a ação afeta somente esta edição.", registrationId },
        { status: 400 },
      );
    }
    const normalized = normalizeRegistrationRemoval(
      String(formData.get("expectedDecision") ?? ""),
      String(formData.get("reason") ?? ""),
    );
    if (!normalized.ok) {
      return data({ error: normalized.error.message, registrationId }, { status: 400 });
    }
    const removalResult = await auth.client.rpc("admin_apply_registration_removal", {
      p_registration_id: registrationId,
      p_expected_decision: normalized.value.decision,
      p_reason: normalized.value.reason,
    });
    result = removalResult;
    if (!removalResult.error) {
      const rawOutcome =
        removalResult.data !== null &&
        typeof removalResult.data === "object" &&
        "outcome" in removalResult.data &&
        typeof removalResult.data.outcome === "string"
          ? removalResult.data.outcome
          : null;
      const outcome =
        rawOutcome === "removed" || rawOutcome === "withdrawn" || rawOutcome === "unchanged"
          ? rawOutcome
          : normalized.value.decision === "remove"
            ? "removed"
            : "withdrawn";
      throw redirect(
        `/admin/competitions/${competitionId}?changedRegistration=${registrationId}&registrationOutcome=${outcome}`,
        { headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
      );
    }
  } else {
    throw new Response("Ação inválida", { status: 400 });
  }

  if (result.error) {
    const mapped = mapAdminDomainError(result.error.code);
    const rosterFailure =
      intent === "replace-roster" ? mapRosterActionFailure(result.error.code) : null;
    const status = rosterFailure?.status ?? (mapped.code === "authorization" ? 403 : 400);
    if (intent === "replace-roster") {
      logOperationalEvent({
        correlationId,
        durationMs: Date.now() - startedAt,
        operation: "roster.replace",
        outcome: rosterFailure?.outcome ?? "failure",
        status,
        context: { competitionId, errorCode: result.error.code },
      });
    }
    return data(
      {
        error: rosterFailure?.message ?? mapped.message,
        intent: typeof intent === "string" ? intent : null,
        registrationId:
          intent === "remove-registration" ? parseId(formData.get("registrationId")) : null,
      },
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
  const actionIntent =
    actionData && "intent" in actionData && typeof actionData.intent === "string"
      ? actionData.intent
      : null;
  const batchConfirmationError =
    actionIntent === "confirm-registrations" ? actionData?.error : null;
  const actionErrorRef = useRef<HTMLParagraphElement>(null);
  const failedRegistrationId =
    actionData && "registrationId" in actionData && typeof actionData.registrationId === "number"
      ? actionData.registrationId
      : null;
  const [openRegistration, setOpenRegistration] = useState<number | null>(
    failedRegistrationId ?? loaderData.savedRosterId ?? loaderData.changedRegistrationId,
  );
  useEffect(() => {
    if (loaderData.savedRosterId) setOpenRegistration(loaderData.savedRosterId);
  }, [loaderData.savedRosterId]);
  useEffect(() => {
    if (actionData?.error) actionErrorRef.current?.focus();
  }, [actionData?.error]);
  const draftRegistrations = loaderData.registrations.filter(
    (registration) => registration.status === "draft",
  );
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
      <AdminNavigation />
      <section className="admin-welcome admin-hub">
        <p className="eyebrow">Hub da edição</p>
        <h1>{competition.display_name}</h1>
        <p>
          {competition.seriesName} · {competition.year} · {competition.categoryName} ·{" "}
          {competition.status}
        </p>
        {actionData?.error && !batchConfirmationError ? (
          <p className="form-error" ref={actionErrorRef} role="alert" tabIndex={-1}>
            {actionData.error}
          </p>
        ) : null}
        {loaderData.registrationOutcome === "removed" ? (
          <p className="form-success">
            A inscrição provisória foi removida. A equipe global foi preservada.
          </p>
        ) : loaderData.registrationOutcome === "withdrawn" ? (
          <p className="form-success">
            A equipe foi retirada da edição e o histórico foi preservado.
          </p>
        ) : loaderData.registrationOutcome === "unchanged" ? (
          <p className="form-success">A inscrição já estava no estado solicitado.</p>
        ) : null}
        {loaderData.confirmedBatch ? (
          <p className="form-success">
            {loaderData.confirmedBatch === 1
              ? "1 inscrição foi confirmada."
              : `${loaderData.confirmedBatch} inscrições foram confirmadas em uma única operação.`}
          </p>
        ) : null}

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

        {loaderData.sourceFallbacks.length ? (
          <section className="admin-panel">
            <p className="eyebrow">Pendências de fonte</p>
            <h2>Fallbacks manuais</h2>
            <ul className="import-history">
              {loaderData.sourceFallbacks.map((fallback) => (
                <li key={fallback.id}>
                  <span>
                    {fallback.gameNumber
                      ? `Jogo ${fallback.gameNumber}`
                      : `Jogo #${fallback.game_id}`}
                  </span>
                  <strong>
                    {fallback.fallback_finalized_at
                      ? "fallback encerrado"
                      : "aguardando boxscore PDF"}
                  </strong>
                  <Link to={`/admin/games/${fallback.game_id}/data-conflict`}>Revisar fonte</Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

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

        {draftRegistrations.length ? (
          <section className="admin-panel">
            <h2>Confirmar inscrições</h2>
            <p>Selecione as equipes prontas. A operação inteira é validada antes de confirmar.</p>
            <Form method="post" className="admin-form">
              <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
              <input type="hidden" name="intent" value="confirm-registrations" />
              <DraftRegistrationSelector
                error={batchConfirmationError}
                errorRef={actionErrorRef}
                registrations={draftRegistrations}
              />
              <button className="button button-primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Confirmando…" : "Confirmar selecionadas"}
              </button>
            </Form>
          </section>
        ) : null}

        <div className="registration-list">
          {loaderData.registrations.map((registration) => (
            <RegistrationAccordion
              key={registration.id}
              id={registration.id}
              name={registration.teamName}
              status={registration.status}
              playerCount={registration.roster.length}
              open={openRegistration === registration.id}
              onToggle={() =>
                setOpenRegistration((current) =>
                  current === registration.id ? null : registration.id,
                )
              }
              situation={
                registration.status === "draft" || registration.status === "confirmed" ? (
                  <div className="admin-registration-situation">
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
                        </select>
                      </label>
                      <button className="button button-ghost" type="submit">
                        Atualizar
                      </button>
                    </Form>
                    {registration.removalDecision ? (
                      <details className="admin-danger-zone">
                        <summary>
                          {registration.removalDecision.decision === "remove"
                            ? "Remover inscrição provisória"
                            : registration.removalDecision.decision === "withdraw"
                              ? "Retirar equipe desta edição"
                              : "Remoção indisponível"}
                        </summary>
                        {registration.removalDecision.decision === "remove" ? (
                          <p>
                            Esta inscrição ainda não possui elenco, vaga estrutural ou histórico
                            competitivo. Somente a inscrição nesta edição será removida; a equipe
                            continuará cadastrada.
                          </p>
                        ) : registration.removalDecision.decision === "withdraw" ? (
                          <p>
                            A inscrição e todo o histórico permanecerão registrados. Atletas ativos
                            serão encerrados e a situação passará para retirada.
                          </p>
                        ) : (
                          <p>O estado atual precisa ser preservado e não admite esta operação.</p>
                        )}
                        {registration.removalDecision.decision !== "blocked" ? (
                          <Form method="post" className="inline-admin-form">
                            <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
                            <input type="hidden" name="intent" value="remove-registration" />
                            <input type="hidden" name="registrationId" value={registration.id} />
                            <input
                              type="hidden"
                              name="expectedDecision"
                              value={registration.removalDecision.decision}
                            />
                            <label>
                              Justificativa
                              <textarea
                                name="reason"
                                required
                                minLength={10}
                                maxLength={500}
                                rows={3}
                              />
                            </label>
                            <label className="checkbox-label">
                              <input name="confirmed" type="checkbox" required />
                              Confirmo que esta ação afeta somente a participação nesta edição.
                            </label>
                            <button
                              className="button button-ghost"
                              type="submit"
                              disabled={isSubmitting}
                            >
                              {registration.removalDecision.decision === "remove"
                                ? "Remover somente a inscrição"
                                : "Retirar e preservar histórico"}
                            </button>
                          </Form>
                        ) : null}
                      </details>
                    ) : null}
                  </div>
                ) : null
              }
              roster={
                registration.status !== "withdrawn" && registration.status !== "completed" ? (
                  <RosterEditor
                    competitionId={competition.id}
                    competitionGender={competition.gender_division}
                    csrfToken={loaderData.csrfToken}
                    registrationId={registration.id}
                    teamName={registration.teamName}
                    currentRoster={registration.roster}
                    suggestedRoster={registration.suggestedRoster}
                    suggestionLabel={registration.suggestionLabel}
                    saved={loaderData.savedRosterId === registration.id}
                  />
                ) : null
              }
              result={
                registration.status !== "draft" ? (
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
                ) : null
              }
            />
          ))}
        </div>

        <section className="admin-action-grid">
          <article>
            <h2>Regulamento e revisões</h2>
            <p>Clone e edite somente uma revisão privada, preservando a estrutura ativa.</p>
            <Link
              className="button button-primary"
              to={`/admin/competitions/${competition.id}/structure`}
            >
              Abrir estrutura
            </Link>
          </article>
          <article>
            <h2>Estrutura e agenda</h2>
            <p>Atribua equipes às vagas e prepare os jogos sem publicar.</p>
            <Link
              className="button button-primary"
              to={`/admin/competitions/${competition.id}/schedule`}
            >
              Organizar confrontos
            </Link>
          </article>
          <article>
            <h2>Naipe e dados dos jogos</h2>
            <p>Revise a classificação e vincule a fonte primária sem inferências.</p>
            <Link
              className="button button-primary"
              to={`/admin/competitions/${competition.id}/data-profile`}
            >
              Revisar configuração
            </Link>
          </article>
          <article>
            <h2>Revisão e publicação</h2>
            <p>Revise o resumo e confirme manualmente cada versão pública.</p>
            <Link
              className="button button-primary"
              to={`/admin/competitions/${competition.id}/publication`}
            >
              Revisar publicação
            </Link>
          </article>
          <article>
            <h2>Exceções esportivas</h2>
            <p>Encerre grupos, registre W.O. e revise correções com impacto prévio.</p>
            <Link
              className="button button-primary"
              to={`/admin/competitions/${competition.id}/sports-exceptions`}
            >
              Revisar exceções
            </Link>
          </article>
          {loaderData.dataActions.scoresheet ? (
            <article>
              <h2>{loaderData.dataActions.scoresheet.label}</h2>
              <p>{loaderData.dataActions.scoresheet.description}</p>
              {loaderData.dataActions.scoresheet.enabled ? (
                <Link
                  className="button button-primary"
                  to={`/admin/competitions/${competition.id}/scoresheets/new`}
                >
                  {loaderData.dataActions.scoresheet.label}
                </Link>
              ) : (
                <button className="button button-primary" type="button" disabled>
                  Indisponível até organizar a agenda
                </button>
              )}
            </article>
          ) : null}
          {loaderData.dataActions.boxscore ? (
            <article>
              <h2>{loaderData.dataActions.boxscore.label}</h2>
              <p>{loaderData.dataActions.boxscore.description}</p>
              {loaderData.dataActions.boxscore.enabled ? (
                <Link
                  className="button button-primary"
                  to={`/admin/competitions/${competition.id}/boxscores/import`}
                >
                  {loaderData.dataActions.boxscore.label}
                </Link>
              ) : (
                <button className="button button-primary" type="button" disabled>
                  Indisponível até organizar a agenda
                </button>
              )}
            </article>
          ) : null}
        </section>
      </section>
    </main>
  );
}
