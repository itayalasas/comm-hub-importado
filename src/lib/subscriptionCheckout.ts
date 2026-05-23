import { configManager } from './config';

const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export interface CheckoutStartResult {
  requires_redirect: boolean;
  checkout_url?: string;
  redirect_url?: string;
  checkout_session_id: string;
}

export interface CheckoutStatusResult {
  subscription: any;
  has_access: boolean;
  available_plans: any[];
  checkout_session_id: string;
  status: string;
}

export async function startManagedCheckout({
  startEndpoint,
  planId,
  returnUrl,
  email,
  tenantId,
}: {
  startEndpoint: string;
  planId: string;
  returnUrl: string;
  email?: string;
  tenantId?: string;
}): Promise<CheckoutStartResult> {
  await configManager.loadConfig();

  const response = await fetch(startEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      application_id: configManager.authAppId,
      api_key: configManager.authApiKey,
      plan_id: planId,
      return_url: returnUrl,
      email,
      tenant_id: tenantId,
    }),
  });

  const result = await response.json();

  if (!response.ok || !result?.success) {
    throw new Error(result?.error?.message || 'No se pudo iniciar el checkout');
  }

  return result.data as CheckoutStartResult;
}

export async function getManagedCheckoutStatus({
  statusEndpoint,
  checkoutSessionId,
}: {
  statusEndpoint: string;
  checkoutSessionId: string;
}): Promise<CheckoutStatusResult> {
  await configManager.loadConfig();

  const response = await fetch(statusEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      application_id: configManager.authAppId,
      api_key: configManager.authApiKey,
      checkout_session_id: checkoutSessionId,
    }),
  });

  const result = await response.json();

  if (!response.ok || !result?.success) {
    throw new Error(result?.error?.message || 'No se pudo consultar el estado del checkout');
  }

  return result.data as CheckoutStatusResult;
}

export function saveCheckoutSession(checkoutSessionId: string, planId: string) {
  localStorage.setItem(
    'pending_subscription_checkout',
    JSON.stringify({
      checkout_session_id: checkoutSessionId,
      plan_id: planId,
      created_at: Date.now(),
    })
  );
}

export function loadCheckoutSession(): { checkout_session_id: string; plan_id: string; created_at: number } | null {
  const stored = localStorage.getItem('pending_subscription_checkout');
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function clearCheckoutSession() {
  localStorage.removeItem('pending_subscription_checkout');
}
