import { data, redirect } from "react-router";

import { PublicGenderSelection } from "../components/public-gender-selection";
import { cloudflareContext } from "../context";
import { createAnonymousSupabaseClient } from "../modules/auth/supabase.server";
import {
  canonicalPublicResource,
  contextPath,
  isPublicResource,
  matchingLegacyContexts,
  parsePublicYear,
} from "../modules/competition/context";
import { contextPreferenceCookie, listPublicContexts } from "../modules/competition/context.server";
import { loadPublicContextPayload } from "../modules/competition/public-route-data.server";
import type { Route } from "./+types/public-legacy-context";
import { PublicContextContent } from "./public-context";

function notFound(): never {
  throw data(null, { status: 404, statusText: "Contexto não encontrado" });
}

export function meta() {
  return [{ title: "Escolha o naipe — Base do Basquete" }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const year = parsePublicYear(params.year);
  if (!year || !isPublicResource(params.resource)) return notFound();
  const resource = canonicalPublicResource(params.resource);

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
    throw redirect(contextPath(onlyMatch, resource), 308);
  }
  if (params.resource === "visao-geral") {
    throw redirect(`/${year}/${params.competition}/${params.category}/classificacao`, 308);
  }

  if (matches.length === 1 && onlyMatch) {
    return data(
      {
        kind: "context" as const,
        payload: await loadPublicContextPayload(client, onlyMatch, resource, contexts),
      },
      { headers: { "Set-Cookie": contextPreferenceCookie(onlyMatch) } },
    );
  }

  return { kind: "selection" as const, contexts: matches, resource };
}

export default function PublicLegacyContextPage({ loaderData }: Route.ComponentProps) {
  if (loaderData.kind === "context") {
    return <PublicContextContent {...loaderData.payload} />;
  }
  return <PublicGenderSelection contexts={loaderData.contexts} resource={loaderData.resource} />;
}
