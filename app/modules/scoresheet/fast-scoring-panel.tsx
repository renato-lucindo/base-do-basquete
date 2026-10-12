import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { CompactScoresheetGrid } from "./compact-grid";
import {
  beginFastEntry,
  cancelFastEntry,
  completeFastScoreEntry,
  evaluateDisqualification,
  hasFoulAfterDisqualification,
  hasRecordedPointsAfterPeriod,
  normalizeGameJersey,
  parseFastFoulEntry,
  parseFoulNotation,
  playerFoulsForDisqualification,
  periodLabel,
  type EditorSlot,
  type FastEntryState,
  type SemanticFoulPayload,
  type TeamSide,
} from "./domain";
import type { ScoresheetRegistration } from "./editor";

const sides: TeamSide[] = ["home", "away"];
const historyLimit = 10;

export interface QuickScoreHistoryItem {
  key: string;
  previous: string | undefined;
  next: string;
  side: TeamSide;
  periodNumber: number;
  jerseyNumber: string;
  points: 1 | 2 | 3;
}

export type QuickScoreResult =
  | { ok: true; entry: QuickScoreHistoryItem }
  | { ok: false; message: string };

export function prepareQuickScore(
  stats: Record<string, string>,
  slots: EditorSlot[],
  side: TeamSide,
  periodNumber: number,
  jerseyNumber: string,
  points: 1 | 2 | 3,
): QuickScoreResult {
  const matching = slots.filter(
    (slot) => slot.rosterEntryId !== null && slot.jerseyNumber === jerseyNumber,
  );
  if (matching.length !== 1) {
    return {
      ok: false,
      message: matching.length
        ? "Há camisas duplicadas. Corrija o elenco."
        : `Camisa ${jerseyNumber} não encontrada nesta equipe.`,
    };
  }
  const slot = matching[0];
  if (!slot) return { ok: false, message: "Atleta indisponível." };
  const field = points === 1 ? "free" : points === 2 ? "two" : "three";
  const key = `${side}-${slot.slotNumber}-${periodNumber}-${field}`;
  const previous = stats[key];
  const current = previous === undefined || previous === "" ? 0 : Number(previous);
  if (!Number.isSafeInteger(current) || current < 0 || current >= 99) {
    return { ok: false, message: "Revise a quantidade na grade (limite de 99 conversões)." };
  }
  return {
    ok: true,
    entry: { key, previous, next: String(current + 1), side, periodNumber, jerseyNumber, points },
  };
}

export type QuickFoulTarget = "player" | "bench" | "coach" | "assistant_1";
export type QuickFoulResult =
  | { ok: true; entry: SemanticFoulPayload; disqualification: string | null }
  | { ok: false; message: string };

