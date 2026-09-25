export type OperationalOutcome = "blocked" | "failure" | "success";

export type OperationalName =
  | "admin.competition"
  | "auth"
  | "boxscore"
  | "boxscore.commit"
  | "boxscore.refresh_stats"
  | "boxscore.resolve_teams"
  | "boxscore.upload"
  | "health"
  | "player.create"
  | "player.private_profile"
  | "public"
  | "roster.replace"
  | "scoresheet"
  | "scoresheet.save";

export interface OperationalContext {
  competitionId?: number;
  entityId?: number;
  errorCode?: string;
}

interface OperationalEventInput {
  correlationId: string;
  durationMs: number;
  method?: string;
  operation: OperationalName;
  outcome: OperationalOutcome;
  status?: number;
  context?: OperationalContext;
}

type LogSink = (message: string) => void;

function safePositiveInteger(value: number | undefined): number | undefined {
  return Number.isSafeInteger(value) && (value ?? 0) > 0 ? value : undefined;
}

function safeErrorCode(value: string | undefined): string | undefined {
  return value && /^[A-Z][A-Z0-9_]{1,63}$/u.test(value) ? value : undefined;
}

export function classifyRequestOperation(request: Request): OperationalName {
  const pathname = new URL(request.url).pathname;
  if (pathname === "/health") return "health";
  if (/^\/admin\/(?:login|logout|mfa)(?:\/|$)/u.test(pathname)) return "auth";
  if (pathname.includes("/boxscores/import")) return "boxscore";
  if (pathname.includes("/scoresheets/")) return "scoresheet";
  if (/^\/admin\/competitions\/[1-9][0-9]*\/?$/u.test(pathname)) {
    return "admin.competition";
  }
  return pathname.startsWith("/admin") ? "auth" : "public";
}

export function outcomeFromStatus(status: number): OperationalOutcome {
  if (status >= 500) return "failure";
  if (status >= 400) return "blocked";
  return "success";
}

export function logOperationalEvent(
  input: OperationalEventInput,
  sink: LogSink = console.info,
): void {
  const competitionId = safePositiveInteger(input.context?.competitionId);
  const entityId = safePositiveInteger(input.context?.entityId);
  const errorCode = safeErrorCode(input.context?.errorCode);
  const event = {
    event: "bdb.operation",
    correlationId: input.correlationId,
    operation: input.operation,
    outcome: input.outcome,
    durationMs: Math.max(0, Math.round(input.durationMs)),
    ...(input.method ? { method: input.method.toUpperCase().slice(0, 12) } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(competitionId ? { competitionId } : {}),
    ...(entityId ? { entityId } : {}),
    ...(errorCode ? { errorCode } : {}),
  };
  sink(JSON.stringify(event));
}
