import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.generated";
import type { ScoresheetRegistration } from "./editor";
import type { ManualScoresheetV2Payload } from "./domain";

// Server only: the client always uses the administrator's AAL2 session and RLS.
export async function loadRevisionRegistrations(
  client: SupabaseClient<Database>,
  competitionId: number,
  saved: ManualScoresheetV2Payload,
): Promise<ScoresheetRegistration[]> {
  const savedRegistrationIds = new Set(saved.teams.map((team) => team.registrationId));
  const savedRosterIds = new Set(
    saved.teams.flatMap((team) => team.slots.map((slot) => slot.rosterEntryId)),
  );
  const [registrations, teams, roster] = await Promise.all([
    client
      .from("team_registrations")
      .select("id,team_id,status")
      .eq("competition_id", competitionId),
    client.from("teams").select("id,name"),
    client
      .from("roster_entries")
      .select("id,registration_id,player_id,jersey_number,status")
      .eq("competition_id", competitionId),
  ]);
  if (registrations.error || teams.error || roster.error)
    throw new Error("Scoresheet revision context unavailable");
  // A saved lineup may contain athletes or registrations made inactive since the game.
  // Retain only those historical members, alongside presently eligible candidates.
  const candidates = roster.data.filter(
    (entry) => entry.status === "active" || savedRosterIds.has(entry.id),
  );
  const ids = [...new Set(candidates.map((entry) => entry.player_id))];
  const players = ids.length
    ? await client.from("players").select("id,full_name").in("id", ids)
    : { data: [], error: null };
  if (players.error) throw new Error("Scoresheet revision players unavailable");
  const names = new Map(players.data.map((entry) => [entry.id, entry.full_name]));
  const teamNames = new Map(teams.data.map((entry) => [entry.id, entry.name]));
  return registrations.data
    .filter((entry) => entry.status === "confirmed" || savedRegistrationIds.has(entry.id))
    .map((entry) => ({
      id: entry.id,
      teamName: teamNames.get(entry.team_id) ?? "Equipe indisponível",
      previous: [],
      roster: candidates
        .filter((player) => player.registration_id === entry.id)
        .map((player) => ({
          rosterEntryId: player.id,
          playerName: names.get(player.player_id) ?? "Atleta indisponível",
          jerseyNumber: player.jersey_number,
        })),
    }));
}
