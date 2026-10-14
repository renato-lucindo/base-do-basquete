import type { ParsedBoxscore } from "./types";

export interface TeamRegistrationCandidate {
  abbreviation: string | null;
  publicName: string | null;
  teamId: number;
  teamName: string;
}

function normalizeTeam(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function matchingRegistrationCandidates<T extends TeamRegistrationCandidate>(
  sourceTeam: ParsedBoxscore["teams"][number],
  candidates: T[],
): T[] {
  const sourceName = normalizeTeam(sourceTeam.name);
  const publicNameMatches = candidates.filter(
    (candidate) => candidate.publicName && normalizeTeam(candidate.publicName) === sourceName,
  );
  if (publicNameMatches.length) return publicNameMatches;

  const globalNameMatches = candidates.filter(
    (candidate) => normalizeTeam(candidate.teamName) === sourceName,
  );
  if (globalNameMatches.length) return globalNameMatches;

  const abbreviation = sourceTeam.abbreviation.toUpperCase();
  return candidates.filter((candidate) => candidate.abbreviation?.toUpperCase() === abbreviation);
}

export function uniqueRegistrationCandidate<T extends TeamRegistrationCandidate>(
  sourceTeam: ParsedBoxscore["teams"][number],
  candidates: T[],
): T | undefined {
  const matches = matchingRegistrationCandidates(sourceTeam, candidates);
  return matches.length === 1 ? matches[0] : undefined;
}
