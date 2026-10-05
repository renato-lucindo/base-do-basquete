import { validateEditionInput } from "./edition-creation";

export type AgeKind = "adult" | "base" | "master";
export interface EditionWorkflowInput {
  seriesId: number | null;
  championshipName: string | null;
  seasonId: number | null;
  categoryKind: AgeKind;
  categoryAge: number | null;
  year: number;
  gender: "male" | "female";
  description: string | null;
  startsOn: string | null;
  endsOn: string | null;
  divisionMode: "none" | "existing" | "new";
  divisionValueId: number | null;
  divisionTypeName: string | null;
  divisionValueName: string | null;
  source: "manual_scoresheet" | "fiba_boxscore";
  preset: "single_group" | "single_elimination";
  entryCount: number;
  expectedProfileId: number | null;
  reason: string | null;
  reviewed: boolean;
}
export const masterAges = Array.from({ length: 12 }, (_, index) => 30 + index * 5);
export function categoryLabel(kind: AgeKind, age: number | null): string {
  if (kind !== "adult" && age === null) return "Idade pendente";
  return kind === "adult" ? "Adulto" : kind === "base" ? `Sub-${age}` : `${age}+`;
}
export function disputeName(name: string, kind: AgeKind, age: number | null, division?: string) {
  return `${name}${kind === "adult" ? "" : ` - ${categoryLabel(kind, age)}`}${division ? `${kind === "adult" ? " - " : " · "}${division}` : ""}`;
}
const keys: (keyof EditionWorkflowInput)[] = [
  "seriesId",
  "championshipName",
  "seasonId",
  "categoryKind",
  "categoryAge",
  "year",
  "gender",
  "description",
  "startsOn",
  "endsOn",
  "divisionMode",
  "divisionValueId",
  "divisionTypeName",
  "divisionValueName",
  "source",
  "preset",
  "entryCount",
  "expectedProfileId",
  "reason",
  "reviewed",
];
const id = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const optionalText = (value: unknown, min: number, max: number) =>
  value === null ||
  (typeof value === "string" && value.trim().length >= min && value.trim().length <= max);
