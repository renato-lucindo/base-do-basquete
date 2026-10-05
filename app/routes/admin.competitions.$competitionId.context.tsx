import { useEffect, useRef } from "react";
import { data, Form, Link, redirect } from "react-router";

import { AdminArea } from "../components/admin/admin-area";
import { cloudflareContext } from "../context";
import { requireAdminAal2 } from "../modules/auth/authorization.server";
import { assertCsrfToken, assertSameOrigin } from "../modules/auth/csrf.server";
import type { Json } from "../types/database.generated";
import type { Route } from "./+types/admin.competitions.$competitionId.context";

interface ContextPlayerConflict {
  playerId: number;
  fullName: string;
  reason: "eligibility_pending" | "gender_incompatible";
}

interface ContextPreview {
  categoryId: number;
  genderDivision: "male" | "female";
  gameCount: number;
  targetProfileId: number | null;
  duplicateCompetitionId: number | null;
  playerConflicts: ContextPlayerConflict[];
  canApply: boolean;
}

function parseId(value: unknown): number | null {
  const text = typeof value === "string" ? value : "";
  return /^[1-9][0-9]*$/.test(text) ? Number(text) : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function parseContextPreview(value: Json | null): ContextPreview | null {
  const root = record(value);
  if (!root) return null;
  const categoryId = parseId(String(root.categoryId ?? ""));
  const genderDivision = root.genderDivision;
  const gameCount = typeof root.gameCount === "number" ? root.gameCount : null;
  const targetProfileId =
    root.targetProfileId === null ? null : parseId(String(root.targetProfileId ?? ""));
  const duplicateCompetitionId =
    root.duplicateCompetitionId === null
      ? null
      : parseId(String(root.duplicateCompetitionId ?? ""));
  if (
    !categoryId ||
    (genderDivision !== "male" && genderDivision !== "female") ||
    gameCount === null ||
    typeof root.canApply !== "boolean" ||
    !Array.isArray(root.playerConflicts)
  ) {
    return null;
  }
  const playerConflicts: ContextPlayerConflict[] = [];
  for (const raw of root.playerConflicts) {
    const item = record(raw);
    const playerId = parseId(String(item?.playerId ?? ""));
    if (
      !item ||
      !playerId ||
      typeof item.fullName !== "string" ||
      (item.reason !== "eligibility_pending" && item.reason !== "gender_incompatible")
    ) {
      return null;
    }
    playerConflicts.push({
      playerId,
      fullName: item.fullName,
      reason: item.reason,
    });
  }
  return {
    categoryId,
    genderDivision,
    gameCount,
    targetProfileId,
    duplicateCompetitionId,
    playerConflicts,
    canApply: root.canApply,
  };
}

function previewBlockers(preview: ContextPreview) {
  const blockers: string[] = [];
  if (preview.gameCount > 0)
    blockers.push("A disputa já possui jogos e o contexto esportivo está travado.");
  if (!preview.targetProfileId)
    blockers.push("Não existe perfil de dados ativo compatível com o novo contexto.");
  if (preview.duplicateCompetitionId) {
    blockers.push(`Já existe uma disputa equivalente (#${preview.duplicateCompetitionId}).`);
  }
  if (preview.playerConflicts.length) {
    blockers.push("Há atletas incompatíveis ou com elegibilidade privada pendente.");
  }
  return blockers;
}

function mapApplyError(code: string | undefined) {
  switch (code) {
    case "BD409":
      return "A disputa mudou ou já possui jogos. Gere uma nova prévia.";
    case "BD506":
      return "Já existe outra disputa com a mesma categoria, naipe e divisão.";
    case "BD601":
      return "Há atleta com elegibilidade privada pendente.";
    case "BD602":
      return "Há atleta incompatível com o naipe selecionado.";
    case "BD404":
      return "A categoria ou disputa selecionada não existe mais.";
    default:
      return "Não foi possível corrigir o contexto. Refaça a prévia.";
  }
}

export function meta() {
  return [{ title: "Corrigir contexto da disputa — Base do Basquete" }];
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const competitionId = parseId(params.competitionId);
  if (!competitionId) throw new Response("Disputa não encontrada", { status: 404 });
  const auth = await requireAdminAal2(request, context.get(cloudflareContext).env);
  const [competitionResult, categoriesResult] = await Promise.all([
    auth.client
      .from("competitions")
      .select("id,display_name,category_id,gender_division")
      .eq("id", competitionId)
      .maybeSingle(),
    auth.client
      .from("categories")
      .select("id,name,age_kind,age_value")
      .eq("is_active", true)
      .order("age_kind")
      .order("age_value", { ascending: true, nullsFirst: true }),
  ]);
  if (competitionResult.error || !competitionResult.data) {
    throw new Response("Disputa não encontrada", { status: 404 });
  }
  if (categoriesResult.error) throw new Error("Competition context category query failed");

  const url = new URL(request.url);
  const categoryId = parseId(url.searchParams.get("categoryId"));
  const gender = url.searchParams.get("gender");
  const genderDivision = gender === "male" || gender === "female" ? gender : null;
  let preview: ContextPreview | null = null;
  let previewError: string | null = null;
  if (categoryId && genderDivision) {
    const previewResult = await auth.client.rpc("admin_preview_dispute_context_change", {
      p_competition_id: competitionId,
      p_category_id: categoryId,
      p_gender_division: genderDivision,
    });
    preview = previewResult.error ? null : parseContextPreview(previewResult.data);
    if (previewResult.error || !preview) previewError = "Não foi possível validar o novo contexto.";
  }

  return data(
    {
      competition: competitionResult.data,
      categories: categoriesResult.data,
      csrfToken: auth.payload.csrfToken,
      selectedCategoryId: categoryId,
      selectedGender: genderDivision,
      preview,
      previewError,
    },
    { headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined },
  );
}

export async function action({ request, params, context }: Route.ActionArgs) {
  assertSameOrigin(request);
  const competitionId = parseId(params.competitionId);
  if (!competitionId) throw new Response("Disputa não encontrada", { status: 404 });
  const auth = await requireAdminAal2(request, context.get(cloudflareContext).env);
  const formData = await request.formData();
  assertCsrfToken(formData, auth.payload.csrfToken);
  const categoryId = parseId(formData.get("categoryId"));
  const gender = String(formData.get("gender") ?? "");
  if (!categoryId || (gender !== "male" && gender !== "female")) {
    return data({ error: "Selecione categoria e naipe válidos." }, { status: 400 });
  }

  const result = await auth.client.rpc("admin_apply_dispute_context_change", {
    p_competition_id: competitionId,
    p_category_id: categoryId,
    p_gender_division: gender,
  });
  if (result.error) return data({ error: mapApplyError(result.error.code) }, { status: 409 });
  throw redirect(`/admin/competitions/${competitionId}?contextUpdated=1`, {
    headers: auth.cookie ? { "Set-Cookie": auth.cookie } : undefined,
  });
}

export default function CompetitionContextCorrection({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const blockers = loaderData.preview ? previewBlockers(loaderData.preview) : [];
  const actionErrorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (actionData?.error) actionErrorRef.current?.focus();
  }, [actionData]);

  return (
    <AdminArea title="Corrigir categoria ou naipe">
      <p>
        Disputa: <strong>{loaderData.competition.display_name}</strong>. A correção só é aplicada
        antes do primeiro jogo e depois de validar perfil de dados e todos os elencos ativos.
      </p>
      <p>
        <Link to={`/admin/competitions/${loaderData.competition.id}`}>
          Voltar ao hub da disputa
        </Link>
      </p>

      <section className="admin-panel">
        <h2>1. Gerar prévia</h2>
        <Form method="get" className="inline-admin-form">
          <label>
            Categoria
            <select
              name="categoryId"
              defaultValue={loaderData.selectedCategoryId ?? loaderData.competition.category_id}
              required
            >
              {loaderData.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Naipe
            <select
              name="gender"
              defaultValue={loaderData.selectedGender ?? loaderData.competition.gender_division}
              required
            >
              <option value="male">Masculino</option>
              <option value="female">Feminino</option>
            </select>
          </label>
          <button className="button button-primary" type="submit">
            Validar alteração
          </button>
        </Form>
        {loaderData.previewError ? (
          <p role="alert" className="form-error">
            {loaderData.previewError}
          </p>
        ) : null}
      </section>

      {loaderData.preview ? (
        <section className="admin-panel">
          <h2>2. Resultado da validação</h2>
          {blockers.length ? (
            <>
              <p role="alert">A alteração ainda não pode ser aplicada.</p>
              <ul>
                {blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>Nenhum conflito encontrado. A correção pode ser confirmada.</p>
          )}
          {loaderData.preview.playerConflicts.length ? (
            <ul>
              {loaderData.preview.playerConflicts.map((player) => (
                <li key={player.playerId}>
                  {player.fullName}:{" "}
                  {player.reason === "eligibility_pending"
                    ? "elegibilidade privada pendente"
                    : "incompatível com o novo naipe"}
                </li>
              ))}
            </ul>
          ) : null}
          {actionData?.error ? (
            <p ref={actionErrorRef} role="alert" tabIndex={-1} className="form-error">
              {actionData.error}
            </p>
          ) : null}
          {loaderData.preview.canApply ? (
            <Form method="post">
              <input type="hidden" name="csrfToken" value={loaderData.csrfToken} />
              <input type="hidden" name="categoryId" value={loaderData.preview.categoryId} />
              <input type="hidden" name="gender" value={loaderData.preview.genderDivision} />
              <button className="button button-primary" type="submit">
                Confirmar correção
              </button>
            </Form>
          ) : null}
        </section>
      ) : null}
    </AdminArea>
  );
}
