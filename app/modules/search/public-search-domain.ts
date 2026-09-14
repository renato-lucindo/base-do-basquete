import type { CompetitionContext } from "../competition/context";

export const PUBLIC_SEARCH_MIN_LENGTH = 2;
export const PUBLIC_SEARCH_MAX_QUERY_LENGTH = 80;
export const PUBLIC_SEARCH_LIMIT = 12;

export interface SearchPlayer {
  id: number;
  name: string;
  nickname: string | null;
  slug: string;
  teamName: string | null;
  isPublic: boolean;
  context?: CompetitionContext;
}

export interface SearchTeam {
  id: number;
  name: string;
  abbreviation: string | null;
  slug: string;
  isPublic: boolean;
  context?: CompetitionContext;
}

export interface SearchGame {
  id: number;
  label: string;
  homeName: string;
  awayName: string;
  context: CompetitionContext;
}

export interface PublicSearchItem {
  id: string;
  label: string;
  description: string;
  href: string;
}

export interface PublicSearchGroup {
  type: "players" | "teams" | "contexts" | "games";
  label: string;
  items: PublicSearchItem[];
}

function detailHref(
  context: CompetitionContext,
  resource: "jogadores" | "equipes" | "jogos",
  detail: string | number,
): string {
  return `/${context.year}/${encodeURIComponent(context.series.slug)}/${encodeURIComponent(
    context.category.slug,
  )}/${resource}/${encodeURIComponent(String(detail))}`;
}

export function normalizePublicSearch(value: string): string {
  return value
    .slice(0, PUBLIC_SEARCH_MAX_QUERY_LENGTH)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matches(query: string, values: Array<string | number | null>): boolean {
  return normalizePublicSearch(values.filter((value) => value !== null).join(" ")).includes(query);
}

function contextHref(context: CompetitionContext): string {
  return `/${context.year}/${encodeURIComponent(context.series.slug)}/${encodeURIComponent(
    context.category.slug,
  )}/classificacao`;
}

export function buildContextualSearchResults(
  rawQuery: string,
  context: CompetitionContext,
  players: SearchPlayer[],
  teams: SearchTeam[],
  contexts: CompetitionContext[],
  limit = PUBLIC_SEARCH_LIMIT,
): PublicSearchGroup[] {
  const query = normalizePublicSearch(rawQuery);
  const safeLimit = Math.max(1, Math.min(limit, PUBLIC_SEARCH_LIMIT));
  if (query.length < PUBLIC_SEARCH_MIN_LENGTH) return [];

  const groups: PublicSearchGroup[] = [
    {
      type: "players",
      label: "Atletas",
      items: players
        .filter((player) => player.isPublic)
        .filter((player) => matches(query, [player.name, player.nickname, player.teamName]))
        .slice(0, 5)
        .map((player) => ({
          id: `player-${player.id}`,
          label: player.nickname ? `${player.name} (${player.nickname})` : player.name,
          description: player.teamName ?? "Sem equipe nesta edição",
          href: detailHref(context, "jogadores", player.slug),
        })),
    },
    {
      type: "teams",
      label: "Equipes",
      items: teams
        .filter((team) => team.isPublic)
        .filter((team) => matches(query, [team.name, team.abbreviation]))
        .slice(0, 4)
        .map((team) => ({
          id: `team-${team.id}`,
          label: team.name,
          description: team.abbreviation ?? "Equipe da edição",
          href: detailHref(context, "equipes", team.slug),
        })),
    },
    {
      type: "contexts",
      label: "Edições e categorias",
      items: contexts
        .filter((item) =>
          matches(query, [item.year, item.displayName, item.series.name, item.category.name]),
        )
        .slice(0, 4)
        .map((item) => ({
          id: `context-${item.competitionId}`,
          label: item.displayName,
          description: `${item.year} · ${item.series.name} · ${item.category.name}`,
          href: contextHref(item),
        })),
    },
  ];

  let remaining = safeLimit;
  return groups.flatMap((group) => {
    const items = group.items.slice(0, remaining);
    remaining -= items.length;
    return items.length > 0 ? [{ ...group, items }] : [];
  });
}

export function buildGlobalSearchResults(
  rawQuery: string,
  contexts: CompetitionContext[],
  players: SearchPlayer[],
  teams: SearchTeam[],
  games: SearchGame[],
  limit = PUBLIC_SEARCH_LIMIT,
): PublicSearchGroup[] {
  const query = normalizePublicSearch(rawQuery);
  if (query.length < PUBLIC_SEARCH_MIN_LENGTH) return [];
  const uniquePlayers = [
    ...new Map(players.filter((item) => item.isPublic).map((item) => [item.id, item])).values(),
  ];
  const uniqueTeams = [
    ...new Map(teams.filter((item) => item.isPublic).map((item) => [item.id, item])).values(),
  ];
  const groups: PublicSearchGroup[] = [
    {
      type: "players",
      label: "Atletas",
      items: uniquePlayers
        .filter((player) => matches(query, [player.name, player.nickname, player.teamName]))
        .slice(0, 5)
        .flatMap((player) =>
          player.context
            ? [
                {
                  id: `player-${player.id}`,
                  label: player.nickname ? `${player.name} (${player.nickname})` : player.name,
                  description: `${player.teamName ?? "Sem equipe"} · ${player.context.displayName}`,
                  href: detailHref(player.context, "jogadores", player.slug),
                },
              ]
            : [],
        ),
    },
    {
      type: "teams",
      label: "Equipes",
      items: uniqueTeams
        .filter((team) => matches(query, [team.name, team.abbreviation]))
        .slice(0, 4)
        .flatMap((team) =>
          team.context
            ? [
                {
                  id: `team-${team.id}`,
                  label: team.name,
                  description: `${team.abbreviation ?? "Equipe"} · ${team.context.displayName}`,
                  href: detailHref(team.context, "equipes", team.slug),
                },
              ]
            : [],
        ),
    },
    {
      type: "contexts",
      label: "Competições e categorias",
      items: contexts
        .filter((item) =>
          matches(query, [item.year, item.displayName, item.series.name, item.category.name]),
        )
        .slice(0, 4)
        .map((item) => ({
          id: `context-${item.competitionId}`,
          label: item.displayName,
          description: `${item.year} · ${item.category.name}`,
          href: contextHref(item),
        })),
    },
    {
      type: "games",
      label: "Jogos",
      items: games
        .filter((game) =>
          matches(query, [game.label, game.homeName, game.awayName, game.context.displayName]),
        )
        .slice(0, 4)
        .map((game) => ({
          id: `game-${game.id}`,
          label: `${game.homeName} × ${game.awayName}`,
          description: `${game.label} · ${game.context.displayName}`,
          href: detailHref(game.context, "jogos", game.id),
        })),
    },
  ];
  let remaining = Math.max(1, Math.min(limit, PUBLIC_SEARCH_LIMIT));
  return groups.flatMap((group) => {
    const items = group.items.slice(0, remaining);
    remaining -= items.length;
    return items.length ? [{ ...group, items }] : [];
  });
}
