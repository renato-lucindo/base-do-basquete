declare global {
  interface Env {
    SUPABASE_URL: string;
    SUPABASE_PUBLISHABLE_KEY: string;
    SESSION_SECRET: string;
    PREVIEW_PASSWORD_AUTH?: string;
    PREVIEW_AUTH_SECRET?: string;
  }
}

export {};
