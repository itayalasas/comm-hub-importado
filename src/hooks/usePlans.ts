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

interface PlansResult {
  plans: Plan[];
  loading: boolean;
  error: string | null;
}

let cachedPlans: Plan[] | null = null;

export const usePlans = (): PlansResult => {
  const [plans, setPlans] = useState<Plan[]>(cachedPlans ?? []);
  const [loading, setLoading] = useState<boolean>(cachedPlans === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedPlans !== null) return;

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
          const fetched: Plan[] = (json?.data?.available_plans ?? [])
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
          cachedPlans = fetched;
          setPlans(fetched);
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

  return { plans, loading, error };
};
