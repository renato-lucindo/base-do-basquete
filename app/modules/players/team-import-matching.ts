export type PlayerMatchStatus =
  | "NOVO"
  | "COMPATIVEL"
  | "AMBIGUO"
  | "CONFLITO";

export interface ExistingPlayerCandidate {
  id: string;
  name: string;
  federationRegistration?: string | null;
}

export interface ImportedPlayerForMatch {
  name: string;
  federationRegistration?: string | null;
}

export interface PlayerMatchResult {
  status: PlayerMatchStatus;
  player: ImportedPlayerForMatch;
  candidates: ExistingPlayerCandidate[];
}

export function matchImportedPlayer(
  player: ImportedPlayerForMatch,
  existingPlayers: ExistingPlayerCandidate[],
): PlayerMatchResult {
  if (player.federationRegistration) {
    const byRegistration = existingPlayers.filter(
      (candidate) =>
        candidate.federationRegistration === player.federationRegistration,
    );

    if (byRegistration.length === 1) {
      return { status: "COMPATIVEL", player, candidates: byRegistration };
    }
  }

  const byName = existingPlayers.filter(
    (candidate) => normalize(candidate.name) === normalize(player.name),
  );

  if (byName.length === 1) {
    return { status: "COMPATIVEL", player, candidates: byName };
  }

  if (byName.length > 1) {
    return { status: "AMBIGUO", player, candidates: byName };
  }

  const similar = existingPlayers.filter((candidate) =>
    hasSimilarName(candidate.name, player.name),
  );

  return {
    status: similar.length ? "CONFLITO" : "NOVO",
    player,
    candidates: similar,
  };
}

function hasSimilarName(left: string, right: string): boolean {
  const a = normalize(left);
  const b = normalize(right);
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  return editDistance(a, b) <= 2;
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      previous = current;
    }
  }
  return row[b.length];
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
