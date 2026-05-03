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
  description: string;
  price: number;
  currency: string;
  billing_cycle: string;
  trial_days: number;
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
  loading: boolean;
  error: string | null;
}

const PLANS_API = 'https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/validation-api/plans';

// Simple module-level cache so the fetch only happens once per page load
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
        const url = `${PLANS_API}?external_app_id=${encodeURIComponent(appId)}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();

        if (!cancelled) {
          const fetched: Plan[] = (json.plans ?? []).filter((p: Plan) => p.is_active);
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
