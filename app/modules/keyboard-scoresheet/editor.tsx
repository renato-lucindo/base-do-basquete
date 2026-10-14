import { useEffect, useRef, useState } from "react";
import {
  aggregate,
  change,
  type Entry,
  type History,
  parseFoul,
  periodColor,
  periodLabel,
  redo,
  type Sheet,
  type Side,
  undo,
  validateSheet,
} from "./domain";
import { SaveFailure, type SaveRequest, type SaveResult } from "./server";
import "./editor.css";

export interface KeyboardContext {
  gameId: number;
  title: string;
  teams: Record<Side, string>;
  candidates: Array<{
    rosterEntryId: number;
    registrationId: number;
    side: Side;
    jersey: string;
    name: string;
  }>;
  initial: Sheet;
  version: number;
  confirmed: boolean;
  requiresFallback: boolean;
}
export function KeyboardScoresheet({
  context,
  onSave,
}: {
  context: KeyboardContext;
  onSave: (request: SaveRequest) => Promise<SaveResult>;
}) {
  const [history, setHistory] = useState<History>({
    present: context.initial,
    past: [],
    future: [],
  });
  const [setup, setSetup] = useState(context.version === 0);
  const [side, setSide] = useState<Side>("home");
  const [period, setPeriod] = useState(1);
  const [mode, setMode] = useState<"points" | "fouls">("points");
  const [target, setTarget] = useState("");
  const [code, setCode] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Rascunho carregado");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(context.confirmed);
  const [recovery, setRecovery] = useState<Sheet | null>(null);
  const [recoveryRaw, setRecoveryRaw] = useState<string | null>(null);
  const [hydration, setHydration] = useState<"pending" | "decision" | "ready">("pending");
  const [busy, setBusy] = useState(false);
  const [setupErrorId, setSetupErrorId] = useState<number | null>(null);
  const [fieldError, setFieldError] = useState<"target" | "code" | "reason" | null>(null);
  const targetRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const version = useRef(context.version);
  const current = useRef(history.present);
  const saved = useRef(JSON.stringify(context.initial));
  const pending = useRef<SaveRequest | null>(null);
  const sending = useRef<Promise<void> | null>(null);
  const sheet = history.present;
  const totals = aggregate(sheet);
  const participationError = /Marque a participação de #(.+?) da equipe (A|B)/.exec(error);
  const periods = Array.from({ length: sheet.periods }, (_, index) => index + 1);
  const storageKey = `bdb:keyboard:v1:${context.gameId}`;
  const focus = () => targetRef.current?.focus();
  current.current = sheet;

  useEffect(() => {
    let stored: string | null;
    try {
      stored = localStorage.getItem(storageKey);
    } catch {
      setStatus("Armazenamento local indisponível; a versão do servidor permanece disponível.");
      setHydration("ready");
      return;
    }
    if (stored !== null) {
      setRecoveryRaw(stored);
      try {
        const copy = JSON.parse(stored) as { document: unknown };
        const document = validateSheet(copy.document);
        if (JSON.stringify(document) !== JSON.stringify(context.initial)) {
          setRecovery(document);
          setHydration("decision");
          return;
        }
      } catch {
        setStatus("Cópia local inválida. Exporte antes de optar pela versão do servidor.");
        setHydration("decision");
        return;
      }
    }
    setRecoveryRaw(null);
    setHydration("ready");
    if (!stored && context.version > 0) targetRef.current?.focus();
  }, [context.initial, context.version, storageKey]);

  function apply(next: Sheet) {
    try {
      // React may run state updaters during rendering, outside this catch.
      validateSheet(next);
      setHistory((h) => change(h, next));
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error && !("issues" in cause)
          ? cause.message
          : "Confira as camisas: use 0, 00 ou um número de 1 a 99, sem repetir na equipe.",
      );
    }
  }
  async function flush(confirm = false) {
    if (hydration !== "ready")
      throw new Error("Resolva a recuperação do rascunho antes de salvar.");
    const task = async () => {
      setBusy(true);
      try {
        // A failed request retains its identity and content for an exact retry.
        do {
          const document = current.current;
          if (!pending.current && !confirm && saved.current === JSON.stringify(document)) break;
          if (!pending.current)
            pending.current = {
              requestId: crypto.randomUUID(),
              baseVersion: version.current,
              document: validateSheet(document, confirm),
              confirm,
              reason: confirm ? reason : "",
            };
          const request = pending.current;
          setStatus("Salvando…");
          const result = await onSave(request);
          if (result.requestId !== request.requestId || result.version !== request.baseVersion + 1)
            throw new Error(
              "Resposta de salvamento inesperada. Recarregue após exportar sua cópia.",
            );
          version.current = result.version;
          saved.current = JSON.stringify(request.document);
          pending.current = null;
          if (result.confirmed) {
            setConfirmed(true);
            setStatus(
              context.requiresFallback
                ? "Fallback manual confirmado. A finalização e a publicação são etapas separadas."
                : "Súmula confirmada. Publique a edição para atualizar a área pública.",
            );
          } else setStatus("Rascunho salvo no servidor");
          if (request.confirm) break;
          if (confirm && request.document !== current.current) continue;
          if (confirm) continue;
        } while (saved.current !== JSON.stringify(current.current) || confirm);
      } catch (cause) {
        if (cause instanceof SaveFailure && [400, 403, 422].includes(cause.status))
          pending.current = null;
        throw cause;
      } finally {
        setBusy(false);
      }
    };
    const queued = (sending.current ?? Promise.resolve()).catch(() => {}).then(task);
    sending.current = queued;
    try {
      await queued;
    } finally {
      if (sending.current === queued) sending.current = null;
    }
  }
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    if (hydration !== "ready" || setup) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ document: sheet, baseVersion: version.current }),
      );
    } catch {
      setStatus("Armazenamento local indisponível; salvamento remoto ativo.");
    }
    const timer = setTimeout(() => {
      void flushRef.current().catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Falha ao salvar. Tente novamente.");
        setStatus("Alterações aguardando salvamento");
      });
    }, 180);
    return () => clearTimeout(timer);
  }, [sheet, storageKey, setup, hydration]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (
        hydration === "decision" ||
        saved.current !== JSON.stringify(current.current) ||
        pending.current
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [hydration]);

  function submitEntry() {
    if (editing && !sheet.events.some((event) => event.id === editing)) {
      setError("O lançamento foi removido. Cancele a edição e lance novamente.");
      setFieldError(null);
      return;
    }
    const normalized = code.trim().toUpperCase();
    if (
      !["B", "C"].includes(target) &&
      !sheet.roster.some((p) => p.side === side && p.jersey === target)
    ) {
      setError("Camisa não relacionada à equipe ativa.");
      setFieldError("target");
      focus();
      return;
    }
    if (
      mode === "points" && !["B", "C"].includes(target)
        ? !/^[123]$/.test(normalized)
        : !parseFoul(normalized, target)
    ) {
      setError("Ação inválida. Use 1, 2, 3 ou uma falta válida, como P2, Tc, B1, B2 ou C1.");
      setFieldError("code");
      codeRef.current?.focus();
      return;
    }
    const event: Entry = {
      id: editing ?? crypto.randomUUID(),
      side,
      period,
      target,
      code: normalized,
    };
    const next = {
      ...sheet,
      roster: sheet.roster.map((slot) =>
        slot.side === side && slot.jersey === target ? { ...slot, played: true } : slot,
      ),
      events: editing
        ? sheet.events.map((e) => (e.id === editing ? event : e))
        : [...sheet.events, event],
    };
    try {
      validateSheet(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Lançamento inválido.");
      setFieldError("code");
      return;
    }
    apply(next);
    setFieldError(null);
    setTarget("");
    setCode("");
    setEditing(null);
    focus();
  }
  function edit(event: Entry) {
    setSide(event.side);
    setPeriod(event.period);
    setTarget(event.target);
    setCode(event.code);
    setMode(/^[123]$/.test(event.code) ? "points" : "fouls");
    setEditing(event.id);
    focus();
  }
  function navigate(nextSide: Side, nextPeriod: number) {
    setSide(nextSide);
    setPeriod(Math.max(1, Math.min(sheet.periods, nextPeriod)));
    if (!editing) {
      setTarget("");
      setCode("");
    }
    focus();
  }
  function resolveRecovery(useLocal: boolean) {
    if (useLocal && !recovery) return;
    const document = useLocal && recovery ? recovery : context.initial;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ document, baseVersion: version.current }));
    } catch {
      setError(
        "Não foi possível registrar a escolha no armazenamento local. Exporte a cópia e tente novamente.",
      );
      return;
    }
    if (useLocal) {
      setHistory((h) => change(h, document));
      setSetup(false);
    }
    setRecovery(null);
    setRecoveryRaw(null);
    setHydration("ready");
  }
  function exportCopy() {
    const url = URL.createObjectURL(
      new Blob([recoveryRaw ?? JSON.stringify(current.current, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `sumula-${context.gameId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="keyboard-sheet" aria-label="Transcrição por teclado">
      <h1>{context.title} · Súmula por teclado</h1>
      <p>
        Transcreva a súmula após o jogo. Regras FIBA 2024 · P/T/U/D. Acertos de LL são registrados
        como 1 ponto; penalidades registram cobranças coletivas.
      </p>
      {hydration === "decision" && (
        <aside aria-label="Recuperação">
          <p>
            Existe uma cópia local diferente do servidor. Escolha qual continuar; exporte a cópia
            antes de descartá-la.
          </p>
          <button type="button" disabled={!recovery} onClick={() => resolveRecovery(true)}>
            Recuperar cópia local
          </button>
          <button type="button" onClick={() => resolveRecovery(false)}>
            Usar versão do servidor
          </button>
          <button type="button" onClick={exportCopy}>
            Exportar cópia
          </button>
        </aside>
      )}
      <p role="status">{status}</p>
      <div inert={hydration !== "ready"}>
        {!setup && (
          <p className="keyboard-sr-only" aria-live="polite" aria-atomic="true">
            Equipe {context.teams[side]}. {periodLabel(period)}. Modo{" "}
            {mode === "points" ? "pontos" : "faltas"}.
          </p>
        )}
        <details>
          <summary>Participação em quadra — conferir atletas sem pontos</summary>
          <p>
            Relacionar não significa jogar. Marque quem entrou em quadra, inclusive sem pontos ou
            faltas. Lançar uma ação marca participação automaticamente.
          </p>
          {sheet.roster.map((slot) => (
            <label key={slot.rosterEntryId}>
              <input
                type="checkbox"
                checked={slot.played}
                aria-invalid={Boolean(
                  participationError &&
                    participationError[1] === slot.jersey &&
                    participationError[2] === (slot.side === "home" ? "A" : "B"),
                )}
                aria-describedby={
                  participationError &&
                  participationError[1] === slot.jersey &&
                  participationError[2] === (slot.side === "home" ? "A" : "B")
                    ? "keyboard-error"
                    : undefined
                }
                onChange={(event) => {
                  const next = {
                    ...sheet,
                    roster: sheet.roster.map((s) =>
                      s.rosterEntryId === slot.rosterEntryId
                        ? { ...s, played: event.target.checked }
                        : s,
                    ),
                  };
                  if (setup) setHistory((h) => ({ ...h, present: next }));
                  else apply(next);
                }}
              />
              Participou: {context.teams[slot.side]} · #{slot.jersey} ·{" "}
              {context.candidates.find((c) => c.rosterEntryId === slot.rosterEntryId)?.name}
            </label>
          ))}
        </details>
        {error && (
          <p role="alert" id="keyboard-error">
            {error}
          </p>
        )}
        {setup ? (
          <>
            <h2>Relacionados do jogo</h2>
            <p>
              Confira quem está na súmula e as camisas usadas neste jogo. Até 12 atletas por equipe.
            </p>
            {(["home", "away"] as const).map((teamSide) => (
              <fieldset key={teamSide}>
                <legend>
                  Equipe {teamSide === "home" ? "A" : "B"} · {context.teams[teamSide]}
                </legend>
                {context.candidates
                  .filter((c) => c.side === teamSide)
                  .map((candidate) => {
                    const selected = sheet.roster.find(
                      (s) => s.rosterEntryId === candidate.rosterEntryId,
                    );
                    return (
                      <div className="keyboard-roster-row" key={candidate.rosterEntryId}>
                        <label>
                          <input
                            type="checkbox"
                            checked={Boolean(selected)}
                            onChange={(e) => {
                              const roster = e.target.checked
                                ? [
                                    ...sheet.roster,
                                    {
                                      rosterEntryId: candidate.rosterEntryId,
                                      registrationId: candidate.registrationId,
                                      side: candidate.side,
                                      jersey: candidate.jersey || "0",
                                      played: false,
                                    },
                                  ]
                                : sheet.roster.filter(
                                    (s) => s.rosterEntryId !== candidate.rosterEntryId,
                                  );
                              // Intermediate setup can be incomplete; full validation runs on continue and server save.
                              setHistory((h) => ({
                                ...h,
                                present: { ...h.present, roster },
                              }));
                            }}
                          />{" "}
                          {candidate.name}
                        </label>
                        {selected && (
                          <label>
                            Camisa de {candidate.name}
                            <input
                              id={`keyboard-roster-${candidate.rosterEntryId}`}
                              aria-invalid={setupErrorId === candidate.rosterEntryId}
                              aria-describedby={
                                setupErrorId === candidate.rosterEntryId
                                  ? "keyboard-error"
                                  : undefined
                              }
                              inputMode="numeric"
                              maxLength={2}
                              value={selected.jersey}
                              onChange={(e) => {
                                setSetupErrorId(null);
                                setError("");
                                setHistory((h) => ({
                                  ...h,
                                  present: {
                                    ...h.present,
                                    roster: h.present.roster.map((s) =>
                                      s.rosterEntryId === candidate.rosterEntryId
                                        ? { ...s, jersey: e.target.value }
                                        : s,
                                    ),
                                  },
                                }));
                              }}
                            />
                          </label>
                        )}
                      </div>
                    );
                  })}
                <label>
                  Atleta-treinador de {context.teams[teamSide]} (se houver)
                  <select
                    value={sheet.coachPlayer[teamSide] ?? ""}
                    onChange={(e) =>
                      setHistory((h) => ({
                        ...h,
                        present: {
                          ...h.present,
                          coachPlayer: {
                            ...h.present.coachPlayer,
                            [teamSide]: e.target.value ? Number(e.target.value) : null,
                          },
                        },
                      }))
                    }
                  >
                    <option value="">Nenhum</option>
                    {sheet.roster
                      .filter((s) => s.side === teamSide)
                      .map((s) => (
                        <option value={s.rosterEntryId} key={s.rosterEntryId}>
                          #{s.jersey} ·{" "}
                          {
                            context.candidates.find((c) => c.rosterEntryId === s.rosterEntryId)
                              ?.name
                          }
                        </option>
                      ))}
                  </select>
                </label>
              </fieldset>
            ))}
            <button
              type="button"
              onClick={() => {
                try {
                  validateSheet(sheet);
                  setSetup(false);
                  setError("");
                  setSetupErrorId(null);
                  setTimeout(focus, 0);
                } catch (cause) {
                  setError(
                    cause instanceof Error && !("issues" in cause)
                      ? cause.message
                      : "Confira as camisas: use 0, 00 ou um número de 1 a 99, sem repetir na equipe.",
                  );
                  const seen = new Set<string>();
                  const invalid = sheet.roster.find((s) => {
                    const key = `${s.side}:${s.jersey}`;
                    if (!/^(00|0|[1-9][0-9]?)$/.test(s.jersey) || seen.has(key)) return true;
                    seen.add(key);
                    return false;
                  });
                  if (invalid) {
                    setSetupErrorId(invalid.rosterEntryId);
                    document.getElementById(`keyboard-roster-${invalid.rosterEntryId}`)?.focus();
                  }
                }
              }}
            >
              Iniciar transcrição
            </button>
          </>
        ) : (
          <>
            <div className="keyboard-toolbar">
              {(["home", "away"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={side === s}
                  onClick={() => navigate(s, period)}
                >
                  Equipe {s === "home" ? "A" : "B"} · {context.teams[s]}
                </button>
              ))}
              <label>
                Período ativo
                <select
                  value={period}
                  onChange={(e) => {
                    setPeriod(Number(e.target.value));
                    focus();
                  }}
                >
                  {periods.map((periodNumber) => (
                    <option key={periodNumber} value={periodNumber}>
                      {periodLabel(periodNumber)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={sheet.periods >= 12}
                onClick={() => {
                  apply({ ...sheet, periods: sheet.periods + 1 });
                  navigate("home", sheet.periods + 1);
                  setPeriod(sheet.periods + 1);
                }}
              >
                Adicionar OT
              </button>
              {sheet.periods > 4 && (
                <button
                  type="button"
                  disabled={sheet.events.some((e) => e.period === sheet.periods)}
                  onClick={() => {
                    apply({ ...sheet, periods: sheet.periods - 1 });
                    setPeriod(Math.min(period, sheet.periods - 1));
                  }}
                >
                  Remover última OT vazia
                </button>
              )}
            </div>
            <form
              className="keyboard-entry"
              onSubmit={(e) => {
                e.preventDefault();
                submitEntry();
              }}
              onKeyDown={(e) => {
                if (e.repeat) {
                  if (e.key === "Enter") e.preventDefault();
                  return;
                }
                if (e.nativeEvent.isComposing) return;
                const input = e.target === targetRef.current || e.target === codeRef.current;
                if (!input) return;
                if (e.key === " ") {
                  e.preventDefault();
                  setMode((m) => (m === "points" ? "fouls" : "points"));
                  setCode("");
                  return;
                }
                if (e.key === "\\") {
                  e.preventDefault();
                  navigate(side === "home" ? "away" : "home", period);
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setEditing(null);
                  setTarget("");
                  setCode("");
                  focus();
                  return;
                }
                if (e.key === "F2") {
                  e.preventDefault();
                  const last = sheet.events.at(-1);
                  if (last) edit(last);
                  return;
                }
                if (
                  e.target === targetRef.current &&
                  !target &&
                  ["ArrowLeft", "ArrowRight"].includes(e.key)
                ) {
                  e.preventDefault();
                  navigate(side, period + (e.key === "ArrowRight" ? 1 : -1));
                }
              }}
            >
              <h2>
                {editing ? "Editar lançamento" : "Lançamento"} · {context.teams[side]} ·{" "}
                {periodLabel(period)}
              </h2>
              <button
                type="button"
                aria-pressed={mode === "fouls"}
                onClick={() => {
                  setMode((m) => (m === "points" ? "fouls" : "points"));
                  setCode("");
                  focus();
                }}
              >
                Modo: {mode === "points" ? "Pontos" : "Faltas"} · Espaço
              </button>
              <label>
                Camisa, B ou C
                <input
                  ref={targetRef}
                  autoComplete="off"
                  inputMode="text"
                  value={target}
                  maxLength={2}
                  aria-describedby={
                    fieldError === "target" ? "keyboard-error keyboard-help" : "keyboard-help"
                  }
                  aria-invalid={fieldError === "target"}
                  onChange={(e) => {
                    setTarget(e.target.value.toUpperCase());
                    setFieldError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
                    e.preventDefault();
                    if (e.repeat) return;
                    if (
                      !["B", "C"].includes(target) &&
                      !sheet.roster.some((s) => s.side === side && s.jersey === target)
                    ) {
                      setError("Camisa não relacionada à equipe ativa.");
                      setFieldError("target");
                      return;
                    }
                    setError("");
                    setFieldError(null);
                    if (target === "B" || target === "C") setCode(`${target}1`);
                    codeRef.current?.focus();
                    codeRef.current?.select();
                  }}
                />
              </label>
              <label>
                {mode === "points" && !["B", "C"].includes(target)
                  ? "Cesta: 1, 2 ou 3"
                  : "Falta e penalidade"}
                <input
                  ref={codeRef}
                  autoComplete="off"
                  value={code}
                  maxLength={3}
                  aria-describedby={
                    fieldError === "code" ? "keyboard-error keyboard-help" : "keyboard-help"
                  }
                  aria-invalid={fieldError === "code"}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setFieldError(null);
                  }}
                />
              </label>
              <button type="submit">{editing ? "Aplicar correção" : "Lançar"}</button>
            </form>
            <p id="keyboard-help">
              Enter: camisa → ação → lançar. Espaço: pontos/faltas. \: equipe. ←/→ no campo de
              camisa vazio: período. F2: editar último. Ctrl+Z/Ctrl+Y: edição nativa do campo;
              botões Desfazer e Refazer: histórico da súmula. Esc: cancelar edição. B/C funcionam
              nos dois modos.
            </p>
            <p>
              P/P1/P2/P3/Pc · T1/Tc · U/U1/U2/U3/Uc · D/D1/D2/D3/Dc · B1/Bc (técnica de banco), B2
              (penalidade por desqualificação no banco) · C1/Cc (técnico), D2 no alvo C
              (desqualificação direta do técnico). “c”: compensada, sem LL; continua contando como
              falta.
            </p>
            <div className="keyboard-toolbar">
              <button
                type="button"
                disabled={!history.past.length}
                onClick={() => {
                  setHistory(undo);
                  setEditing(null);
                  setTarget("");
                  setCode("");
                  focus();
                }}
              >
                Desfazer
              </button>
              <button
                type="button"
                disabled={!history.future.length}
                onClick={() => {
                  setHistory(redo);
                  setEditing(null);
                  setTarget("");
                  setCode("");
                  focus();
                }}
              >
                Refazer
              </button>
              <button
                type="button"
                onClick={() => {
                  void flush().catch((cause) => setError(String(cause)));
                }}
              >
                Salvar / tentar novamente
              </button>
              <button type="button" onClick={exportCopy}>
                Exportar cópia
              </button>
            </div>
            <h2>Conferência</h2>
            {/* biome-ignore lint/a11y/noNoninteractiveTabindex: horizontal overflow must be keyboard-scrollable, verified with axe at 390px. */}
            <section className="keyboard-table-scroll" aria-label="Placar por período" tabIndex={0}>
              <table>
                <caption>Placar por equipe e período</caption>
                <thead>
                  <tr>
                    <th>Equipe</th>
                    {periods.map((periodNumber) => (
                      <th key={periodNumber}>{periodLabel(periodNumber)}</th>
                    ))}
                    <th>Total</th>
                    <th>LL cobrados</th>
                    <th>LL cedidos</th>
                    <th>LL convertidos</th>
                    <th>Técnico</th>
                  </tr>
                </thead>
                <tbody>
                  {(["home", "away"] as const).map((s) => (
                    <tr key={s}>
                      <th>{context.teams[s]}</th>
                      {periods.map((periodNumber) => (
                        <td key={periodNumber} className={`period-${periodColor(periodNumber)}`}>
                          {totals.teams[s].periods[periodNumber - 1]}
                        </td>
                      ))}
                      <td>{totals.teams[s].points}</td>
                      <td>{totals.teams[s].freeTaken}</td>
                      <td>{totals.teams[s].freeConceded}</td>
                      <td>{totals.teams[s].freeMade}</td>
                      <td>{totals.teams[s].coachStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section
              className="keyboard-table-scroll"
              aria-label="Estatísticas dos atletas"
              // biome-ignore lint/a11y/noNoninteractiveTabindex: focus enables horizontal keyboard scrolling.
              tabIndex={0}
            >
              <table>
                <caption>Estatísticas individuais</caption>
                <thead>
                  <tr>
                    <th>Equipe</th>
                    <th>Atleta</th>
                    <th>2P</th>
                    <th>3P</th>
                    <th>LL</th>
                    <th>Pontos</th>
                    <th>Faltas</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {totals.players.map((p) => (
                    <tr key={p.rosterEntryId}>
                      <td>{context.teams[p.side]}</td>
                      <th>
                        #{p.jersey} ·{" "}
                        {context.candidates.find((c) => c.rosterEntryId === p.rosterEntryId)?.name}
                      </th>
                      <td>{p.two}</td>
                      <td>{p.three}</td>
                      <td>{p.free}</td>
                      <td>{p.points}</td>
                      <td>{p.fouls}</td>
                      <td>
                        {p.status === "eligible"
                          ? "Apto"
                          : p.status === "excluded"
                            ? "Excluído: 5 faltas"
                            : `Desqualificado: ${p.status}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <h2>Histórico / visualização da súmula</h2>
            <ol className="keyboard-history">
              {sheet.events.map((event, index) => (
                <li key={event.id} className={`period-${periodColor(event.period)}`}>
                  <span>
                    {index + 1}. {periodLabel(event.period)} · {context.teams[event.side]} ·{" "}
                    {event.target === "B"
                      ? "Banco"
                      : event.target === "C"
                        ? "Técnico"
                        : `#${event.target}`}{" "}
                    · {event.code}
                  </span>
                  <button
                    type="button"
                    aria-label={`Editar lançamento ${index + 1}`}
                    onClick={() => edit(event)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    aria-label={`Excluir lançamento ${index + 1}`}
                    onClick={() => {
                      apply({
                        ...sheet,
                        events: sheet.events.filter((e) => e.id !== event.id),
                      });
                      focus();
                    }}
                  >
                    Excluir
                  </button>
                </li>
              ))}
            </ol>
            <fieldset>
              <legend>{confirmed ? "Confirmar revisão" : "Confirmar súmula"}</legend>
              <p>
                O rascunho salva automaticamente. A confirmação substitui os totais deste jogo em
                uma transação. A publicação da edição é uma ação separada.
              </p>
              {(confirmed || context.requiresFallback) && (
                <label>
                  {confirmed ? "Motivo da correção" : "Motivo do fallback emergencial"}
                  <textarea
                    ref={reasonRef}
                    value={reason}
                    minLength={10}
                    maxLength={500}
                    aria-invalid={fieldError === "reason"}
                    aria-describedby={fieldError === "reason" ? "keyboard-error" : undefined}
                    onChange={(e) => {
                      setReason(e.target.value);
                      setFieldError(null);
                    }}
                  />
                </label>
              )}
              <button
                type="button"
                disabled={busy || hydration !== "ready"}
                onClick={() => {
                  if ((confirmed || context.requiresFallback) && reason.trim().length < 10) {
                    setError(
                      confirmed
                        ? "Informe um motivo da correção com pelo menos 10 caracteres."
                        : "Informe um motivo do fallback emergencial com pelo menos 10 caracteres.",
                    );
                    setFieldError("reason");
                    reasonRef.current?.focus();
                    return;
                  }
                  void flush(true).catch((cause) =>
                    setError(
                      cause instanceof Error ? cause.message : "Não foi possível confirmar.",
                    ),
                  );
                }}
              >
                Revisar totais e confirmar
              </button>
            </fieldset>
          </>
        )}
      </div>
    </section>
  );
}
