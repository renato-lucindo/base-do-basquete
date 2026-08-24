import { createRequestHandler, RouterContextProvider } from "react-router";

import { cloudflareContext, correlationIdContext } from "../app/context";
import { healthResponse } from "../app/modules/health/health.server";
import { applySecurityHeaders } from "../app/modules/http/security.server";
import {
  classifyRequestOperation,
  logOperationalEvent,
  outcomeFromStatus,
} from "../app/modules/observability/operation.server";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    const correlationId = crypto.randomUUID();
    const url = new URL(request.url);
    const operation = classifyRequestOperation(request);
    const startedAt = Date.now();

    try {
      if (request.method === "GET" && url.pathname === "/health") {
        const response = healthResponse(env, correlationId);
        logOperationalEvent({
          correlationId,
          durationMs: Date.now() - startedAt,
          method: request.method,
          operation,
          outcome: outcomeFromStatus(response.status),
          status: response.status,
        });
        return response;
      }

      const routerContext = new RouterContextProvider();
      routerContext.set(cloudflareContext, { env, ctx });
      routerContext.set(correlationIdContext, correlationId);

      const response = applySecurityHeaders(
        await requestHandler(request, routerContext),
        correlationId,
      );
      logOperationalEvent({
        correlationId,
        durationMs: Date.now() - startedAt,
        method: request.method,
        operation,
        outcome: outcomeFromStatus(response.status),
        status: response.status,
      });
      return response;
    } catch (error) {
      logOperationalEvent({
        correlationId,
        durationMs: Date.now() - startedAt,
        method: request.method,
        operation,
        outcome: "failure",
        status: 500,
      });
      throw error;
    }
  },
} satisfies ExportedHandler<Env>;
