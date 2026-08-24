export interface RosterMatchCandidate {
  rosterEntryId: number;
  playerName: string;
  jerseyNumber: string | null;
}

export interface PlayerMatchSuggestion {
  sourceName: string;
  sourceJersey: string;
  kind: "exact" | "similar" | "unmatched";
  rosterEntryId: number | null;
  score: number | null;
  alternatives: Array<{ rosterEntryId: number; playerName: string; score: number }>;
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
      rosterEntryId: candidate.rosterEntryId,
      score: 1,
      alternatives: [
        { rosterEntryId: candidate.rosterEntryId, playerName: candidate.playerName, score: 1 },
      ],
    };
  }
  const ranked = candidates
    .map((candidate) => ({
      rosterEntryId: candidate.rosterEntryId,
      playerName: candidate.playerName,
      score: nameSimilarity(sourceName, candidate.playerName),
    }))
    .filter((candidate) => candidate.score >= 0.78)
    .sort(
      (left, right) =>
        right.score - left.score || left.playerName.localeCompare(right.playerName, "pt-BR"),
    )
    .slice(0, 3);
  return {
    sourceName,
    sourceJersey,
    kind: ranked.length ? "similar" : "unmatched",
    rosterEntryId: ranked[0]?.rosterEntryId ?? null,
    score: ranked[0]?.score ?? null,
    alternatives: ranked,
  };
}
