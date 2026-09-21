import { data, Form, Link, redirect, useNavigation } from "react-router";

import { cloudflareContext, correlationIdContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";
import {
  mapAdminDomainError,
  normalizeGenderDivision,
  normalizePrimaryDataSource,
  summarizeDataProfileGameImpact,
} from "../modules/competition/admin-domain";
import { logOperationalEvent } from "../modules/observability/operation.server";
import type { Route } from "./+types/admin.competitions.$competitionId.data-profile";

function parseId(value: string | FormDataEntryValue | null): number | null {
  const text = typeof value === "string" ? value : "";
  return /^[1-9][0-9]*$/.test(text) ? Number(text) : null;
}

function isCompatibilitySchemaUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  return ["42703", "42P01", "PGRST204", "PGRST205"].includes(String(error.code));
}

function genderLabel(value: string | null): string {
  if (value === "male") return "Masculino";
  if (value === "female") return "Feminino";
  return "Pendente";
}

function sourceLabel(value: string): string {
  return value === "fiba_boxscore" ? "Boxscore PDF" : "Súmula manual";
}

function formError(message: string, status: number, cookie: string | null) {
  return data(
    { error: message },
    { status, headers: cookie ? { "Set-Cookie": cookie } : undefined },
  );
}

export function meta() {
  return [{ title: "Naipe e fonte de dados — Base do Basquete" }];
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const competitionId = parseId(params.competitionId);
  if (!competitionId) throw new Response("Edição não encontrada", { status: 404 });
  const { env } = context.get(cloudflareContext);
  const auth = await requireAdminAal2(request, env);

  const compatibilityResult = await auth.client
    .from("competitions")
    .select(
      "id,display_name,year,status,series_id,category_id,gender_division,gender_division_review_required,data_profile_id,data_profile_review_required,data_profile_validated_at",
    )
    .eq("id", competitionId)
    .limit(1);

  let schemaAvailable = true;
  let competition:
    | {
        id: number;
        display_name: string;
        year: number;
        status: string;
        series_id: number;
        category_id: number;
        gender_division: string | null;
        gender_division_review_required: boolean;
        data_profile_id: number | null;
        data_profile_review_required: boolean;
        data_profile_validated_at: string | null;
      }
    | undefined;

  if (compatibilityResult.error) {
    if (!isCompatibilitySchemaUnavailable(compatibilityResult.error)) {
      throw new Error("Competition data profile query failed");
    }
    schemaAvailable = false;
    const legacyResult = await auth.client
      .from("competitions")
      .select("id,display_name,year,status,series_id,category_id")
      .eq("id", competitionId)
      .limit(1);
    if (legacyResult.error) throw new Error("Competition data profile query failed");
    const legacyCompetition = legacyResult.data[0];
    if (legacyCompetition) {
      competition = {
        ...legacyCompetition,
        gender_division: null,
        gender_division_review_required: true,
        data_profile_id: null,
        data_profile_review_required: true,
        data_profile_validated_at: null,
      };
    }
  } else {
    competition = compatibilityResult.data[0];
  }

  if (!competition) throw new Response("Edição não encontrada", { status: 404 });

  const [seriesResult, categoryResult, gamesResult] = await Promise.all([
    auth.client.from("competition_series").select("name").eq("id", competition.series_id).single(),
    auth.client.from("categories").select("name").eq("id", competition.category_id).single(),
    auth.client
      .from("games")
      .select("source,status")
      .eq("competition_id", competitionId)
      .order("id"),
  ]);
  if (seriesResult.error || categoryResult.error || gamesResult.error) {
    throw new Error("Competition data profile context query failed");
  }

  let activeProfiles: Array<{
    id: number;
    version: number;
    primarySource: "manual_scoresheet" | "fiba_boxscore";
    activatedAt: string | null;
  }> = [];
  if (
    schemaAvailable &&
    !competition.gender_division_review_required &&
    (competition.gender_division === "male" || competition.gender_division === "female")
  ) {
    const profilesResult = await auth.client
      .from("active_series_category_data_profiles")
      .select("id,version,primary_source,activated_at")
      .eq("series_id", competition.series_id)
      .eq("category_id", competition.category_id)
      .eq("gender_division", competition.gender_division)
      .order("version", { ascending: false });
    if (profilesResult.error) throw new Error("Competition active data profile query failed");
    activeProfiles = profilesResult.data.map((profile) => {
      if (
        !Number.isSafeInteger(profile.id) ||
        !Number.isSafeInteger(profile.version) ||
        (profile.primary_source !== "manual_scoresheet" &&
          profile.primary_source !== "fiba_boxscore")
      ) {
        throw new Error("Competition active data profile query failed");
      }
      return {
        id: profile.id as number,
        version: profile.version as number,
        primarySource: profile.primary_source,
        activatedAt: profile.activated_at,
      };
    });
  }

  const saved = new URL(request.url).searchParams.get("saved");
  return data(
    {
      csrfToken: auth.payload.csrfToken,
      schemaAvailable,
      competition: {
        ...competition,
        seriesName: seriesResult.data.name,
        categoryName: categoryResult.data.name,
      },
      activeProfiles,
      impact: summarizeDataProfileGameImpact(gamesResult.data),
      saved: saved === "division" || saved === "profile" ? saved : null,
    },
    { headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
  );
}

export async function action({ request, params, context }: Route.ActionArgs) {
  assertSameOrigin(request);
  const competitionId = parseId(params.competitionId);
  if (!competitionId) throw new Response("Edição não encontrada", { status: 404 });
  const { env } = context.get(cloudflareContext);
  const correlationId = context.get(correlationIdContext);
  const startedAt = Date.now();
  const auth = await requireAdminAal2(request, env);
  const formData = await request.formData();
  assertCsrfToken(formData, auth.payload.csrfToken);
  const intent = String(formData.get("intent") ?? "");

  const competitionResult = await auth.client
    .from("competitions")
    .select(
      "id,series_id,category_id,gender_division,gender_division_review_required,data_profile_id,data_profile_review_required",
    )
    .eq("id", competitionId)
    .limit(1);
  if (competitionResult.error) {
    if (isCompatibilitySchemaUnavailable(competitionResult.error)) {
      return formError(
        "A revisão estará disponível depois que a atualização compatível do banco chegar a este ambiente.",
        409,
        auth.cookie,
      );
    }
    throw new Error("Competition data profile action query failed");
  }
  const competition = competitionResult.data[0];
  if (!competition) throw new Response("Edição não encontrada", { status: 404 });

  let result: { error: { code?: string } | null };
  let saved: "division" | "profile";
  if (intent === "review-division") {
    const normalized = normalizeGenderDivision(String(formData.get("genderDivision") ?? ""));
    if (!normalized.ok) return formError(normalized.error.message, 400, auth.cookie);
    result = await auth.client.rpc("admin_review_competition_gender", {
      p_competition_id: competitionId,
      p_gender_division: normalized.value,
    });
    saved = "division";
  } else if (intent === "assign-active-profile") {
    const profileId = parseId(formData.get("profileId"));
    if (!profileId) return formError("Selecione explicitamente um perfil ativo.", 400, auth.cookie);
    result = await auth.client.rpc("admin_assign_competition_data_profile", {
      p_competition_id: competitionId,
      p_profile_id: profileId,
    });
    saved = "profile";
  } else if (intent === "create-and-assign-profile") {
    if (
      competition.gender_division_review_required ||
      (competition.gender_division !== "male" && competition.gender_division !== "female")
    ) {
      return formError("Revise o naipe antes de configurar a fonte primária.", 400, auth.cookie);
    }

    const initialChoice = normalizePrimaryDataSource(
      String(formData.get("primarySource") ?? ""),
      String(formData.get("changeReason") ?? ""),
      false,
    );
    if (!initialChoice.ok) return formError(initialChoice.error.message, 400, auth.cookie);

    const profilesResult = await auth.client
      .from("active_series_category_data_profiles")
      .select("id,primary_source")
      .eq("series_id", competition.series_id)
      .eq("category_id", competition.category_id)
      .eq("gender_division", competition.gender_division);
    if (profilesResult.error)
      throw new Error("Competition active data profile action query failed");
    const matchingProfile = profilesResult.data.find(
      (profile) =>
        profile.id !== null &&
        Number.isSafeInteger(profile.id) &&
        profile.primary_source === initialChoice.value.source,
    );

    if (matchingProfile?.id !== null && matchingProfile?.id !== undefined) {
      result = await auth.client.rpc("admin_assign_competition_data_profile", {
        p_competition_id: competitionId,
        p_profile_id: matchingProfile.id,
      });
    } else {
      const choice = normalizePrimaryDataSource(
        String(formData.get("primarySource") ?? ""),
        String(formData.get("changeReason") ?? ""),
        profilesResult.data.length > 0,
      );
      if (!choice.ok) return formError(choice.error.message, 400, auth.cookie);
      const created = await auth.client.rpc("admin_create_series_category_data_profile", {
        p_series_id: competition.series_id,
        p_category_id: competition.category_id,
        p_gender_division: competition.gender_division,
        p_primary_source: choice.value.source,
        ...(choice.value.changeReason ? { p_change_reason: choice.value.changeReason } : {}),
      });
      if (created.error) {
        result = created;
      } else if (!created.data || !Number.isSafeInteger(created.data.id)) {
        throw new Error("Competition data profile creation returned invalid data");
      } else {
        const activated = await auth.client.rpc("admin_activate_series_category_data_profile", {
          p_profile_id: created.data.id,
        });
        result = activated.error
          ? activated
          : await auth.client.rpc("admin_assign_competition_data_profile", {
              p_competition_id: competitionId,
              p_profile_id: created.data.id,
            });
      }
    }
    saved = "profile";
  } else {
    throw new Response("Ação inválida", { status: 400 });
  }

  if (result.error) {
    const mapped = mapAdminDomainError(result.error.code);
    const status = mapped.code === "authorization" ? 403 : mapped.code === "not-found" ? 404 : 400;
    logOperationalEvent({
      correlationId,
      durationMs: Date.now() - startedAt,
      operation: "admin.competition",
      outcome: "blocked",
      status,
      context: { competitionId, errorCode: result.error.code },
    });
    return formError(mapped.message, status, auth.cookie);
  }

  logOperationalEvent({
    correlationId,
    durationMs: Date.now() - startedAt,
    operation: "admin.competition",
    outcome: "success",
    status: 303,
    context: { competitionId },
  });
  throw redirect(`/admin/competitions/${competitionId}/data-profile?saved=${saved}`, {
    headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined,
  });
}

export default function CompetitionDataProfileReview({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { competition, impact } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";
  const divisionReviewed =
    !competition.gender_division_review_required &&
    (competition.gender_division === "male" || competition.gender_division === "female");
  const reviewComplete = divisionReviewed && !competition.data_profile_review_required;

  return (
    <main className="admin-shell">
      <header className="site-header admin-header">
        <Link className="brand" to={`/admin/competitions/${competition.id}`}>
          <span className="brand-mark">B</span>
          <span>Voltar ao hub</span>
        </Link>
        <span className="environment-pill">
          <span className="status-dot" />
          AAL2
        </span>
      </header>

      <section className="admin-welcome admin-hub">
        <p className="eyebrow">Revisão administrativa</p>
        <h1>Naipe e fonte dos jogos</h1>
        <p>
          {competition.display_name} · {competition.seriesName} · {competition.categoryName} ·{" "}
          {competition.year}
        </p>

        {actionData?.error ? <p className="form-error">{actionData.error}</p> : null}
        {loaderData.saved === "division" ? (
          <output className="form-success">Naipe registrado. Revise agora a fonte primária.</output>
        ) : null}
        {loaderData.saved === "profile" ? (
          <output className="form-success">Perfil ativado e vinculado à edição.</output>
        ) : null}

        {!loaderData.schemaAvailable ? (
          <section className="admin-panel" aria-labelledby="rollout-title">
            <h2 id="rollout-title">Atualização de banco pendente</h2>
            <p>
              Este ambiente ainda está no contrato anterior. Nenhuma classificação foi inferida ou
              gravada; a revisão será liberada quando a migration compatível for aplicada.
            </p>
          </section>
        ) : (
          <>
            <div className="admin-status-grid">
              <article>
                <span>Naipe</span>
                <strong>{genderLabel(competition.gender_division)}</strong>
              </article>
              <article>
                <span>Perfil</span>
                <strong>{reviewComplete ? "Validado" : "Pendente"}</strong>
              </article>
              <article>
                <span>Jogos preservados</span>
                <strong>{impact.totalGames}</strong>
              </article>
            </div>

            {!divisionReviewed ? (
              <section className="admin-panel" aria-labelledby="division-title">
                <h2 id="division-title">1. Classificar o naipe</h2>
                <p>
                  A escolha é administrativa e explícita. Nome, categoria, equipes e estatísticas
                  não são usados para sugerir um valor.
                </p>
                <Form method="post" className="compact-admin-form">
                  <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
                  <input type="hidden" name="intent" value="review-division" />
                  <label>
                    Naipe da edição
                    <select name="genderDivision" required defaultValue="">
                      <option value="" disabled>
                        Selecione sem sugestão
                      </option>
                      <option value="male">Masculino</option>
                      <option value="female">Feminino</option>
                    </select>
                  </label>
                  <button className="button button-primary" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Registrando…" : "Confirmar naipe"}
                  </button>
                </Form>
              </section>
            ) : reviewComplete ? (
              <section className="admin-panel" aria-labelledby="complete-title">
                <h2 id="complete-title">Revisão concluída</h2>
                <p>
                  A edição está vinculada ao perfil #{competition.data_profile_id}. Alterações de
                  configuração posteriores pertencem ao fluxo editorial específico e não são feitas
                  silenciosamente aqui.
                </p>
              </section>
            ) : (
              <>
                <section className="admin-panel data-profile-impact" aria-labelledby="impact-title">
                  <h2 id="impact-title">2. Prévia de impacto</h2>
                  <p>
                    A revisão não reinterpreta nem exclui jogos existentes. Dados ausentes continuam
                    indisponíveis e nunca viram zero por conveniência.
                  </p>
                  <ul>
                    <li>{impact.manualGames} jogo(s) com origem em súmula</li>
                    <li>{impact.boxscoreGames} jogo(s) com origem em boxscore</li>
                    <li>{impact.otherGames} jogo(s) legado(s) ou ainda sem fonte definitiva</li>
                    {impact.statuses.map((item) => (
                      <li key={item.status}>
                        {item.count} jogo(s) no estado {item.status}
                      </li>
                    ))}
                  </ul>
                  <div className="data-profile-source-preview">
                    <article>
                      <h3>Súmula manual</h3>
                      <p>
                        Exibe participação, pontos, cestas convertidas, faltas e GD. Métricas
                        avançadas permanecem indisponíveis.
                      </p>
                    </article>
                    <article>
                      <h3>Boxscore PDF</h3>
                      <p>
                        Habilita cobertura avançada somente nos jogos em que o PDF autoritativo
                        realmente forneceu cada métrica.
                      </p>
                    </article>
                  </div>
                </section>

                {loaderData.activeProfiles.length ? (
                  <section className="admin-panel" aria-labelledby="existing-profile-title">
                    <h2 id="existing-profile-title">3. Vincular perfil ativo</h2>
                    <Form method="post" className="compact-admin-form">
                      <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
                      <input type="hidden" name="intent" value="assign-active-profile" />
                      <label>
                        Perfil compatível
                        <select name="profileId" required defaultValue="">
                          <option value="" disabled>
                            Selecione explicitamente
                          </option>
                          {loaderData.activeProfiles.map((profile) => (
                            <option key={profile.id} value={profile.id}>
                              {sourceLabel(profile.primarySource)} · versão {profile.version}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="button button-primary"
                        type="submit"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Vinculando…" : "Vincular perfil selecionado"}
                      </button>
                    </Form>
                  </section>
                ) : null}

                <section className="admin-panel" aria-labelledby="new-profile-title">
                  <h2 id="new-profile-title">
                    {loaderData.activeProfiles.length
                      ? "Ou criar uma nova versão"
                      : "3. Criar o primeiro perfil"}
                  </h2>
                  <Form method="post" className="compact-admin-form">
                    <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
                    <input type="hidden" name="intent" value="create-and-assign-profile" />
                    <label>
                      Fonte primária
                      <select name="primarySource" required defaultValue="">
                        <option value="" disabled>
                          Selecione sem sugestão
                        </option>
                        <option value="manual_scoresheet">Súmula manual</option>
                        <option value="fiba_boxscore">Boxscore PDF</option>
                      </select>
                    </label>
                    <label>
                      Justificativa {loaderData.activeProfiles.length ? "obrigatória" : "opcional"}
                      <textarea
                        name="changeReason"
                        minLength={loaderData.activeProfiles.length ? 10 : undefined}
                        maxLength={500}
                        required={loaderData.activeProfiles.length > 0}
                        placeholder="Explique o motivo e o impacto da escolha."
                      />
                    </label>
                    <button className="button button-primary" type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Ativando…" : "Criar, ativar e vincular"}
                    </button>
                  </Form>
                </section>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
