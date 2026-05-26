import { useEffect, useState } from 'react';
import { getRuntimeConfig } from '../lib/config';

export interface PlanFeature {
  code: string;
  name: string;
  description: string;
  value: string;
  value_type: 'number' | 'boolean' | 'string';
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
  description: string;
  price: number;
  currency: string;
  billing_cycle: string;
  trial_days: number;
  active?: boolean;
  entitlements: { features: PlanFeature[] };
  is_active: boolean;
  sort_order: number;
  mercadopago: {
    preapproval_plan_id: string;
    status: string;
    init_point: string;
    back_url: string;
  } | null;
}

interface PlansResult {
  plans: Plan[];
  checkout: ApplicationCheckoutConfig | null;
  loading: boolean;
  error: string | null;
}

let cachedPlans: Plan[] | null = null;
let cachedCheckout: ApplicationCheckoutConfig | null = null;

function parseBooleanLike(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  return Boolean(value);
}

function normalizeCheckout(rawCheckout: any): ApplicationCheckoutConfig | null {
  if (!rawCheckout || typeof rawCheckout !== 'object') return null;

  return {
    managed_by_authsystem: parseBooleanLike(rawCheckout.managed_by_authsystem),
    start_endpoint: rawCheckout.start_endpoint ? String(rawCheckout.start_endpoint) : undefined,
    status_endpoint: rawCheckout.status_endpoint ? String(rawCheckout.status_endpoint) : undefined,
    cancel_endpoint: rawCheckout.cancel_endpoint ? String(rawCheckout.cancel_endpoint) : undefined,
    cancel_proxy_endpoint: rawCheckout.cancel_proxy_endpoint ? String(rawCheckout.cancel_proxy_endpoint) : undefined,
    cancellation_mode: rawCheckout.cancellation_mode ? String(rawCheckout.cancellation_mode) : undefined,
  };
}

export const usePlans = (): PlansResult => {
  const [plans, setPlans] = useState<Plan[]>(cachedPlans ?? []);
  const [checkout, setCheckout] = useState<ApplicationCheckoutConfig | null>(cachedCheckout);
  const [loading, setLoading] = useState<boolean>(cachedPlans === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedPlans !== null) return;

    let cancelled = false;

    const load = async () => {
      try {
        const { authAppId: appId, authApiKey: apiKey, plansApiUrl } = getRuntimeConfig();

        if (!appId || !apiKey) {
          throw new Error('No se encontraron las credenciales de la aplicacion');
        }

        if (!plansApiUrl) {
          throw new Error('No se encontro la URL de planes');
        }

        const response = await fetch(plansApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            application_id: appId,
            api_key: apiKey,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const json = await response.json();
        const responseData = json?.data ?? json ?? {};
        const rawPlans = responseData.available_plans ?? responseData.plans ?? json.plans ?? [];
        const rawCheckout = responseData.checkout ?? json.checkout ?? null;

        if (!cancelled) {
          const fetched: Plan[] = (rawPlans ?? [])
            .filter((plan: Plan) => plan && typeof plan === 'object' && plan.id)
            .map((plan: any) => ({
              ...plan,
              active: parseBooleanLike(plan.active ?? plan.is_active ?? true),
              is_active: parseBooleanLike(plan.is_active ?? plan.active ?? true),
            }));

          const fetchedCheckout = normalizeCheckout(rawCheckout);
          cachedPlans = fetched;
          cachedCheckout = fetchedCheckout;
          setPlans(fetched);
          setCheckout(fetchedCheckout);
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

  return { plans, checkout, loading, error };
};
