export const ADMIN_DRAFT_SCHEMA_VERSION = 1 as const;
export const ADMIN_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type AdminDraftFlow = "roster" | "manual-scoresheet" | "boxscore-review";

export interface AdminDraft<T> {
  schemaVersion: typeof ADMIN_DRAFT_SCHEMA_VERSION;
  flow: AdminDraftFlow;
  competitionId: number;
  entityId?: number;
  savedAt: string;
  expiresAt: string;
  data: T;
}

export type AdminDraftReadResult<T> =
  | { status: "missing" }
  | { status: "expired" | "incompatible" | "unsafe" }
  | { status: "available"; draft: AdminDraft<T> };

const forbiddenKeyPattern =
  /(^|_)(pdf|file|binary|blob|token|cookie|session|secret|credential|password|signed_?url|csrf|idempotency)(_|$)/i;

function hasForbiddenValue(value: unknown, seen = new WeakSet<object>()): boolean {
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (value instanceof Blob || value instanceof ArrayBuffer) return true;
  if (ArrayBuffer.isView(value)) return true;
  return Object.entries(value).some(
    ([key, nested]) =>
      forbiddenKeyPattern.test(key.replace(/([a-z0-9])([A-Z])/g, "$1_$2")) ||
      hasForbiddenValue(nested, seen),
  );
}

export function adminDraftKey(
  flow: AdminDraftFlow,
  competitionId: number,
  entityId?: number,
): string {
  return `base-do-basquete:admin-draft:v1:${flow}:${competitionId}:${entityId ?? "new"}`;
}

export function createAdminDraft<T>(
  flow: AdminDraftFlow,
  competitionId: number,
  data: T,
  options?: { entityId?: number; now?: Date; ttlMs?: number },
): AdminDraft<T> {
  if (hasForbiddenValue(data)) throw new Error("ADMIN_DRAFT_UNSAFE_DATA");
  const now = options?.now ?? new Date();
  const ttlMs = options?.ttlMs ?? ADMIN_DRAFT_TTL_MS;
  return {
    schemaVersion: ADMIN_DRAFT_SCHEMA_VERSION,
    flow,
    competitionId,
    ...(options?.entityId ? { entityId: options.entityId } : {}),
    savedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    data,
  };
}

export function parseAdminDraft<T>(
  raw: string | null,
  expected: { flow: AdminDraftFlow; competitionId: number; entityId?: number; now?: Date },
): AdminDraftReadResult<T> {
  if (!raw) return { status: "missing" };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { status: "incompatible" };
  }
  if (!value || typeof value !== "object" || hasForbiddenValue(value)) {
    return { status: "unsafe" };
  }
  const candidate = value as Partial<AdminDraft<T>>;
  if (
    candidate.schemaVersion !== ADMIN_DRAFT_SCHEMA_VERSION ||
    candidate.flow !== expected.flow ||
    candidate.competitionId !== expected.competitionId ||
    candidate.entityId !== expected.entityId ||
    typeof candidate.savedAt !== "string" ||
    typeof candidate.expiresAt !== "string" ||
    !("data" in candidate)
  ) {
    return { status: "incompatible" };
  }
  const savedAt = Date.parse(candidate.savedAt);
  const expiresAt = Date.parse(candidate.expiresAt);
  if (!Number.isFinite(savedAt) || !Number.isFinite(expiresAt)) {
    return { status: "incompatible" };
  }
  if (expiresAt <= (expected.now ?? new Date()).getTime()) return { status: "expired" };
  return { status: "available", draft: candidate as AdminDraft<T> };
}
