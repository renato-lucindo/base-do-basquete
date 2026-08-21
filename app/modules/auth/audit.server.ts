import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/database.generated";

export type AuthAuditEvent = "admin_access" | "logout" | "mfa_verified" | "session_refreshed";

export async function recordAuthAuditEvent(
  client: SupabaseClient<Database>,
  eventType: AuthAuditEvent,
  correlationId: string,
): Promise<void> {
  const { error } = await client.from("auth_audit_events").insert({
    correlation_id: correlationId,
    event_type: eventType,
    metadata: {},
  });

  if (error) throw new Error(`Unable to record ${eventType} audit event`);
}

export function logAuthEvent(
  correlationId: string,
  event: string,
  outcome: "blocked" | "failure" | "success",
): void {
  console.info(JSON.stringify({ correlationId, event, outcome }));
}
