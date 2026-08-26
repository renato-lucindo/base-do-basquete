import { data, Link } from "react-router";

import { GameStatistics } from "../components/game-statistics";
import { PlayerProfile } from "../components/player-profile";
import { PublicBreadcrumb, PublicHeader } from "../components/public-navigation";
import { cloudflareContext } from "../context";
import { createAnonymousSupabaseClient } from "../modules/auth/supabase.server";
import {
  isDetailResource,
  isPublicResource,
  parsePublicYear,
} from "../modules/competition/context";
import {
  contextPreferenceCookie,
  listPublicContexts,
  resolveCompetitionContext,
} from "../modules/competition/context.server";
import { loadPublicDetail } from "../modules/competition/public-data.server";
import { loadPublicPlayerProfile } from "../modules/statistics/player-profile.server";
import { loadPublicGameDetail } from "../modules/statistics/public-statistics.server";
import type { Route } from "./+types/public-detail";

function notFound(): never {
  throw data(null, {
    status: 404,
    statusText: "Registro não encontrado neste contexto",
  });
}

export function meta() {
  return [{ title: "Detalhe — Base do Basquete" }];
}

function placementLabel(placement: number, resultLabel: string | null): string {
  if (resultLabel) return resultLabel;
  return placement === 1 ? "Campeão" : `${placement}º lugar`;
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const year = parsePublicYear(params.year);
  if (
    !year ||
    !isPublicResource(params.resource) ||
    !isDetailResource(params.resource) ||
    !params.detail
  ) {
    return notFound();
  }

  const { env } = context.get(cloudflareContext);
  const client = createAnonymousSupabaseClient(env);
  const resolvedContext = await resolveCompetitionContext(client, {
    year,
    seriesSlug: params.competition,
    categorySlug: params.category,
  });
  if (!resolvedContext) return notFound();

  const contexts = await listPublicContexts(client);
  const [loadedDetail, game, playerProfile] = await Promise.all([
    params.resource === "jogadores"
      ? Promise.resolve(null)
      : loadPublicDetail(client, resolvedContext, params.resource, params.detail),
    params.resource === "jogos"
      ? loadPublicGameDetail(client, resolvedContext, params.detail)
      : Promise.resolve(null),
    params.resource === "jogadores"
      ? loadPublicPlayerProfile(client, resolvedContext, contexts, params.detail)
      : Promise.resolve(null),
  ]);
  const detail = playerProfile
    ? {
        label: playerProfile.fullName,
        description: playerProfile.bio ?? "Perfil público do atleta.",
        achievements: playerProfile.achievements,
      }
    : loadedDetail;
  if (
    !detail ||
    (params.resource === "jogos" && !game) ||
    (params.resource === "jogadores" && !playerProfile)
  ) {
    return notFound();
  }

  return data(
    {
      context: resolvedContext,
      contexts,
      detail,
      game,
      playerProfile,
      resource: params.resource,
    },
    { headers: { "Set-Cookie": contextPreferenceCookie(resolvedContext) } },
  );
}

export default function PublicDetailPage({ loaderData }: Route.ComponentProps) {
  const { context, contexts, detail, game, playerProfile, resource } = loaderData;
  return (
    <main className="public-shell">
      <PublicHeader
        context={context}
        contexts={contexts}
        detailLabel={detail.label}
        resource={resource}
      />
      <div className="public-content">
        <PublicBreadcrumb
          context={context}
          contexts={contexts}
          resource={resource}
          detailLabel={detail.label}
        />
        {resource === "jogos" && game ? (
          <GameStatistics context={context} game={game} />
        ) : resource === "jogadores" && playerProfile ? (
          <PlayerProfile
            achievements={detail.achievements}
            context={context}
            profile={playerProfile}
          />
        ) : (
          <>
            <article className="detail-card">
              <p className="eyebrow">{context.displayName}</p>
              <h1>{detail.label}</h1>
              <p>{detail.description}</p>
            </article>
            <section className="achievement-panel" aria-labelledby="achievement-title">
              <p className="eyebrow">Histórico derivado</p>
              <h2 id="achievement-title">Conquistas confirmadas</h2>
              {detail.achievements.length ? (
                <ol className="achievement-list">
                  {detail.achievements.map((achievement) => {
                    const contextPath = `/${achievement.year}/${achievement.seriesSlug}/${achievement.categorySlug}`;
                    return (
                      <li key={`${achievement.competitionId}-${achievement.teamSlug ?? "team"}`}>
                        <strong>
                          {placementLabel(achievement.placement, achievement.resultLabel)}
                        </strong>
                        <span>
                          {achievement.year} · {achievement.seriesName} · {achievement.categoryName}
                        </span>
                        {achievement.teamName && achievement.teamSlug ? (
                          <Link to={`${contextPath}/equipes/${achievement.teamSlug}`}>
                            {achievement.teamName}
                          </Link>
                        ) : null}
                        <Link to={`${contextPath}/classificacao`}>Abrir edição</Link>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p>Nenhuma conquista confirmada.</p>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
