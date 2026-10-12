import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.generated";
import { loadRevisionRegistrations } from "./revision-context.server";
import { savedFixture } from "./setup-revision.fixture";

describe("saved scoresheet roster context", () => {
  it("preserves historical inactive athletes and teams without offering unrelated inactive athletes", async () => {
    const saved = savedFixture();
    const rows = {
      team_registrations: [
        { id: 10, team_id: 100, status: "withdrawn" },
        { id: 20, team_id: 200, status: "confirmed" },
      ],
      teams: [
        { id: 100, name: "Casa" },
        { id: 200, name: "Fora" },
      ],
      roster_entries: [
        { id: 11, registration_id: 10, player_id: 1, jersey_number: "00", status: "inactive" },
        { id: 12, registration_id: 10, player_id: 2, jersey_number: "3", status: "inactive" },
        { id: 13, registration_id: 10, player_id: 3, jersey_number: "4", status: "active" },
        { id: 21, registration_id: 20, player_id: 4, jersey_number: "7", status: "active" },
      ],
      players: [
        { id: 1, full_name: "Histórica" },
        { id: 3, full_name: "Atual" },
        { id: 4, full_name: "Visitante" },
      ],
    };
    const requestedPlayers: number[][] = [];
    const client = {
      from(table: keyof typeof rows) {
        let playerIds: number[] | null = null;
        const query = {
          select: () => query,
          eq: () => query,
          in: (_column: string, ids: number[]) => {
            playerIds = ids;
            requestedPlayers.push(ids);
            return query;
          },
          // biome-ignore lint/suspicious/noThenProperty: Mimics the Supabase thenable builder.
          then: (resolve: (value: unknown) => void) =>
            Promise.resolve({
              data:
                table === "players" && playerIds !== null
                  ? rows[table].filter((row) => playerIds!.includes(row.id))
                  : rows[table],
              error: null,
            }).then(resolve),
        };
        return query;
      },
    } as unknown as SupabaseClient<Database>;

    const result = await loadRevisionRegistrations(client, 100, saved);
    expect(result.find((item) => item.id === 10)?.roster).toEqual([
      { rosterEntryId: 11, playerName: "Histórica", jerseyNumber: "00" },
      { rosterEntryId: 13, playerName: "Atual", jerseyNumber: "4" },
    ]);
    expect(requestedPlayers).toEqual([[1, 3, 4]]);
  });
});
