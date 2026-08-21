export type AdminDomainErrorCode =
  | "authorization"
  | "not-found"
  | "transition"
  | "invalid-roster"
  | "player-conflict"
  | "jersey-conflict"
  | "unknown";

export interface AdminDomainError {
  code: AdminDomainErrorCode;
  field?: "competition" | "team" | "status" | "roster" | "player" | "jersey";
  message: string;
}

const jerseyPattern = /^(?:0|00|[1-9][0-9]?)$/;

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
    default:
      return {
        code: "unknown",
        message: "Não foi possível concluir a operação.",
      };
  }
}
