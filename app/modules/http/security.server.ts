const baseSecurityHeaders = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'none'",
    "connect-src 'self'",
    "font-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
  ].join("; "),
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
} as const;

export function applySecurityHeaders(response: Response, correlationId: string): Response {
  const headers = new Headers(response.headers);

  for (const [name, value] of Object.entries(baseSecurityHeaders)) {
    headers.set(name, value);
  }

  headers.set("X-Correlation-Id", correlationId);

  if (headers.get("Content-Type")?.startsWith("text/html") && !headers.has("Cache-Control")) {
    headers.set("Cache-Control", "no-store");
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}
