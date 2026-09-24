import { data, Link } from "react-router";

import { GameStatistics } from "../components/game-statistics";
import { PlayerProfile } from "../components/player-profile";
import { PublicBreadcrumb, PublicHeader } from "../components/public-navigation";
import { cloudflareContext } from "../context";
import { createAnonymousSupabaseClient } from "../modules/auth/supabase.server";
import {
  genderDivisionSlug,
  isDetailResource,
  isPublicResource,
  parseGenderDivisionSlug,
  parsePublicYear,
} from "../modules/competition/context";
import {
  contextPreferenceCookie,
  resolveCompetitionContext,
} from "../modules/competition/context.server";
import {
  loadPublicDetailPayload,
  type PublicDetailPayload,
} from "../modules/competition/public-route-data.server";
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

export async function loader({ params, context, request }: Route.LoaderArgs) {
  const year = parsePublicYear(params.year);
  const genderDivision = parseGenderDivisionSlug(
    new URL(request.url).pathname.split("/").filter(Boolean)[3],
  );
  if (
    !year ||
    !genderDivision ||
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
    genderDivision,
  });
  if (!resolvedContext) return notFound();

  const payload = await loadPublicDetailPayload(
    client,
    resolvedContext,
    params.resource,
    params.detail,
    undefined,
    new URL(request.url).searchParams,
  );
  if (!payload) return notFound();

  return data(payload, { headers: { "Set-Cookie": contextPreferenceCookie(resolvedContext) } });
}

export function PublicDetailContent({
  context,
  contexts,
  detail,
  game,
  playerProfile,
  resource,
}: PublicDetailPayload) {
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
                    const genderSegment = achievement.genderDivision
                      ? `/${genderDivisionSlug(achievement.genderDivision)}`
                      : "";
                    const contextPath = `/${achievement.year}/${achievement.seriesSlug}/${achievement.categorySlug}${genderSegment}`;
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

export default function PublicDetailPage({ loaderData }: Route.ComponentProps) {
  return <PublicDetailContent {...loaderData} />;
}
