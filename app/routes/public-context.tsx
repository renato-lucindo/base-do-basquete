import { data } from "react-router";

import { PublicBreadcrumb, PublicHeader, resourceLabel } from "../components/public-navigation";
import { PublicSportsCore } from "../components/public-sports-core";
import { StatisticsExplorer } from "../components/statistics-explorer";
import { cloudflareContext } from "../context";
import { createAnonymousSupabaseClient } from "../modules/auth/supabase.server";
import {
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
  const year = parsePublicYear(params.year);
  const genderDivision = parseGenderDivisionSlug(
    new URL(request.url).pathname.split("/").filter(Boolean)[3],
  );
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

  return data(await loadPublicContextPayload(client, resolvedContext, params.resource), {
    headers: { "Set-Cookie": contextPreferenceCookie(resolvedContext) },
  });
}

export function PublicContextContent({
  context,
  contexts,
  playerStatistics,
  resource,
  sportsCore,
}: PublicContextPayload) {
  const title = resourceLabel(resource);

  return (
    <main className="public-shell">
      <PublicHeader context={context} contexts={contexts} resource={resource} />
      <div className="public-content">
        {resource === "jogadores" ? null : (
          <>
            <PublicBreadcrumb context={context} contexts={contexts} resource={resource} />
            <section className="context-hero">
              <h1>{title}</h1>
            </section>
          </>
        )}

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

export default function PublicContextPage({ loaderData }: Route.ComponentProps) {
  return <PublicContextContent {...loaderData} />;
}
