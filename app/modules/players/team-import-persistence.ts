import type { ConfirmedImportPlayer } from "./team-import-confirmation";

export type PlayerImportAction =
  | { type: "create"; name: string; birthDate?: string | null }
  | { type: "link"; playerId: number; name: string; jerseyNumber: string | null };

export function createPersistencePlan(
  players: ConfirmedImportPlayer[],
): PlayerImportAction[] {
  return players.map(({ player, decision, existingPlayerId }) =>
    decision === "existing" && existingPlayerId
      ? { type: "link", playerId: existingPlayerId, name: player.name, jerseyNumber: player.jerseyNumber }
      : { type: "create", name: player.name, birthDate: player.birthDate },
  );
}

export type PersistenceAdapter = {
  insertPlayer(input: { fullName: string; birthDate?: string | null }): Promise<number>;
  insertRosterEntry(input: {
    playerId: number;
    registrationId: number;
    competitionId: number;
    jerseyNumber: string | null;
  }): Promise<void>;
};

export async function persistImport(
  adapter: PersistenceAdapter,
  actions: PlayerImportAction[],
  context: { registrationId: number; competitionId: number },
) {
  for (const action of actions) {
    const playerId = action.type === "create"
      ? await adapter.insertPlayer({ fullName: action.name, birthDate: action.birthDate })
      : action.playerId;

    await adapter.insertRosterEntry({
      playerId,
      registrationId: context.registrationId,
      competitionId: context.competitionId,
      jerseyNumber: action.type === "link" ? action.jerseyNumber : null,
    });
  }
}