export function prepareQuickFoul(
  fouls: SemanticFoulPayload[],
  slots: EditorSlot[],
  registrationId: number,
  periodNumber: number,
  target: QuickFoulTarget,
  text: string,
  stats: Record<string, string>,
  side: TeamSide,
): QuickFoulResult {
  if (
    !Number.isSafeInteger(registrationId) ||
    registrationId <= 0 ||
    !Number.isSafeInteger(periodNumber) ||
    periodNumber < 1 ||
    periodNumber > 4
  ) {
    return { ok: false, message: "Selecione uma equipe e um período válidos." };
  }
  if (fouls.length >= 1000) return { ok: false, message: "Limite de faltas do rascunho atingido." };

  const parsed = target === "player" ? parseFastFoulEntry(text) : null;
  const notation = target === "coach" ? "C1" : "B1";
  const nonPlayer = target === "player" ? null : parseFoulNotation(text);
  if (target === "player" && !parsed) {
    return { ok: false, message: "Falta inválida. Use camisa e código, como 12U2 ou 12 T1." };
  }
  if (target !== "player" && (!nonPlayer || nonPlayer.originalNotation !== notation)) {
    return { ok: false, message: `Falta inválida. Use ${notation} para o alvo selecionado.` };
  }

  const matching = parsed
    ? slots.filter(
        (slot) => slot.rosterEntryId !== null && slot.jerseyNumber === parsed.jerseyNumber,
      )
    : [];
  if (parsed && matching.length !== 1) {
    return {
      ok: false,
      message: matching.length
        ? "Há camisas duplicadas. Corrija o elenco."
        : `Camisa ${parsed.jerseyNumber} não encontrada nesta equipe.`,
    };
  }
  const matchedSlot = matching[0];
  const rosterEntryId = matchedSlot?.rosterEntryId;
  const previous =
    rosterEntryId == null || !matchedSlot
      ? []
      : playerFoulsForDisqualification(stats, fouls, side, matchedSlot, registrationId);
  if (previous === null) {
    return {
      ok: false,
      message: "Corrija as faltas legadas incompletas antes de lançar outra falta.",
    };
  }
  if (evaluateDisqualification(previous)) {
    return { ok: false, message: "Atleta já desqualificado (GD); novas faltas bloqueadas." };
  }

  const sequenceNumber =
    Math.max(
      0,
      ...fouls
        .filter((foul) => foul.periodNumber === periodNumber)
        .map((foul) => foul.sequenceNumber),
    ) + 1;
  if (sequenceNumber > 1000)
    return { ok: false, message: "Limite de sequência de faltas atingido." };
  const entry: SemanticFoulPayload = {
    periodNumber,
    sequenceNumber,
    ...(parsed?.foul ?? nonPlayer!),
    target: parsed
      ? { kind: "player", registrationId, rosterEntryId: rosterEntryId! }
      : target === "bench"
        ? { kind: "bench", registrationId }
        : {
            kind: "staff",
            registrationId,
            staffRole: target === "coach" ? "coach" : "assistant_1",
          },
  };
  const updatedPlayerFouls = rosterEntryId == null ? [] : [...previous, entry];
  if (rosterEntryId != null && hasFoulAfterDisqualification(updatedPlayerFouls)) {
    return {
      ok: false,
      message: "Esta falta criaria registros posteriores à desqualificação (GD).",
    };
  }
  const gd = rosterEntryId == null ? null : evaluateDisqualification(updatedPlayerFouls);
  if (
    gd &&
    matchedSlot &&
    hasRecordedPointsAfterPeriod(stats, side, matchedSlot.slotNumber, gd.periodNumber)
  ) {
    return {
      ok: false,
      message: "Esta falta criaria GD retroativa com pontos registrados em período posterior.",
    };
  }
  return {
    ok: true,
    entry,
    disqualification: gd?.reason ?? null,
  };
}

interface FastScoringPanelProps {
  slots: Record<TeamSide, EditorSlot[]>;
  registrations: ScoresheetRegistration[];
  registrationIds: Record<TeamSide, number>;
  stats: Record<string, string>;
  fouls: SemanticFoulPayload[];
  onChange: (key: string, value: string | undefined) => void;
  onFoulsChange: (next: SemanticFoulPayload[]) => void;
}

