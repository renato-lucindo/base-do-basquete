import { data, Link, redirect } from "react-router";
import { cloudflareContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import type { Route } from "./+types/admin.competitions.$competitionId.scoresheets.new";

function parseId(value: string | undefined) {
  if (!value || !/^[1-9][0-9]*$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

export interface ScoresheetUnavailableIssue {
  action: "hub" | "schedule";
  message: string;
}

export function describeScoresheetUnavailability({
  hasStructuralGames,
  hasMinimumConfirmedRegistrations,
  hasMinimumRegistrationsWithRoster,
  hasIncompleteParticipants,
  hasUnconfirmedParticipant,
  hasParticipantWithoutRoster,
}: {
  hasStructuralGames: boolean;
  hasMinimumConfirmedRegistrations: boolean;
  hasMinimumRegistrationsWithRoster: boolean;
  hasIncompleteParticipants: boolean;
  hasUnconfirmedParticipant: boolean;
  hasParticipantWithoutRoster: boolean;
}): ScoresheetUnavailableIssue {
  if (!hasMinimumConfirmedRegistrations) {
    return {
      action: "hub",
      message: "Confirme pelo menos duas equipes antes de preencher uma súmula.",
    };
  }
  if (!hasMinimumRegistrationsWithRoster) {
    return {
      action: "hub",
      message: "Adicione atletas ao elenco de pelo menos duas equipes confirmadas.",
    };
  }
  if (!hasStructuralGames) {
    return {
      action: "schedule",
      message: "Organize um confronto na agenda antes de preencher a súmula.",
    };
  }
  if (hasUnconfirmedParticipant) {
    return {
      action: "hub",
      message: "Confirme as equipes do confronto antes de preencher a súmula.",
    };
  }
  if (hasParticipantWithoutRoster) {
    return { action: "hub", message: "Adicione atletas aos elencos das equipes do confronto." };
  }
  return {
    action: "schedule",
    message: hasIncompleteParticipants
      ? "Defina mandante e visitante para o confronto na agenda."
      : "Revise na agenda as equipes e o confronto dos jogos que ainda estão em andamento.",
  };
}

export function meta() {
  return [{ title: "Transcrever súmula por teclado — Base do Basquete" }];
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const competitionId = parseId(params.competitionId);
  if (!competitionId) throw new Response("Edição não encontrada", { status: 404 });
  const auth = await requireAdminAal2(request, context.get(cloudflareContext).env);
  const competitionResult = await auth.client
    .from("competitions")
    .select("id,display_name,status,data_profile_id")
    .eq("id", competitionId)
    .limit(1);
  if (competitionResult.error) throw new Error("Scoresheet competition query failed");
  const competition = competitionResult.data[0];
  if (!competition || competition.status === "archived") {
    throw new Response("Edição indisponível", { status: 404 });
  }

  const [registrationsResult, rosterResult, gamesResult, teamsResult] = await Promise.all([
    auth.client
      .from("team_registrations")
      .select("id,team_id")
      .eq("competition_id", competitionId)
      .eq("status", "confirmed")
      .order("id"),
    auth.client
      .from("roster_entries")
      .select("registration_id")
      .eq("competition_id", competitionId)
      .eq("status", "active")
      .order("registration_id"),
    auth.client
      .from("games")
      .select("id,game_number,matchup_id,status")
      .eq("competition_id", competitionId)
      .order("id"),
    auth.client.from("teams").select("id,name").order("name"),
  ]);
  if (registrationsResult.error || rosterResult.error || gamesResult.error || teamsResult.error) {
    throw new Error("Scoresheet eligibility query failed");
  }

  const gameIds = gamesResult.data.map((game) => game.id);
  const [participantsResult, savedResult, profileResult] = await Promise.all([
    gameIds.length
      ? auth.client
          .from("game_participants")
          .select("game_id,registration_id,side")
          .in("game_id", gameIds)
      : Promise.resolve({ data: [], error: null }),
    gameIds.length
      ? auth.client.from("keyboard_scoresheets").select("game_id").in("game_id", gameIds)
      : Promise.resolve({ data: [], error: null }),
    competition.data_profile_id
      ? auth.client
          .from("series_category_data_profiles")
          .select("primary_source")
          .eq("id", competition.data_profile_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (participantsResult.error || profileResult.error) {
    throw new Error("Scoresheet participants/profile query failed");
  }
  const migrationPending = Boolean(savedResult.error);
  const fallbackProfile = profileResult.data?.primary_source === "fiba_boxscore";
  const confirmed = new Map(registrationsResult.data.map((entry) => [entry.id, entry.team_id]));
  const rostered = new Set(rosterResult.data.map((entry) => entry.registration_id));
  const teamNames = new Map(teamsResult.data.map((team) => [team.id, team.name]));
  const savedIds = new Set((savedResult.data ?? []).map((entry) => entry.game_id));
  const eligible = gamesResult.data.flatMap((game) => {
    const participants = participantsResult.data.filter((part) => part.game_id === game.id);
    const home = participants.find((part) => part.side === "home");
    const away = participants.find((part) => part.side === "away");
    if (!home || !away || !game.matchup_id || home.registration_id === away.registration_id)
      return [];
    const homeTeamId = confirmed.get(home.registration_id);
    const awayTeamId = confirmed.get(away.registration_id);
    if (homeTeamId === undefined || awayTeamId === undefined) return [];
    if (!rostered.has(home.registration_id) || !rostered.has(away.registration_id)) return [];
    if (!savedIds.has(game.id) && !["draft", "scheduled", "live"].includes(game.status)) return [];
    return [
      {
        id: game.id,
        number: game.game_number,
        homeName: teamNames.get(homeTeamId) ?? "Mandante",
        awayName: teamNames.get(awayTeamId) ?? "Visitante",
        saved: savedIds.has(game.id),
      },
    ];
  });
  const unavailableIssue = eligible.length
    ? null
    : describeScoresheetUnavailability({
        hasStructuralGames: gamesResult.data.length > 0,
        hasMinimumConfirmedRegistrations: confirmed.size >= 2,
        hasMinimumRegistrationsWithRoster:
          [...confirmed.keys()].filter((id) => rostered.has(id)).length >= 2,
        hasIncompleteParticipants: gamesResult.data.some((game) => {
          const parts = participantsResult.data.filter((part) => part.game_id === game.id);
          return (
            !parts.some((part) => part.side === "home") ||
            !parts.some((part) => part.side === "away")
          );
        }),
        hasUnconfirmedParticipant: participantsResult.data.some(
          (part) => !confirmed.has(part.registration_id),
        ),
        hasParticipantWithoutRoster: participantsResult.data.some(
          (part) => confirmed.has(part.registration_id) && !rostered.has(part.registration_id),
        ),
      });
  const responseHeaders = auth.cookie ? { "Set-Cookie": auth.cookie } : undefined;
  if (eligible.length === 1 && eligible[0] && !migrationPending && !fallbackProfile) {
    throw redirect(`/admin/games/${eligible[0].id}/scoresheet/keyboard`, {
      headers: responseHeaders,
    });
  }
  return data(
    {
      competitionId,
      competitionName: competition.display_name,
      games: eligible,
      unavailableIssue,
      migrationPending,
      fallbackProfile,
    },
    { headers: responseHeaders },
  );
}

export function ScoresheetUnavailableState({
  competitionId,
  issue,
  requiresFallbackReason,
}: {
  competitionId: number;
  issue: ScoresheetUnavailableIssue;
  requiresFallbackReason: boolean;
}) {
  const hub = `/admin/competitions/${competitionId}`;
  const action = issue.action === "schedule" ? `${hub}/schedule` : hub;
  return (
    <section className="admin-welcome">
      <h2>Nenhum jogo disponível</h2>
      <p>{issue.message}</p>
      {requiresFallbackReason ? (
        <p>Esta edição exige a origem principal de boxscore. Consulte a configuração da edição.</p>
      ) : null}
      <Link className="button button-primary" to={action}>
        {issue.action === "schedule" ? "Abrir agenda" : "Revisar equipes e elencos"}
      </Link>
    </section>
  );
}

export default function NewManualScoresheet({ loaderData }: Route.ComponentProps) {
  return (
    <main className="admin-shell">
      <header className="site-header admin-header">
        <Link className="brand" to={`/admin/competitions/${loaderData.competitionId}`}>
          <span className="brand-mark">B</span>
          <span>Voltar ao campeonato</span>
        </Link>
      </header>
      <section className="admin-welcome" aria-labelledby="keyboard-entry-title">
        <p className="eyebrow">Súmula manual</p>
        <h1 id="keyboard-entry-title">Transcrever súmula por teclado</h1>
        <p>
          {loaderData.competitionName} — selecione o jogo para registrar pontos e faltas usando
          camisa e valor.
        </p>
        <p>Camisa → Enter → ponto ou falta → Enter. Espaço alterna pontos e faltas.</p>
      </section>
      {loaderData.migrationPending ? (
        <section className="admin-welcome" role="alert">
          <h2>Gravação por teclado indisponível neste ambiente</h2>
          <p>
            A migration do módulo ainda precisa ser aplicada ao banco de preview. Seus lançamentos
            não serão iniciados sem persistência segura.
          </p>
        </section>
      ) : loaderData.fallbackProfile ? (
        <section className="admin-welcome" role="alert">
          <h2>Edição com boxscore como fonte principal</h2>
          <p>Revise a origem de dados da edição antes de iniciar a transcrição por teclado.</p>
        </section>
      ) : loaderData.games.length ? (
        <section className="admin-welcome" aria-label="Selecionar jogo para transcrição">
          <h2>Escolha o jogo</h2>
          <ul>
            {loaderData.games.map((game) => (
              <li key={game.id}>
                <Link
                  className="button button-primary"
                  to={`/admin/games/${game.id}/scoresheet/keyboard`}
                >
                  Jogo {game.number ?? game.id} · {game.homeName} × {game.awayName} ·{" "}
                  {game.saved ? "Retomar ou corrigir" : "Lançar súmula"}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : loaderData.unavailableIssue ? (
        <ScoresheetUnavailableState
          competitionId={loaderData.competitionId}
          issue={loaderData.unavailableIssue}
          requiresFallbackReason={loaderData.fallbackProfile}
        />
      ) : null}
    </main>
  );
}
