export interface RosterMatchCandidate {
  playerId: number;
  rosterEntryId: number | null;
  registrationId: number | null;
  playerName: string;
  jerseyNumber: string | null;
  teamName: string | null;
}

export interface PlayerMatchAlternative extends RosterMatchCandidate {
  score: number;
}

export interface PlayerMatchSuggestion {
  sourceName: string;
  sourceJersey: string;
  kind: "exact" | "similar" | "unmatched";
  playerId: number | null;
  rosterEntryId: number | null;
  registrationId: number | null;
  score: number | null;
  alternatives: PlayerMatchAlternative[];
}

export function normalizePersonName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function levenshtein(left: string, right: string): number {
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0] as number;
    previous[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const upper = previous[rightIndex] as number;
      previous[rightIndex] = Math.min(
        (previous[rightIndex] as number) + 1,
        (previous[rightIndex - 1] as number) + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      diagonal = upper;
    }
  }
  return previous[right.length] as number;
}

export function nameSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizePersonName(left);
  const normalizedRight = normalizePersonName(right);
  const length = Math.max(normalizedLeft.length, normalizedRight.length);
  return length === 0 ? 1 : 1 - levenshtein(normalizedLeft, normalizedRight) / length;
}

export function suggestPlayerMatch(
  sourceName: string,
  sourceJersey: string,
  candidates: RosterMatchCandidate[],
): PlayerMatchSuggestion {
  const normalized = normalizePersonName(sourceName);
  const exact = candidates.filter(
    (candidate) => normalizePersonName(candidate.playerName) === normalized,
  );
  if (exact.length === 1) {
    const candidate = exact[0] as RosterMatchCandidate;
    return {
      sourceName,
      sourceJersey,
      kind: "exact",
      playerId: candidate.playerId,
      rosterEntryId: candidate.rosterEntryId,
      registrationId: candidate.registrationId,
      score: 1,
      alternatives: [{ ...candidate, score: 1 }],
    };
  }
  const ranked = candidates
    .map((candidate) => ({
      ...candidate,
      score: nameSimilarity(sourceName, candidate.playerName),
    }))
    .filter((candidate) => candidate.score >= 0.78)
    .sort((left, right) => {
      const scoreOrder = right.score - left.score;
      if (scoreOrder !== 0) return scoreOrder;
      const leftSameJersey = left.jerseyNumber === sourceJersey ? 1 : 0;
      const rightSameJersey = right.jerseyNumber === sourceJersey ? 1 : 0;
      return (
        rightSameJersey - leftSameJersey || left.playerName.localeCompare(right.playerName, "pt-BR")
      );
    })
    .slice(0, 3);
  return {
    sourceName,
    sourceJersey,
    kind: ranked.length ? "similar" : "unmatched",
    playerId: null,
    rosterEntryId: null,
    registrationId: null,
    score: ranked[0]?.score ?? null,
    alternatives: ranked,
  };
}
