export function scheduleId(value: unknown): number | null {
  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

/** Require an explicit offset; never interpret browser or server local time. */
export function validateSchedule(form: FormData) {
  const matchupId = scheduleId(form.get("matchupId"));
  const revisionText = form.get("expectedRevision");
  const rawDate = form.get("scheduledAt");
  const rawVenue = form.get("venue");
  if (
    !matchupId ||
    typeof revisionText !== "string" ||
    !/^(0|[1-9][0-9]*)$/.test(revisionText) ||
    !Number.isSafeInteger(Number(revisionText)) ||
    typeof rawDate !== "string" ||
    typeof rawVenue !== "string"
  ) {
    return { ok: false as const, error: "Recarregue a página e revise o agendamento." };
  }
  const venue = rawVenue.trim();
  if (venue.length > 160)
    return { ok: false as const, error: "O local deve ter no máximo 160 caracteres." };
  let scheduledAt: string | null = null;
  if (rawDate) {
    const match =
      /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)(Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.exec(rawDate);
    const date = match ? new Date(`${match[1]}T00:00:00Z`) : null;
    if (
      !match ||
      !date ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== match[1] ||
      Number(match[1].slice(0, 4)) < 1900 ||
      !Number.isFinite(Date.parse(rawDate))
    ) {
      return { ok: false as const, error: "Informe data e horário válidos com fuso explícito." };
    }
    scheduledAt = new Date(rawDate).toISOString();
  }
  return {
    ok: true as const,
    input: {
      matchupId,
      expectedRevision: Number(revisionText),
      scheduledAt,
      venue: venue || null,
    },
  };
}

export function validateResolution(form: FormData) {
  const matchupId = scheduleId(form.get("matchupId"));
  const submissionId = scheduleId(form.get("officialResultSubmissionId"));
  if (!matchupId || !submissionId)
    return { ok: false as const, error: "O resultado oficial ativo precisa ser recarregado." };
  return { ok: true as const, input: { matchupId, submissionId } };
}

export function schedulingError(code: string | undefined): string {
  const messages: Record<string, string> = {
    BD401: "Confirme novamente o MFA para continuar.",
    BD404: "Confronto ou vaga não encontrado.",
    BR020: "Esta operação exige uma edição privada em rascunho.",
    BR021: "Esta vaga já foi atribuída. A alteração exige um fluxo de correção.",
    BR022: "A edição precisa de um preset ativo.",
    BR023: "Confirme a inscrição da equipe antes de continuar.",
    BR024: "Esta equipe já ocupa outra vaga nesta edição.",
    BR025: "Revise o horário, o local e o período da edição.",
    BR026: "O agendamento mudou. Recarregue e revise antes de salvar.",
    BR027: "Um jogo iniciado ou com dados registrados não pode ser reagendado aqui.",
    BR030: "Este confronto já foi resolvido. Correções exigem o fluxo de emenda.",
    BR031: "O resultado oficial ativo mudou ou ainda não está pronto. Recarregue a página.",
    BR032: "Uma competição arquivada não pode progredir.",
    BR033: "A progressão automática básica vale somente para confrontos eliminatórios.",
    BR034: "O jogo precisa estar finalizado antes de resolver o confronto.",
    BR035: "O resultado oficial está incompleto ou inconsistente.",
  };
  return messages[code ?? ""] ?? "Não foi possível salvar. Recarregue e tente novamente.";
}
