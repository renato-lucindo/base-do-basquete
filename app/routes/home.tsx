import { redirect } from "react-router";

import { PublicFooter } from "../components/public-navigation";
import { cloudflareContext } from "../context";
import { createAnonymousSupabaseClient } from "../modules/auth/supabase.server";
import { contextPath, matchingLegacyContexts } from "../modules/competition/context";
import { listPublicContexts, readContextPreference } from "../modules/competition/context.server";
import type { Route } from "./+types/home";

export function meta() {
  return [
    { title: "Base do Basquete — O jogo fica na história" },
    {
      name: "description",
      content: "Campeonatos, equipes, atletas e jogos com contexto verificável.",
    },
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const client = createAnonymousSupabaseClient(env);
  const preference = readContextPreference(request);
  const contexts = await listPublicContexts(client);

  if (preference) {
    const matches = matchingLegacyContexts(contexts, {
      year: preference.year,
      seriesSlug: preference.seriesSlug,
      categorySlug: preference.categorySlug,
    });
    const preferredContext = preference.genderDivision
      ? matches.find((context) => context.genderDivision === preference.genderDivision)
      : matches.length === 1
        ? matches[0]
        : undefined;
    if (preferredContext) {
      throw redirect(contextPath(preferredContext, "classificacao"));
    }
    if (matches.length > 1) {
      throw redirect(
        `/${preference.year}/${preference.seriesSlug}/${preference.categorySlug}/visao-geral`,
      );
    }
  }

  const recentContext = contexts[0] ?? null;
  if (recentContext) {
    throw redirect(contextPath(recentContext, "classificacao"));
  }

  return { empty: true };
}

export default function Home() {
  return (
    <div className="public-shell empty-public-page">
      <main className="empty-public-shell">
        <div className="error-card">
          <span className="eyebrow">Base do Basquete</span>
          <h1>A próxima temporada está sendo preparada.</h1>
          <p>Nenhuma edição pública está disponível neste momento.</p>
          <a className="button button-ghost" href="/admin">
            Administração
          </a>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
