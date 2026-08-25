import { data } from "react-router";

import { PublicBreadcrumb, PublicHeader, resourceLabel } from "../components/public-navigation";
import { PublicSportsCore } from "../components/public-sports-core";
import { StatisticsExplorer } from "../components/statistics-explorer";
import { cloudflareContext } from "../context";
import { isPublicResource, parsePublicYear } from "../modules/competition/context";
import {
  contextPreferenceCookie,
  listPublicContexts,
  resolveCompetitionContext,
} from "../modules/competition/context.server";
import { createAnonymousSupabaseClient } from "../modules/auth/supabase.server";
import { loadCompetitionStatistics } from "../modules/statistics/public-statistics.server";
import { loadPublicSportsCore } from "../modules/statistics/public-sports.server";
import type { Route } from "./+types/public-context";

function notFound(): never {
  throw data(null, { status: 404, statusText: "Contexto não encontrado" });
}

export function meta() {
  return [{ title: "Edição — Base do Basquete" }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const year = parsePublicYear(params.year);
  if (!year || !isPublicResource(params.resource)) {
    return notFound();
  }

  const { env } = context.get(cloudflareContext);
  const client = createAnonymousSupabaseClient(env);
  const resolvedContext = await resolveCompetitionContext(client, {
    year,
    seriesSlug: params.competition,
    categorySlug: params.category,
  });
  if (!resolvedContext) {
    return notFound();
  }

  const [contexts, playerStatistics, sportsCore] = await Promise.all([
    listPublicContexts(client),
    params.resource === "jogadores"
      ? loadCompetitionStatistics(client, resolvedContext)
      : Promise.resolve(null),
    params.resource === "jogadores"
      ? Promise.resolve(null)
      : loadPublicSportsCore(client, resolvedContext),
  ]);

  return data(
    {
      context: resolvedContext,
      contexts,
      playerStatistics,
      resource: params.resource,
      sportsCore,
    },
    { headers: { "Set-Cookie": contextPreferenceCookie(resolvedContext) } },
  );
}

export default function PublicContextPage({ loaderData }: Route.ComponentProps) {
  const { context, contexts, playerStatistics, resource, sportsCore } = loaderData;
  const title = resourceLabel(resource);

  return (
    <main className="public-shell">
      <PublicHeader context={context} contexts={contexts} resource={resource} />
      <div className="public-content">
        <PublicBreadcrumb context={context} contexts={contexts} resource={resource} />
        <section className="context-hero">
          <h1>{title}</h1>
        </section>

        {resource === "jogadores" && playerStatistics ? (
          <StatisticsExplorer
            context={context}
            key={context.competitionId}
            statistics={playerStatistics}
          />
        ) : sportsCore ? (
          <PublicSportsCore context={context} data={sportsCore} resource={resource} />
        ) : null}
      </div>
    </main>
  );
}
