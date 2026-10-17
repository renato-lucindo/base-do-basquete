interface PreviewPasswordEnvironment {
  APP_ENV: string;
  PREVIEW_PASSWORD_AUTH?: string;
}
export function usesPreviewPasswordAuth(env: PreviewPasswordEnvironment): boolean {
  if (env.PREVIEW_PASSWORD_AUTH === undefined) return false;
  if (env.APP_ENV !== "preview" || env.PREVIEW_PASSWORD_AUTH !== "enabled") {
    throw new Error("Invalid preview password authentication configuration");
  }
  return true;
}
