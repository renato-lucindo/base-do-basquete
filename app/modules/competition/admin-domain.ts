export type AdminDomainErrorCode =
  | "authorization"
  | "not-found"
  | "transition"
  | "invalid-roster"
  | "player-conflict"
  | "jersey-conflict"
  | "invalid-result"
  | "result-conflict"
  | "invalid-profile"
  | "profile-transition"
  | "profile-context"
  | "review-required"
  | "context-conflict"
  | "unknown";

export interface AdminDomainError {
  code: AdminDomainErrorCode;
  field?:
    | "competition"
    | "team"
    | "status"
    | "roster"
    | "player"
    | "jersey"
    | "placement"
    | "genderDivision"
    | "primarySource"
    | "changeReason"
    | "dataProfile";
  message: string;
}

const jerseyPattern = /^(?:0|00|[1-9][0-9]?)$/;

export type GenderDivision = "male" | "female";
export type PrimaryDataSource = "manual_scoresheet" | "fiba_boxscore";

export interface DataProfileGameImpact {
  totalGames: number;
  manualGames: number;
  boxscoreGames: number;
  otherGames: number;
  statuses: Array<{ status: string; count: number }>;
}

export function normalizeGenderDivision(
  value: string,
): { ok: true; value: GenderDivision } | { ok: false; error: AdminDomainError } {
  const normalized = value.trim().toLowerCase();
  if (normalized === "male" || normalized === "female") {
    return { ok: true, value: normalized };
  }
  return {
    ok: false,
    error: {
      code: "invalid-profile",
      field: "genderDivision",
      message: "Selecione explicitamente o naipe da edição.",
    },
  };
}

export function normalizePrimaryDataSource(
  sourceValue: string,
  reasonValue: string,
  reasonRequired: boolean,
):
  | { ok: true; value: { source: PrimaryDataSource; changeReason: string | null } }
  | { ok: false; error: AdminDomainError } {
  const source = sourceValue.trim().toLowerCase();
  if (source !== "manual_scoresheet" && source !== "fiba_boxscore") {
    return {
      ok: false,
      error: {
        code: "invalid-profile",
        field: "primarySource",
        message: "Selecione explicitamente a fonte primária.",
      },
    };
  }
  const changeReason = reasonValue.trim() || null;
  if (reasonRequired && (!changeReason || changeReason.length < 10)) {
    return {
      ok: false,
      error: {
        code: "invalid-profile",
        field: "changeReason",
        message: "Explique a alteração em pelo menos 10 caracteres.",
      },
    };
  }
  if (changeReason && changeReason.length > 500) {
    return {
      ok: false,
      error: {
        code: "invalid-profile",
        field: "changeReason",
        message: "A justificativa deve ter no máximo 500 caracteres.",
      },
    };
  }
  return { ok: true, value: { source, changeReason } };
}

export function summarizeDataProfileGameImpact(
  games: Array<{ source: string; status: string }>,
): DataProfileGameImpact {
  const statusCounts = new Map<string, number>();
  let manualGames = 0;
  let boxscoreGames = 0;
  let otherGames = 0;

  for (const game of games) {
    if (game.source === "manual") manualGames += 1;
    else if (game.source === "boxscore") boxscoreGames += 1;
    else otherGames += 1;
    statusCounts.set(game.status, (statusCounts.get(game.status) ?? 0) + 1);
  }

  return {
    totalGames: games.length,
    manualGames,
    boxscoreGames,
    otherGames,
    statuses: [...statusCounts.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((left, right) => left.status.localeCompare(right.status)),
  };
}

export type FinalResultStatus = "placed" | "withdrawn" | "disqualified";

export function normalizeFinalResult(
  statusValue: string,
  placementValue: string,
  labelValue: string,
):
  | {
      ok: true;
      value: { status: FinalResultStatus; placement: number | null; label: string | null };
    }
  | { ok: false; error: AdminDomainError } {
  const status = statusValue.trim().toLowerCase();
  if (status !== "placed" && status !== "withdrawn" && status !== "disqualified") {
    return {
      ok: false,
      error: { code: "invalid-result", field: "status", message: "Selecione um resultado final." },
    };
  }
  const placementText = placementValue.trim();
  const placement = /^[1-9][0-9]*$/.test(placementText) ? Number(placementText) : null;
  if (
    (status === "placed" && placement === null) ||
    (status !== "placed" && placementText !== "")
  ) {
    return {
      ok: false,
      error: {
        code: "invalid-result",
        field: "placement",
        message: "Informe uma colocação positiva somente para resultado classificado.",
      },
    };
  }
  const label = labelValue.trim() || null;
  if (label && (label.length < 2 || label.length > 80)) {
    return {
      ok: false,
      error: {
        code: "invalid-result",
        field: "placement",
        message: "O rótulo deve ter entre 2 e 80 caracteres.",
      },
    };
  }
  return { ok: true, value: { status, placement, label: status === "placed" ? label : null } };
}

export function normalizeJersey(
  value: string,
): { ok: true; value: string | null } | { ok: false; error: AdminDomainError } {
  const normalized = value.trim();
  if (normalized === "") {
    return { ok: true, value: null };
  }
  if (!jerseyPattern.test(normalized)) {
    return {
      ok: false,
      error: {
        code: "invalid-roster",
        field: "jersey",
        message: "Use 0, 00 ou um número de 1 a 99.",
      },
    };
  }
  return { ok: true, value: normalized };
}

export function mapAdminDomainError(code: string | undefined): AdminDomainError {
  switch (code) {
    case "BD401":
      return {
        code: "authorization",
        message: "Confirme o segundo fator antes de continuar.",
      };
    case "BD404":
      return {
        code: "not-found",
        message: "O registro selecionado não existe mais.",
      };
    case "BD102":
      return {
        code: "transition",
        field: "status",
        message: "Essa mudança de estado não é permitida.",
      };
    case "BD103":
      return {
        code: "invalid-roster",
        field: "roster",
        message: "Revise os atletas e números informados.",
      };
    case "BD104":
      return {
        code: "player-conflict",
        field: "player",
        message: "Um atleta já representa outra equipe nesta edição.",
      };
    case "BD105":
      return {
        code: "jersey-conflict",
        field: "jersey",
        message: "Duas pessoas não podem usar a mesma camisa ativa na equipe.",
      };
    case "BD201":
    case "BD202":
      return {
        code: "invalid-result",
        field: "placement",
        message: "Revise o estado final e a colocação informada.",
      };
    case "BD203":
      return {
        code: "result-conflict",
        field: "placement",
        message: "Essa colocação já pertence a outra equipe na edição.",
      };
    case "BD501":
      return {
        code: "invalid-profile",
        field: "dataProfile",
        message: "Revise o naipe, a fonte primária e a justificativa informados.",
      };
    case "BD503":
      return {
        code: "profile-transition",
        field: "dataProfile",
        message: "Esse perfil não pode ser ativado no estado atual.",
      };
    case "BD504":
      return {
        code: "profile-context",
        field: "dataProfile",
        message: "O perfil não pertence à mesma série, categoria e naipe desta edição.",
      };
    case "BD505":
      return {
        code: "review-required",
        field: "genderDivision",
        message: "Revise o naipe antes de configurar a fonte primária.",
      };
    case "BD506":
      return {
        code: "context-conflict",
        field: "genderDivision",
        message: "Já existe uma edição com a mesma série, categoria, naipe e ano.",
      };
    default:
      return {
        code: "unknown",
        message: "Não foi possível concluir a operação.",
      };
  }
}
