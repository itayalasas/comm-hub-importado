import { useEffect, useState } from 'react';
import { configManager, getRuntimeConfig } from '../lib/config';

export interface PlanFeature {
  code: string;
  name: string;
  description: string;
  value: string;
  value_type: 'number' | 'boolean' | 'string' | 'text';
  unit: string | null;
  category: string;
}

export interface ApplicationCheckoutConfig {
  managed_by_authsystem: boolean;
  start_endpoint?: string;
  status_endpoint?: string;
  cancel_endpoint?: string;
  cancel_proxy_endpoint?: string;
  cancellation_mode?: string;
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
  entitlements: { features: PlanFeature[] };
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
  is_active?: boolean;
}

export interface CheckoutMeta {
  managed_by_authsystem: boolean;
  start_endpoint: string;
  status_endpoint: string;
  cancel_endpoint?: string;
  cancel_proxy_endpoint?: string;
  cancellation_mode?: string;
}

interface PlansResult {
  plans: Plan[];
  loading: boolean;
  error: string | null;
  checkout: CheckoutMeta | null;
}

let cachedPlans: Plan[] | null = null;
let cachedCheckout: CheckoutMeta | null = null;

export const usePlans = (): PlansResult => {
  const [plans, setPlans] = useState<Plan[]>(cachedPlans ?? []);
  const [checkout, setCheckout] = useState<CheckoutMeta | null>(cachedCheckout);
  const [loading, setLoading] = useState<boolean>(cachedPlans === null || cachedCheckout === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        if (cachedPlans !== null && cachedCheckout !== null) {
          if (!cancelled) {
            setPlans(cachedPlans);
            setCheckout(cachedCheckout);
            setLoading(false);
          }
          return;
        }

        await configManager.loadConfig();
        const { authAppId, authApiKey, plansApiUrl } = getRuntimeConfig();
        if (!authAppId || !authApiKey) {
          throw new Error('Missing plans API credentials');
        }

        const endpoint = plansApiUrl || configManager.plansApiUrl || '';
        if (!endpoint) {
          throw new Error('Missing plans API URL');
        }

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            application_id: authAppId,
            api_key: authApiKey,
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const json = await res.json();
        const responseData = json?.data ?? json ?? {};
        const availablePlans = responseData.available_plans ?? responseData.plans ?? [];
        const checkoutMeta = responseData.checkout ?? null;
        const fetchedPlans: Plan[] = (Array.isArray(availablePlans) ? availablePlans : []).filter(
          (plan: Plan) => plan.is_active !== false,
        );

        if (!cancelled) {
          cachedPlans = fetchedPlans;
          cachedCheckout = checkoutMeta;
          setPlans(fetchedPlans);
          setCheckout(checkoutMeta);
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

    return () => {
      cancelled = true;
    };
  }, []);

  return { plans, loading, error, checkout };
};

export const invalidatePlansCache = () => {
  cachedPlans = null;
  cachedCheckout = null;
};
