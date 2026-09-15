export interface RulesetEditorOrigin {
  slotId: number;
  kind: "undefined" | "entry" | "winner";
  entrySeed: number | null;
  sourceMatchupId: number | null;
}

export interface RulesetEditorDocument {
  revision: {
    id: number;
    competitionId: number;
    number: number;
    status: "draft";
    editorRevision: number;
  };
  tracks: Array<{ id: number; code: string }>;
  stages: Array<{
    id: number;
    trackId: number | null;
    code: string;
    name: string;
    order: number;
    kind: "round_robin" | "knockout" | null;
  }>;
  rounds: Array<{
    id: number;
    stageId: number;
    code: string;
    name: string;
    order: number;
    role: string;
    capacity: number;
    maxMatchups: number;
    usedMatchups: number;
  }>;
  entries: Array<{ id: number; seed: number }>;
  matchups: Array<{
    id: number;
    roundId: number;
    code: string;
    order: number;
    home: RulesetEditorOrigin;
    away: RulesetEditorOrigin;
  }>;
  summary: {
    entries: number;
    matchupCapacity: number;
    matchups: number;
    undefinedOrigins: number;
  };
}

export type RulesetEditOperation =
  | "rename_stage"
  | "rename_round"
  | "add_matchup"
  | "remove_matchup"
  | "set_origin";

export interface RulesetEditResult {
  rulesetRevisionId: number;
  editorRevision: number;
  operation: RulesetEditOperation;
  entityId: number;
  outcome: "updated" | "unchanged";
}

export function isRulesetEditRequestId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function parseRulesetEditResult(value: unknown): RulesetEditResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const rulesetRevisionId = integer(row.rulesetRevisionId);
  const editorRevision = integer(row.editorRevision);
  const entityId = integer(row.entityId);
  if (
    !rulesetRevisionId ||
    !editorRevision ||
    !entityId ||
    (row.operation !== "rename_stage" &&
      row.operation !== "rename_round" &&
      row.operation !== "add_matchup" &&
      row.operation !== "remove_matchup" &&
      row.operation !== "set_origin") ||
    (row.outcome !== "updated" && row.outcome !== "unchanged")
  )
    return null;
  return {
    rulesetRevisionId,
    editorRevision,
    entityId,
    operation: row.operation,
    outcome: row.outcome,
  };
}

function integer(value: unknown, minimum = 1) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum
    ? value
    : null;
}

function text(value: unknown, minimum = 1) {
  return typeof value === "string" && value.length >= minimum ? value : null;
}

function array(value: unknown) {
  return Array.isArray(value) ? value : null;
}

function parseOrigin(value: unknown): RulesetEditorOrigin | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const slotId = integer(row.slotId);
  if (
    slotId === null ||
    (row.kind !== "undefined" && row.kind !== "entry" && row.kind !== "winner")
  )
    return null;
  const entrySeed = row.entrySeed === null ? null : integer(row.entrySeed);
  const sourceMatchupId = row.sourceMatchupId === null ? null : integer(row.sourceMatchupId);
  if (
    (row.kind === "undefined" && (entrySeed !== null || sourceMatchupId !== null)) ||
    (row.kind === "entry" && (entrySeed === null || sourceMatchupId !== null)) ||
    (row.kind === "winner" && (entrySeed !== null || sourceMatchupId === null))
  )
    return null;
  return { slotId, kind: row.kind, entrySeed, sourceMatchupId };
}

