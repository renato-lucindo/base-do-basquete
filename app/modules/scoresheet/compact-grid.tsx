import { useState, type KeyboardEvent } from "react";

import {
  calculatePoints,
  parseFoulCodes,
  type EditorSlot,
  type RosterCandidate,
  type SemanticFoulPayload,
  type TeamSide,
} from "./domain";
import {
  quickFoulPeriod,
  quickFoulPeriodLabel,
  quickPlayerGdIssue,
  quickScoreBlockedByGd,
} from "./quick-periods";

const compactFields = [
  ["two", "2P"],
  ["three", "3P"],
  ["free", "LL"],
  ["fouls", "Faltas"],
] as const;

interface CompactScoresheetGridProps {
  side: TeamSide;
  teamName: string;
  slots: EditorSlot[];
  roster: RosterCandidate[];
  periodCount: number;
  periodNumber: number;
  stats: Record<string, string>;
  semanticFouls?: SemanticFoulPayload[];
  registrationId?: number;
  disqualificationFor: (
    side: TeamSide,
    slotNumber: number,
  ) => { periodNumber: number; reason: string } | null;
  onChange: (key: string, value: string) => void;
}

function statKey(side: TeamSide, slotNumber: number, periodNumber: number, field: string) {
  return `${side}-${slotNumber}-${periodNumber}-${field}`;
}

