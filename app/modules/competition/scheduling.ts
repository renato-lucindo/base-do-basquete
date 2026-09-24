export function scheduleId(value: unknown): number | null {
  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export const competitionTimeZone = "America/Sao_Paulo";

function zonedParts(instant: Date) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: competitionTimeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

export function scheduleLocalParts(instant: string | null): { date: string; time: string } {
  if (!instant) return { date: "", time: "" };
  const parsed = new Date(instant);
  if (!Number.isFinite(parsed.getTime())) return { date: "", time: "" };
  const parts = zonedParts(parsed);
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    date: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
    time: `${pad(parts.hour)}:${pad(parts.minute)}`,
  };
}

export function scheduleLocalToIso(date: string, time: string): string | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (year < 1900) return null;

  const wallClockUtc = Date.UTC(year, month - 1, day, hour, minute);
  const calendarCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarCheck.getUTCFullYear() !== year ||
    calendarCheck.getUTCMonth() !== month - 1 ||
    calendarCheck.getUTCDate() !== day
  ) {
    return null;
  }

  const offsetAt = (timestamp: number) => {
    const instant = new Date(timestamp);
    const parts = zonedParts(instant);
    return (
      Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) -
      Math.floor(timestamp / 60000) * 60000
    );
  };
  let candidate = wallClockUtc - offsetAt(wallClockUtc);
  candidate = wallClockUtc - offsetAt(candidate);
  const verified = zonedParts(new Date(candidate));
  if (
    verified.year !== year ||
    verified.month !== month ||
    verified.day !== day ||
    verified.hour !== hour ||
    verified.minute !== minute
  ) {
    return null;
  }
  return new Date(candidate).toISOString();
}

