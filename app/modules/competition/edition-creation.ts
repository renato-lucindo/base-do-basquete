import { compilePreset, PresetError, type PresetKey } from "./ruleset-presets";

export interface EditionInput {
  seriesId: number;
  categoryId: number;
  year: number;
  name: string;
  gender: "male" | "female";
  source: "manual_scoresheet" | "fiba_boxscore";
  preset: PresetKey;
  entryCount: number;
  startsOn: string | null;
  endsOn: string | null;
  expectedProfileId: number | null;
  reason: string | null;
  reviewed: boolean;
}
export type EditionValidation =
  | { ok: true; input: EditionInput; summary: { rounds: number; matchups: number; byes: number } }
  | { ok: false; error: string };

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function validDate(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validateEditionInput(value: unknown, currentYear: number): EditionValidation {
  const invalid = (error: string): EditionValidation => ({ ok: false, error });
  if (!value || typeof value !== "object" || Array.isArray(value))
    return invalid("Revise os dados da edição.");
  const input = value as Record<string, unknown>;
  if (!positiveInteger(input.seriesId) || !positiveInteger(input.categoryId)) {
    return invalid("Selecione a série e a categoria.");
  }
  if (!positiveInteger(input.year) || input.year < 1900 || input.year > currentYear + 1) {
    return invalid(`Informe um ano entre 1900 e ${currentYear + 1}.`);
  }
  if (
    typeof input.name !== "string" ||
    input.name.trim().length < 2 ||
    input.name.trim().length > 160
  ) {
    return invalid("O nome deve ter entre 2 e 160 caracteres.");
  }
  if (input.gender !== "male" && input.gender !== "female")
    return invalid("Selecione explicitamente o naipe.");
  if (input.source !== "manual_scoresheet" && input.source !== "fiba_boxscore")
    return invalid("Selecione a fonte primária.");
  if (
    !validDate(input.startsOn) ||
    !validDate(input.endsOn) ||
    (input.startsOn && input.endsOn && input.startsOn > input.endsOn)
  ) {
    return invalid("Revise as datas: o início não pode ser posterior ao término.");
  }
  if (input.expectedProfileId !== null && !positiveInteger(input.expectedProfileId))
    return invalid("Recarregue o perfil da edição.");
  if (
    input.reason !== null &&
    (typeof input.reason !== "string" ||
      input.reason.trim().length < 10 ||
      input.reason.trim().length > 500)
  ) {
    return invalid("A justificativa deve ter entre 10 e 500 caracteres.");
  }
  if (typeof input.reviewed !== "boolean") return invalid("Confirme a revisão dos dados.");
  try {
    const blueprint = compilePreset(input.preset, input.entryCount);
    return {
      ok: true,
      input: {
        seriesId: input.seriesId,
        categoryId: input.categoryId,
        year: input.year,
        name: input.name.trim(),
        gender: input.gender,
        source: input.source,
        preset: blueprint.key,
        entryCount: blueprint.entryCount,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        expectedProfileId: input.expectedProfileId,
        reason: typeof input.reason === "string" ? input.reason.trim() : null,
        reviewed: input.reviewed,
      },
      summary: {
        rounds: blueprint.rounds.length,
        matchups: blueprint.rounds.reduce((sum, round) => sum + round.matchups.length, 0),
        byes: blueprint.rounds.reduce((sum, round) => sum + round.byes.length, 0),
      },
    };
  } catch (error) {
    if (!(error instanceof PresetError)) throw error;
    return invalid("Selecione um dos dois formatos e informe de 2 a 16 equipes.");
  }
}

export function editionInputFromForm(form: FormData): unknown {
  const text = (name: string) => String(form.get(name) ?? "").trim();
  const integer = (name: string) => (/^\d+$/.test(text(name)) ? Number(text(name)) : null);
  return {
    seriesId: integer("seriesId"),
    categoryId: integer("categoryId"),
    year: integer("year"),
    name: text("name"),
    gender: text("gender"),
    source: text("source"),
    preset: text("preset"),
    entryCount: integer("entryCount"),
    expectedProfileId: integer("expectedProfileId"),
    startsOn: text("startsOn") || null,
    endsOn: text("endsOn") || null,
    reason: text("reason") || null,
    reviewed: form.get("reviewed") === "on",
  };
}
export function editionCreationError(code?: string): string {
  switch (code) {
    case "BD401":
      return "Confirme o segundo fator antes de criar a edição.";
    case "BD404":
      return "A série, categoria ou perfil não está mais disponível.";
    case "BD506":
      return "Já existe uma edição para esta série, categoria, naipe e ano.";
    case "BR010":
      return "Esta solicitação já foi usada com outros dados. Recarregue a página.";
    case "BR011":
      return "Confirme a revisão da primeira edição deste ano.";
    case "BR012":
      return "O perfil de dados mudou. Recarregue e revise a fonte primária.";
    case "BR013":
      return "A mudança de fonte exige confirmação e justificativa.";
    default:
      return "Não foi possível criar a edição. Nenhuma criação parcial foi mantida.";
  }
}
