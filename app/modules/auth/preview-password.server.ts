interface PreviewPasswordEnvironment {
  APP_ENV: string;
  SUPABASE_URL: string;
  PREVIEW_PASSWORD_AUTH_PROJECT_REF?: string;
}

// These existing projects must never receive the password-only preview exception.
const protectedProjects = new Set(["yjnbemfeyjhxhomprlnm", "payumtvegfqfejmowxiy"]);

export function usesPreviewPasswordAuth(env: PreviewPasswordEnvironment): boolean {
  const ref = env.PREVIEW_PASSWORD_AUTH_PROJECT_REF;
  if (ref === undefined) return false;
  if (
    env.APP_ENV !== "preview" ||
    !/^[a-z]{20}$/u.test(ref) ||
    protectedProjects.has(ref) ||
    env.SUPABASE_URL !== `https://${ref}.supabase.co`
  ) {
    throw new Error("Invalid preview password authentication configuration");
  }
  return true;
}
