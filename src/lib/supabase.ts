import { authClient } from './auth';
import { db } from './db';
import { configManager, getRuntimeConfig } from './config';
import { functionsFetch } from './functions';

type Session = {
  access_token: string;
  refresh_token?: string;
  user?: unknown;
} | null;

class RealtimeChannelStub {
  constructor(public readonly name: string) {}

  on(_event: string, _filter: Record<string, unknown>, _callback: (payload: any) => void) {
    return this;
  }

  subscribe() {
    return this;
  }

  unsubscribe() {
    return this;
  }
}

async function getSession(): Promise<{ data: { session: Session }; error: null }> {
  const token = authClient.getAccessToken() || localStorage.getItem('access_token') || '';
  const refreshToken = localStorage.getItem('refresh_token') || undefined;
  const userRaw = localStorage.getItem('user');
  const user = userRaw ? JSON.parse(userRaw) : undefined;

  if (!token) {
    return { data: { session: null }, error: null };
  }

  return {
    data: {
      session: {
        access_token: token,
        refresh_token: refreshToken,
        user,
      },
    },
    error: null,
  };
}

async function signOut() {
  authClient.setAccessToken(null);
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  return { data: { session: null }, error: null };
}

async function invoke(path: string, options: { method?: string; body?: unknown; headers?: Record<string, string>; includeApiKey?: boolean } = {}) {
  await configManager.loadConfig();
  const response = await functionsFetch(path, {
    method: options.method || 'POST',
    headers: options.headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    includeApiKey: options.includeApiKey,
  });

  const data = await response.json().catch(() => ({}));
  return {
    data,
    error: response.ok ? null : data?.error ?? { message: response.statusText },
  };
}

export const supabase = {
  from: <T = any>(table: string) => db.from<T>(table),
  auth: {
    getSession,
    signOut,
  },
  functions: {
    invoke,
  },
  channel: (name: string) => new RealtimeChannelStub(name),
  removeChannel: async (_channel?: RealtimeChannelStub) => undefined,
  getRuntimeConfig,
};

export type SupabaseLike = typeof supabase;
