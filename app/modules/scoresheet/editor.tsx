import { useMemo, useState } from "react";
import { Form, Link, useNavigation } from "react-router";

import { FormDraftNotice } from "../admin/form-draft-notice";

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

interface ManualScoresheetEditorProps {
  actionError?: string;
  competitionId: number;
  competitionName: string;
  csrfToken: string;
  idempotencyKey: string;
  registrations: ScoresheetRegistration[];
}

const sides: TeamSide[] = ["home", "away"];
const fields = [
  ["two", "2 pontos"],
  ["three", "3 pontos"],
  ["free", "Lance livre"],
] as const;

function statKey(side: TeamSide, slotNumber: number, periodNumber: number, field: string) {
  return `${side}-${slotNumber}-${periodNumber}-${field}`;
}

export function ManualScoresheetEditor({
  actionError,
  competitionId,
  competitionName,
  csrfToken,
  idempotencyKey,
  registrations,
}: ManualScoresheetEditorProps) {
  const navigation = useNavigation();
  const [periodCount, setPeriodCount] = useState(4);
  const [registrationIds, setRegistrationIds] = useState<Record<TeamSide, number>>({
    home: registrations[0]?.id ?? 0,
    away: registrations[1]?.id ?? 0,
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

  const setRegistration = (side: TeamSide, registrationId: number) => {
    setRegistrationIds((current) => ({ ...current, [side]: registrationId }));
    setSlots((current) => ({ ...current, [side]: initialSlots(registrationId) }));
    setStats((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${side}-`))),
    );
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

  return (
    <main className="admin-shell scoresheet-shell">
      <header className="site-header admin-header">
        <Link className="brand" to={`/admin/competitions/${competitionId}`}>
          <span className="brand-mark">BB</span>
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

        <Form method="post" className="scoresheet-form" id="manual-scoresheet-form">
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <input type="hidden" name="periodCount" value={periodCount} />
          <FormDraftNotice
            contextId={`competition-${competitionId}`}
            formId="manual-scoresheet-form"
          />

          <fieldset className="scoresheet-header-grid">
            <legend>Cabeçalho do jogo</legend>
            <label>
              Número do jogo (opcional)
              <input name="gameNumber" maxLength={40} />
            </label>
            <label>
              Data e hora
              <input name="scheduledLocal" type="datetime-local" required />
            </label>
            <label>
              Local
              <input name="venue" required maxLength={160} />
            </label>
          </fieldset>

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
                    <select
                      name={`${side}RegistrationId`}
                      value={registrationIds[side]}
                      onChange={(event) => setRegistration(side, Number(event.target.value))}
                    >
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
                            onChange={(event) =>
                              setSlots((current) => ({
                                ...current,
                                [side]: current[side].map((item) =>
                                  item.slotNumber === slot.slotNumber
                                    ? { ...item, jerseyNumber: event.target.value }
                                    : item,
                                ),
                              }))
                            }
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
              onClick={() => setPeriodCount((count) => Math.min(12, count + 1))}
            >
              Adicionar OT{periodCount - 3}
            </button>
          </section>

          {sides.map((side) => (
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
                    <article className="player-stat-card" key={`${side}-stats-${slot.slotNumber}`}>
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
                              disqualification && periodNumber > disqualification.periodNumber,
                            );
                            return (
                              <fieldset disabled={locked} key={periodNumber}>
                                <legend>{periodLabel(periodNumber)}</legend>
                                {fields.map(([field, label]) => {
                                  const key = statKey(side, slot.slotNumber, periodNumber, field);
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
                                          setStats((current) => ({
                                            ...current,
                                            [key]: event.target.value,
                                          }))
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
                                      setStats((current) => ({
                                        ...current,
                                        [statKey(side, slot.slotNumber, periodNumber, "fouls")]:
                                          event.target.value,
                                      }))
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
          ))}

          <div className="scoresheet-submit">
            <p>O jogo será encerrado como final. Empate exige OT e é recusado pelo banco.</p>
            <label className="irreversible-confirmation">
              <input name="irreversibleConfirmed" required type="checkbox" value="yes" />
              Revisei equipes, atletas, períodos, faltas e placar. Confirmo o encerramento
              irreversível desta súmula.
            </label>
            <button
              className="button button-primary"
              type="submit"
              disabled={isSubmitting || invalidParticipants || hasDuplicateJersey}
            >
              {isSubmitting ? "Salvando…" : "Salvar e encerrar jogo"}
            </button>
          </div>
        </Form>
      </section>
    </main>
  );
}
