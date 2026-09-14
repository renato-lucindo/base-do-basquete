export interface AdminPlayerSearchResult {
  id: number;
  fullName: string;
  nickname: string | null;
  currentTeamName: string | null;
  editionJersey: string | null;
  conflict: { registrationId: number; teamName: string } | null;
}

export function normalizeAdminPlayerName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function sortAdminPlayers(
  players: AdminPlayerSearchResult[],
  selectedIds: ReadonlySet<number>,
): AdminPlayerSearchResult[] {
  return [...players].sort(
    (left, right) =>
      Number(selectedIds.has(right.id)) - Number(selectedIds.has(left.id)) ||
      left.fullName.localeCompare(right.fullName, "pt-BR") ||
      left.id - right.id,
  );
}
