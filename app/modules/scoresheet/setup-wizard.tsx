import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";

import { AdminDraftNotice } from "../../components/admin/admin-draft-notice";
import { AdminWizardSteps } from "../../components/admin/admin-wizard-steps";
import { UnsavedChangesGuard } from "../../components/admin/unsaved-changes-guard";
import { readAdminDraft, removeAdminDraft, saveAdminDraft } from "../admin-drafts/client";
import type { AdminDraft } from "../admin-drafts/schema";
import { MANUAL_SCORESHEET_SETUP_DRAFT_EDITOR_VERSION } from "../admin-drafts/schema";
import {
  evaluateDisqualification,
  normalizeGameJersey,
  OFFICIAL_ROLES,
  playerFoulsForDisqualification,
  type TeamSide,
  validateTeamSlots,
} from "./domain";
import type { ScoresheetRegistration } from "./editor";
import { FastScoringPanel } from "./fast-scoring-panel";
import { buildSetupConfirmation } from "./setup-confirmation";
import {
  buildSetupRevision,
  revisionDiff,
  REVISION_REASON_ERROR,
  savedScoresheetScore,
  setupFromSavedScoresheet,
  type ScoresheetRevisionBase,
} from "./setup-revision";
import { periodLabel } from "./domain";
import { quickScoreThroughPeriod } from "./quick-periods";
import {
  createScoresheetSetup,
  editSetupCoach,
  linkSetupCaptainToCoach,
  restoreScoresheetSetup,
  type ScoresheetSetup,
  selectSetupCaptain,
  selectSetupPlayer,
  selectSetupTeam,
  updateSetupStat,
  validateSetupGame,
  validateSetupTeams,
} from "./setup-state";

const sides: TeamSide[] = ["home", "away"];
const steps = ["Jogo", "Equipes", "Lançamentos", "Revisão"] as const;
const FALLBACK_REASON_ERROR =
  "Informe um motivo com 10 a 500 caracteres para a súmula emergencial.";

interface ScoresheetSetupWizardProps {
  competitionId: number;
  competitionName: string;
  registrations: ScoresheetRegistration[];
  hasExistingGames: boolean;
  csrfToken?: string;
  requiresFallbackReason?: boolean;
  revision?: ScoresheetRevisionBase;
}

export function ManualScoresheetSetupWizard(props: ScoresheetSetupWizardProps) {
  return (
    <ScoresheetSetupWizardSession
      key={
        props.revision
          ? `${props.revision.gameId}:${props.revision.submissionId}`
          : props.competitionId
      }
      {...props}
    />
  );
}

