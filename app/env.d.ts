declare global {
  interface Env {
    SUPABASE_URL: string;
    SUPABASE_PUBLISHABLE_KEY: string;
    SESSION_SECRET: string;
  }
}

export {};
