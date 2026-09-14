import { data, redirect } from "react-router";

import {
  detailSelectionResource,
  PublicGenderSelection,
} from "../components/public-gender-selection";
import { cloudflareContext } from "../context";
import { createAnonymousSupabaseClient } from "../modules/auth/supabase.server";
import {
  contextPath,
  isPublicResource,
  matchingLegacyContexts,
  parsePublicYear,
} from "../modules/competition/context";
import { contextPreferenceCookie, listPublicContexts } from "../modules/competition/context.server";
import { loadPublicDetailPayload } from "../modules/competition/public-route-data.server";
import type { Route } from "./+types/public-legacy-detail";
import { PublicDetailContent } from "./public-detail";

function notFound(): never {
  throw data(null, { status: 404, statusText: "Registro não encontrado neste contexto" });
}

export function meta() {
  return [{ title: "Escolha o naipe — Base do Basquete" }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const year = parsePublicYear(params.year);
  const resource = isPublicResource(params.resource)
    ? detailSelectionResource(params.resource)
    : null;
  if (!year || !resource || !params.detail) return notFound();

  const { env } = context.get(cloudflareContext);
  const client = createAnonymousSupabaseClient(env);
  const contexts = await listPublicContexts(client);
  const matches = matchingLegacyContexts(contexts, {
    year,
    seriesSlug: params.competition,
    categorySlug: params.category,
  });

  if (matches.length === 0) return notFound();
  const onlyMatch = matches[0];
  if (matches.length === 1 && onlyMatch?.genderDivision) {
    throw redirect(contextPath(onlyMatch, resource, params.detail), 308);
  }

  if (matches.length === 1 && onlyMatch) {
    const payload = await loadPublicDetailPayload(
      client,
      onlyMatch,
      resource,
      params.detail,
      contexts,
    );
    if (!payload) return notFound();
    return data(
      { kind: "detail" as const, payload },
      { headers: { "Set-Cookie": contextPreferenceCookie(onlyMatch) } },
    );
  }

  return { kind: "selection" as const, contexts: matches, detail: params.detail, resource };
}

export default function PublicLegacyDetailPage({ loaderData }: Route.ComponentProps) {
  if (loaderData.kind === "detail") {
    return <PublicDetailContent {...loaderData.payload} />;
  }
  return (
    <PublicGenderSelection
      contexts={loaderData.contexts}
      detail={loaderData.detail}
      resource={loaderData.resource}
    />
  );
}
