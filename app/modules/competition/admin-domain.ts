export type AdminDomainErrorCode =
  | "authorization"
  | "not-found"
  | "transition"
  | "invalid-roster"
  | "player-conflict"
  | "jersey-conflict"
  | "invalid-result"
  | "result-conflict"
  | "unknown";

export interface AdminDomainError {
  code: AdminDomainErrorCode;
  field?: "competition" | "team" | "status" | "roster" | "player" | "jersey" | "placement";
  message: string;
}

const jerseyPattern = /^(?:0|00|[1-9][0-9]?)$/;

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
    default:
      return {
        code: "unknown",
        message: "Não foi possível concluir a operação.",
      };
  }
}
