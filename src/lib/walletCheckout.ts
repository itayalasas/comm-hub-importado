import { fetchJsonWithTimeout, resolveCheckoutEndpoint } from './subscriptionCheckout';

const PENDING_WALLET_TOPUP_STORAGE_KEY = 'pending_wallet_topup';

export interface PendingWalletTopup {
  checkout_session_id: string;
  amount: number;
  created_at: number;
}

export function storePendingWalletTopup(value: PendingWalletTopup): void {
  localStorage.setItem(PENDING_WALLET_TOPUP_STORAGE_KEY, JSON.stringify(value));
}

export function readPendingWalletTopup(): PendingWalletTopup | null {
  const raw = localStorage.getItem(PENDING_WALLET_TOPUP_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.checkout_session_id) return null;

    return {
      checkout_session_id: String(parsed.checkout_session_id),
      amount: Number(parsed.amount || 0),
      created_at: Number(parsed.created_at || Date.now()),
    };
  } catch {
    return null;
  }
}

export function clearPendingWalletTopup(): void {
  localStorage.removeItem(PENDING_WALLET_TOPUP_STORAGE_KEY);
}

export interface WalletTransaction {
  id: string;
  type: 'topup' | 'debit' | 'refund' | 'adjustment';
  amount: number;
  currency: string;
  balance_after: number;
  reference?: string | null;
  feature_code?: string | null;
  status: string;
  created_at: string;
}

export interface WalletBalanceArgs {
  applicationId: string;
  apiKey: string;
  tenantId?: string;
  appUserId?: string;
  transactionsLimit?: number;
  endpoint?: string;
}

export interface WalletBalanceResult {
  balance: number;
  currency: string;
  wallet_id: string | null;
  updated_at?: string | null;
  recent_transactions: WalletTransaction[];
}

export async function getWalletBalance({
  applicationId,
  apiKey,
  tenantId,
  appUserId,
  transactionsLimit,
  endpoint,
}: WalletBalanceArgs): Promise<WalletBalanceResult> {
  const url = resolveCheckoutEndpoint(endpoint, 'wallet-balance');

  const response = await fetchJsonWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      application_id: applicationId,
      api_key: apiKey,
      tenant_id: tenantId,
      app_user_id: appUserId,
      transactions_limit: transactionsLimit,
    }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result?.success) {
    throw new Error(result?.error?.message || 'No se pudo consultar el saldo de la billetera');
  }

  return result.data as WalletBalanceResult;
}

export interface StartWalletTopupCheckoutArgs {
  applicationId: string;
  apiKey: string;
  amount: number;
  currency?: string;
  returnUrl: string;
  email?: string;
  tenantId?: string;
  appUserId?: string;
  metadata?: Record<string, any>;
  endpoint?: string;
}

export interface StartWalletTopupCheckoutResult {
  checkout_session_id: string;
  provider: string;
  requires_redirect: boolean;
  checkout_url?: string;
  amount: number;
  currency: string;
  environment?: string;
}

export async function startWalletTopupCheckout({
  applicationId,
  apiKey,
  amount,
  currency,
  returnUrl,
  email,
  tenantId,
  appUserId,
  metadata,
  endpoint,
}: StartWalletTopupCheckoutArgs): Promise<StartWalletTopupCheckoutResult> {
  const url = resolveCheckoutEndpoint(endpoint, 'wallet-topup-checkout');

  const response = await fetchJsonWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      application_id: applicationId,
      api_key: apiKey,
      amount,
      currency,
      return_url: returnUrl,
      email,
      tenant_id: tenantId,
      app_user_id: appUserId,
      metadata,
    }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result?.success) {
    throw new Error(result?.error?.message || 'No se pudo iniciar la recarga de saldo');
  }

  return result.data as StartWalletTopupCheckoutResult;
}

export interface WalletTopupStatusArgs {
  applicationId: string;
  apiKey: string;
  checkoutSessionId: string;
  endpoint?: string;
}

export interface WalletTopupStatusResult {
  checkout_session: {
    id: string;
    status: string;
    provider_status?: string | null;
    amount: number;
    currency: string;
    return_url: string;
    completed_at?: string | null;
    last_synced_at?: string | null;
  };
  wallet: {
    balance: number;
    currency: string;
    updated_at?: string | null;
  };
}

export async function getWalletTopupStatus({
  applicationId,
  apiKey,
  checkoutSessionId,
  endpoint,
}: WalletTopupStatusArgs): Promise<WalletTopupStatusResult> {
  const url = resolveCheckoutEndpoint(endpoint, 'wallet-topup-status');

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
    throw new Error(result?.error?.message || 'No se pudo consultar el estado de la recarga');
  }

  return result.data as WalletTopupStatusResult;
}
