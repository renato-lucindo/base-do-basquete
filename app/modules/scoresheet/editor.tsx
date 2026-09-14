import { useEffect, useMemo, useRef, useState } from "react";
import { Form, Link, useNavigation } from "react-router";

import { AdminDraftNotice } from "../../components/admin/admin-draft-notice";
import { AdminWizardSteps } from "../../components/admin/admin-wizard-steps";
import { StickyActionSummary } from "../../components/admin/sticky-action-summary";
import { UnsavedChangesGuard } from "../../components/admin/unsaved-changes-guard";
import { readAdminDraft, removeAdminDraft, saveAdminDraft } from "../admin-drafts/client";
import type { AdminDraft } from "../admin-drafts/schema";
import { CompactScoresheetGrid } from "./compact-grid";
import {
  buildPrefillSlots,
  calculatePoints,
  duplicateJerseys,
  evaluateDisqualification,
  parseFoulCodes,
  periodLabel,
  type FoulInput,
  type EditorSlot,
  type RosterCandidate,
  type TeamSide,
} from "./domain";

export interface ScoresheetRegistration {
  id: number;
  teamName: string;
  roster: RosterCandidate[];
  previous: Array<{ slotNumber: number; rosterEntryId: number; jerseyNumber: string }>;
}

export interface ScoresheetGame {
  id: number;
  gameNumber: string | null;
  scheduledLocal: string;
  venue: string;
  homeRegistrationId: number;
  awayRegistrationId: number;
}

interface ManualScoresheetEditorProps {
  actionError?: string;
  competitionId: number;
  competitionName: string;
  csrfToken: string;
  idempotencyKey: string;
  games: ScoresheetGame[];
  registrations: ScoresheetRegistration[];
}

const sides: TeamSide[] = ["home", "away"];
const fields = [
  ["two", "2 pontos"],
  ["three", "3 pontos"],
  ["free", "Lance livre"],
] as const;
const scoresheetSteps = ["Jogo", "Equipes", "Lançamentos", "Revisão"] as const;

interface ScoresheetDraftData {
  gameId: number;
  periodCount: number;
  registrationIds: Record<TeamSide, number>;
  slots: Record<TeamSide, EditorSlot[]>;
  stats: Record<string, string>;
  gameNumber: string;
  scheduledLocal: string;
  venue: string;
  step: number;
  viewMode: "cards" | "compact";
  activePeriod: number;
}

function statKey(side: TeamSide, slotNumber: number, periodNumber: number, field: string) {
  return `${side}-${slotNumber}-${periodNumber}-${field}`;
}

