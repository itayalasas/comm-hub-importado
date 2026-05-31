import { buildFunctionsUrl, getRuntimeConfig } from './config';

const PENDING_CHECKOUT_STORAGE_KEY = 'pending_subscription_checkout';
const TEST_SUBSCRIPTION_EMAIL = 'test_user_1004704034@testuser.com';
const CHECKOUT_REQUEST_TIMEOUT_MS = 20000;

export interface ManagedCheckoutConfig {
  managed_by_authsystem: boolean;
  start_endpoint?: string;
  status_endpoint?: string;
}

export interface PendingSubscriptionCheckout {
  checkout_session_id: string;
  plan_id: string;
  created_at: number;
}

export interface StartManagedCheckoutArgs {
  applicationId: string;
  apiKey: string;
  planId: string;
  returnUrl: string;
  email?: string;
  tenantId?: string;
  endpoint?: string;
}

export interface StartManagedCheckoutResult {
  requires_redirect: boolean;
  checkout_session_id: string;
  checkout_url?: string;
  redirect_url?: string;
}

export interface CheckoutStatusArgs {
  applicationId: string;
  apiKey: string;
  checkoutSessionId: string;
  endpoint?: string;
}

export interface CheckoutStatusResult {
  subscription?: any;
  has_access?: boolean;
  available_plans?: any[];
  [key: string]: any;
}

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = CHECKOUT_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

export function resolveCheckoutEndpoint(endpoint: string | undefined, fallbackPath: string): string {
  const runtime = getRuntimeConfig();
  const baseUrl = (runtime.functionsBaseUrlRaw || runtime.supabaseUrl || '').trim().replace(/\/+$/, '');
  if (!baseUrl) {
    throw new Error('Missing functions base URL');
  }

  if (endpoint && /^https?:\/\//i.test(endpoint)) return endpoint;
  const rawPath = endpoint ?? fallbackPath;
  return buildFunctionsUrl(rawPath, baseUrl);
}

export function storePendingSubscriptionCheckout(value: PendingSubscriptionCheckout): void {
  localStorage.setItem(PENDING_CHECKOUT_STORAGE_KEY, JSON.stringify(value));
}

export function readPendingSubscriptionCheckout(): PendingSubscriptionCheckout | null {
  const raw = localStorage.getItem(PENDING_CHECKOUT_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.checkout_session_id || !parsed.plan_id) return null;

    return {
      checkout_session_id: String(parsed.checkout_session_id),
      plan_id: String(parsed.plan_id),
      created_at: Number(parsed.created_at || Date.now()),
    };
  } catch {
    return null;
  }
}

export function clearPendingSubscriptionCheckout(): void {
  localStorage.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
}

export function buildLegacyRegisterUrl(planId: string): string {
  const { authUrl, authAppId, authApiKey, redirectUri } = getRuntimeConfig();
  const base = authUrl;
  const appId = authAppId;
  const apiKey = authApiKey;
  return `${base}/register-tenant?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&api_key=${apiKey}&plan_id=${planId}`;
}

export async function startManagedSubscriptionCheckout({
  applicationId,
  apiKey,
  planId,
  returnUrl,
  email,
  tenantId,
  endpoint,
}: StartManagedCheckoutArgs): Promise<StartManagedCheckoutResult> {
  const url = resolveCheckoutEndpoint(endpoint, 'subscription-start-checkout');
  const body = {
    application_id: applicationId,
    api_key: apiKey,
    plan_id: planId,
    return_url: returnUrl,
    email: TEST_SUBSCRIPTION_EMAIL,
    tenant_id: tenantId,
  };

  console.log('[subscription-start-checkout] request', {
    url,
    body,
    requestedEmail: email ?? null,
  });

  const response = await fetchJsonWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result?.success) {
    throw new Error(result?.error?.message || 'No se pudo iniciar el checkout');
  }

  return result.data as StartManagedCheckoutResult;
}

export async function getManagedCheckoutStatus({
  applicationId,
  apiKey,
  checkoutSessionId,
  endpoint,
}: CheckoutStatusArgs): Promise<CheckoutStatusResult> {
  const url = resolveCheckoutEndpoint(endpoint, 'subscription-checkout-status');

  const response = await fetchJsonWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      application_id: applicationId,
      api_key: apiKey,
      checkout_session_id: checkoutSessionId,
    }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result?.success) {
    throw new Error(result?.error?.message || 'No se pudo consultar el checkout');
  }

  return result.data as CheckoutStatusResult;
}
