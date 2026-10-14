import type { ImportedTeamPlayer } from "./team-import-domain";

export type ImportReviewStatus =
  | "Encontrado compatibilidade"
  | "Não encontrado - Criar novo jogador"
  | "Necessita confirmação";

export interface TeamImportReviewRow {
  imported: ImportedTeamPlayer;
  status: ImportReviewStatus;
  suggestedPlayerId: string | null;
  message: string;
}

export function buildTeamImportReview(
  players: ImportedTeamPlayer[],
  matches: Array<{ playerId: string | null; status: "COMPATIVEL" | "NOVO" | "AMBIGUO" | "CONFLITO" }>,
): TeamImportReviewRow[] {
  return players.map((imported, index) => {
    const match = matches[index];

    if (!match || match.status === "NOVO") {
      return {
        imported,
        status: "Não encontrado - Criar novo jogador",
        suggestedPlayerId: null,
        message: "Nenhum jogador compatível encontrado.",
      };
    }

    if (match.status === "COMPATIVEL") {
      return {
        imported,
        status: "Encontrado compatibilidade",
        suggestedPlayerId: match.playerId,
        message: "Jogador existente encontrado.",
      };
    }

    return {
      imported,
      status: "Necessita confirmação",
      suggestedPlayerId: match.playerId,
      message: "Existe mais de uma possibilidade de vínculo.",
    };
  });
}
