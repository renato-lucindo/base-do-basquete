import { useEffect, useRef, useState } from "react";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { AdminArea } from "../components/admin/admin-area";
import { AdminWizardSteps } from "../components/admin/admin-wizard-steps";
import { cloudflareContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";
import {
  editionCreationError,
  editionInputFromForm,
  validateEditionInput,
} from "../modules/competition/edition-creation";
import type { Route } from "./+types/admin.competitions.new";

function currentYear() {
  return Number(
    new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "America/Sao_Paulo" }).format(
      new Date(),
    ),
  );
}
export function meta() {
  return [{ title: "Criar edição — Administração" }];
}
export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const auth = await requireAdminAal2(request, env);
  const [series, categories, profiles] = await Promise.all([
    auth.client.from("competition_series").select("id,name").eq("is_active", true).order("name"),
    auth.client.from("categories").select("id,name").eq("is_active", true).order("name"),
    auth.client
      .from("series_category_data_profiles")
      .select("id,series_id,category_id,gender_division,primary_source,version")
      .eq("status", "active"),
  ]);
  if (series.error || categories.error || profiles.error)
    throw new Error("Edition choices unavailable");
  return data(
    {
      series: series.data,
      categories: categories.data,
      profiles: profiles.data,
      csrfToken: auth.payload.csrfToken,
      requestId: crypto.randomUUID(),
      currentYear: currentYear(),
    },
    { headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
  );
}
export async function action({ request, context }: Route.ActionArgs) {
  assertSameOrigin(request);
  const { env } = context.get(cloudflareContext);
  const auth = await requireAdminAal2(request, env);
  const form = await request.formData();
  assertCsrfToken(form, auth.payload.csrfToken);
  const intent = form.get("intent");
  if (intent !== "review" && intent !== "create")
    throw new Response("Ação inválida", { status: 400 });
  const headers = auth.cookie ? { "Set-Cookie": auth.cookie } : undefined;
  let input: unknown = editionInputFromForm(form);
  if (intent === "create") {
    const payload = String(form.get("payload") ?? "");
    try {
      if (payload.length > 5000) throw new Error("Payload too large");
      const parsed: unknown = JSON.parse(payload);
      input =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? { ...parsed, reviewed: form.get("reviewed") === "on" }
          : null;
    } catch {
      input = null;
    }
  }
  const validation = validateEditionInput(input, currentYear());
  if (!validation.ok)
    return data({ error: validation.error, review: null }, { status: 400, headers });
  if (intent === "review") return data({ error: null, review: validation }, { headers });
  const requestId = String(form.get("requestId") ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    return data(
      { error: "Recarregue a página antes de criar a edição.", review: validation },
      { status: 400, headers },
    );
  }
  if (!validation.input.reviewed)
    return data(
      { error: "Confirme a revisão dos dados.", review: validation },
      { status: 400, headers },
    );
  const result = await auth.client.rpc("admin_create_competition_from_preset", {
    p_request_id: requestId,
    p_input: { ...validation.input },
  });
  if (result.error || !Number.isSafeInteger(result.data) || (result.data ?? 0) < 1) {
    return data(
      { error: editionCreationError(result.error?.code), review: validation },
      { status: 400, headers },
    );
  }
  throw redirect(`/admin/competitions/${result.data}`, { headers });
}