export function parseRulesetEditorDocument(value: unknown): RulesetEditorDocument | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const document = value as Record<string, unknown>;
  if (
    !document.revision ||
    typeof document.revision !== "object" ||
    Array.isArray(document.revision) ||
    !document.summary ||
    typeof document.summary !== "object" ||
    Array.isArray(document.summary)
  )
    return null;
  const revision = document.revision as Record<string, unknown>;
  const summary = document.summary as Record<string, unknown>;
  const tracks = array(document.tracks);
  const stages = array(document.stages);
  const rounds = array(document.rounds);
  const entries = array(document.entries);
  const matchups = array(document.matchups);
  if (!tracks || !stages || !rounds || !entries || !matchups) return null;

  const parsedRevision = {
    id: integer(revision.id),
    competitionId: integer(revision.competitionId),
    number: integer(revision.number),
    status: revision.status,
    editorRevision: integer(revision.editorRevision),
  };
  const parsedSummary = {
    entries: integer(summary.entries, 0),
    matchupCapacity: integer(summary.matchupCapacity, 0),
    matchups: integer(summary.matchups, 0),
    undefinedOrigins: integer(summary.undefinedOrigins, 0),
  };
  if (
    Object.values(parsedRevision).some((item) => item === null) ||
    parsedRevision.status !== "draft" ||
    Object.values(parsedSummary).some((item) => item === null)
  )
    return null;

  const parsedTracks = tracks.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    const id = integer(row.id);
    const code = text(row.code);
    return id && code ? { id, code } : null;
  });
  const parsedStages = stages.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    const id = integer(row.id);
    const trackId = row.trackId === null ? null : integer(row.trackId);
    const code = text(row.code);
    const name = text(row.name, 2);
    const order = integer(row.order);
    const kind =
      row.kind === null || row.kind === "round_robin" || row.kind === "knockout"
        ? row.kind
        : undefined;
    return id && code && name && order && kind !== undefined
      ? { id, trackId, code, name, order, kind }
      : null;
  });
  const parsedRounds = rounds.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    const id = integer(row.id);
    const stageId = integer(row.stageId);
    const code = text(row.code);
    const name = text(row.name, 2);
    const order = integer(row.order);
    const role = text(row.role);
    const capacity = integer(row.capacity);
    const maxMatchups = integer(row.maxMatchups);
    const usedMatchups = integer(row.usedMatchups, 0);
    return id &&
      stageId &&
      code &&
      name &&
      order &&
      role &&
      capacity &&
      maxMatchups &&
      usedMatchups !== null
      ? { id, stageId, code, name, order, role, capacity, maxMatchups, usedMatchups }
      : null;
  });
  const parsedEntries = entries.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    const id = integer(row.id);
    const seed = integer(row.seed);
    return id && seed ? { id, seed } : null;
  });
  const parsedMatchups = matchups.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    const id = integer(row.id);
    const roundId = integer(row.roundId);
    const code = text(row.code);
    const order = integer(row.order);
    const home = parseOrigin(row.home);
    const away = parseOrigin(row.away);
    return id && roundId && code && order && home && away
      ? { id, roundId, code, order, home, away }
      : null;
  });
  if (
    [...parsedTracks, ...parsedStages, ...parsedRounds, ...parsedEntries, ...parsedMatchups].some(
      (item) => item === null,
    )
  )
    return null;
  return {
    revision: parsedRevision as RulesetEditorDocument["revision"],
    tracks: parsedTracks as RulesetEditorDocument["tracks"],
    stages: parsedStages as RulesetEditorDocument["stages"],
    rounds: parsedRounds as RulesetEditorDocument["rounds"],
    entries: parsedEntries as RulesetEditorDocument["entries"],
    matchups: parsedMatchups as RulesetEditorDocument["matchups"],
    summary: parsedSummary as RulesetEditorDocument["summary"],
  };
}

export function rulesetEditError(code: string | undefined) {
  switch (code) {
    case "BD401":
      return "Sua sessão precisa de autenticação em dois fatores novamente.";
    case "BD404":
      return "O item estrutural não existe mais. Recarregue a página.";
    case "BR003":
      return "A origem precisa ser uma vaga desta revisão ou um confronto de rodada anterior.";
    case "BR004":
      return "Revisões ativas e publicadas são imutáveis.";
    case "BR054":
      return "Esta edição não está em rascunho e não pode ser alterada.";
    case "BR006":
      return "A rodada já atingiu a capacidade máxima de confrontos.";
    case "BR010":
      return "Esta tentativa já foi usada para outra alteração. Recarregue a página.";
    case "BR059":
      return "Revise os campos desta alteração estrutural.";
    case "BR060":
      return "A estrutura mudou desde a abertura da página. Recarregue antes de continuar.";
    case "BR061":
      return "O confronto é origem de outra vaga ou já possui jogo, preparação ou resultado.";
    case "BR062":
      return "Já existe um item estrutural com esse código ou posição.";
    default:
      return "Não foi possível salvar a estrutura. Recarregue e tente novamente.";
  }
}
