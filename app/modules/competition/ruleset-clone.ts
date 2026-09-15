export interface RulesetCloneSource {
  revisionId: number;
  competitionId: number;
  displayName: string;
  year: number;
  gender: "male" | "female";
  revisionNumber: number;
  sourceKind: "edition" | "template_snapshot";
  presetKey: string | null;
  entryCount: number;
  genderMismatch: boolean;
  structure: {
    tracks: number;
    stages: number;
    rounds: number;
    entries: number;
    matchups: number;
  };
}

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function positiveInteger(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function count(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function isRulesetCloneRequestId(value: string) {
  return uuidV4.test(value);
}

export function parseRulesetCloneSource(value: unknown): RulesetCloneSource | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const structure = row.structure_summary;
  if (!structure || typeof structure !== "object" || Array.isArray(structure)) return null;
  const rawStructure = structure as Record<string, unknown>;
  const parsedStructure = {
    tracks: count(rawStructure.tracks),
    stages: count(rawStructure.stages),
    rounds: count(rawStructure.rounds),
    entries: count(rawStructure.entries),
    matchups: count(rawStructure.matchups),
  };
  const revisionId = positiveInteger(row.source_revision_id);
  const competitionId = positiveInteger(row.source_competition_id);
  const year = positiveInteger(row.edition_year);
  const revisionNumber = positiveInteger(row.revision_number);
  const entryCount = positiveInteger(row.entry_count);
  if (
    revisionId === null ||
    competitionId === null ||
    year === null ||
    revisionNumber === null ||
    entryCount === null ||
    typeof row.display_name !== "string" ||
    (row.gender_division !== "male" && row.gender_division !== "female") ||
    (row.source_kind !== "edition" && row.source_kind !== "template_snapshot") ||
    (row.preset_key !== null && typeof row.preset_key !== "string") ||
    typeof row.gender_mismatch !== "boolean" ||
    Object.values(parsedStructure).some((item) => item === null)
  ) {
    return null;
  }
  return {
    revisionId,
    competitionId,
    displayName: row.display_name,
    year,
    gender: row.gender_division,
    revisionNumber,
    sourceKind: row.source_kind,
    presetKey: row.preset_key,
    entryCount,
    genderMismatch: row.gender_mismatch,
    structure: parsedStructure as RulesetCloneSource["structure"],
  };
}

export function parseRulesetCloneResult(value: unknown): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return positiveInteger((value as Record<string, unknown>).rulesetRevisionId);
}

export function rulesetCloneError(code: string | undefined) {
  switch (code) {
    case "BD401":
      return "Sua sessão precisa de autenticação em dois fatores novamente.";
    case "BD404":
      return "A edição ou a origem selecionada não existe mais.";
    case "BR010":
      return "Esta tentativa já foi usada com outra origem. Recarregue a página.";
    case "BR054":
      return "Somente uma edição em rascunho pode receber uma nova revisão estrutural.";
    case "BR055":
      return "Revise a origem selecionada e tente novamente.";
    case "BR056":
      return "A origem não é compatível com a série e a categoria desta edição.";
    case "BR057":
      return "Confirme explicitamente a recompilação para usar uma origem de outro naipe.";
    case "BR058":
      return "Esta edição já possui uma revisão estrutural em rascunho.";
    default:
      return "Não foi possível clonar a estrutura. Recarregue e tente novamente.";
  }
}