export function ManualScoresheetEditor({
  actionError,
  competitionId,
  competitionName,
  csrfToken,
  idempotencyKey,
  games,
  registrations,
}: ManualScoresheetEditorProps) {
  const navigation = useNavigation();
  const submitted = useRef(false);
  const [periodCount, setPeriodCount] = useState(4);
  const [step, setStep] = useState(1);
  const [viewMode, setViewMode] = useState<"cards" | "compact">("cards");
  const [activePeriod, setActivePeriod] = useState(1);
  const firstGame = games[0];
  const [gameId, setGameId] = useState(firstGame?.id ?? 0);
  const [gameNumber, setGameNumber] = useState(firstGame?.gameNumber ?? "");
  const [scheduledLocal, setScheduledLocal] = useState(firstGame?.scheduledLocal ?? "");
  const [venue, setVenue] = useState(firstGame?.venue ?? "");
  const [registrationIds, setRegistrationIds] = useState<Record<TeamSide, number>>({
    home: firstGame?.homeRegistrationId ?? 0,
    away: firstGame?.awayRegistrationId ?? 0,
  });
  const registrationById = useMemo(
    () => new Map(registrations.map((registration) => [registration.id, registration])),
    [registrations],
  );
  const initialSlots = (registrationId: number) => {
    const registration = registrationById.get(registrationId);
    return buildPrefillSlots(registration?.roster ?? [], registration?.previous ?? []);
  };
  const [slots, setSlots] = useState<Record<TeamSide, EditorSlot[]>>({
    home: initialSlots(registrationIds.home),
    away: initialSlots(registrationIds.away),
  });
  const [stats, setStats] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<AdminDraft<ScoresheetDraftData> | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pendingDraft, setPendingDraft] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  useEffect(() => {
    const result = readAdminDraft<ScoresheetDraftData>({
      flow: "manual-scoresheet",
      competitionId,
    });
    if (result.status === "available") setDraft(result.draft);
  }, [competitionId]);

  useEffect(() => {
    if (navigation.state === "submitting") submitted.current = true;
  }, [navigation.state]);

  useEffect(
    () => () => {
      if (submitted.current) removeAdminDraft({ flow: "manual-scoresheet", competitionId });
    },
    [competitionId],
  );

  useEffect(() => {
    if (!pendingDraft) return;
    const timeout = window.setTimeout(() => {
      const time = saveAdminDraft(
        { flow: "manual-scoresheet", competitionId },
        {
          gameId,
          periodCount,
          registrationIds,
          slots,
          stats,
          gameNumber,
          scheduledLocal,
          venue,
          step,
          viewMode,
          activePeriod,
        },
      );
      setSavedAt(time);
      setPendingDraft(false);
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [
    activePeriod,
    competitionId,
    gameNumber,
    gameId,
    pendingDraft,
    periodCount,
    registrationIds,
    scheduledLocal,
    slots,
    stats,
    step,
    venue,
    viewMode,
  ]);

  const markChanged = () => setPendingDraft(true);

  const restoreDraft = () => {
    if (!draft) return;
    if (
      !draft.data ||
      !Number.isInteger(draft.data.gameId) ||
      !draft.data.registrationIds ||
      !draft.data.slots ||
      !Array.isArray(draft.data.slots.home) ||
      !Array.isArray(draft.data.slots.away) ||
      !draft.data.stats ||
      !Number.isInteger(draft.data.periodCount)
    ) {
      discardDraft();
      setRestoreMessage("O rascunho incompatível foi descartado.");
      return;
    }
    const availableRegistrations = new Set(registrations.map(({ id }) => id));
    const restoredGame = games.find((game) => game.id === draft.data.gameId);
    if (
      !restoredGame ||
      !availableRegistrations.has(draft.data.registrationIds.home) ||
      !availableRegistrations.has(draft.data.registrationIds.away)
    ) {
      removeAdminDraft({ flow: "manual-scoresheet", competitionId });
      setDraft(null);
      setRestoreMessage("As equipes do rascunho não estão mais disponíveis.");
      return;
    }
    let skipped = 0;
    const restoredSlots = Object.fromEntries(
      sides.map((side) => {
        const validRoster = new Set(
          registrationById
            .get(draft.data.registrationIds[side])
            ?.roster.map(({ rosterEntryId }) => rosterEntryId) ?? [],
        );
        return [
          side,
          draft.data.slots[side].map((slot) => {
            if (slot.rosterEntryId === null || validRoster.has(slot.rosterEntryId)) return slot;
            skipped += 1;
            return { ...slot, rosterEntryId: null, jerseyNumber: "" };
          }),
        ];
      }),
    ) as Record<TeamSide, EditorSlot[]>;
    setPeriodCount(draft.data.periodCount);
    setGameId(restoredGame.id);
    setRegistrationIds({
      home: restoredGame.homeRegistrationId,
      away: restoredGame.awayRegistrationId,
    });
    setSlots(restoredSlots);
    setStats(draft.data.stats);
    setGameNumber(restoredGame.gameNumber ?? "");
    setScheduledLocal(restoredGame.scheduledLocal);
    setVenue(restoredGame.venue);
    setStep(Math.min(4, Math.max(1, draft.data.step)));
    setViewMode(draft.data.viewMode);
    setActivePeriod(Math.min(draft.data.periodCount, Math.max(1, draft.data.activePeriod)));
    setSavedAt(draft.savedAt);
    setDraft(null);
    setRestoreMessage(
      skipped
        ? `${skipped} atleta(s) indisponível(is) foram removidos do rascunho.`
        : "Rascunho restaurado.",
    );
  };

  const discardDraft = () => {
    removeAdminDraft({ flow: "manual-scoresheet", competitionId });
    setDraft(null);
    setSavedAt(null);
  };

  const setRegistration = (side: TeamSide, registrationId: number) => {
    markChanged();
    setRegistrationIds((current) => ({ ...current, [side]: registrationId }));
    setSlots((current) => ({ ...current, [side]: initialSlots(registrationId) }));
    setStats((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${side}-`))),
    );
  };

  const selectGame = (selectedId: number) => {
    const game = games.find((candidate) => candidate.id === selectedId);
    if (!game) return;
    markChanged();
    setGameId(game.id);
    setGameNumber(game.gameNumber ?? "");
    setScheduledLocal(game.scheduledLocal);
    setVenue(game.venue);
    setRegistration("home", game.homeRegistrationId);
    setRegistration("away", game.awayRegistrationId);
    setStats({});
  };

  const setSlot = (side: TeamSide, slotNumber: number, rosterEntryId: number | null) => {
    if (rosterEntryId === null) {
      const hasData = Object.entries(stats).some(
        ([key, value]) => key.startsWith(`${side}-${slotNumber}-`) && value.trim() !== "",
      );
      if (hasData && !globalThis.confirm("Marcar como N/A removerá as estatísticas deste slot."))
        return;
      setStats((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([key]) => !key.startsWith(`${side}-${slotNumber}-`)),
        ),
      );
    }
    markChanged();
    const registration = registrationById.get(registrationIds[side]);
    const candidate = registration?.roster.find((item) => item.rosterEntryId === rosterEntryId);
    setSlots((current) => ({
      ...current,
      [side]: current[side].map((slot) =>
        slot.slotNumber === slotNumber
          ? {
              ...slot,
              rosterEntryId,
              jerseyNumber: candidate?.jerseyNumber ?? "",
            }
          : slot,
      ),
    }));
  };

  const disqualificationFor = (side: TeamSide, slotNumber: number) => {
    const fouls: FoulInput[] = [];
    for (let periodNumber = 1; periodNumber <= periodCount; periodNumber += 1) {
      const codes = parseFoulCodes(stats[statKey(side, slotNumber, periodNumber, "fouls")] ?? "");
      if (!codes) continue;
      codes.forEach((code, index) => {
        fouls.push({ periodNumber, sequenceNumber: index + 1, code });
      });
    }
    return evaluateDisqualification(fouls);
  };

  const scoreFor = (side: TeamSide) => {
    let score = 0;
    for (const slot of slots[side]) {
      if (slot.rosterEntryId === null) continue;
      for (let period = 1; period <= periodCount; period += 1) {
        const value = (field: string) =>
          Number(stats[statKey(side, slot.slotNumber, period, field)] || 0);
        try {
          score += calculatePoints(value("two"), value("three"), value("free"));
        } catch {
          return Number.NaN;
        }
      }
    }
    return score;
  };

  const homeDuplicates = duplicateJerseys(slots.home);
  const awayDuplicates = duplicateJerseys(slots.away);
  const hasDuplicateJersey = homeDuplicates.size > 0 || awayDuplicates.size > 0;
  const invalidParticipants =
    registrationIds.home === 0 ||
    registrationIds.away === 0 ||
    registrationIds.home === registrationIds.away;
  const homeScore = scoreFor("home");
  const awayScore = scoreFor("away");
  const isSubmitting = navigation.state === "submitting";
  const activePlayers =
    slots.home.filter((slot) => slot.rosterEntryId).length +
    slots.away.filter((slot) => slot.rosterEntryId).length;
  const changeStat = (key: string, value: string) => {
    markChanged();
    setStats((current) => ({ ...current, [key]: value }));
  };
  const canAdvance =
    (step === 1 && Boolean(scheduledLocal && venue.trim())) ||
    (step === 2 && !invalidParticipants && !hasDuplicateJersey && activePlayers > 0) ||
    step >= 3;

  return (
    <main className="admin-shell scoresheet-shell">
      <header className="site-header admin-header">
        <Link className="brand" to={`/admin/competitions/${competitionId}`}>
          <span className="brand-mark">B</span>
          <span>Voltar ao hub</span>
        </Link>
        <span className="environment-pill">
          <span className="status-dot" />
          AAL2
        </span>
      </header>
      <section className="admin-welcome scoresheet-editor">
        <p className="eyebrow">Súmula manual</p>
        <h1>{competitionName}</h1>
        <p>
          Horário interpretado em America/Sao_Paulo. Pontos, placar, GD e encerramento são
          recalculados no banco.
        </p>
        {actionError ? (
          <p className="form-error" role="alert">
            {actionError}
          </p>
        ) : null}
        <AdminWizardSteps current={step} labels={scoresheetSteps} onSelect={setStep} />
        {draft ? (
          <AdminDraftNotice
            savedAt={draft.savedAt}
            onRestore={restoreDraft}
            onDiscard={discardDraft}
          />
        ) : null}
        {restoreMessage ? <output className="admin-note">{restoreMessage}</output> : null}

        <Form method="post" className="scoresheet-form">
          <UnsavedChangesGuard active={pendingDraft} />
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <input type="hidden" name="periodCount" value={periodCount} />
          <input type="hidden" name="gameId" value={gameId} />

          <div hidden={step !== 1}>
            <fieldset className="scoresheet-header-grid">
              <legend>Cabeçalho do jogo</legend>
              <label>
                Jogo estrutural
                <select value={gameId} onChange={(event) => selectGame(Number(event.target.value))}>
                  {games.map((game) => (
                    <option key={game.id} value={game.id}>
                      {game.gameNumber ? `Jogo ${game.gameNumber}` : `Jogo #${game.id}`}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Número do jogo
                <input name="gameNumber" maxLength={40} value={gameNumber} readOnly />
              </label>
              <label>
                Data e hora
                <input
                  name="scheduledLocal"
                  type="datetime-local"
                  required
                  value={scheduledLocal}
                  readOnly
                />
              </label>
              <label>
                Local
                <input name="venue" required maxLength={160} value={venue} readOnly />
              </label>
            </fieldset>
            <div className="wizard-actions">
              <button
                className="button button-primary"
                type="button"
                disabled={!scheduledLocal || !venue.trim()}
                onClick={() => {
                  setStep(2);
                  markChanged();
                }}
              >
                Continuar para equipes
              </button>
            </div>
          </div>

          <div hidden={step !== 2}>
            <section className="participant-grid">
              {sides.map((side) => {
                const opposite = side === "home" ? "away" : "home";
                const registration = registrationById.get(registrationIds[side]);
                const selectedIds = new Set(
                  slots[side]
                    .map((slot) => slot.rosterEntryId)
                    .filter((value): value is number => value !== null),
                );
                const duplicateSet = side === "home" ? homeDuplicates : awayDuplicates;
                return (
                  <fieldset className="lineup-panel" key={side}>
                    <legend>{side === "home" ? "Mandante" : "Visitante"}</legend>
                    <label>
                      Equipe inscrita
                      <select value={registrationIds[side]} disabled>
                        {registrations.map((option) => (
                          <option
                            key={option.id}
                            value={option.id}
                            disabled={option.id === registrationIds[opposite]}
                          >
                            {option.teamName}
                          </option>
                        ))}
                      </select>
                      <input
                        type="hidden"
                        name={`${side}RegistrationId`}
                        value={registrationIds[side]}
                      />
                    </label>
                    <div className="slot-grid">
                      {slots[side].map((slot) => (
                        <div className="slot-row" key={`${side}-${slot.slotNumber}`}>
                          <span>#{slot.slotNumber}</span>
                          <label>
                            <span className="sr-only">Atleta do slot {slot.slotNumber}</span>
                            <select
                              name={`${side}Player${slot.slotNumber}`}
                              value={slot.rosterEntryId ?? ""}
                              onChange={(event) =>
                                setSlot(
                                  side,
                                  slot.slotNumber,
                                  event.target.value ? Number(event.target.value) : null,
                                )
                              }
                            >
                              <option value="">N/A</option>
                              {registration?.roster.map((candidate) => (
                                <option
                                  key={candidate.rosterEntryId}
                                  value={candidate.rosterEntryId}
                                  disabled={
                                    selectedIds.has(candidate.rosterEntryId) &&
                                    candidate.rosterEntryId !== slot.rosterEntryId
                                  }
                                >
                                  {candidate.playerName}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span className="sr-only">Camisa do slot {slot.slotNumber}</span>
                            <input
                              aria-invalid={duplicateSet.has(slot.jerseyNumber)}
                              name={`${side}Jersey${slot.slotNumber}`}
                              value={slot.jerseyNumber}
                              disabled={slot.rosterEntryId === null}
                              placeholder="Camisa"
                              onChange={(event) => {
                                markChanged();
                                setSlots((current) => ({
                                  ...current,
                                  [side]: current[side].map((item) =>
                                    item.slotNumber === slot.slotNumber
                                      ? { ...item, jerseyNumber: event.target.value }
                                      : item,
                                  ),
                                }));
                              }}
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  </fieldset>
                );
              })}
            </section>

            {invalidParticipants ? (
              <p className="form-error">Mandante e visitante devem ser equipes diferentes.</p>
            ) : null}
            {hasDuplicateJersey ? (
              <p className="form-error">Há camisas duplicadas dentro da mesma equipe.</p>
            ) : null}
            <div className="wizard-actions">
              <button className="button button-ghost" type="button" onClick={() => setStep(1)}>
                Voltar
              </button>
              <button
                className="button button-primary"
                type="button"
                disabled={invalidParticipants || hasDuplicateJersey || activePlayers === 0}
                onClick={() => {
                  setStep(3);
                  markChanged();
                }}
              >
                Continuar para lançamentos
              </button>
            </div>
          </div>

          <div hidden={step !== 3}>
            <section className="scoresheet-scoreboard" aria-live="polite">
              <div>
                <span>{registrationById.get(registrationIds.home)?.teamName ?? "Mandante"}</span>
                <strong>{Number.isNaN(homeScore) ? "—" : homeScore}</strong>
              </div>
              <span>×</span>
              <div>
                <span>{registrationById.get(registrationIds.away)?.teamName ?? "Visitante"}</span>
                <strong>{Number.isNaN(awayScore) ? "—" : awayScore}</strong>
              </div>
            </section>

            <section className="period-toolbar">
              <div>
                <h2>Grade por períodos</h2>
                <p>Informe conversões e faltas separadas por vírgula: P, T, U, U2 ou D.</p>
              </div>
              <button
                className="button button-ghost"
                type="button"
                disabled={periodCount >= 12}
                onClick={() => {
                  setPeriodCount((count) => Math.min(12, count + 1));
                  markChanged();
                }}
              >
                Adicionar OT{periodCount - 3}
              </button>
            </section>

            <div className="scoresheet-view-toolbar">
              <fieldset>
                <legend>Visualização</legend>
                <label>
                  <input
                    type="radio"
                    name="scoresheetView"
                    checked={viewMode === "cards"}
                    onChange={() => {
                      setViewMode("cards");
                      markChanged();
                    }}
                  />
                  Cartões
                </label>
                <label>
                  <input
                    type="radio"
                    name="scoresheetView"
                    checked={viewMode === "compact"}
                    onChange={() => {
                      setViewMode("compact");
                      markChanged();
                    }}
                  />
                  Grade compacta
                </label>
              </fieldset>
              {viewMode === "compact" ? (
                <label>
                  Período em edição
                  <select
                    value={activePeriod}
                    onChange={(event) => {
                      setActivePeriod(Number(event.currentTarget.value));
                      markChanged();
                    }}
                  >
                    {Array.from({ length: periodCount }, (_, index) => index + 1).map((period) => (
                      <option key={period} value={period}>
                        {periodLabel(period)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            {viewMode === "compact"
              ? Object.entries(stats)
                  .filter(([key]) => Number(key.split("-")[2]) !== activePeriod)
                  .map(([key, value]) => (
                    <input key={key} type="hidden" name={`stat-${key}`} value={value} />
                  ))
              : null}

            {viewMode === "cards"
              ? sides.map((side) => (
                  <section className="team-stat-section" key={`${side}-stats`}>
                    <h2>{registrationById.get(registrationIds[side])?.teamName}</h2>
                    {slots[side]
                      .filter((slot) => slot.rosterEntryId !== null)
                      .map((slot) => {
                        const player = registrationById
                          .get(registrationIds[side])
                          ?.roster.find((item) => item.rosterEntryId === slot.rosterEntryId);
                        const disqualification = disqualificationFor(side, slot.slotNumber);
                        return (
                          <article
                            className="player-stat-card"
                            key={`${side}-stats-${slot.slotNumber}`}
                          >
                            <header>
                              <h3>
                                {slot.jerseyNumber || "—"} · {player?.playerName}
                              </h3>
                              {disqualification ? (
                                <span className="gd-pill">
                                  GD {disqualification.reason} em{" "}
                                  {periodLabel(disqualification.periodNumber)}
                                </span>
                              ) : null}
                            </header>
                            <div className="period-stat-grid">
                              {Array.from({ length: periodCount }, (_, index) => index + 1).map(
                                (periodNumber) => {
                                  const locked = Boolean(
                                    disqualification &&
                                      periodNumber > disqualification.periodNumber,
                                  );
                                  return (
                                    <fieldset disabled={locked} key={periodNumber}>
                                      <legend>{periodLabel(periodNumber)}</legend>
                                      {fields.map(([field, label]) => {
                                        const key = statKey(
                                          side,
                                          slot.slotNumber,
                                          periodNumber,
                                          field,
                                        );
                                        return (
                                          <label key={field}>
                                            {label}
                                            <input
                                              aria-label={`${label} de ${player?.playerName} em ${periodLabel(periodNumber)}`}
                                              inputMode="numeric"
                                              name={`stat-${key}`}
                                              pattern="(?:0|[1-9][0-9]?)"
                                              value={stats[key] ?? "0"}
                                              onChange={(event) =>
                                                changeStat(key, event.target.value)
                                              }
                                            />
                                          </label>
                                        );
                                      })}
                                      <label>
                                        Faltas
                                        <input
                                          aria-label={`Faltas de ${player?.playerName} em ${periodLabel(periodNumber)}`}
                                          name={`stat-${statKey(side, slot.slotNumber, periodNumber, "fouls")}`}
                                          placeholder="P,T"
                                          value={
                                            stats[
                                              statKey(side, slot.slotNumber, periodNumber, "fouls")
                                            ] ?? ""
                                          }
                                          onChange={(event) =>
                                            changeStat(
                                              statKey(side, slot.slotNumber, periodNumber, "fouls"),
                                              event.target.value,
                                            )
                                          }
                                        />
                                      </label>
                                      {locked ? <p>Bloqueado após GD.</p> : null}
                                    </fieldset>
                                  );
                                },
                              )}
                            </div>
                          </article>
                        );
                      })}
                  </section>
                ))
              : sides.map((side) => (
                  <CompactScoresheetGrid
                    key={`${side}-compact`}
                    side={side}
                    teamName={registrationById.get(registrationIds[side])?.teamName ?? side}
                    slots={slots[side]}
                    roster={registrationById.get(registrationIds[side])?.roster ?? []}
                    periodCount={periodCount}
                    periodNumber={activePeriod}
                    stats={stats}
                    disqualificationFor={disqualificationFor}
                    onChange={changeStat}
                  />
                ))}
            <div className="wizard-actions">
              <button className="button button-ghost" type="button" onClick={() => setStep(2)}>
                Voltar
              </button>
              <button
                className="button button-primary"
                type="button"
                onClick={() => {
                  setStep(4);
                  markChanged();
                }}
              >
                Revisar súmula
              </button>
            </div>
          </div>

          <div className="scoresheet-submit" hidden={step !== 4}>
            <p>O jogo será encerrado como final. Empate exige OT e é recusado pelo banco.</p>
            <button className="button button-ghost" type="button" onClick={() => setStep(3)}>
              Voltar aos lançamentos
            </button>
          </div>

          <StickyActionSummary
            title="Resumo da súmula"
            metrics={[
              {
                label: "Placar",
                value: `${Number.isNaN(homeScore) ? "—" : homeScore} × ${Number.isNaN(awayScore) ? "—" : awayScore}`,
              },
              { label: "Período", value: periodLabel(activePeriod) },
              { label: "Atletas", value: activePlayers },
            ]}
            status={
              pendingDraft
                ? "Salvando rascunho…"
                : savedAt
                  ? "Rascunho salvo"
                  : actionError
                    ? "Há pendências"
                    : "Pronto para editar"
            }
          >
            {step < 4 ? (
              <button
                className="button button-primary"
                type="button"
                disabled={!canAdvance}
                onClick={() => {
                  setStep(Math.min(4, step + 1));
                  markChanged();
                }}
              >
                Próxima etapa
              </button>
            ) : (
              <button
                className="button button-primary"
                type="submit"
                disabled={isSubmitting || invalidParticipants || hasDuplicateJersey}
              >
                {isSubmitting ? "Salvando…" : "Salvar jogo"}
              </button>
            )}
          </StickyActionSummary>
        </Form>
      </section>
    </main>
  );
}
