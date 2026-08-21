import { redirect } from "react-router";

import { cloudflareContext } from "../context";
import { contextPath } from "../modules/competition/context";
import {
  latestPublicContext,
  readContextPreference,
  resolveCompetitionContext,
} from "../modules/competition/context.server";
import { createAnonymousSupabaseClient } from "../modules/auth/supabase.server";
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

  if (preference) {
    const preferredContext = await resolveCompetitionContext(client, {
      year: preference.year,
      seriesSlug: preference.seriesSlug,
      categorySlug: preference.categorySlug,
    });
    if (preferredContext) {
      throw redirect(contextPath(preferredContext, "classificacao"));
    }
  }

  const recentContext = await latestPublicContext(client);
  if (recentContext) {
    throw redirect(contextPath(recentContext, "classificacao"));
  }

  return { empty: true };
}

export default function Home() {
  return (
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
  );
}
