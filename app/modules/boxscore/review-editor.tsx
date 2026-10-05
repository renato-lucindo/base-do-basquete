import { useEffect, useMemo, useRef, useState } from "react";
import { Form, useNavigation } from "react-router";

import { AdminDraftNotice } from "../../components/admin/admin-draft-notice";
import { AdminPlayerSearch } from "../../components/admin/admin-player-search";
import { AdminWizardSteps } from "../../components/admin/admin-wizard-steps";
import { InlineFieldError } from "../../components/admin/inline-field-error";
import { StickyActionSummary } from "../../components/admin/sticky-action-summary";
import { UnsavedChangesGuard } from "../../components/admin/unsaved-changes-guard";
import type { Json } from "../../types/database.generated";
import { readAdminDraft, removeAdminDraft, saveAdminDraft } from "../admin-drafts/client";
import type { AdminDraft } from "../admin-drafts/schema";
import type { AdminPlayerSearchResult } from "../players/admin-domain";
import { matchingRegistrationCandidates } from "./team-registration-resolution";
import type { ParsedBoxscore } from "./types";

const importSteps = ["Arquivo", "Revisão", "Associações", "Confirmação"] as const;

interface ReviewMatch {
  source_team_name: string;
  source_player_name: string;
  source_jersey_number: string;
  roster_entry_id: number | null;
  suggested_player_id: number | null;
  suggestion_payload: Json;
  suggestion_kind: string;
  similarity_score: number | null;
}

interface ReviewRegistration {
  id: number;
  teamId: number;
  teamName: string;
  abbreviation: string | null;
  roster: Array<{
    rosterEntryId: number;
    playerId: number;
    playerName: string;
    jerseyNumber: string | null;
  }>;
}

interface ReviewGame {
  id: number;
  gameNumber: string | null;
  scheduledAt: string | null;
  venue: string | null;
  homeRegistrationId: number;
  awayRegistrationId: number;
  homeTeamName: string;
  awayTeamName: string;
  isLateFallback: boolean;
}

interface ReviewTeamCandidate {
  teamId: number;
  teamName: string;
  publicName: string | null;
  abbreviation: string | null;
  isActive: boolean;
  registrationId: number | null;
  registrationStatus: string | null;
  registrationCount: number;
}

interface BoxscoreReviewEditorProps {
  actionError?: string;
  actionStep?: 2 | 3 | 4;
  competitionId: number;
  competitionGender: string | null;
  csrfToken: string;
  games: ReviewGame[];
  manualMatchupRequestId: string;
  preferredGameId: number | null;
  review: {
    id: number;
    parsed: ParsedBoxscore;
    resolvedTeams: Array<{ sourceTeamName: string; registrationId: number }>;
    matches: ReviewMatch[];
  };
  registrations: ReviewRegistration[];
  teamCandidates: ReviewTeamCandidate[];
}

interface ReviewDraftData {
  applyReviewedMetadata: boolean;
  gameId: number;
  manualHomeRegistrationId: number;
  scheduledDate: string;
  scheduledTime: string;
  step: number;
  targetMode: "create" | "existing";
  registrations: Record<number, number>;
  resolutions: Record<number, string>;
  venue: string;
}

type NewPlayerEligibilitySex = "" | "female" | "male";

