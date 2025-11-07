/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_AUTH_URL: string;
  readonly VITE_AUTH_APP_ID: string;
  readonly VITE_AUTH_API_KEY: string;
  readonly VITE_REDIRECT_URI: string;
  readonly AUTH_VALIDA_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
