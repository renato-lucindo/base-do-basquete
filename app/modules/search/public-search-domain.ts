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
}

export interface SearchTeam {
  id: number;
  name: string;
  abbreviation: string | null;
  slug: string;
  isPublic: boolean;
}

export interface PublicSearchItem {
  id: string;
  label: string;
  description: string;
  href: string;
}

export interface PublicSearchGroup {
  type: "players" | "teams" | "contexts";
  label: string;
  items: PublicSearchItem[];
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
          href: `/${context.year}/${encodeURIComponent(
            context.series.slug,
          )}/${encodeURIComponent(context.category.slug)}/jogadores/${encodeURIComponent(
            player.slug,
          )}`,
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
          href: `/${context.year}/${encodeURIComponent(
            context.series.slug,
          )}/${encodeURIComponent(context.category.slug)}/equipes/${encodeURIComponent(team.slug)}`,
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