export function CompactScoresheetGrid({
  side,
  teamName,
  slots,
  roster,
  periodCount,
  periodNumber,
  stats,
  semanticFouls,
  registrationId,
  disqualificationFor,
  onChange,
}: CompactScoresheetGridProps) {
  const [legacyErrors, setLegacyErrors] = useState<Record<string, string>>({});
  const active = slots.filter((slot) => slot.rosterEntryId !== null);
  const moveVertically = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const input = event.currentTarget;
    const column = input.dataset.gridColumn;
    const row = Number(input.dataset.gridRow);
    const direction = event.shiftKey ? -1 : 1;
    const target = document.querySelector<HTMLInputElement>(
      `[data-grid-side="${side}"][data-grid-column="${column}"][data-grid-row="${row + direction}"]`,
    );
    target?.focus();
    target?.select();
  };

  return (
    <section className="compact-grid-section">
      <header>
        <h2>{teamName}</h2>
        <span>
          Período em edição: {periodNumber <= 4 ? `Q${periodNumber}` : `OT${periodNumber - 4}`}
        </span>
      </header>
      <div className="compact-grid-scroll">
        <table className="compact-data-grid">
          <caption>Lançamentos compactos de {teamName}</caption>
          <thead>
            <tr>
              <th scope="col">Camisa</th>
              <th scope="col">Atleta</th>
              {compactFields.map(([, label]) => (
                <th scope="col" key={label}>
                  {label}
                </th>
              ))}
              <th scope="col">Total</th>
              <th scope="col">Situação</th>
            </tr>
          </thead>
          <tbody>
            {active.map((slot, rowIndex) => {
              const player = roster.find((item) => item.rosterEntryId === slot.rosterEntryId);
              const disqualification = disqualificationFor(side, slot.slotNumber);
              const locked = Boolean(
                disqualification &&
                  (semanticFouls
                    ? quickScoreBlockedByGd(periodNumber, disqualification.periodNumber)
                    : periodNumber > disqualification.periodNumber),
              );
              let total = 0;
              try {
                for (let period = 1; period <= periodCount; period += 1) {
                  total += calculatePoints(
                    Number(stats[statKey(side, slot.slotNumber, period, "two")] || 0),
                    Number(stats[statKey(side, slot.slotNumber, period, "three")] || 0),
                    Number(stats[statKey(side, slot.slotNumber, period, "free")] || 0),
                  );
                }
              } catch {
                total = Number.NaN;
              }
              return (
                <tr key={slot.slotNumber} data-locked={locked || undefined}>
                  <th scope="row">{slot.jerseyNumber || "—"}</th>
                  <td>{player?.playerName ?? "Atleta"}</td>
                  {compactFields.map(([field, label], columnIndex) => {
                    const fouls = field === "fouls";
                    const fieldPeriod =
                      fouls && semanticFouls ? quickFoulPeriod(periodNumber) : periodNumber;
                    const key = statKey(side, slot.slotNumber, fieldPeriod, field);
                    if (fouls && semanticFouls) {
                      const playerFouls = semanticFouls.filter(
                        (foul) =>
                          foul.target.kind === "player" &&
                          foul.target.registrationId === registrationId &&
                          foul.target.rosterEntryId === slot.rosterEntryId &&
                          foul.periodNumber === fieldPeriod,
                      );
                      const legacy = stats[key] ?? "";
                      const legacyIssue =
                        legacyErrors[key] ||
                        (parseFoulCodes(legacy) === null
                          ? "Revise os códigos legados, separados por vírgula (ex.: P,T)."
                          : "");
                      const invalidLegacy = Boolean(legacyIssue);
                      const errorId = `legacy-fouls-error-${side}-${slot.slotNumber}-${periodNumber}`;
                      const period = quickFoulPeriodLabel(periodNumber);
                      return (
                        <td key={field}>
                          <output
                            aria-label={`Faltas rápidas de ${player?.playerName} em ${period}`}
                          >
                            {playerFouls.map((foul) => foul.originalNotation).join(", ") || "—"}
                          </output>
                          <label>
                            <span className="sr-only">
                              Faltas legadas de {player?.playerName} em {period}
                            </span>
                            <input
                              aria-label={`Faltas legadas de ${player?.playerName} em ${period}`}
                              name={`stat-${key}`}
                              inputMode="text"
                              placeholder="P,T"
                              value={legacy}
                              aria-invalid={invalidLegacy || undefined}
                              aria-describedby={invalidLegacy ? errorId : undefined}
                              data-grid-side={side}
                              data-grid-row={rowIndex}
                              data-grid-column={columnIndex}
                              onKeyDown={moveVertically}
                              onChange={(event) => {
                                const value = event.currentTarget.value;
                                const issue = quickPlayerGdIssue(
                                  { ...stats, [key]: value },
                                  semanticFouls,
                                  side,
                                  slot,
                                  registrationId ?? 0,
                                );
                                setLegacyErrors((current) => ({ ...current, [key]: issue ?? "" }));
                                if (!issue) onChange(key, value);
                              }}
                            />
                          </label>
                          {invalidLegacy ? (
                            <span className="form-error" id={errorId} role="alert">
                              {legacyIssue}
                            </span>
                          ) : null}
                        </td>
                      );
                    }
                    return (
                      <td key={field}>
                        <label>
                          <span className="sr-only">
                            {label} de {player?.playerName}
                          </span>
                          <input
                            aria-label={`${label} de ${player?.playerName}`}
                            name={`stat-${key}`}
                            inputMode={fouls ? "text" : "numeric"}
                            pattern={fouls ? undefined : "(?:0|[1-9][0-9]?)"}
                            placeholder={fouls ? "P,T" : "0"}
                            value={stats[key] ?? (fouls ? "" : "0")}
                            disabled={locked}
                            data-grid-side={side}
                            data-grid-row={rowIndex}
                            data-grid-column={columnIndex}
                            onKeyDown={moveVertically}
                            onChange={(event) => onChange(key, event.currentTarget.value)}
                          />
                        </label>
                      </td>
                    );
                  })}
                  <td>
                    <strong>{Number.isFinite(total) ? total : "—"}</strong>
                  </td>
                  <td>
                    {disqualification
                      ? `GD ${disqualification.reason}`
                      : locked
                        ? "Bloqueado"
                        : "Ativo"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="admin-note">
        Enter avança para o próximo atleta na mesma coluna; Shift + Enter retorna.
      </p>
    </section>
  );
}
