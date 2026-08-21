import { data, Link } from "react-router";

import { PublicBreadcrumb, PublicHeader, resourceLabel } from "../components/public-navigation";
import { StatisticsExplorer } from "../components/statistics-explorer";
import { cloudflareContext } from "../context";
import { contextPath, isPublicResource, parsePublicYear } from "../modules/competition/context";
import {
  contextPreferenceCookie,
  listPublicContexts,
  resolveCompetitionContext,
} from "../modules/competition/context.server";
import { loadPublicResourceItems } from "../modules/competition/public-data.server";
import { createAnonymousSupabaseClient } from "../modules/auth/supabase.server";
import { loadCompetitionStatistics } from "../modules/statistics/public-statistics.server";
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

  const [contexts, items, playerStatistics] = await Promise.all([
    listPublicContexts(client),
    params.resource === "jogadores"
      ? Promise.resolve([])
      : loadPublicResourceItems(client, resolvedContext, params.resource),
    params.resource === "jogadores"
      ? loadCompetitionStatistics(client, resolvedContext)
      : Promise.resolve(null),
  ]);

  return data(
    {
      context: resolvedContext,
      contexts,
      items,
      playerStatistics,
      resource: params.resource,
    },
    { headers: { "Set-Cookie": contextPreferenceCookie(resolvedContext) } },
  );
}

export default function PublicContextPage({ loaderData }: Route.ComponentProps) {
  const { context, contexts, items, playerStatistics, resource } = loaderData;
  const title = resourceLabel(resource);

  return (
    <main className="public-shell">
      <PublicHeader context={context} contexts={contexts} resource={resource} />
      <div className="public-content">
        <PublicBreadcrumb context={context} contexts={contexts} resource={resource} />
        <section className="context-hero">
          <p className="eyebrow">{context.displayName}</p>
          <h1>{title}</h1>
          <p>
            {context.series.name} · {context.year} · {context.category.name}
          </p>
        </section>

        {resource === "jogadores" && playerStatistics ? (
          <StatisticsExplorer
            context={context}
            key={context.competitionId}
            statistics={playerStatistics}
          />
        ) : items.length > 0 ? (
          <div className="resource-grid">
            {items.map((item, index) => (
              <article className="resource-card" key={item.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h2>{item.label}</h2>
                <p>{item.detail}</p>
                {item.detailKey && resource !== "classificacao" ? (
                  <Link to={contextPath(context, resource, item.detailKey)}>Ver no contexto</Link>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-resource">Ainda não há registros públicos para este recorte.</p>
        )}
      </div>
    </main>
  );
}
