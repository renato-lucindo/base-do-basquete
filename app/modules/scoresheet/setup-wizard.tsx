import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

import { AdminDraftNotice } from "../../components/admin/admin-draft-notice";
import { AdminWizardSteps } from "../../components/admin/admin-wizard-steps";
import { UnsavedChangesGuard } from "../../components/admin/unsaved-changes-guard";
import { readAdminDraft, removeAdminDraft, saveAdminDraft } from "../admin-drafts/client";
import type { AdminDraft } from "../admin-drafts/schema";
import { MANUAL_SCORESHEET_SETUP_DRAFT_EDITOR_VERSION } from "../admin-drafts/schema";
import { OFFICIAL_ROLES, type TeamSide } from "./domain";
import type { ScoresheetRegistration } from "./editor";
import {
  createScoresheetSetup,
  editSetupCoach,
  linkSetupCaptainToCoach,
  restoreScoresheetSetup,
  type ScoresheetSetup,
  selectSetupCaptain,
  selectSetupPlayer,
  selectSetupTeam,
  validateSetupGame,
  validateSetupTeams,
} from "./setup-state";

const sides: TeamSide[] = ["home", "away"];
const steps = ["Jogo", "Equipes", "Lançamentos", "Revisão"] as const;

export function ManualScoresheetSetupWizard({
  competitionId,
  competitionName,
  registrations,
  hasExistingGames,
}: {
  competitionId: number;
  competitionName: string;
  registrations: ScoresheetRegistration[];
  hasExistingGames: boolean;
}) {
  const draftIdentity = useMemo(
    () => ({
      flow: "manual-scoresheet" as const,
      competitionId,
      editorVersion: MANUAL_SCORESHEET_SETUP_DRAFT_EDITOR_VERSION,
    }),
    [competitionId],
  );
  const [setup, setSetup] = useState<ScoresheetSetup>(createScoresheetSetup);
  const [availableDraft, setAvailableDraft] = useState<AdminDraft<ScoresheetSetup> | null>(null);
  const [changed, setChanged] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const result = readAdminDraft<ScoresheetSetup>(draftIdentity);
    if (result.status === "available") setAvailableDraft(result.draft);
  }, [draftIdentity]);

  useEffect(() => {
    if (!changed) return;
    const timer = window.setTimeout(() => {
      setSavedAt(saveAdminDraft(draftIdentity, setup));
      setChanged(false);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [changed, draftIdentity, setup]);

  const update = (change: (current: ScoresheetSetup) => ScoresheetSetup) => {
    setSetup(change);
    setChanged(true);
    setErrors([]);
    setFeedback(null);
  };

  const restoreDraft = () => {
    if (!availableDraft) return;
    const restored = restoreScoresheetSetup(availableDraft.data, registrations);
    if (!restored) {
      setFeedback("Rascunho incompatível com os elencos atuais. Revise a configuração novamente.");
      removeAdminDraft(draftIdentity);
    } else {
      setSetup(restored);
      setSavedAt(availableDraft.savedAt);
      setFeedback("Configuração restaurada deste navegador.");
    }
    setAvailableDraft(null);
  };

  const discardDraft = () => {
    removeAdminDraft(draftIdentity);
    setAvailableDraft(null);
    setSavedAt(null);
    setFeedback("Rascunho anterior descartado.");
  };

  const goToStep = (next: 1 | 2) => {
    if (next === 2) {
      const issues = validateSetupGame(setup, registrations);
      if (issues.length) {
        setErrors(issues);
        return;
      }
    }
    update((current) => ({ ...current, step: next }));
    window.requestAnimationFrame(() => headingRef.current?.focus());
  };

  const verifySetup = () => {
    const issues = [
      ...validateSetupGame(setup, registrations),
      ...validateSetupTeams(setup, registrations),
    ];
    setErrors(issues);
    setFeedback(
      issues.length === 0
        ? "Configuração válida e salva neste navegador. O lançamento rápido será habilitado na Etapa 6."
        : null,
    );
    if (!issues.length) setChanged(true);
  };

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
        <h1>Configurar jogo e equipes</h1>
        <p>
          Preencha a configuração da partida. Até a confirmação final, os dados ficam somente neste
          navegador.
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
            if (value === 1 || value === 2) goToStep(value);
          }}
        />
        <UnsavedChangesGuard active={changed} />
        {availableDraft ? (
          <AdminDraftNotice
            savedAt={availableDraft.savedAt}
            onRestore={restoreDraft}
            onDiscard={discardDraft}
          />
        ) : null}
        {errors.length ? (
          <div id="setup-errors" role="alert" className="form-error">
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

        <div className="scoresheet-form">
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
                    aria-describedby={errors.length ? "setup-errors" : undefined}
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
              <label>
                Data do jogo (obrigatória)
                <input
                  type="date"
                  required
                  value={setup.game.date}
                  aria-describedby={errors.length ? "setup-errors" : undefined}
                  onChange={(event) =>
                    update((current) => ({
                      ...current,
                      game: { ...current.game, date: event.target.value },
                    }))
                  }
                />
              </label>
              <label>
                Horário (opcional)
                <input
                  type="time"
                  value={setup.game.time ?? ""}
                  onChange={(event) =>
                    update((current) => ({
                      ...current,
                      game: { ...current.game, time: event.target.value },
                    }))
                  }
                />
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
                return (
                  <fieldset className="lineup-panel" key={side}>
                    <legend>
                      {label}: {team?.teamName}
                    </legend>
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
                              disabled={slot.rosterEntryId === null}
                              value={slot.jerseyNumber}
                              onChange={(event) =>
                                update((current) => ({
                                  ...current,
                                  slots: {
                                    ...current.slots,
                                    [side]: current.slots[side].map((item) =>
                                      item.slotNumber === slot.slotNumber
                                        ? { ...item, jerseyNumber: event.target.value }
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
                                        ? { ...item, isStarter: event.target.checked }
                                        : item,
                                    ),
                                  },
                                }))
                              }
                            />{" "}
                            Titular
                          </label>
                          <label>
                            <input
                              type="radio"
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
                                [side]: { ...current.staff[side], assistant: event.target.value },
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
                          officials: { ...current.officials, [role]: event.target.value },
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
              <button className="button button-primary" type="button" onClick={verifySetup}>
                Conferir configuração
              </button>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
