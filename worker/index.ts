interface Env {
  APP_ENV: "preview" | "production";
}

function securityHeaders(): Headers {
  return new Headers({
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Cache-Control": "no-store"
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const correlationId = crypto.randomUUID();
    const headers = securityHeaders();
    headers.set("Content-Type", "application/json; charset=utf-8");
    headers.set("X-Correlation-Id", correlationId);

    if (request.method !== "GET" || url.pathname !== "/health") {
      return Response.json(
        { error: "not_found", correlationId },
        { status: 404, headers }
      );
    }

    return Response.json(
      { status: "ok", service: "base-do-basquete", environment: env.APP_ENV },
      { status: 200, headers }
    );
  }
} satisfies ExportedHandler<Env>;
