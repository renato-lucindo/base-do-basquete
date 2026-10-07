import {
  type AdminDraftFlow,
  type AdminDraftReadResult,
  adminDraftKey,
  createAdminDraft,
  parseAdminDraft,
} from "./schema";

interface DraftIdentity {
  flow: AdminDraftFlow;
  competitionId: number;
  entityId?: number;
  editorVersion?: string;
}

export function readAdminDraft<T>(identity: DraftIdentity): AdminDraftReadResult<T> {
  if (typeof window === "undefined") return { status: "missing" };
  const key = adminDraftKey(
    identity.flow,
    identity.competitionId,
    identity.entityId,
    identity.editorVersion,
  );
  const result = parseAdminDraft<T>(window.localStorage.getItem(key), identity);
  if (
    result.status === "expired" ||
    result.status === "incompatible" ||
    result.status === "unsafe"
  ) {
    window.localStorage.removeItem(key);
  }
  return result;
}

export function saveAdminDraft<T>(identity: DraftIdentity, value: T): string {
  if (typeof window === "undefined") return "";
  const draft = createAdminDraft(identity.flow, identity.competitionId, value, {
    entityId: identity.entityId,
    editorVersion: identity.editorVersion,
  });
  window.localStorage.setItem(
    adminDraftKey(identity.flow, identity.competitionId, identity.entityId, identity.editorVersion),
    JSON.stringify(draft),
  );
  return draft.savedAt;
}

export function removeAdminDraft(identity: DraftIdentity) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(
    adminDraftKey(identity.flow, identity.competitionId, identity.entityId, identity.editorVersion),
  );
}
