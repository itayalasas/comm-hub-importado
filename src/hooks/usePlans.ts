import { useState, useEffect } from 'react';
import { configManager } from '../lib/config';

export interface PlanFeature {
  code: string;
  name: string;
  description: string;
  value: string;
  value_type: 'number' | 'boolean' | 'string';
  unit: string | null;
  category: string;
}

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  billing_cycle: string;
  trial_days: number;
  is_default: boolean;
  sort_order: number;
  entitlements: { features: PlanFeature[] };
  // Legacy fields kept for any remaining direct-link scenarios
  checkout_url: string | null;
  subscribe_url: string | null;
  mp_init_point: string | null;
  mp_back_url: string | null;
  mp_preapproval_plan_id: string | null;
  mercadopago: {
    init_point: string | null;
    preapproval_plan_id: string | null;
    back_url: string | null;
    status: string | null;
  } | null;
}

export interface CheckoutMeta {
  managed_by_authsystem: boolean;
  start_endpoint: string;
  status_endpoint: string;
}

interface PlansResult {
  plans: Plan[];
  checkout: CheckoutMeta | null;
  loading: boolean;
  error: string | null;
}

interface CachedResult {
  plans: Plan[];
  checkout: CheckoutMeta | null;
}

let cached: CachedResult | null = null;

const DEFAULT_CHECKOUT_ENDPOINTS = {
  start_endpoint: 'https://sfqtmnncgiqkveaoqckt.supabase.co/functions/v1/subscription-start-checkout',
  status_endpoint: 'https://sfqtmnncgiqkveaoqckt.supabase.co/functions/v1/subscription-checkout-status',
};

export const usePlans = (): PlansResult => {
  const [result, setResult] = useState<CachedResult>(cached ?? { plans: [], checkout: null });
  const [loading, setLoading] = useState<boolean>(cached === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cached !== null) return;

    let cancelled = false;

    const load = async () => {
      try {
        await configManager.loadConfig();
        const appId = configManager.authAppId;
        const apiKey = configManager.authApiKey;
        const plansApiUrl = configManager.plansApiUrl;

        const res = await fetch(plansApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ application_id: appId, api_key: apiKey }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();

        if (!cancelled) {
          const plans: Plan[] = (json?.data?.available_plans ?? [])
            .filter((p: any) => p.active !== false)
            .map((p: any): Plan => ({
              ...p,
              mercadopago: p.mp_init_point || p.mp_preapproval_plan_id
                ? {
                    init_point: p.mp_init_point ?? null,
                    preapproval_plan_id: p.mp_preapproval_plan_id ?? null,
                    back_url: p.mp_back_url ?? null,
                    status: p.mp_status ?? null,
                  }
                : null,
            }));

          // Always use the direct Supabase endpoints — the proxy at sendcraft.net
          // does not yet expose these routes (405 Method Not Allowed).
          const rawCheckout = json?.data?.checkout;
          const checkout: CheckoutMeta = {
            managed_by_authsystem: rawCheckout?.managed_by_authsystem === true,
            start_endpoint: DEFAULT_CHECKOUT_ENDPOINTS.start_endpoint,
            status_endpoint: DEFAULT_CHECKOUT_ENDPOINTS.status_endpoint,
          };

          cached = { plans, checkout };
          setResult(cached);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error cargando planes');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  return { plans: result.plans, checkout: result.checkout, loading, error };
};

// Clears the module-level cache (useful after a successful subscription)
export const invalidatePlansCache = () => { cached = null; };