export default function NewCompetition({ loaderData, actionData }: Route.ComponentProps) {
  const [step, setStep] = useState(1);
  const [requestId] = useState(loaderData.requestId);
  const [seriesId, setSeriesId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [gender, setGender] = useState("");
  const [sourceOverride, setSourceOverride] = useState("");
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const profile = loaderData.profiles.find(
    (item) =>
      String(item.series_id) === seriesId &&
      String(item.category_id) === categoryId &&
      item.gender_division === gender,
  );
  const review = actionData?.review;
  useEffect(() => {
    if (actionData?.review) setStep(3);
    else if (actionData?.error) setStep(1);
  }, [actionData]);
  useEffect(() => {
    if (step === 3) reviewHeading.current?.focus();
  }, [step]);
  return (
    <AdminArea title="Criar edição">
      <p>
        A edição será criada como rascunho privado. Nenhum jogo ou publicação será criado
        automaticamente.
      </p>
      <AdminWizardSteps
        current={step}
        labels={["Identificação", "Dados e formato", "Revisão"]}
        onSelect={setStep}
      />
      {actionData?.error ? (
        <p role="alert" className="form-error">
          {actionData.error}
        </p>
      ) : null}
      <Form
        method="post"
        noValidate
        className="compact-admin-form edition-wizard-form"
        hidden={step === 3 && Boolean(review)}
      >
        <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
        <input type="hidden" name="intent" value="review" />
        <input type="hidden" name="expectedProfileId" value={profile?.id ?? ""} />
        <fieldset hidden={step !== 1}>
          <legend>Identificação da edição</legend>
          <label>
            Série
            <select
              name="seriesId"
              required
              value={seriesId}
              onChange={(event) => {
                setSeriesId(event.target.value);
                setSourceOverride("");
              }}
            >
              <option value="">Selecione</option>
              {loaderData.series.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Categoria
            <select
              name="categoryId"
              required
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value);
                setSourceOverride("");
              }}
            >
              <option value="">Selecione</option>
              {loaderData.categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Naipe
            <select
              name="gender"
              required
              value={gender}
              onChange={(event) => {
                setGender(event.target.value);
                setSourceOverride("");
              }}
            >
              <option value="">Selecione sem inferir</option>
              <option value="male">Masculino</option>
              <option value="female">Feminino</option>
            </select>
          </label>
          <label>
            Ano
            <input
              name="year"
              type="number"
              min={1900}
              max={loaderData.currentYear + 1}
              defaultValue={loaderData.currentYear}
              required
            />
          </label>
          <label>
            Nome da edição
            <input name="name" minLength={2} maxLength={160} required />
          </label>
          <label>
            Início (opcional no rascunho)
            <input name="startsOn" type="date" />
          </label>
          <label>
            Término (opcional no rascunho)
            <input name="endsOn" type="date" />
          </label>
          <button type="button" className="button" onClick={() => setStep(2)}>
            Continuar
          </button>
        </fieldset>
        <fieldset hidden={step !== 2}>
          <legend>Dados e formato</legend>
          <p>
            {profile
              ? `Perfil ativo encontrado: versão ${profile.version}.`
              : "Sem perfil ativo para esta combinação. A criação registrará a fonte escolhida."}
          </p>
          <label>
            Fonte primária
            <select
              name="source"
              required
              value={sourceOverride || profile?.primary_source || ""}
              onChange={(event) => setSourceOverride(event.target.value)}
            >
              <option value="">Selecione</option>
              <option value="manual_scoresheet">Súmula manual</option>
              <option value="fiba_boxscore">Boxscore FIBA/Genius Sports</option>
            </select>
          </label>
          <label>
            Justificativa para mudar a fonte (se aplicável)
            <textarea name="reason" minLength={10} maxLength={500} />
          </label>
          <p>
            Uma mudança explícita cria nova versão do perfil para futuras edições. O histórico
            permanece vinculado à versão anterior.
          </p>
          <label>
            Formato
            <select name="preset" required defaultValue="">
              <option value="">Selecione</option>
              <option value="single_group">Grupo único — turno único</option>
              <option value="single_elimination">Eliminatória simples — jogo único</option>
            </select>
          </label>
          <label>
            Quantidade de equipes
            <input name="entryCount" type="number" min={2} max={16} required />
          </label>
          <p>
            As posições serão reservadas. As equipes serão atribuídas explicitamente depois, sem
            inferência pelos nomes.
          </p>
          <div className="inline-admin-form">
            <button type="button" className="button button-ghost" onClick={() => setStep(1)}>
              Voltar
            </button>
            <button type="submit" className="button" disabled={busy}>
              {busy ? "Validando…" : "Revisar estrutura"}
            </button>
          </div>
        </fieldset>
      </Form>
      {step === 3 && review ? (
        <section aria-label="Revisão da nova edição" className="admin-card">
          <h2 ref={reviewHeading} tabIndex={-1}>
            {review.input.name}
          </h2>
          <p>
            {loaderData.series.find((item) => item.id === review.input.seriesId)?.name} ·{" "}
            {loaderData.categories.find((item) => item.id === review.input.categoryId)?.name}
          </p>
          <p>
            {review.input.year} · {review.input.gender === "male" ? "Masculino" : "Feminino"} ·
            Rascunho privado
          </p>
          <p>
            {review.input.source === "manual_scoresheet"
              ? "Súmula manual"
              : "Boxscore FIBA/Genius Sports"}{" "}
            · {review.input.preset === "single_group" ? "Grupo único" : "Eliminatória simples"}
          </p>
          <p>
            {review.input.entryCount} equipes · {review.summary.rounds} rodadas ·{" "}
            {review.summary.matchups} confrontos reservados · {review.summary.byes} folgas
          </p>
          <p>
            Período: {review.input.startsOn ?? "início pendente"} a{" "}
            {review.input.endsOn ?? "término pendente"}.
          </p>
          <Form method="post" className="compact-admin-form">
            <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
            <input type="hidden" name="intent" value="create" />
            <input type="hidden" name="requestId" value={requestId} />
            <input type="hidden" name="payload" value={JSON.stringify(review.input)} />
            <label>
              <input type="checkbox" name="reviewed" required /> Revisei o ano, o naipe, a fonte e o
              formato. Confirmo a criação privada e, se aplicável, a nova versão do perfil.
            </label>
            <div className="inline-admin-form">
              <button type="button" className="button button-ghost" onClick={() => setStep(1)}>
                Editar
              </button>
              <button type="submit" className="button" disabled={busy}>
                {busy ? "Criando…" : "Criar edição privada"}
              </button>
            </div>
          </Form>
        </section>
      ) : null}
      <Link to="/admin/competitions">Voltar às competições</Link>
    </AdminArea>
  );
}
