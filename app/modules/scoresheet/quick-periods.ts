import { periodLabel, type TeamSide } from "./domain";

export const MAX_SCORESHEET_PERIODS = 12;

export function quickFoulPeriod(periodNumber: number): number {
  return Math.min(periodNumber, 4);
}

export function quickFoulPeriodLabel(periodNumber: number): string {
  return periodNumber >= 4 ? "Q4/OT" : periodLabel(periodNumber);
}

export function quickScoreBlockedByGd(periodNumber: number, gdPeriod: number): boolean {
  return quickFoulPeriod(periodNumber) > gdPeriod;
}

// Empty conversion counters mean zero in the editor. An unfinished non-empty
// counter cannot establish a tie and must be repaired before adding overtime.
export function quickScoreThroughPeriod(
  stats: Record<string, string>,
  throughPeriod: number,
): Record<TeamSide, number> | null {
  const totals = { home: 0, away: 0 };
  for (const [key, raw] of Object.entries(stats)) {
    const match = /^(home|away)-(1[0-2]|[1-9])-(1[0-2]|[1-9])-(two|three|free)$/.exec(key);
    if (!match || Number(match[3]) > throughPeriod) continue;
    const value = raw.trim();
    if (value && !/^(?:0|[1-9][0-9]?)$/.test(value)) return null;
    const side = match[1] as TeamSide;
    totals[side] += Number(value) * (match[4] === "two" ? 2 : match[4] === "three" ? 3 : 1);
  }
  return totals;
}

export function quickOvertimeEligibility(
  stats: Record<string, string>,
  periodCount: number,
  completedPeriods: number[],
) {
  // Recheck all preceding ties after corrections, preserving already-entered OT
  // data so an inconsistent draft can be repaired instead of being discarded.
  for (let period = 4; period <= periodCount; period += 1) {
    const score = quickScoreThroughPeriod(stats, period);
    if (!score) {
      return {
        canAdd: false,
        message: `Corrija a pontuação incompleta até ${periodLabel(period)} para liberar OT${period - 3}.`,
      };
    }
    if (score.home !== score.away) {
      return {
        canAdd: false,
        message: `OT${period - 3} exige empate no placar acumulado até ${periodLabel(period)} (${score.home} × ${score.away}).${period < periodCount ? " Os dados de OT foram preservados para correção." : ""}`,
      };
    }
    if (!completedPeriods.includes(period)) {
      return {
        canAdd: false,
        message: `Confirme ${periodLabel(period)} concluído para liberar OT${period - 3}.${period < periodCount ? " Os dados de OT foram preservados para conferência." : ""}`,
      };
    }
  }
  if (periodCount >= MAX_SCORESHEET_PERIODS) {
    return { canAdd: false, message: "Limite de oito prorrogações atingido." };
  }
  return {
    canAdd: true,
    message: `${periodLabel(periodCount)} concluído e placar acumulado empatado. OT${periodCount - 3} disponível.`,
  };
}
