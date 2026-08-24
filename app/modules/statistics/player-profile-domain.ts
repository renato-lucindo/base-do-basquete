export interface PlayerTotals {
  games: number;
  points: number;
  assists: number;
  rebounds: number;
  steals: number;
  blocks: number;
}

export function perGame(total: number, games: number): number | null {
  return games === 0 ? null : Math.round((total / games) * 10) / 10;
}

export function addPlayerTotals(rows: PlayerTotals[]): PlayerTotals {
  return rows.reduce(
    (total, row) => ({
      games: total.games + row.games,
      points: total.points + row.points,
      assists: total.assists + row.assists,
      rebounds: total.rebounds + row.rebounds,
      steals: total.steals + row.steals,
      blocks: total.blocks + row.blocks,
    }),
    { games: 0, points: 0, assists: 0, rebounds: 0, steals: 0, blocks: 0 },
  );
}

export function publicProfileValue(value: string | number | null): string {
  if (value === null || value === "") return "Não informado";
  return String(value);
}