function normalizeTeam(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function BoxscoreReviewEditor({
  actionError,
  actionStep,
  competitionId,
  competitionGender,
  csrfToken,
  games,
  manualMatchupRequestId,
  preferredGameId,
  review,
  registrations,
  teamCandidates,
}: BoxscoreReviewEditorProps) {
  const navigation = useNavigation();
  const submitted = useRef(false);
  const actionErrorRef = useRef<HTMLParagraphElement>(null);
  const matches = useMemo(
    () =>
      new Map(
        review.matches.map((match) => [
          `${match.source_team_name}\u0000${match.source_player_name}`,
          match,
        ]),
      ),
    [review.matches],
  );
  const players = useMemo(
    () => review.parsed.teams.flatMap((team) => team.players.map((player) => ({ team, player }))),
    [review.parsed.teams],
  );
  const candidatesForTeam = (team: ParsedBoxscore["teams"][number]) =>
    matchingRegistrationCandidates(team, teamCandidates);
  const matchedRegistration = (team: ParsedBoxscore["teams"][number]) => {
    const audited = review.resolvedTeams.find(
      (resolved) => normalizeTeam(resolved.sourceTeamName) === normalizeTeam(team.name),
    );
    if (audited) {
      return registrations.find((registration) => registration.id === audited.registrationId);
    }
    const candidates = candidatesForTeam(team);
    if (candidates.length !== 1) return undefined;
    const candidate = candidates[0];
    if (!candidate) return undefined;
    if (!candidate.isActive || candidate.registrationStatus !== "confirmed") return undefined;
    return registrations.find((registration) => registration.id === candidate.registrationId);
  };
  const rosteredPlayerIds = useMemo(
    () => new Set(registrations.flatMap((item) => item.roster.map((entry) => entry.playerId))),
    [registrations],
  );
  const initialRegistrations = Object.fromEntries(
    review.parsed.teams.map((team, index) => [index, matchedRegistration(team)?.id ?? 0]),
  );
  const resolvedRegistrationIds = review.parsed.teams
    .map((team) => matchedRegistration(team)?.id ?? 0)
    .filter((id) => id > 0);
  const eligibleGames =
    resolvedRegistrationIds.length === 2 && new Set(resolvedRegistrationIds).size === 2
      ? games.filter((game) => {
          const participants = new Set([game.homeRegistrationId, game.awayRegistrationId]);
          return resolvedRegistrationIds.every((registrationId) =>
            participants.has(registrationId),
          );
        })
      : [];
  const initialGame =
    eligibleGames.find((game) => game.id === preferredGameId) ??
    eligibleGames.find((game) => game.gameNumber === review.parsed.gameNumber) ??
    eligibleGames[0] ??
    null;
  const initialTeamResolutionChoices = Object.fromEntries(
    review.parsed.teams.map((team, index) => {
      const resolved = matchedRegistration(team);
      if (resolved) return [index, `registration:${resolved.id}`];
      const candidates = candidatesForTeam(team);
      if (candidates.length === 0) return [index, "new"];
      if (candidates.length !== 1) return [index, ""];
      const candidate = candidates[0];
      if (!candidate) return [index, ""];
      if (!candidate.isActive) return [index, ""];
      if (candidate.registrationStatus === "confirmed" && candidate.registrationId) {
        return [index, `registration:${candidate.registrationId}`];
      }
      if (candidate.registrationStatus === null || candidate.registrationStatus === "draft") {
        return [index, `team:${candidate.teamId}`];
      }
      return [index, ""];
    }),
  );
  const initialResolutions = Object.fromEntries(
    players.map(({ team, player }, index) => {
      const match = matches.get(`${team.name}\u0000${player.name}`);
      const selectedTeam = matchedRegistration(team);
      const suggestedRoster = match?.roster_entry_id
        ? selectedTeam?.roster.find((entry) => entry.rosterEntryId === match.roster_entry_id)
        : null;
      const suggestedFree = match?.suggested_player_id
        ? !rosteredPlayerIds.has(match.suggested_player_id)
        : false;
      const value =
        match?.suggestion_kind === "exact" && suggestedRoster
          ? `roster:${suggestedRoster.rosterEntryId}`
          : match?.suggestion_kind === "exact" && suggestedFree
            ? `player:${match.suggested_player_id}`
            : match?.suggestion_kind === "unmatched"
              ? "new"
              : "";
      return [index, value];
    }),
  );
  const [step, setStep] = useState(2);
  const [gameId, setGameId] = useState(initialGame?.id ?? 0);
  const [targetMode, setTargetMode] = useState<"create" | "existing">(
    initialGame ? "existing" : "create",
  );
  const [scheduledDate, setScheduledDate] = useState(
    review.parsed.scheduledLocal?.slice(0, 10) ?? "",
  );
  const [scheduledTime, setScheduledTime] = useState(
    review.parsed.scheduledLocal?.slice(11, 16) ?? "",
  );
  const [venue, setVenue] = useState(review.parsed.venue ?? "");
  const [applyReviewedMetadata, setApplyReviewedMetadata] = useState(false);
  const [manualHomeRegistrationId, setManualHomeRegistrationId] = useState(
    resolvedRegistrationIds[0] ?? 0,
  );
  const [teamRegistrations, setTeamRegistrations] =
    useState<Record<number, number>>(initialRegistrations);
  const [teamResolutionChoices, setTeamResolutionChoices] = useState<Record<number, string>>(
    initialTeamResolutionChoices,
  );
  const [resolutions, setResolutions] = useState<Record<number, string>>(initialResolutions);
  const [newPlayerEligibility, setNewPlayerEligibility] = useState<
    Record<number, NewPlayerEligibilitySex>
  >({});
  const [draft, setDraft] = useState<AdminDraft<ReviewDraftData> | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pendingDraft, setPendingDraft] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const reviewAction = (mode: "confirm" | "resolve-teams") => `?import=${review.id}&mode=${mode}`;

  useEffect(() => {
    const result = readAdminDraft<ReviewDraftData>({
      flow: "boxscore-review",
      competitionId,
      entityId: review.id,
    });
    if (result.status === "available") setDraft(result.draft);
  }, [competitionId, review.id]);

  useEffect(() => {
    if (!pendingDraft) return;
    const timeout = window.setTimeout(() => {
      setSavedAt(
        saveAdminDraft(
          { flow: "boxscore-review", competitionId, entityId: review.id },
          {
            applyReviewedMetadata,
            gameId,
            manualHomeRegistrationId,
            scheduledDate,
            scheduledTime,
            step,
            targetMode,
            registrations: teamRegistrations,
            resolutions,
            venue,
          },
        ),
      );
      setPendingDraft(false);
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [
    applyReviewedMetadata,
    competitionId,
    gameId,
    manualHomeRegistrationId,
    pendingDraft,
    resolutions,
    review.id,
    scheduledDate,
    scheduledTime,
    step,
    targetMode,
    teamRegistrations,
    venue,
  ]);

  useEffect(() => {
    if (!actionError) return;
    setStep(actionStep ?? 4);
    actionErrorRef.current?.focus();
  }, [actionError, actionStep]);

  useEffect(() => {
    if (navigation.state === "submitting" && navigation.formAction?.includes("mode=confirm")) {
      submitted.current = true;
    }
  }, [navigation.formAction, navigation.state]);

  useEffect(
    () => () => {
      if (submitted.current) {
        removeAdminDraft({ flow: "boxscore-review", competitionId, entityId: review.id });
      }
    },
    [competitionId, review.id],
  );

  const change = () => setPendingDraft(true);
  const pending = players.filter(
    (_, index) =>
      !resolutions[index] || (resolutions[index] === "new" && !newPlayerEligibility[index]),
  ).length;
  const missingTeams = review.parsed.teams.filter((_, index) => !teamRegistrations[index]).length;
  const unresolvedTeamChoices = review.parsed.teams.filter(
    (_, index) => !teamRegistrations[index] && !teamResolutionChoices[index],
  ).length;
  const hasEligibleGame = eligibleGames.length > 0;
  const manualAwayRegistrationId =
    resolvedRegistrationIds.find((registrationId) => registrationId !== manualHomeRegistrationId) ??
    0;
  const manualAwayRegistration = registrations.find(
    (registration) => registration.id === manualAwayRegistrationId,
  );
  const targetReady =
    missingTeams === 0 &&
    Boolean(scheduledDate && scheduledTime && venue.trim()) &&
    ((targetMode === "existing" && gameId > 0) ||
      (targetMode === "create" && manualHomeRegistrationId > 0 && manualAwayRegistrationId > 0));
  const hasTransientPrivateSelection = Object.values(newPlayerEligibility).some(Boolean);
  const editionGenderLabel =
    competitionGender === "male"
      ? "Masculino"
      : competitionGender === "female"
        ? "Feminino"
        : "Pendente de revisão";

  const restore = () => {
    if (!draft) return;
    if (
      !draft.data ||
      !Number.isInteger(draft.data.gameId) ||
      !Number.isInteger(draft.data.manualHomeRegistrationId) ||
      !["create", "existing"].includes(draft.data.targetMode) ||
      typeof draft.data.scheduledDate !== "string" ||
      typeof draft.data.scheduledTime !== "string" ||
      typeof draft.data.venue !== "string" ||
      typeof draft.data.applyReviewedMetadata !== "boolean" ||
      !draft.data.registrations ||
      !draft.data.resolutions
    ) {
      discard();
      setRestoreMessage("O rascunho incompatível foi descartado.");
      return;
    }
    const restoredGame = draft.data.gameId
      ? eligibleGames.find((game) => game.id === draft.data.gameId)
      : null;
    if (draft.data.targetMode === "existing" && draft.data.gameId && !restoredGame) {
      discard();
      setRestoreMessage("O jogo estrutural do rascunho não está mais disponível.");
      return;
    }
    const validRosterEntries = new Set(
      registrations.flatMap((registration) =>
        registration.roster.map(({ rosterEntryId }) => rosterEntryId),
      ),
    );
    let skipped = 0;
    const restoredResolutions = Object.fromEntries(
      Object.entries(draft.data.resolutions).map(([index, resolution]) => {
        if (resolution === "new") return [index, resolution];
        const rosterMatch = resolution.match(/^roster:([1-9][0-9]*)$/);
        const playerMatch = resolution.match(/^player:([1-9][0-9]*)$/);
        if (playerMatch || (rosterMatch && validRosterEntries.has(Number(rosterMatch[1])))) {
          return [index, resolution];
        }
        skipped += 1;
        return [index, ""];
      }),
    );
    const restoredStep = Math.min(4, Math.max(2, draft.data.step));
    const restoredTargetReady =
      draft.data.targetMode === "existing"
        ? Boolean(restoredGame)
        : resolvedRegistrationIds.includes(draft.data.manualHomeRegistrationId);
    setStep(missingTeams > 0 || !restoredTargetReady ? 2 : restoredStep);
    setGameId(restoredGame?.id ?? 0);
    setTargetMode(draft.data.targetMode);
    setManualHomeRegistrationId(draft.data.manualHomeRegistrationId);
    setScheduledDate(draft.data.scheduledDate);
    setScheduledTime(draft.data.scheduledTime);
    setVenue(draft.data.venue);
    setApplyReviewedMetadata(draft.data.applyReviewedMetadata);
    setTeamRegistrations(initialRegistrations);
    setResolutions(restoredResolutions);
    setSavedAt(draft.savedAt);
    setDraft(null);
    setRestoreMessage(
      skipped
        ? `${skipped} referência(s) indisponível(is) foram ignoradas.`
        : "Rascunho restaurado.",
    );
  };

  const discard = () => {
    removeAdminDraft({ flow: "boxscore-review", competitionId, entityId: review.id });
    setDraft(null);
    setSavedAt(null);
  };

  return (
    <section className="admin-panel boxscore-review">
      <AdminWizardSteps
        current={step}
        labels={importSteps}
        onSelect={(nextStep) => {
          if (nextStep > 2 && !targetReady) return;
          if (nextStep > 3 && pending > 0) return;
          setStep(nextStep);
        }}
      />
      {draft ? (
        <AdminDraftNotice savedAt={draft.savedAt} onRestore={restore} onDiscard={discard} />
      ) : null}
      {restoreMessage ? <output className="admin-note">{restoreMessage}</output> : null}
      {actionError ? (
        <p className="form-error" role="alert" tabIndex={-1} ref={actionErrorRef}>
          {actionError}
        </p>
      ) : null}
      <Form method="post" action={reviewAction("confirm")} onSubmit={() => setAttempted(true)}>
        <UnsavedChangesGuard active={pendingDraft || hasTransientPrivateSelection} />
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <input type="hidden" name="importId" value={review.id} />
        <input type="hidden" name="gameId" value={gameId} />
        <input type="hidden" name="targetMode" value={targetMode} />
        <input type="hidden" name="homeRegistrationId" value={manualHomeRegistrationId} />
        <input type="hidden" name="teamCount" value="2" />
        <input type="hidden" name="playerCount" value={players.length} />
        <input type="hidden" name="manualMatchupRequestId" value={manualMatchupRequestId} />
        <section hidden={step !== 2}>
          <h2>Revisar jogo extraído</h2>
          <p>
            <strong>Jogo {review.parsed.gameNumber}</strong> · {review.parsed.teams[0].name}{" "}
            {review.parsed.teams[0].score} × {review.parsed.teams[1].score}{" "}
            {review.parsed.teams[1].name}
          </p>
          <p>
            Extraído do PDF: {review.parsed.scheduledLocal} · {review.parsed.venue}
          </p>
          <h3>Equipes da edição</h3>
          <p>
            Confirme cada equipe antes de avançar. Uma equipe ausente pode ser inscrita a partir de
            um cadastro existente ou criada explicitamente com o nome e a sigla extraídos do PDF.
          </p>
          <div className="boxscore-team-resolution">
            {review.parsed.teams.map((team, index) => {
              const candidates = candidatesForTeam(team);
              const resolvedRegistration = registrations.find(
                (registration) => registration.id === teamRegistrations[index],
              );
              return (
                <label key={team.name}>
                  {team.name} ({team.abbreviation})
                  <input type="hidden" name={`teamName-${index}`} value={team.name} />
                  {resolvedRegistration ? (
                    <>
                      <output>
                        Inscrição confirmada: {resolvedRegistration.teamName}
                        {resolvedRegistration.abbreviation
                          ? ` (${resolvedRegistration.abbreviation})`
                          : ""}
                      </output>
                      <input
                        type="hidden"
                        name={`teamResolution-${index}`}
                        value={`registration:${resolvedRegistration.id}`}
                      />
                    </>
                  ) : (
                    <select
                      name={`teamResolution-${index}`}
                      value={teamResolutionChoices[index] ?? ""}
                      required
                      aria-invalid={(attempted && !teamResolutionChoices[index]) || undefined}
                      onChange={(event) => {
                        setTeamResolutionChoices((current) => ({
                          ...current,
                          [index]: event.currentTarget.value,
                        }));
                      }}
                    >
                      <option value="" disabled>
                        Selecione como resolver
                      </option>
                      {candidates.map((candidate) => {
                        const candidateName = candidate.publicName ?? candidate.teamName;
                        const unavailable =
                          !candidate.isActive ||
                          (candidate.registrationStatus === "draft" &&
                            candidate.registrationCount > 1) ||
                          (candidate.registrationStatus !== null &&
                            candidate.registrationStatus !== "draft" &&
                            candidate.registrationStatus !== "confirmed");
                        const value =
                          candidate.registrationId && candidate.registrationStatus === "confirmed"
                            ? `registration:${candidate.registrationId}`
                            : `team:${candidate.teamId}`;
                        const label = !candidate.isActive
                          ? `${candidateName} · equipe inativa`
                          : candidate.registrationStatus === "confirmed"
                            ? `${candidateName} · usar inscrição confirmada`
                            : candidate.registrationStatus === "draft"
                              ? candidate.registrationCount > 1
                                ? `${candidateName} · confirme esta inscrição no hub antes de importar`
                                : `${candidateName} · confirmar inscrição existente`
                              : candidate.registrationStatus === null
                                ? `${candidateName} · inscrever equipe existente`
                                : `${candidateName} · inscrição ${candidate.registrationStatus}`;
                        return (
                          <option
                            key={`${candidate.teamId}:${candidate.registrationId ?? "new"}`}
                            value={value}
                            disabled={unavailable}
                          >
                            {label}
                          </option>
                        );
                      })}
                      {candidates.length === 0 ? (
                        <option value="new">
                          Criar equipe “{team.name}” ({team.abbreviation}) e confirmar inscrição
                        </option>
                      ) : null}
                    </select>
                  )}
                  <input
                    type="hidden"
                    name={`registration-${index}`}
                    value={teamRegistrations[index] || ""}
                  />
                  <InlineFieldError
                    message={
                      attempted && !teamRegistrations[index] && !teamResolutionChoices[index]
                        ? "Escolha como resolver esta equipe."
                        : null
                    }
                  />
                </label>
              );
            })}
          </div>
          {missingTeams > 0 ? (
            <div className="wizard-actions">
              <button
                className="button button-primary"
                type="submit"
                formAction={reviewAction("resolve-teams")}
                formNoValidate
                disabled={unresolvedTeamChoices > 0 || navigation.state !== "idle"}
              >
                {navigation.state !== "idle" ? "Resolvendo equipes…" : "Resolver equipes"}
              </button>
            </div>
          ) : (
            <output className="admin-note">As duas equipes possuem inscrição confirmada.</output>
          )}

          {missingTeams === 0 ? (
            <div className="admin-note">
              {hasEligibleGame ? (
                <label>
                  Destino do boxscore
                  <select
                    value={targetMode}
                    onChange={(event) => {
                      setTargetMode(event.currentTarget.value as "create" | "existing");
                      change();
                    }}
                  >
                    <option value="existing">Usar jogo existente</option>
                    <option value="create">Criar jogo na confirmação</option>
                  </select>
                </label>
              ) : (
                <p>
                  Ainda não existe um jogo entre estas equipes. Ele será criado somente quando a
                  importação for confirmada.
                </p>
              )}
              {targetMode === "existing" && hasEligibleGame ? (
                <>
                  <label>
                    Jogo da edição
                    <select
                      value={gameId}
                      required
                      onChange={(event) => {
                        setGameId(Number(event.currentTarget.value));
                        change();
                      }}
                    >
                      {eligibleGames.map((game) => (
                        <option key={game.id} value={game.id}>
                          {game.gameNumber ? `Jogo ${game.gameNumber}` : `Jogo #${game.id}`} ·{" "}
                          {game.homeTeamName} × {game.awayTeamName}
                          {game.scheduledAt ? ` · ${game.scheduledAt}` : ""}
                          {game.venue ? ` · ${game.venue}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="confirmation-check">
                    <input
                      type="checkbox"
                      name="applyReviewedMetadata"
                      value="yes"
                      checked={applyReviewedMetadata}
                      onChange={(event) => {
                        setApplyReviewedMetadata(event.currentTarget.checked);
                        change();
                      }}
                    />
                    Substituir data, horário e local do jogo pelos valores revisados abaixo.
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Equipe mandante
                    <select
                      value={manualHomeRegistrationId}
                      required
                      onChange={(event) => {
                        setManualHomeRegistrationId(Number(event.currentTarget.value));
                        change();
                      }}
                    >
                      {resolvedRegistrationIds.map((registrationId) => {
                        const registration = registrations.find(
                          (candidate) => candidate.id === registrationId,
                        );
                        return registration ? (
                          <option key={registration.id} value={registration.id}>
                            {registration.teamName}
                          </option>
                        ) : null;
                      })}
                    </select>
                  </label>
                  <p>
                    Visitante:{" "}
                    <strong>{manualAwayRegistration?.teamName ?? "Equipe a definir"}</strong>
                  </p>
                </>
              )}
              <div className="schedule-grid">
                <label>
                  Data
                  <input
                    type="date"
                    name="scheduledDate"
                    value={scheduledDate}
                    required
                    onChange={(event) => {
                      setScheduledDate(event.currentTarget.value);
                      change();
                    }}
                  />
                </label>
                <label>
                  Horário
                  <input
                    type="time"
                    name="scheduledTime"
                    value={scheduledTime}
                    required
                    onChange={(event) => {
                      setScheduledTime(event.currentTarget.value);
                      change();
                    }}
                  />
                </label>
                <label>
                  Local
                  <input
                    name="venue"
                    value={venue}
                    maxLength={160}
                    required
                    onChange={(event) => {
                      setVenue(event.currentTarget.value);
                      change();
                    }}
                  />
                </label>
              </div>
            </div>
          ) : (
            <p className="admin-note">
              Resolva as duas equipes antes de escolher o jogo da edição.
            </p>
          )}
          <div className="wizard-actions">
            <button
              className="button button-primary"
              type="button"
              disabled={!targetReady}
              onClick={() => {
                setStep(3);
                change();
              }}
            >
              Revisar associações
            </button>
          </div>
        </section>

        <section hidden={step !== 3}>
          <h2>Associar atletas</h2>
          <p>{pending} associação(ões) pendente(s). Correspondências sugeridas exigem revisão.</p>
          <div className="boxscore-association-list">
            {players.map(({ team, player }, index) => {
              const match = matches.get(`${team.name}\u0000${player.name}`);
              const selectedTeam = registrations.find(
                (registration) =>
                  registration.id === teamRegistrations[review.parsed.teams.indexOf(team)],
              );
              const suggestions = Array.isArray(match?.suggestion_payload)
                ? (match.suggestion_payload as Array<{
                    playerName?: string;
                    score?: number;
                    teamName?: string | null;
                  }>)
                : [];
              const value = resolutions[index] ?? "";
              const selectedPlayerId = value.startsWith("player:") ? Number(value.slice(7)) : null;
              return (
                <article key={`${team.name}-${player.jerseyNumber}-${player.name}`}>
                  <header>
                    <span>
                      <strong>
                        #{player.jerseyNumber} · {player.name}
                      </strong>
                      <small>
                        {team.name}
                        {player.didNotPlay ? " · NJ" : ""}
                      </small>
                    </span>
                    <span className={`match-pill match-${match?.suggestion_kind ?? "unmatched"}`}>
                      {match?.suggestion_kind === "exact"
                        ? "Exata"
                        : match?.suggestion_kind === "similar"
                          ? "Sugerida"
                          : "Pendente"}
                    </span>
                  </header>
                  <input type="hidden" name={`playerTeam-${index}`} value={team.name} />
                  <input type="hidden" name={`playerName-${index}`} value={player.name} />
                  <label>
                    Associação
                    <select
                      name={`playerResolution-${index}`}
                      value={value}
                      required
                      aria-invalid={(attempted && !value) || undefined}
                      onChange={(event) => {
                        const nextResolution = event.currentTarget.value;
                        setResolutions((current) => ({
                          ...current,
                          [index]: nextResolution,
                        }));
                        if (nextResolution !== "new") {
                          setNewPlayerEligibility((current) => {
                            const next = { ...current };
                            delete next[index];
                            return next;
                          });
                        }
                        change();
                      }}
                    >
                      <option value="" disabled>
                        Selecione o atleta
                      </option>
                      {registrations.flatMap((registration) =>
                        registration.roster.map((candidate) => (
                          <option
                            key={candidate.rosterEntryId}
                            value={`roster:${candidate.rosterEntryId}`}
                          >
                            {registration.teamName} · {candidate.playerName} · #
                            {candidate.jerseyNumber ?? "—"}
                          </option>
                        )),
                      )}
                      {selectedPlayerId ? (
                        <option value={value}>
                          Adicionar cadastro #{selectedPlayerId} ao elenco
                        </option>
                      ) : null}
                      <option value="new">
                        Criar automaticamente pelo nome extraído após revisão
                      </option>
                    </select>
                    <InlineFieldError
                      message={attempted && !value ? "Revise esta associação." : null}
                    />
                  </label>
                  {value === "new" ? (
                    <label>
                      Sexo para elegibilidade
                      <select
                        name={`playerEligibilitySex-${index}`}
                        value={newPlayerEligibility[index] ?? ""}
                        required
                        aria-invalid={(attempted && !newPlayerEligibility[index]) || undefined}
                        onChange={(event) => {
                          const nextValue = event.currentTarget.value;
                          if (nextValue !== "female" && nextValue !== "male") return;
                          setNewPlayerEligibility((current) => ({
                            ...current,
                            [index]: nextValue,
                          }));
                        }}
                      >
                        <option value="" disabled>
                          Selecione sem inferir
                        </option>
                        <option value="female">Feminino</option>
                        <option value="male">Masculino</option>
                      </select>
                      <small>
                        Naipe da edição: {editionGenderLabel}. Esta escolha privada não é salva no
                        rascunho.
                      </small>
                      <InlineFieldError
                        message={
                          attempted && !newPlayerEligibility[index]
                            ? "Selecione explicitamente para criar o atleta."
                            : null
                        }
                      />
                    </label>
                  ) : null}
                  {suggestions.length ? (
                    <p className="match-suggestions">
                      Sugestões:{" "}
                      {suggestions
                        .map(
                          (item) =>
                            `${item.playerName ?? "Atleta"} (${Math.round((item.score ?? 0) * 100)}%)`,
                        )
                        .join("; ")}
                    </p>
                  ) : null}
                  <details>
                    <summary>Pesquisar outro atleta</summary>
                    <AdminPlayerSearch
                      competitionId={competitionId}
                      competitionGender={competitionGender}
                      registrationId={selectedTeam?.id}
                      csrfToken={csrfToken}
                      selectedIds={selectedPlayerId ? new Set([selectedPlayerId]) : undefined}
                      onSelect={(candidate: AdminPlayerSearchResult) => {
                        setResolutions((current) => ({
                          ...current,
                          [index]: `player:${candidate.id}`,
                        }));
                        change();
                      }}
                    />
                  </details>
                </article>
              );
            })}
          </div>
          <div className="wizard-actions">
            <button className="button button-ghost" type="button" onClick={() => setStep(2)}>
              Voltar
            </button>
            <button
              className="button button-primary"
              type="button"
              disabled={pending > 0}
              onClick={() => {
                setStep(4);
                change();
              }}
            >
              Revisar confirmação
            </button>
          </div>
        </section>

        <section hidden={step !== 4} className="boxscore-confirmation">
          <h2>Confirmar importação</h2>
          <p>
            Serão confirmadas 2 equipes e {players.length} associações. O commit permanece atômico e
            o PDF continua privado.
          </p>
          <label className="confirmation-check">
            <input type="checkbox" name="confirmImport" value="yes" required />
            Confirmo que revisei as equipes, atletas e correspondências sugeridas.
          </label>
          <div className="wizard-actions">
            <button className="button button-ghost" type="button" onClick={() => setStep(3)}>
              Voltar
            </button>
            <button
              className="button button-primary"
              type="submit"
              disabled={navigation.state !== "idle" || pending > 0}
            >
              {navigation.state !== "idle" ? "Confirmando…" : "Confirmar importação atômica"}
            </button>
          </div>
        </section>

        <StickyActionSummary
          title={`Importação #${review.id}`}
          metrics={[
            { label: "Atletas", value: players.length },
            { label: "Pendências", value: pending + missingTeams },
          ]}
          status={
            hasTransientPrivateSelection
              ? "Seleção privada não salva"
              : pendingDraft
                ? "Salvando rascunho…"
                : savedAt
                  ? "Rascunho salvo"
                  : "Revisão em andamento"
          }
        >
          {step < 4 ? (
            <button
              className="button button-primary"
              type="button"
              disabled={(step === 2 && !targetReady) || (step === 3 && pending > 0)}
              onClick={() => {
                setStep(Math.min(4, step + 1));
                change();
              }}
            >
              Próxima etapa
            </button>
          ) : null}
        </StickyActionSummary>
      </Form>
    </section>
  );
}
