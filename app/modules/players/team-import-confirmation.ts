import type { ImportedTeamPlayer } from "./team-import-domain";

export type ImportDecision = "existing" | "create";

export type ConfirmedImportPlayer = {
  player: ImportedTeamPlayer;
  decision: ImportDecision;
  existingPlayerId?: number;
  correctedName?: string;
};

export function buildImportConfirmation(
  players: ImportedTeamPlayer[],
  decisions: Record<number, ConfirmedImportPlayer["decision"] | { decision: ImportDecision; existingPlayerId?: number; correctedName?: string }>,
): ConfirmedImportPlayer[] {
  return players.map((player, index) => ({
    player,
    ...(typeof decisions[index] === "object"
      ? decisions[index]
      : { decision: decisions[index] ?? "create" }),
  }));
}