function ScoresheetSetupWizardSession({
  competitionId,
  competitionName,
  registrations,
  hasExistingGames,
  csrfToken = "",
  requiresFallbackReason = false,
  revision,
}: ScoresheetSetupWizardProps) {
  const fetcher = useFetcher<{ error?: string; confirmedGameId?: number }>();
  const revisionGameId = revision?.gameId;
  const revisionSubmissionId = revision?.submissionId;
  const draftIdentity = useMemo(
    () => ({
      flow: "manual-scoresheet" as const,
      competitionId,
      entityId: revisionGameId,
      editorVersion:
        revisionSubmissionId !== undefined
          ? `v3-revision-${revisionSubmissionId}`
          : MANUAL_SCORESHEET_SETUP_DRAFT_EDITOR_VERSION,
    }),
    [competitionId, revisionGameId, revisionSubmissionId],
  );
  const [setup, setSetup] = useState<ScoresheetSetup>(() =>
    revision ? setupFromSavedScoresheet(revision.payload) : createScoresheetSetup(),
  );
  const [revisionConfirmed, setRevisionConfirmed] = useState(false);
  const [availableDraft, setAvailableDraft] = useState<AdminDraft<ScoresheetSetup> | null>(null);
  const [draftDecision, setDraftDecision] = useState<"checking" | "pending" | "resolved">(
    "checking",
  );
  const [changed, setChanged] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const pendingSaveRef = useRef<{
    identity: typeof draftIdentity;
    setup: ScoresheetSetup;
  } | null>(null);
  const draftBlocked = draftDecision !== "resolved";
  const confirmedGameId = fetcher.data?.confirmedGameId;

  useEffect(() => {
    if (!confirmedGameId) return;
    pendingSaveRef.current = null;
    removeAdminDraft(draftIdentity);
    setErrors([]);
    setChanged(false);
    setSavedAt(null);
    window.requestAnimationFrame(() => headingRef.current?.focus());
  }, [confirmedGameId, draftIdentity]);

  useEffect(() => {
    if (fetcher.data?.error) {
      setErrors([fetcher.data.error]);
    }
  }, [fetcher.data]);
  useEffect(() => {
    if (errors.length) errorRef.current?.focus();
  }, [errors]);

  useEffect(() => {
    const result = readAdminDraft<ScoresheetSetup>(draftIdentity);
    setAvailableDraft(result.status === "available" ? result.draft : null);
    setDraftDecision(result.status === "available" ? "pending" : "resolved");
  }, [draftIdentity]);

  useEffect(() => {
    if (!changed || draftBlocked) return;
    const timer = window.setTimeout(() => {
      setSavedAt(saveAdminDraft(draftIdentity, setup));
      pendingSaveRef.current = null;
      setChanged(false);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [changed, draftBlocked, draftIdentity, setup]);

  // Keep the latest committed draft available for cleanup during internal router navigation.
  useEffect(() => {
    pendingSaveRef.current = changed && !draftBlocked ? { identity: draftIdentity, setup } : null;
  }, [changed, draftBlocked, draftIdentity, setup]);

  useEffect(
    () => () => {
      const pending = pendingSaveRef.current;
      if (pending) saveAdminDraft(pending.identity, pending.setup);
    },
    [],
  );

  const update = (change: (current: ScoresheetSetup) => ScoresheetSetup) => {
    if (draftBlocked || confirmedGameId || fetcher.state !== "idle") return;
    setSetup((current) => ({
      ...change(current),
      submissionKey: crypto.randomUUID(),
    }));
    setChanged(true);
    setRevisionConfirmed(false);
    setErrors([]);
    setFeedback(null);
  };

  const restoreDraft = () => {
    if (!availableDraft) return;
    const restored = restoreScoresheetSetup(availableDraft.data, registrations);
    if (!restored) {
      setFeedback(
        "Rascunho incompatível com os elencos ou lançamentos atuais. O rascunho foi preservado; nenhuma informação foi descartada.",
      );
      return;
    } else {
      setSetup(restored);
      setRevisionConfirmed(false);
      setSavedAt(availableDraft.savedAt);
      setFeedback("Configuração restaurada deste navegador.");
    }
    setAvailableDraft(null);
    setDraftDecision("resolved");
    setChanged(false);
    setErrors([]);
    window.requestAnimationFrame(() => headingRef.current?.focus());
  };

  const discardDraft = () => {
    removeAdminDraft(draftIdentity);
    setAvailableDraft(null);
    setDraftDecision("resolved");
    setChanged(false);
    setSavedAt(null);
    setFeedback("Rascunho anterior descartado.");
    window.requestAnimationFrame(() => headingRef.current?.focus());
  };

  const focusValidationErrors = (issues: string[]) => {
    setErrors(issues);
  };

  const goToStep = (next: 1 | 2 | 3 | 4) => {
    if (draftBlocked) return;
    const issues =
      next === 1
        ? []
        : [
            ...validateSetupGame(setup, registrations),
            ...(next >= 3 ? validateSetupTeams(setup, registrations) : []),
            ...(next === 4 ? buildSetupConfirmation(setup, competitionId).issues : []),
          ];
    if (issues.length) {
      focusValidationErrors(issues);
      return;
    }
    update((current) => ({ ...current, step: next }));
    if (next === 3)
      setFeedback(
        "Configuração válida. Lance os pontos abaixo; o rascunho permanece neste navegador.",
      );
    window.requestAnimationFrame(() => headingRef.current?.focus());
  };

  const confirm = () => {
    if (draftBlocked || confirmedGameId || fetcher.state !== "idle") return;
    const issues = [
      ...validateSetupGame(setup, registrations),
      ...validateSetupTeams(setup, registrations),
      ...buildSetupConfirmation(setup, competitionId).issues,
      ...(requiresFallbackReason &&
      (setup.fallbackReason.trim().length < 10 || setup.fallbackReason.trim().length > 500)
        ? [FALLBACK_REASON_ERROR]
        : []),
    ];
    if (revision) {
      issues.push(...buildSetupRevision(setup, revision).issues);
      if (setup.revisionReason.trim().length < 10 || setup.revisionReason.trim().length > 500)
        issues.push(REVISION_REASON_ERROR);
      if (!revisionDiff(setup, revision).length)
        issues.push("Altere ao menos um dado antes de gravar uma revisão.");
      if (!revisionConfirmed) issues.push("Confirme que revisou as alterações antes de gravar.");
    }
    if (issues.length) return focusValidationErrors(issues);
    const form = new FormData();
    form.set("intent", revision ? "revise-manual-v2" : "confirm-manual-v2");
    form.set("csrfToken", csrfToken);
    form.set("setup", JSON.stringify(setup));
    if (revision) {
      form.set("baseSubmissionId", String(revision.submissionId));
      form.set("basePayloadHash", revision.payloadHash);
      form.set("revisionConfirmed", String(revisionConfirmed));
    }
    fetcher.submit(form, { method: "post" });
  };

  const teamSelectionError = errors.includes("Selecione duas equipes inscritas e diferentes.");
  const dateError = errors.includes("Informe uma data de jogo válida.");
  const timeError = errors.includes("Informe um horário válido ou deixe vazio.");
  const fallbackReasonError = errors.includes(FALLBACK_REASON_ERROR);
  const revisedPayload = revision ? buildSetupRevision(setup, revision).payload : null;
  const changes = revision ? revisionDiff(setup, revision) : [];

  return (
    <main className="admin-shell scoresheet-shell">
      <header className="site-header admin-header">
        <div className="brand">
          <span className="brand-mark">B</span>
          <span>Súmula manual v2</span>
        </div>
        <span className="environment-pill">Rascunho local</span>
      </header>
      <section className="admin-welcome">
        <p className="eyebrow">{competitionName}</p>
        <h1>
          {revision ? `Revisar súmula do jogo #${revision.gameId}` : "Configurar jogo e equipes"}
        </h1>
        <p>
          {revision
            ? `Editando a versão ${revision.version}. Mandante e visitante permanecem fixos. Uma nova versão será gravada após a confirmação.`
            : "Preencha a configuração da partida. Até a confirmação final, os dados ficam somente neste navegador."}
        </p>
        {hasExistingGames ? (
          <p>
            <Link to="?modo=existente">Abrir o editor de um jogo já criado</Link>
          </p>
        ) : null}
        <AdminWizardSteps
          current={setup.step}
          labels={steps}
          onSelect={(value) => {
            if (value === 1 || value === 2 || value === 3 || value === 4) goToStep(value);
          }}
        />
        <UnsavedChangesGuard active={changed && !confirmedGameId} />
        {availableDraft ? (
          <AdminDraftNotice
            savedAt={availableDraft.savedAt}
            onRestore={restoreDraft}
            onDiscard={discardDraft}
          />
        ) : null}
        {errors.length ? (
          <div id="setup-errors" role="alert" className="form-error" ref={errorRef} tabIndex={-1}>
            <strong>Revise a configuração:</strong>
            <ul>
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {feedback ? (
          <p className="admin-note" role="status">
            {feedback}
          </p>
        ) : null}
        {savedAt ? (
          <p className="admin-note" role="status">
            Rascunho salvo neste navegador.
          </p>
        ) : null}

        {draftBlocked ? (
          <p className="admin-note" role="status">
            {draftDecision === "checking"
              ? "Verificando rascunho salvo…"
              : "Restaure ou descarte o rascunho anterior para editar a configuração."}
          </p>
        ) : null}

        <div className="scoresheet-form" inert={draftBlocked}>
          <section
            className="scoresheet-step"
            hidden={setup.step !== 1}
            aria-labelledby="scoresheet-setup-game-heading"
          >
            <h2
              className="scoresheet-step-heading"
              id="scoresheet-setup-game-heading"
              ref={setup.step === 1 ? headingRef : undefined}
              tabIndex={-1}
            >
              Jogo
            </h2>
            <fieldset className="scoresheet-header-grid">
              <legend>Dados da partida</legend>
              {sides.map((side) => (
                <label key={side}>
                  {side === "home" ? "Mandante" : "Visitante"}
                  <select
                    value={setup.registrationIds[side]}
                    disabled={Boolean(revision)}
                    aria-invalid={teamSelectionError || undefined}
                    aria-describedby={teamSelectionError ? "setup-game-teams-error" : undefined}
                    onChange={(event) => {
                      const selected = registrations.find(
                        (team) => team.id === Number(event.target.value),
                      );
                      if (selected) update((current) => selectSetupTeam(current, side, selected));
                    }}
                  >
                    <option value={0}>Selecione uma equipe</option>
                    {registrations.map((team) => (
                      <option
                        key={team.id}
                        value={team.id}
                        disabled={
                          team.id === setup.registrationIds[side === "home" ? "away" : "home"]
                        }
                      >
                        {team.teamName}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              {teamSelectionError ? (
                <p id="setup-game-teams-error" className="form-error">
                  Selecione duas equipes inscritas e diferentes.
                </p>
              ) : null}
              <label>
                Data do jogo (obrigatória)
                <input
                  type="date"
                  required
                  value={setup.game.date}
                  aria-invalid={dateError || undefined}
                  aria-describedby={dateError ? "setup-game-date-error" : undefined}
                  onChange={(event) =>
                    update((current) => ({
                      ...current,
                      game: { ...current.game, date: event.target.value },
                    }))
                  }
                />
                {dateError ? (
                  <span id="setup-game-date-error">Informe uma data de jogo válida.</span>
                ) : null}
              </label>
              <label>
                Horário (opcional)
                <input
                  type="time"
                  aria-invalid={timeError || undefined}
                  aria-describedby={timeError ? "setup-game-time-error" : undefined}
                  value={setup.game.time ?? ""}
                  onChange={(event) =>
                    update((current) => ({
                      ...current,
                      game: { ...current.game, time: event.target.value },
                    }))
                  }
                />
                {timeError ? (
                  <span id="setup-game-time-error">Informe um horário válido ou deixe vazio.</span>
                ) : null}
              </label>
              <label>
                Local (opcional)
                <input
                  maxLength={160}
                  value={setup.game.venue ?? ""}
                  onChange={(event) =>
                    update((current) => ({
                      ...current,
                      game: { ...current.game, venue: event.target.value },
                    }))
                  }
                />
              </label>
              <label>
                Número do jogo (opcional)
                <input
                  maxLength={40}
                  value={setup.game.gameNumber ?? ""}
                  onChange={(event) =>
                    update((current) => ({
                      ...current,
                      game: { ...current.game, gameNumber: event.target.value },
                    }))
                  }
                />
              </label>
              <label>
                Fase ou rodada (opcional)
                <input
                  maxLength={160}
                  value={setup.game.phaseRound ?? ""}
                  onChange={(event) =>
                    update((current) => ({
                      ...current,
                      game: { ...current.game, phaseRound: event.target.value },
                    }))
                  }
                />
              </label>
              <label>
                Observações (opcional)
                <textarea
                  maxLength={2000}
                  value={setup.game.notes ?? ""}
                  onChange={(event) =>
                    update((current) => ({
                      ...current,
                      game: { ...current.game, notes: event.target.value },
                    }))
                  }
                />
              </label>
            </fieldset>
            <div className="wizard-actions">
              <button className="button button-primary" type="button" onClick={() => goToStep(2)}>
                Continuar para equipes
              </button>
            </div>
          </section>

          <section
            className="scoresheet-step"
            hidden={setup.step !== 2}
            aria-labelledby="scoresheet-setup-teams-heading"
          >
            <h2
              className="scoresheet-step-heading"
              id="scoresheet-setup-teams-heading"
              ref={setup.step === 2 ? headingRef : undefined}
              tabIndex={-1}
            >
              Equipes
            </h2>
            <p>Relacione até 12 atletas previamente inscritos por equipe e escolha um capitão.</p>
            <div className="participant-grid">
              {sides.map((side) => {
                const team = registrations.find(
                  (registration) => registration.id === setup.registrationIds[side],
                );
                const selected = new Set(
                  setup.slots[side].map((slot) => slot.rosterEntryId).filter((id) => id !== null),
                );
                const label = side === "home" ? "Mandante" : "Visitante";
                const sideErrors = errors.filter((message) => message.startsWith(label + ":"));
                const sideErrorId = "setup-" + side + "-lineup-error";
                const activeSlots = setup.slots[side].filter((slot) => slot.rosterEntryId !== null);
                const slotIssues = sideErrors.length ? validateTeamSlots(setup.slots[side]) : [];
                const invalidPlayerSlots = new Set<number>();
                const invalidJerseySlots = new Set<number>();
                const invalidCaptainSlots = new Set<number>();
                if (slotIssues.includes("roster_size") && activeSlots.length === 0)
                  invalidPlayerSlots.add(1);
                for (const slot of activeSlots) {
                  const rosterId = slot.rosterEntryId;
                  if (
                    (team && !team.roster.some((player) => player.rosterEntryId === rosterId)) ||
                    (slotIssues.includes("duplicate_player") &&
                      activeSlots.filter((item) => item.rosterEntryId === rosterId).length > 1)
                  )
                    invalidPlayerSlots.add(slot.slotNumber);
                  const jersey = normalizeGameJersey(slot.jerseyNumber);
                  if (
                    jersey === null ||
                    (slotIssues.includes("duplicate_jersey") &&
                      activeSlots.filter(
                        (item) => normalizeGameJersey(item.jerseyNumber) === jersey,
                      ).length > 1)
                  )
                    invalidJerseySlots.add(slot.slotNumber);
                  if (slotIssues.includes("captain_required"))
                    invalidCaptainSlots.add(slot.slotNumber);
                }
                return (
                  <fieldset className="lineup-panel" key={side}>
                    <legend>
                      {label}: {team?.teamName}
                    </legend>
                    {sideErrors.length ? (
                      <p id={sideErrorId} className="form-error">
                        {sideErrors.join(" ")}
                      </p>
                    ) : null}
                    <div className="slot-grid">
                      {setup.slots[side].map((slot) => (
                        <div className="slot-row" key={`${side}-${slot.slotNumber}`}>
                          <span>#{slot.slotNumber}</span>
                          <label>
                            Atleta{" "}
                            <span className="sr-only">
                              {label}, slot {slot.slotNumber}
                            </span>
                            <select
                              aria-invalid={invalidPlayerSlots.has(slot.slotNumber) || undefined}
                              aria-describedby={
                                invalidPlayerSlots.has(slot.slotNumber) ? sideErrorId : undefined
                              }
                              value={slot.rosterEntryId ?? ""}
                              onChange={(event) => {
                                const id = event.target.value ? Number(event.target.value) : null;
                                update((current) =>
                                  selectSetupPlayer(
                                    current,
                                    side,
                                    slot.slotNumber,
                                    id,
                                    team?.roster ?? [],
                                  ),
                                );
                              }}
                            >
                              <option value="">N/A</option>
                              {team?.roster.map((candidate) => (
                                <option
                                  key={candidate.rosterEntryId}
                                  value={candidate.rosterEntryId}
                                  disabled={
                                    selected.has(candidate.rosterEntryId) &&
                                    slot.rosterEntryId !== candidate.rosterEntryId
                                  }
                                >
                                  {candidate.playerName}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Camisa{" "}
                            <span className="sr-only">
                              {label}, slot {slot.slotNumber}
                            </span>
                            <input
                              maxLength={2}
                              inputMode="numeric"
                              placeholder="00"
                              aria-invalid={invalidJerseySlots.has(slot.slotNumber) || undefined}
                              aria-describedby={
                                invalidJerseySlots.has(slot.slotNumber) ? sideErrorId : undefined
                              }
                              disabled={slot.rosterEntryId === null}
                              value={slot.jerseyNumber}
                              onChange={(event) =>
                                update((current) => ({
                                  ...current,
                                  slots: {
                                    ...current.slots,
                                    [side]: current.slots[side].map((item) =>
                                      item.slotNumber === slot.slotNumber
                                        ? {
                                            ...item,
                                            jerseyNumber: event.target.value,
                                          }
                                        : item,
                                    ),
                                  },
                                }))
                              }
                            />
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              disabled={slot.rosterEntryId === null}
                              checked={Boolean(slot.isStarter)}
                              onChange={(event) =>
                                update((current) => ({
                                  ...current,
                                  slots: {
                                    ...current.slots,
                                    [side]: current.slots[side].map((item) =>
                                      item.slotNumber === slot.slotNumber
                                        ? {
                                            ...item,
                                            isStarter: event.target.checked,
                                          }
                                        : item,
                                    ),
                                  },
                                }))
                              }
                            />{" "}
                            Titular
                            <span className="sr-only">
                              {" "}
                              — {label}, slot {slot.slotNumber}
                            </span>
                          </label>
                          <label>
                            <input
                              type="radio"
                              aria-invalid={invalidCaptainSlots.has(slot.slotNumber) || undefined}
                              aria-describedby={
                                invalidCaptainSlots.has(slot.slotNumber) ? sideErrorId : undefined
                              }
                              name={`${side}-captain`}
                              disabled={slot.rosterEntryId === null}
                              checked={Boolean(slot.isCaptain)}
                              onChange={() =>
                                update((current) =>
                                  selectSetupCaptain(
                                    current,
                                    side,
                                    slot.slotNumber,
                                    team?.roster ?? [],
                                  ),
                                )
                              }
                            />{" "}
                            Capitão
                            <span className="sr-only">
                              {" "}
                              — {label}, slot {slot.slotNumber}
                            </span>
                          </label>
                        </div>
                      ))}
                    </div>
                    <fieldset>
                      <legend>Comissão técnica</legend>
                      <label>
                        Técnico
                        <input
                          maxLength={160}
                          value={setup.staff[side].coach?.name ?? ""}
                          onChange={(event) =>
                            update((current) => editSetupCoach(current, side, event.target.value))
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="button button-ghost"
                        disabled={
                          !setup.slots[side].some(
                            (slot) => slot.isCaptain && slot.rosterEntryId !== null,
                          )
                        }
                        onClick={() =>
                          update((current) =>
                            linkSetupCaptainToCoach(current, side, team?.roster ?? []),
                          )
                        }
                      >
                        Usar capitão como técnico
                      </button>
                      {setup.staff[side].coach?.origin === "captain_placeholder" ? (
                        <p className="admin-note">
                          Vinculado ao capitão. Editar o nome desfaz o vínculo.
                        </p>
                      ) : null}
                      <label>
                        Primeiro assistente (opcional)
                        <input
                          maxLength={160}
                          value={setup.staff[side].assistant}
                          onChange={(event) =>
                            update((current) => ({
                              ...current,
                              staff: {
                                ...current.staff,
                                [side]: {
                                  ...current.staff[side],
                                  assistant: event.target.value,
                                },
                              },
                            }))
                          }
                        />
                      </label>
                    </fieldset>
                  </fieldset>
                );
              })}
            </div>
            <details>
              <summary>Oficiais da partida (opcional)</summary>
              <div className="scoresheet-header-grid">
                {OFFICIAL_ROLES.map((role) => (
                  <label key={role}>
                    {role}
                    <input
                      maxLength={160}
                      value={setup.officials[role]}
                      onChange={(event) =>
                        update((current) => ({
                          ...current,
                          officials: {
                            ...current.officials,
                            [role]: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            </details>
            <div className="wizard-actions">
              <button className="button button-ghost" type="button" onClick={() => goToStep(1)}>
                Voltar para jogo
              </button>
              <button className="button button-primary" type="button" onClick={() => goToStep(3)}>
                Continuar para lançamentos
              </button>
            </div>
          </section>
          {setup.step === 3 ? (
            <section className="scoresheet-step" aria-labelledby="scoresheet-scoring-heading">
              <h2
                className="scoresheet-step-heading"
                id="scoresheet-scoring-heading"
                ref={headingRef}
                tabIndex={-1}
              >
                Lançamentos
              </h2>
              <p>
                Transcreva pontos e faltas por camisa e período. Os lançamentos ficam no rascunho
                local.
              </p>
              <FastScoringPanel
                periodCount={setup.periodCount}
                completedPeriods={setup.completedPeriods}
                onPeriodCompletionChange={(period, completed) =>
                  update((current) => ({
                    ...current,
                    completedPeriods: completed
                      ? [...new Set([...current.completedPeriods, period])].sort((a, b) => a - b)
                      : current.completedPeriods.filter((item) => item < period),
                  }))
                }
                onPeriodCountChange={(periodCount) =>
                  update((current) => ({ ...current, periodCount }))
                }
                slots={setup.slots}
                registrations={registrations}
                registrationIds={setup.registrationIds}
                stats={setup.stats}
                fouls={setup.fouls}
                onFoulsChange={(fouls) => update((current) => ({ ...current, fouls }))}
                onChange={(key, value) => update((current) => updateSetupStat(current, key, value))}
              />
              <div className="wizard-actions">
                <button className="button button-ghost" type="button" onClick={() => goToStep(2)}>
                  Voltar para equipes
                </button>
                <button className="button button-primary" type="button" onClick={() => goToStep(4)}>
                  Revisar e confirmar
                </button>
              </div>
            </section>
          ) : null}
          {setup.step === 4 ? (
            <section className="scoresheet-step" aria-labelledby="scoresheet-review-heading">
              <h2 id="scoresheet-review-heading" ref={headingRef} tabIndex={-1}>
                Revisão final
              </h2>
              {confirmedGameId ? (
                <div role="status">
                  <p>
                    {revision
                      ? "Revisão gravada em uma nova versão."
                      : "Súmula confirmada e gravada."}{" "}
                    Jogo #{confirmedGameId}.
                  </p>
                  <Link to={`/admin/games/${confirmedGameId}/scoresheet`}>
                    Abrir súmula salva e histórico
                  </Link>
                  <Link
                    className="button button-primary"
                    to={`/admin/competitions/${competitionId}`}
                  >
                    Voltar à edição
                  </Link>
                </div>
              ) : (
                <>
                  <p>
                    {revision
                      ? "Confira as alterações antes de gravar uma nova versão da súmula."
                      : "Confira os dados antes de gravar a súmula e finalizar a partida."}
                  </p>
                  {revision ? (
                    <section aria-labelledby="revision-diff-heading">
                      <h3 id="revision-diff-heading">Alterações desta revisão</h3>
                      <p>
                        Placar anterior: {savedScoresheetScore(revision.payload)}. Placar revisado:{" "}
                        {revisedPayload
                          ? savedScoresheetScore(revisedPayload)
                          : "Revise os lançamentos"}
                        .
                      </p>
                      {changes.length ? (
                        <ul>
                          {changes.map((item) => (
                            <li key={item.path}>
                              <strong>{item.label}</strong>: {item.before} → {item.after}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>Nenhuma alteração.</p>
                      )}
                      <label>
                        Motivo da revisão (obrigatório)
                        <textarea
                          value={setup.revisionReason}
                          minLength={10}
                          maxLength={500}
                          aria-invalid={errors.includes(REVISION_REASON_ERROR) || undefined}
                          aria-describedby={
                            errors.includes(REVISION_REASON_ERROR)
                              ? "revision-reason-error"
                              : undefined
                          }
                          onChange={(event) =>
                            update((current) => ({
                              ...current,
                              revisionReason: event.target.value,
                            }))
                          }
                        />
                        {errors.includes(REVISION_REASON_ERROR) ? (
                          <span id="revision-reason-error">{REVISION_REASON_ERROR}</span>
                        ) : null}
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={revisionConfirmed}
                          onChange={(event) => setRevisionConfirmed(event.target.checked)}
                        />{" "}
                        Revisei as alterações e confirmo a gravação de uma nova versão.
                      </label>
                    </section>
                  ) : null}
                  <dl>
                    <dt>Data e horário</dt>
                    <dd>
                      {setup.game.date} {setup.game.time || "Horário não informado"}
                    </dd>
                    <dt>Local</dt>
                    <dd>{setup.game.venue || "Não informado"}</dd>
                    <dt>Número do jogo</dt>
                    <dd>{setup.game.gameNumber || "Não informado"}</dd>
                    <dt>Fase/rodada</dt>
                    <dd>{setup.game.phaseRound || "Não informada"}</dd>
                    <dt>Observações</dt>
                    <dd>{setup.game.notes || "Nenhuma"}</dd>
                  </dl>
                  <h3>Placar e parciais</h3>
                  {/* biome-ignore lint/a11y/noNoninteractiveTabindex: overflow regions must be keyboard-focusable */}
                  <section className="scoresheet-review-table" aria-label="Parciais" tabIndex={0}>
                    <table>
                      <caption>Parciais por período e placar acumulado</caption>
                      <thead>
                        <tr>
                          <th scope="col">Período</th>
                          <th scope="col">Mandante</th>
                          <th scope="col">Visitante</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: setup.periodCount }, (_, index) => index + 1).map(
                          (period) => {
                            const score = quickScoreThroughPeriod(setup.stats, period);
                            const previous = quickScoreThroughPeriod(setup.stats, period - 1);
                            return (
                              <tr key={period}>
                                <th scope="row">{periodLabel(period)}</th>
                                <td>
                                  {(score?.home ?? 0) - (previous?.home ?? 0)} (total{" "}
                                  {score?.home ?? "—"})
                                </td>
                                <td>
                                  {(score?.away ?? 0) - (previous?.away ?? 0)} (total{" "}
                                  {score?.away ?? "—"})
                                </td>
                              </tr>
                            );
                          },
                        )}
                      </tbody>
                    </table>
                  </section>
                  {sides.map((side) => {
                    const registration = registrations.find(
                      (item) => item.id === setup.registrationIds[side],
                    );
                    const active = setup.slots[side].filter((slot) => slot.rosterEntryId !== null);
                    return (
                      <section key={side}>
                        <h3>
                          {side === "home" ? "Mandante" : "Visitante"}: {registration?.teamName}
                        </h3>
                        <p>
                          Elenco:{" "}
                          {active
                            .map(
                              (slot) =>
                                `#${slot.jerseyNumber} ${registration?.roster.find((player) => player.rosterEntryId === slot.rosterEntryId)?.playerName ?? "Atleta"}${slot.isCaptain ? " (capitão)" : ""}${slot.isStarter ? " (titular)" : ""}`,
                            )
                            .join("; ")}
                        </p>
                        <p>
                          Técnico: {setup.staff[side].coach?.name || "—"}. Assistente:{" "}
                          {setup.staff[side].assistant || "—"}.
                        </p>
                        <p>
                          Faltas rápidas:{" "}
                          {
                            setup.fouls.filter(
                              (foul) => foul.target.registrationId === setup.registrationIds[side],
                            ).length
                          }
                          . Faltas da grade:{" "}
                          {active.reduce(
                            (sum, slot) =>
                              sum +
                              [1, 2, 3, 4].reduce(
                                (total, period) =>
                                  total +
                                  (setup.stats[`${side}-${slot.slotNumber}-${period}-fouls`]
                                    ?.split(",")
                                    .filter(Boolean).length ?? 0),
                                0,
                              ),
                            0,
                          )}
                          .
                        </p>
                        <p>
                          Desqualificações (GD):{" "}
                          {active
                            .flatMap((slot) => {
                              const recorded = playerFoulsForDisqualification(
                                setup.stats,
                                setup.fouls,
                                side,
                                slot,
                                setup.registrationIds[side],
                              );
                              const gd = recorded ? evaluateDisqualification(recorded) : null;
                              return gd
                                ? [
                                    `#${slot.jerseyNumber} (${gd.reason}, ${periodLabel(gd.periodNumber)})`,
                                  ]
                                : [];
                            })
                            .join("; ") || "Nenhuma"}
                          .
                        </p>
                      </section>
                    );
                  })}
                  <h3>Oficiais</h3>
                  <p>
                    {Object.entries(setup.officials)
                      .filter(([, name]) => name.trim())
                      .map(([role, name]) => `${role}: ${name}`)
                      .join("; ") || "Não informados"}
                  </p>
                  {requiresFallbackReason ? (
                    <label>
                      Motivo da súmula emergencial (obrigatório)
                      <textarea
                        value={setup.fallbackReason}
                        minLength={10}
                        maxLength={500}
                        aria-invalid={fallbackReasonError || undefined}
                        aria-describedby={
                          fallbackReasonError ? "setup-fallback-reason-error" : undefined
                        }
                        onChange={(event) =>
                          update((current) => ({
                            ...current,
                            fallbackReason: event.target.value,
                          }))
                        }
                      />
                      {fallbackReasonError ? (
                        <span id="setup-fallback-reason-error">{FALLBACK_REASON_ERROR}</span>
                      ) : null}
                    </label>
                  ) : null}
                  <div className="wizard-actions">
                    <button
                      className="button button-ghost"
                      type="button"
                      onClick={() => goToStep(3)}
                    >
                      Voltar para lançamentos
                    </button>
                    <button
                      className="button button-primary"
                      type="button"
                      onClick={confirm}
                      disabled={fetcher.state !== "idle"}
                    >
                      {fetcher.state === "idle"
                        ? revision
                          ? "Confirmar e gravar revisão"
                          : "Confirmar e gravar súmula"
                        : "Gravando súmula…"}
                    </button>
                  </div>
                </>
              )}
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}
