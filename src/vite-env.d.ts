/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONFIG_API_URL: string;
  readonly VITE_FUNCTIONS_BASE_URL: string;
  readonly VITE_QUERY_API_URL: string;
  readonly FUNCTIONS_BASE_URL: string;
  readonly QUERY_API_URL: string;
  readonly PLANS_API_URL: string;
  readonly VITE_PLANS_API_URL: string;
  readonly API_KEY: string;
  readonly VITE_API_KEY: string;
  readonly API_KEY_USER_EMBED: string;

  readonly VITE_AUTH_URL: string;
  readonly AUTH_URL: string;
  readonly AUTH_FUNCTIONS_BASE_URL: string;
  readonly AUTH_EDGE_FUNCTIONS_BASE_URL?: string;
  readonly VITE_AUTH_APP_ID: string;
  readonly VITE_AUTH_API_KEY: string;
  readonly VITE_REDIRECT_URI: string;
  readonly AUTH_VALIDA_TOKEN?: string;
  readonly AUTH_EXCHANGE_URL?: string;
  readonly AUTH_TOKEN_VALIDA?: string;
  readonly AUTH_VERIFY_URL?: string;
  readonly AUTH_REFRESH_URL?: string;
  readonly AUTH_LOGOUT_URL?: string;
  readonly URL_HEALTH_CHECK_API?: string;
  readonly VALIDATION_API_BASE_URL?: string;
  readonly CANCEL_SUBSCRIPTION_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