/** Interpret the browser's date/time controls only in the competition's official timezone. */
export function validateSchedule(form: FormData) {
  const matchupId = scheduleId(form.get("matchupId"));
  const revisionText = form.get("expectedRevision");
  const rawDate = form.get("scheduledDate");
  const rawTime = form.get("scheduledTime");
  const rawVenue = form.get("venue");
  if (
    !matchupId ||
    typeof revisionText !== "string" ||
    !/^(0|[1-9][0-9]*)$/.test(revisionText) ||
    !Number.isSafeInteger(Number(revisionText)) ||
    typeof rawDate !== "string" ||
    typeof rawTime !== "string" ||
    typeof rawVenue !== "string"
  ) {
    return { ok: false as const, error: "Recarregue a página e revise o agendamento." };
  }
  const venue = rawVenue.trim();
  if (venue.length > 160)
    return { ok: false as const, error: "O local deve ter no máximo 160 caracteres." };
  let scheduledAt: string | null = null;
  if (Boolean(rawDate) !== Boolean(rawTime)) {
    return { ok: false as const, error: "Informe data e horário juntos." };
  }
  if (rawDate && rawTime) {
    scheduledAt = scheduleLocalToIso(rawDate, rawTime);
    if (!scheduledAt) return { ok: false as const, error: "Informe data e horário válidos." };
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

export function validateScheduleBatch(form: FormData) {
  const selectedIds = form.getAll("selectedMatchupId").map((value) => scheduleId(value));
  if (
    selectedIds.length === 0 ||
    selectedIds.length > 64 ||
    selectedIds.some((value) => value === null) ||
    new Set(selectedIds).size !== selectedIds.length
  ) {
    return { ok: false as const, error: "Selecione ao menos um jogo válido para salvar." };
  }

  const bulkDate = String(form.get("bulkDate") ?? "");
  const bulkTime = String(form.get("bulkTime") ?? "");
  const bulkVenue = String(form.get("bulkVenue") ?? "").trim();
  if (bulkVenue.length > 160) {
    return { ok: false as const, error: "O local em lote deve ter no máximo 160 caracteres." };
  }

  const items: Array<{
    matchupId: number;
    expectedRevision: number;
    scheduledAt: string | null;
    venue: string | null;
  }> = [];
  for (const matchupId of selectedIds as number[]) {
    const revisionText = String(form.get(`revision-${matchupId}`) ?? "");
    const rowDate = String(form.get(`date-${matchupId}`) ?? "");
    const rowTime = String(form.get(`time-${matchupId}`) ?? "");
    const rowVenue = String(form.get(`venue-${matchupId}`) ?? "").trim();
    if (!/^(0|[1-9][0-9]*)$/.test(revisionText) || !Number.isSafeInteger(Number(revisionText))) {
      return { ok: false as const, error: "A agenda mudou. Recarregue antes de salvar." };
    }
    if (rowVenue.length > 160) {
      return { ok: false as const, error: "O local deve ter no máximo 160 caracteres." };
    }

    const scheduledDate = bulkDate || rowDate;
    const scheduledTime = bulkTime || rowTime;
    if (Boolean(scheduledDate) !== Boolean(scheduledTime)) {
      return {
        ok: false as const,
        error:
          "Cada jogo precisa ter data e horário juntos. O valor em lote pode completar a linha.",
      };
    }
    let scheduledAt: string | null = null;
    if (scheduledDate && scheduledTime) {
      scheduledAt = scheduleLocalToIso(scheduledDate, scheduledTime);
      if (!scheduledAt) {
        return { ok: false as const, error: "Revise as datas e horários selecionados." };
      }
    }

    items.push({
      matchupId,
      expectedRevision: Number(revisionText),
      scheduledAt,
      venue: bulkVenue || rowVenue || null,
    });
  }

  return { ok: true as const, input: { items } };
}

export function validateResolution(form: FormData) {
  const matchupId = scheduleId(form.get("matchupId"));
  const submissionId = scheduleId(form.get("officialResultSubmissionId"));
  if (!matchupId || !submissionId)
    return { ok: false as const, error: "O resultado oficial ativo precisa ser recarregado." };
  return { ok: true as const, input: { matchupId, submissionId } };
}

function scheduleRequestId(value: unknown): string | null {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function scheduleDetails(form: FormData) {
  const rawDate = form.get("scheduledDate");
  const rawTime = form.get("scheduledTime");
  const rawVenue = form.get("venue");
  if (typeof rawDate !== "string" || typeof rawTime !== "string" || typeof rawVenue !== "string") {
    return { ok: false as const, error: "Revise a data, o horário e o local." };
  }
  const venue = rawVenue.trim();
  if (venue.length > 160) {
    return { ok: false as const, error: "O local deve ter no máximo 160 caracteres." };
  }
  if (Boolean(rawDate) !== Boolean(rawTime)) {
    return { ok: false as const, error: "Informe data e horário juntos." };
  }
  let scheduledAt: string | null = null;
  if (rawDate && rawTime) {
    scheduledAt = scheduleLocalToIso(rawDate, rawTime);
    if (!scheduledAt) return { ok: false as const, error: "Informe data e horário válidos." };
  }
  return { ok: true as const, scheduledAt, venue: venue || null };
}

export function validateManualMatchup(form: FormData) {
  const requestId = scheduleRequestId(form.get("requestId"));
  const roundId = scheduleId(form.get("roundId"));
  const homeRegistrationId = scheduleId(form.get("homeRegistrationId"));
  const awayRegistrationId = scheduleId(form.get("awayRegistrationId"));
  const details = scheduleDetails(form);
  if (!requestId || !roundId || !homeRegistrationId || !awayRegistrationId || !details.ok) {
    return {
      ok: false as const,
      error: details.ok ? "Escolha a fase e duas equipes válidas." : details.error,
    };
  }
  if (homeRegistrationId === awayRegistrationId) {
    return { ok: false as const, error: "Mandante e visitante precisam ser equipes diferentes." };
  }
  return {
    ok: true as const,
    input: {
      requestId,
      roundId,
      homeRegistrationId,
      awayRegistrationId,
      scheduledAt: details.scheduledAt,
      venue: details.venue,
    },
  };
}

export function validateManualParticipants(form: FormData) {
  const matchupId = scheduleId(form.get("matchupId"));
  const expectedHomeRegistrationId = scheduleId(form.get("expectedHomeRegistrationId"));
  const expectedAwayRegistrationId = scheduleId(form.get("expectedAwayRegistrationId"));
  const homeRegistrationId = scheduleId(form.get("homeRegistrationId"));
  const awayRegistrationId = scheduleId(form.get("awayRegistrationId"));
  if (
    !matchupId ||
    !expectedHomeRegistrationId ||
    !expectedAwayRegistrationId ||
    !homeRegistrationId ||
    !awayRegistrationId
  ) {
    return { ok: false as const, error: "Recarregue a página e escolha as duas equipes." };
  }
  if (homeRegistrationId === awayRegistrationId) {
    return { ok: false as const, error: "Mandante e visitante precisam ser equipes diferentes." };
  }
  return {
    ok: true as const,
    input: {
      matchupId,
      expectedHomeRegistrationId,
      expectedAwayRegistrationId,
      homeRegistrationId,
      awayRegistrationId,
    },
  };
}

export function schedulingError(code: string | undefined): string {
  const messages: Record<string, string> = {
    BD401: "Confirme novamente o MFA para continuar.",
    BD404: "Confronto ou vaga não encontrado.",
    BR020: "Esta operação exige uma edição privada em rascunho.",
    BR021: "Esta vaga já foi atribuída. A alteração exige um fluxo de correção.",
    BR022: "A edição precisa de uma estrutura ativa com fase e rodada.",
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
    BR097: "Este confronto não pode ser alterado pelo fluxo manual.",
    BR098: "As equipes ou a agenda mudaram. Recarregue antes de salvar.",
    BR099: "Este jogo já possui histórico que impede a troca das equipes.",
  };
  return messages[code ?? ""] ?? "Não foi possível salvar. Recarregue e tente novamente.";
}