export function validateEditionWorkflow(value: unknown, year: number) {
  const fail = (field: string, error: string) => ({ ok: false as const, field, error });
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fail("form", "Revise os dados da edição.");
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).some((key) => !keys.includes(key as keyof EditionWorkflowInput)) ||
    keys.some((key) => !(key in input))
  ) {
    return fail("form", "Recarregue o formulário: o contrato dos dados mudou.");
  }
  if (input.seasonId !== null && !id(input.seasonId)) return fail("seasonId", "Edição inválida.");
  if (input.seasonId !== null) {
    if (input.seriesId !== null || input.championshipName !== null)
      return fail("seriesId", "A disputa deve herdar o campeonato da edição.");
  } else if (input.seriesId !== null) {
    if (!id(input.seriesId) || input.championshipName !== null)
      return fail("seriesId", "Selecione um campeonato existente.");
  } else if (!optionalText(input.championshipName, 2, 120) || input.championshipName === null) {
    return fail("championshipName", "O nome do campeonato deve ter entre 2 e 120 caracteres.");
  }
  const age = input.categoryAge;
  if (input.categoryKind === "adult") {
    if (age !== null) return fail("categoryAge", "Adulto não utiliza idade.");
  } else if (input.categoryKind === "base") {
    if (!id(age) || age < 12 || age > 23)
      return fail("categoryAge", "Informe uma idade inteira entre 12 e 23.");
  } else if (input.categoryKind === "master") {
    if (!id(age) || !masterAges.includes(age))
      return fail("categoryAge", "Selecione uma idade de 30 a 85, em intervalos de 5 anos.");
  } else return fail("categoryKind", "Selecione Adulto, Base ou Master.");
  if (!optionalText(input.description, 1, 2000))
    return fail("description", "A descrição deve ter até 2.000 caracteres.");
  if (input.divisionMode === "existing") {
    if (
      input.seasonId === null ||
      !id(input.divisionValueId) ||
      input.divisionTypeName !== null ||
      input.divisionValueName !== null
    ) {
      return fail("divisionValueId", "Selecione uma divisão da edição.");
    }
  } else if (input.divisionMode === "new") {
    if (
      input.divisionValueId !== null ||
      input.divisionTypeName === null ||
      input.divisionValueName === null ||
      !optionalText(input.divisionTypeName, 2, 80) ||
      !optionalText(input.divisionValueName, 1, 80)
    ) {
      return fail("divisionValueName", "Informe o tipo e o valor da divisão.");
    }
  } else if (
    input.divisionMode !== "none" ||
    input.divisionValueId !== null ||
    input.divisionTypeName !== null ||
    input.divisionValueName !== null
  ) {
    return fail("divisionMode", "Revise a divisão competitiva.");
  }
  const legacy = validateEditionInput(
    { ...input, seriesId: 1, categoryId: 1, name: "Validação" },
    year,
  );
  if (!legacy.ok) {
    const field = /ano/.test(legacy.error)
      ? "year"
      : /naipe/.test(legacy.error)
        ? "gender"
        : /datas/.test(legacy.error)
          ? "startsOn"
          : /fonte/.test(legacy.error)
            ? "source"
            : /justificativa/.test(legacy.error)
              ? "reason"
              : /formatos/.test(legacy.error)
                ? "entryCount"
                : "form";
    return fail(field, legacy.error);
  }
  return {
    ok: true as const,
    input: input as unknown as EditionWorkflowInput,
    summary: legacy.summary,
  };
}
export function workflowInputFromForm(form: FormData): unknown {
  const text = (key: string) => String(form.get(key) ?? "").trim();
  const number = (key: string) => (/^\d+$/.test(text(key)) ? Number(text(key)) : null);
  const championship = text("seriesId");
  const kind = text("categoryKind");
  const mode = text("divisionMode");
  return {
    seriesId: number("seasonId") ? null : number("seriesId"),
    championshipName:
      !number("seasonId") && championship === "new" ? text("championshipName") || null : null,
    seasonId: number("seasonId"),
    categoryKind: kind,
    categoryAge: kind === "adult" ? null : number("categoryAge"),
    year: number("year"),
    gender: text("gender"),
    description: text("description") || null,
    startsOn: text("startsOn") || null,
    endsOn: text("endsOn") || null,
    divisionMode: mode,
    divisionValueId: mode === "existing" ? number("divisionValueId") : null,
    divisionTypeName: mode === "new" ? text("divisionTypeName") || null : null,
    divisionValueName: mode === "new" ? text("divisionValueName") || null : null,
    source: text("source"),
    preset: text("preset"),
    entryCount: number("entryCount"),
    expectedProfileId: number("expectedProfileId"),
    reason: text("reason") || null,
    reviewed: form.get("reviewed") === "on",
  };
}
export function workflowError(code?: string, message?: string): string {
  if (message === "BDB_CHAMPIONSHIP_ALREADY_EXISTS")
    return "Esse campeonato já existe. Selecione-o na lista.";
  if (message === "BDB_COMPETITION_SEASON_CONFLICT")
    return "Já existe uma edição para esse campeonato, ano e naipe. Use Adicionar disputa.";
  if (message === "BDB_COMPETITION_CONTEXT_ALREADY_EXISTS")
    return "Essa categoria e divisão já possuem uma disputa na edição.";
  if (message === "BDB_CATEGORY_LEGACY_CONFLICT")
    return "Existe uma categoria legada com esse identificador. Ela precisa de revisão explícita.";
  if (code === "BD409")
    return "O contexto mudou ou a solicitação foi usada com outros dados. Recarregue e revise.";
  if (code === "BD506")
    return "Já existe esse contexto. Revise a edição, a categoria ou a divisão.";
  if (code === "BR012") return "O perfil de dados mudou. Recarregue e revise a fonte primária.";
  if (code === "BR013") return "A mudança de fonte exige confirmação e justificativa.";
  if (code === "BD401") return "Confirme o segundo fator antes de criar.";
  return "Não foi possível criar. Nenhuma criação parcial foi mantida.";
}
