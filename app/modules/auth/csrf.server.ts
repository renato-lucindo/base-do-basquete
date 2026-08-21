export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("Origin");
  if (!origin || origin !== new URL(request.url).origin) {
    throw new Response("Origem inválida", { status: 403 });
  }
}

export function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return difference === 0;
}

export function assertCsrfToken(formData: FormData, expectedToken: string): void {
  const submittedToken = formData.get("csrfToken");
  if (typeof submittedToken !== "string" || !constantTimeEqual(submittedToken, expectedToken)) {
    throw new Response("Requisição inválida", { status: 403 });
  }
}
