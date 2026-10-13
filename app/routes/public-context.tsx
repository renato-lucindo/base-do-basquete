import { data, redirect } from "react-router";
import { BoxscoreStatisticsExplorer } from "../components/boxscore-statistics-explorer";
import {
  PublicBreadcrumb,
  PublicFooter,
  PublicHeader,
  resourceLabel,
} from "../components/public-navigation";
import { PublicSportsCore } from "../components/public-sports-core";
import { StatisticsExplorer } from "../components/statistics-explorer";
import { cloudflareContext } from "../context";
import { createAnonymousSupabaseClient } from "../modules/auth/supabase.server";
import {
  contextPath,
  isPublicResource,
  parseGenderDivisionSlug,
  parsePublicYear,
} from "../modules/competition/context";
import {
  contextPreferenceCookie,
  resolveCompetitionContext,
} from "../modules/competition/context.server";
import {
  loadPublicContextPayload,
  type PublicContextPayload,
} from "../modules/competition/public-route-data.server";
import type { Route } from "./+types/public-context";

function notFound(): never {
  throw data(null, { status: 404, statusText: "Contexto não encontrado" });
}

export function meta() {
  return [{ title: "Edição — Base do Basquete" }];
}

export async function loader({ params, context, request }: Route.LoaderArgs) {
  const requestUrl = new URL(request.url);
  const year = parsePublicYear(params.year);
  const genderDivision = parseGenderDivisionSlug(requestUrl.pathname.split("/").filter(Boolean)[3]);
  if (!year || !genderDivision || !isPublicResource(params.resource)) {
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
  if (!resolvedContext) {
    return notFound();
  }

  if (params.resource === "visao-geral") {
    throw redirect(`${contextPath(resolvedContext, "classificacao")}${requestUrl.search}`, {
      status: 308,
      headers: { "Set-Cookie": contextPreferenceCookie(resolvedContext) },
    });
  }

  return data(
    await loadPublicContextPayload(
      client,
      resolvedContext,
      params.resource,
      undefined,
      requestUrl.searchParams,
    ),
    {
      headers: { "Set-Cookie": contextPreferenceCookie(resolvedContext) },
    },
  );
}

export function PublicContextContent({
  boxscoreStatistics,
  context,
  contexts,
  playerStatistics,
  resource,
  sportsCore,
}: PublicContextPayload) {
  const title = resourceLabel(resource);

  return (
    <div className="public-shell">
      <PublicHeader context={context} contexts={contexts} resource={resource} />
      <main className="public-content">
        {resource === "jogadores" ? null : (
          <>
            <PublicBreadcrumb context={context} contexts={contexts} resource={resource} />
            <header className="public-page-heading">
              <p className="eyebrow">{context.displayName}</p>
              <h1>{title}</h1>
            </header>
          </>
        )}

        {resource === "jogadores" ? <h1 className="sr-only">Jogadores</h1> : null}

        {resource === "jogadores" && boxscoreStatistics ? (
          <BoxscoreStatisticsExplorer
            context={context}
            data={boxscoreStatistics}
            key={`${context.competitionId}:${boxscoreStatistics.mode}:${boxscoreStatistics.scope}`}
          />
        ) : resource === "jogadores" && playerStatistics ? (
          <StatisticsExplorer
            context={context}
            key={context.competitionId}
            statistics={playerStatistics}
          />
        ) : sportsCore ? (
          <PublicSportsCore context={context} data={sportsCore} resource={resource} />
        ) : null}
      </main>
      <PublicFooter />
    </div>
  );
}

export default function PublicContextPage({ loaderData }: Route.ComponentProps) {
  return <PublicContextContent {...loaderData} />;
}
