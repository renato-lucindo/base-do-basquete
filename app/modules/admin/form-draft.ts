export const ADMIN_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export type DraftFieldValues = Record<string, string[]>;

export interface AdminFormDraft {
  version: 1;
  formId: string;
  contextId: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  fields: DraftFieldValues;
}

const forbiddenName =
  /(csrf|token|session|secret|credential|password|passcode|mfa|totp|idempotency|pdf|file|boxscore)/i;

export function isForbiddenDraftField(name: string): boolean {
  return forbiddenName.test(name);
}

export function sanitizeDraftEntries(
  entries: Iterable<[string, FormDataEntryValue]>,
): DraftFieldValues {
  const fields: DraftFieldValues = {};
  for (const [name, value] of entries) {
    if (!name || isForbiddenDraftField(name) || typeof value !== "string") continue;
    const values = fields[name] ?? [];
    values.push(value.slice(0, 2_000));
    fields[name] = values;
  }
  return fields;
}

export function createAdminFormDraft(
  formId: string,
  contextId: string,
  fields: DraftFieldValues,
  now = Date.now(),
): AdminFormDraft {
  return {
    version: 1,
    formId,
    contextId,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + ADMIN_DRAFT_TTL_MS,
    fields,
  };
}

export function parseAdminFormDraft(
  raw: string | null,
  formId: string,
  contextId: string,
  now = Date.now(),
): AdminFormDraft | null {
  if (!raw) return null;
  try {
    const candidate = JSON.parse(raw) as Partial<AdminFormDraft>;
    if (
      candidate.version !== 1 ||
      candidate.formId !== formId ||
      candidate.contextId !== contextId ||
      typeof candidate.createdAt !== "number" ||
      typeof candidate.updatedAt !== "number" ||
      typeof candidate.expiresAt !== "number" ||
      candidate.expiresAt <= now ||
      !candidate.fields ||
      typeof candidate.fields !== "object"
    ) {
      return null;
    }

    const fields: DraftFieldValues = {};
    for (const [name, values] of Object.entries(candidate.fields)) {
      if (
        isForbiddenDraftField(name) ||
        !Array.isArray(values) ||
        values.some((value) => typeof value !== "string")
      ) {
        continue;
      }
      fields[name] = values.map((value) => value.slice(0, 2_000));
    }
    return { ...(candidate as AdminFormDraft), fields };
  } catch {
    return null;
  }
}
