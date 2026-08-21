import { createRequestHandler, RouterContextProvider } from "react-router";

import { cloudflareContext, correlationIdContext } from "../app/context";
import { healthResponse } from "../app/modules/health/health.server";
import { applySecurityHeaders } from "../app/modules/http/security.server";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    const correlationId = crypto.randomUUID();
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return healthResponse(env, correlationId);
    }

    const routerContext = new RouterContextProvider();
    routerContext.set(cloudflareContext, { env, ctx });
    routerContext.set(correlationIdContext, correlationId);

    const response = await requestHandler(request, routerContext);

    return applySecurityHeaders(response, correlationId);
  },
} satisfies ExportedHandler<Env>;
