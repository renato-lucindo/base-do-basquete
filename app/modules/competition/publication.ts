export interface PublicationReview {
  competitionId: number;
  currentVersion: number;
  nextVersion: number;
  confirmedTeams: number;
  eligibleGames: number;
  invalidGames: number;
  startsOn: string | null;
  canPublish: boolean;
  blockers: string[];
  changed: boolean;
}

function nonNegativeInteger(value: unknown): number | null {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

export function validatePublication(form: FormData) {
  const expectedVersion = nonNegativeInteger(form.get("expectedVersion"));
  if (expectedVersion === null || form.get("confirmed") !== "yes") {
    return {
      ok: false as const,
      error: "Confirme a revisão e recarregue a página antes de publicar.",
    };
  }
  return { ok: true as const, input: { expectedVersion } };
}

export function publicationBlocker(code: string): string {
  const labels: Record<string, string> = {
    ARCHIVED: "A edição está arquivada.",
    START_DATE_REQUIRED: "Defina a data inicial da edição.",
    BEFORE_STARTS_ON: "A publicação será liberada na data inicial da edição.",
    GENDER_REVIEW_REQUIRED: "Conclua a revisão de naipe.",
    DATA_PROFILE_REVIEW_REQUIRED: "Conclua a revisão da fonte primária.",
    CONFIRMED_TEAMS_REQUIRED: "Confirme pelo menos duas equipes.",
    INVALID_PUBLIC_GAME: "Há jogo público sem exatamente dois participantes.",
  };
  return labels[code] ?? "Existe uma pendência editorial não reconhecida.";
}

export function publicationError(code: string | undefined): string {
  const labels: Record<string, string> = {
    BD401: "Confirme novamente o MFA para continuar.",
    BD404: "Edição não encontrada.",
    BR041: "A revisão mudou. Recarregue antes de publicar.",
    BR042: "A publicação está bloqueada pelas pendências da revisão.",
    BR043: "Confirme explicitamente a revisão para publicar.",
  };
  return labels[code ?? ""] ?? "Não foi possível publicar. Recarregue e tente novamente.";
}