export function FastScoringPanel({
  slots,
  registrations,
  registrationIds,
  stats,
  fouls,
  onChange,
  onFoulsChange,
}: FastScoringPanelProps) {
  const [side, setSide] = useState<TeamSide>("home");
  const [periodNumber, setPeriodNumber] = useState(1);
  const [entryState, setEntryState] = useState<FastEntryState>(cancelFastEntry);
  const [jerseyText, setJerseyText] = useState("");
  const [pointsText, setPointsText] = useState("");
  const [status, setStatus] = useState("Digite a camisa e pressione Enter.");
  const [error, setError] = useState("");
  const [foulTarget, setFoulTarget] = useState<QuickFoulTarget>("player");
  const [foulText, setFoulText] = useState("");
  const [foulError, setFoulError] = useState("");
  const [foulStatus, setFoulStatus] = useState("Pronto para registrar falta.");
  const foulRef = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState<Array<QuickScoreHistoryItem & { id: number }>>([]);
  const historyId = useRef(0);
  const jerseyRef = useRef<HTMLInputElement>(null);
  const pointsRef = useRef<HTMLInputElement>(null);
  const previousStageRef = useRef(entryState.stage);
  const preserveContextFocusRef = useRef(false);

  useEffect(() => {
    // The wizard owns initial focus on the step heading; only transitions move it.
    if (previousStageRef.current === entryState.stage) return;
    previousStageRef.current = entryState.stage;
    if (preserveContextFocusRef.current) {
      preserveContextFocusRef.current = false;
      return;
    }
    const request = window.requestAnimationFrame(() => {
      if (entryState.stage === "jersey") jerseyRef.current?.focus();
      else pointsRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(request);
  }, [entryState.stage]);

  const cancel = () => {
    setEntryState(cancelFastEntry());
    setJerseyText("");
    setPointsText("");
    setError("");
    setStatus("Entrada cancelada. Digite outra camisa.");
    jerseyRef.current?.focus();
  };

  const selectJersey = () => {
    const selected = beginFastEntry(jerseyText);
    if (!selected) {
      setError("Informe uma camisa válida: 0, 00 ou 1 a 99.");
      return;
    }
    const normalized = normalizeGameJersey(jerseyText);
    if (!normalized) return;
    const matching = slots[side].filter(
      (slot) => slot.rosterEntryId !== null && slot.jerseyNumber === normalized,
    );
    if (matching.length !== 1) {
      setError(
        matching.length
          ? "Há camisas duplicadas. Corrija o elenco."
          : `Camisa ${normalized} não encontrada nesta equipe.`,
      );
      return;
    }
    setJerseyText(normalized);
    setEntryState(selected);
    setError("");
    setStatus(`Camisa ${normalized} selecionada. Informe 1, 2 ou 3 pontos.`);
  };

  const submitPoints = () => {
    const entry = completeFastScoreEntry(entryState, pointsText);
    if (!entry) {
      setError("Valor inválido. Digite 1, 2 ou 3 pontos.");
      return;
    }
    const slot = slots[side].find(
      (slot) => slot.rosterEntryId !== null && slot.jerseyNumber === entry.jerseyNumber,
    );
    const playerFouls = slot
      ? playerFoulsForDisqualification(stats, fouls, side, slot, registrationIds[side])
      : [];
    if (playerFouls === null) {
      setError("Corrija as faltas legadas incompletas antes de lançar pontos.");
      return;
    }
    const gd = evaluateDisqualification(playerFouls);
    if (gd && periodNumber > gd.periodNumber) {
      setError(
        `Atleta desqualificado em ${periodLabel(gd.periodNumber)}; pontos posteriores bloqueados.`,
      );
      return;
    }
    const result = prepareQuickScore(
      stats,
      slots[side],
      side,
      periodNumber,
      entry.jerseyNumber,
      entry.points,
    );
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onChange(result.entry.key, result.entry.next);
    const recorded = { ...result.entry, id: ++historyId.current };
    setHistory((current) => [...current, recorded].slice(-historyLimit));
    setEntryState(cancelFastEntry());
    setJerseyText("");
    setPointsText("");
    setError("");
    setStatus(
      `Camisa ${entry.jerseyNumber}: +${entry.points} ponto(s), ${periodLabel(periodNumber)}. Próxima camisa.`,
    );
    jerseyRef.current?.focus();
  };

  const undo = () => {
    const last = history.at(-1);
    if (!last) {
      setStatus("Nenhum lançamento recente para desfazer.");
      return;
    }
    if (stats[last.key] !== last.next) {
      setHistory([]);
      setError("A grade foi alterada após o lançamento. Histórico descartado; confira a grade.");
      return;
    }
    onChange(last.key, last.previous);
    setHistory((current) => current.slice(0, -1));
    setError("");
    setStatus(
      `Desfeito: camisa ${last.jerseyNumber}, ${last.points} ponto(s) em ${periodLabel(last.periodNumber)}.`,
    );
    setEntryState(cancelFastEntry());
    setJerseyText("");
    setPointsText("");
    jerseyRef.current?.focus();
  };

  const submitFoul = () => {
    const result = prepareQuickFoul(
      fouls,
      slots[side],
      registrationIds[side],
      periodNumber,
      foulTarget,
      foulText,
      stats,
      side,
    );
    if (!result.ok) {
      setFoulError(result.message);
      return;
    }
    onFoulsChange([...fouls, result.entry]);
    setFoulText("");
    setFoulError("");
    setFoulStatus(
      `${
        foulTarget === "player"
          ? `Camisa ${parseFastFoulEntry(foulText)?.jerseyNumber}`
          : foulTarget === "bench"
            ? "Banco"
            : foulTarget === "coach"
              ? "Técnico"
              : "Assistente"
      }: ` +
        `${result.entry.originalNotation} registrada em ${periodLabel(periodNumber)}.` +
        (result.disqualification ? ` GD ${result.disqualification}.` : ""),
    );
    foulRef.current?.focus();
  };

  const onKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest(".compact-grid-section")) return;
    if (event.target === foulRef.current) {
      if (event.key === "Escape") {
        event.preventDefault();
        setFoulText("");
        setFoulError("");
        setFoulStatus("Entrada de falta cancelada.");
      }
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      undo();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  };

  const switchContext = (nextSide: TeamSide, nextPeriod: number) => {
    if (entryState.stage === "value") preserveContextFocusRef.current = true;
    setSide(nextSide);
    setPeriodNumber(nextPeriod);
    setEntryState(cancelFastEntry());
    setJerseyText("");
    setPointsText("");
    setFoulText("");
    setError("");
    setFoulError("");
    setStatus(
      `Pronto para ${nextSide === "home" ? "mandante" : "visitante"}, ${periodLabel(nextPeriod)}. Digite a camisa.`,
    );
  };

  return (
    <form
      className="fast-scoring-panel"
      onKeyDown={onKeyboard}
      onSubmit={(event) => event.preventDefault()}
    >
      <fieldset className="scoresheet-header-grid">
        <legend>Contexto do lançamento rápido</legend>
        <label>
          Equipe para lançamento rápido
          <select
            value={side}
            onChange={(event) => switchContext(event.target.value as TeamSide, periodNumber)}
          >
            {sides.map((value) => (
              <option key={value} value={value}>
                {value === "home" ? "Mandante" : "Visitante"} —{" "}
                {registrations.find((item) => item.id === registrationIds[value])?.teamName ??
                  "Equipe"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Período para lançamento rápido
          <select
            value={periodNumber}
            onChange={(event) => switchContext(side, Number(event.target.value))}
          >
            {[1, 2, 3, 4].map((value) => (
              <option key={value} value={value}>
                {periodLabel(value)}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      <fieldset className="scoresheet-header-grid">
        <legend>Faltas rápidas — FIBA 2024</legend>
        <label>
          Alvo da falta
          <select
            value={foulTarget}
            onChange={(event) => {
              setFoulTarget(event.target.value as QuickFoulTarget);
              setFoulText("");
              setFoulError("");
            }}
          >
            <option value="player">Atleta</option>
            <option value="bench">Banco</option>
            <option value="coach">Técnico</option>
            <option value="assistant_1">1º assistente</option>
          </select>
        </label>
        <label>
          Código da falta
          <input
            ref={foulRef}
            type="text"
            autoComplete="off"
            maxLength={6}
            value={foulText}
            aria-invalid={Boolean(foulError)}
            aria-describedby={foulError ? "fast-foul-error" : "fast-foul-help"}
            onChange={(event) => {
              setFoulText(event.target.value);
              setFoulError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitFoul();
              }
            }}
          />
        </label>
        <div className="wizard-actions">
          <button className="button button-ghost" type="button" onClick={submitFoul}>
            Registrar falta
          </button>
        </div>
        <p className="admin-note" id="fast-foul-help">
          Atleta: 12U2, 12 U2 ou 00T1; banco e assistente: B1; técnico: C1. Equipe e período seguem
          os seletores acima. Enter registra; Esc limpa.
        </p>
        {foulError ? (
          <p className="form-error" role="alert" id="fast-foul-error">
            {foulError}
          </p>
        ) : null}
        <p className="admin-note" role="status" aria-live="polite">
          {foulStatus}
        </p>
        <div>
          <strong>Faltas registradas: {fouls.length}</strong>
          <ol aria-label="Faltas semânticas registradas">
            {fouls
              .slice(-10)
              .reverse()
              .map((foul) => (
                <li key={`${foul.periodNumber}-${foul.sequenceNumber}`}>
                  {periodLabel(foul.periodNumber)} —{" "}
                  {foul.target.registrationId === registrationIds.home ? "Mandante" : "Visitante"} —{" "}
                  {foul.target.kind === "player"
                    ? `atleta #${
                        slots[
                          foul.target.registrationId === registrationIds.home ? "home" : "away"
                        ].find((slot) => slot.rosterEntryId === foul.target.rosterEntryId)
                          ?.jerseyNumber ?? "?"
                      }`
                    : foul.target.kind === "bench"
                      ? "banco"
                      : foul.target.staffRole === "coach"
                        ? "técnico"
                        : "assistente"}
                  : {foul.originalNotation}
                </li>
              ))}
          </ol>
        </div>
      </fieldset>
      <fieldset className="scoresheet-header-grid">
        <legend>
          Pontuação rápida —{" "}
          {entryState.stage === "jersey" ? "aguardando camisa" : "aguardando valor"}
        </legend>
        <label>
          Número da camisa
          <input
            ref={jerseyRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={2}
            value={jerseyText}
            disabled={entryState.stage === "value"}
            aria-invalid={Boolean(error) && entryState.stage === "jersey"}
            aria-describedby={
              error && entryState.stage === "jersey" ? "fast-scoring-error" : "fast-scoring-help"
            }
            onChange={(event) => {
              setJerseyText(event.target.value);
              setError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                selectJersey();
              }
            }}
          />
        </label>
        {entryState.stage === "value" ? (
          <label>
            Pontos da camisa {entryState.jerseyNumber} (1, 2 ou 3)
            <input
              ref={pointsRef}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={1}
              value={pointsText}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "fast-scoring-error" : "fast-scoring-help"}
              onChange={(event) => {
                setPointsText(event.target.value);
                setError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitPoints();
                }
              }}
            />
          </label>
        ) : null}
        <div className="wizard-actions">
          <button
            className="button button-ghost"
            type="button"
            onClick={entryState.stage === "jersey" ? selectJersey : submitPoints}
          >
            {entryState.stage === "jersey" ? "Confirmar camisa" : "Registrar pontos"}
          </button>
          <button
            className="button button-ghost"
            type="button"
            onClick={undo}
            disabled={!history.length}
          >
            Desfazer último (Ctrl+Z)
          </button>
          <button className="button button-ghost" type="button" onClick={cancel}>
            Cancelar (Esc)
          </button>
        </div>
      </fieldset>
      <p className="admin-note" id="fast-scoring-help">
        Digite camisa, Enter, valor, Enter. Esc cancela; Ctrl+Z desfaz o último lançamento.
      </p>
      {error ? (
        <p role="alert" className="form-error" id="fast-scoring-error">
          {error}
        </p>
      ) : null}
      <p role="status" aria-live="polite" className="admin-note">
        {status}
      </p>
      <section aria-label="Últimos lançamentos">
        <h3>
          Últimos lançamentos ({history.length}/{historyLimit})
        </h3>
        {history.length ? (
          <ol>
            {history
              .slice()
              .reverse()
              .map((item) => (
                <li key={item.id}>
                  {item.side === "home" ? "Mandante" : "Visitante"},{" "}
                  {periodLabel(item.periodNumber)}, camisa {item.jerseyNumber}: +{item.points}
                </li>
              ))}
          </ol>
        ) : (
          <p>Nenhum lançamento nesta sessão.</p>
        )}
      </section>
      <h3>Grade para conferência e correções</h3>
      <p className="admin-note">Alterações diretas na grade limpam o histórico de desfazer.</p>
      {sides.map((value) => {
        const registration = registrations.find((item) => item.id === registrationIds[value]);
        return (
          <CompactScoresheetGrid
            key={value}
            side={value}
            teamName={registration?.teamName ?? (value === "home" ? "Mandante" : "Visitante")}
            slots={slots[value]}
            roster={registration?.roster ?? []}
            periodCount={4}
            periodNumber={periodNumber}
            stats={stats}
            semanticFouls={fouls}
            registrationId={registrationIds[value]}
            disqualificationFor={(_side, slotNumber) => {
              const slot = slots[value].find((slot) => slot.slotNumber === slotNumber);
              if (!slot) return null;
              const playerFouls = playerFoulsForDisqualification(
                stats,
                fouls,
                value,
                slot,
                registrationIds[value],
              );
              return playerFouls ? evaluateDisqualification(playerFouls) : null;
            }}
            onChange={(key, value) => {
              onChange(key, value);
              setHistory([]);
            }}
          />
        );
      })}
    </form>
  );
}
