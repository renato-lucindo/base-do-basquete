import { applySecurityHeaders } from "../http/security.server";

type HealthEnvironment = Pick<Env, "APP_ENV">;

export function healthResponse(env: HealthEnvironment, correlationId: string): Response {
  const response = Response.json(
    {
      environment: env.APP_ENV,
      service: "base-do-basquete",
      status: "ok",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );

  return applySecurityHeaders(response, correlationId);
}
