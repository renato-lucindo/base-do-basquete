import { data } from "react-router";

import { PublicBreadcrumb, PublicHeader } from "../components/public-navigation";
import { cloudflareContext } from "../context";
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
import { createAnonymousSupabaseClient } from "../modules/auth/supabase.server";
import type { Route } from "./+types/public-detail";

function notFound(): never {
  throw data(null, { status: 404, statusText: "Registro não encontrado neste contexto" });
}

export function meta() {
  return [{ title: "Detalhe — Base do Basquete" }];
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
  if (!resolvedContext) {
    return notFound();
  }

  const [contexts, detail] = await Promise.all([
    listPublicContexts(client),
    loadPublicDetail(client, resolvedContext, params.resource, params.detail),
  ]);
  if (!detail) {
    return notFound();
  }

  return data(
    { context: resolvedContext, contexts, detail, resource: params.resource },
    { headers: { "Set-Cookie": contextPreferenceCookie(resolvedContext) } },
  );
}

export default function PublicDetailPage({ loaderData }: Route.ComponentProps) {
  const { context, contexts, detail, resource } = loaderData;
  return (
    <main className="public-shell">
      <PublicHeader context={context} contexts={contexts} resource={resource} />
      <div className="public-content">
        <PublicBreadcrumb
          context={context}
          contexts={contexts}
          resource={resource}
          detailLabel={detail.label}
        />
        <article className="detail-card">
          <p className="eyebrow">{context.displayName}</p>
          <h1>{detail.label}</h1>
          <p>{detail.description}</p>
        </article>
      </div>
    </main>
  );
}
