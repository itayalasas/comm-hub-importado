import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { queryCount, querySelect } from '../lib/queryApi';

interface LimitCheck {
  canAdd: boolean;
  currentCount: number;
  maxLimit: number;
  limitReached: boolean;
}

export const useSubscriptionLimits = () => {
  const { user, subscription, isSystemAdmin } = useAuth();
  const [applicationCount, setApplicationCount] = useState<number>(0);
  const [templateCount, setTemplateCount] = useState<number>(0);
  const [emailsThisMonth, setEmailsThisMonth] = useState<number>(0);
  const [pdfsThisMonth, setPdfsThisMonth] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isSystemAdmin) {
      setApplicationCount(0);
      setTemplateCount(0);
      setEmailsThisMonth(0);
      setPdfsThisMonth(0);
      setIsLoading(false);
      return;
    }

    if (user) {
      loadCounts();
    } else {
      setIsLoading(false);
    }
  }, [user, isSystemAdmin]);

  const loadCounts = async () => {
    if (isSystemAdmin) {
      setApplicationCount(0);
      setTemplateCount(0);
      setEmailsThisMonth(0);
      setPdfsThisMonth(0);
      return;
    }

    try {
      setIsLoading(true);
      await Promise.all([
        loadApplicationCount(),
        loadTemplateCount(),
        loadEmailsThisMonth(),
        loadPdfsThisMonth(),
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const getAppIds = async (): Promise<string[]> => {
    if (!user?.sub) return [];

    const { data: apps, error } = await querySelect<{ id: string }>({
      table: 'applications',
      operation: 'select',
      select: 'id',
      filters: user.tenant_id
        ? [{ column: 'tenant_id', op: 'eq', value: user.tenant_id }]
        : [{ column: 'user_id', op: 'eq', value: user.sub }],
      order: { column: 'created_at', ascending: false },
    });

    if (error) {
      return [];
    }

    return apps?.map((a: { id: string }) => a.id) ?? [];
  };

  // Period window: use subscription period if available, otherwise current calendar month
  const getPeriodWindow = (): { start: string; end: string } => {
    const periodStart =
      subscription?.current_period_start ||
      subscription?.period_start ||
      subscription?.trial_start ||
      null;
    const periodEnd =
      subscription?.current_period_end ||
      subscription?.period_end ||
      subscription?.next_payment_date ||
      subscription?.trial_end ||
      null;

    if (periodStart && periodEnd) {
      return { start: periodStart, end: periodEnd };
    }

    if (periodEnd) {
      const endDate = new Date(periodEnd);
      if (!Number.isNaN(endDate.getTime())) {
        const fallbackStart = new Date(endDate);
        fallbackStart.setMonth(fallbackStart.getMonth() - 1);
        return { start: fallbackStart.toISOString(), end: periodEnd };
      }
    }

    const now = new Date();
    const calendarStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const calendarEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    return { start: calendarStart, end: calendarEnd };
  };

  const loadApplicationCount = async () => {
    try {
      if (!user?.sub) {
        setApplicationCount(0);
        return;
      }

      const { count, error } = await queryCount({
        table: 'applications',
        operation: 'select',
        select: 'id',
        filters: user.tenant_id
          ? [{ column: 'tenant_id', op: 'eq', value: user.tenant_id }]
          : [{ column: 'user_id', op: 'eq', value: user.sub }],
      });

      if (error) throw error;
      setApplicationCount(count ?? 0);
    } catch {
      // ignore
    }
  };

  const loadTemplateCount = async () => {
    try {
      const appIds = await getAppIds();
      if (appIds.length === 0) {
        setTemplateCount(0);
        return;
      }

      const { count, error } = await supabase
        .from('communication_templates')
        .select('*', { count: 'exact', head: true })
        .in('application_id', appIds);

      if (error) throw error;
      setTemplateCount(count ?? 0);
    } catch {
      // ignore
    }
  };

  const loadEmailsThisMonth = async () => {
    try {
      const appIds = await getAppIds();
      if (appIds.length === 0) {
        setEmailsThisMonth(0);
        return;
      }

      const { start, end } = getPeriodWindow();

      const { count, error } = await supabase
        .from('email_logs')
        .select('*', { count: 'exact', head: true })
        .in('application_id', appIds)
        .in('communication_type', ['email', 'email_with_pdf'])
        .gte('created_at', start)
        .lte('created_at', end);

      if (error) throw error;
      setEmailsThisMonth(count ?? 0);
    } catch {
      // ignore
    }
  };

  const loadPdfsThisMonth = async () => {
    try {
      const appIds = await getAppIds();
      if (appIds.length === 0) {
        setPdfsThisMonth(0);
        return;
      }

      const { start, end } = getPeriodWindow();

      // Count from email_logs (pdf_generation_logs has service-role-only RLS)
      const { count, error } = await supabase
        .from('email_logs')
        .select('*', { count: 'exact', head: true })
        .in('application_id', appIds)
        .eq('communication_type', 'pdf_generation')
        .gte('created_at', start)
        .lte('created_at', end);

      if (error) throw error;
      setPdfsThisMonth(count ?? 0);
    } catch {
      // ignore
    }
  };

  const getFeatureLimit = (featureCode: string): number | null => {
    if (isSystemAdmin) return Infinity;

    if (!subscription?.entitlements?.features) return null;

    const feature = subscription.entitlements.features.find(
      (f) => f.code === featureCode
    );

    if (!feature) return null;

    if (feature.value_type === 'number') {
      return parseInt(feature.value, 10);
    }

    return null;
  };

  const hasFeature = (featureCode: string): boolean => {
    if (isSystemAdmin) return true;

    if (!subscription?.entitlements?.features) return false;

    const feature = subscription.entitlements.features.find(
      (f) => f.code === featureCode
    );

    if (!feature) return false;

    if (feature.value_type === 'boolean') {
      return feature.value === 'true' || feature.value === '1';
    }

    return true;
  };

  const checkApplicationLimit = (): LimitCheck => {
    if (isSystemAdmin) {
      return { canAdd: true, currentCount: applicationCount, maxLimit: Infinity, limitReached: false };
    }

    const maxLimit = getFeatureLimit('max_applications');
    if (maxLimit === null) {
      return { canAdd: true, currentCount: applicationCount, maxLimit: Infinity, limitReached: false };
    }
    const limitReached = applicationCount >= maxLimit;
    return { canAdd: !limitReached, currentCount: applicationCount, maxLimit, limitReached };
  };

  const checkTemplateLimit = (): LimitCheck => {
    if (isSystemAdmin) {
      return { canAdd: true, currentCount: templateCount, maxLimit: Infinity, limitReached: false };
    }

    const maxLimit = getFeatureLimit('templates');
    if (maxLimit === null) {
      return { canAdd: true, currentCount: templateCount, maxLimit: Infinity, limitReached: false };
    }
    const limitReached = templateCount >= maxLimit;
    return { canAdd: !limitReached, currentCount: templateCount, maxLimit, limitReached };
  };

  const checkFeatureLimit = (featureCode: string, currentCount: number): LimitCheck => {
    if (isSystemAdmin) {
      return { canAdd: true, currentCount, maxLimit: Infinity, limitReached: false };
    }

    const maxLimit = getFeatureLimit(featureCode);
    if (maxLimit === null) {
      return { canAdd: true, currentCount, maxLimit: Infinity, limitReached: false };
    }
    const limitReached = currentCount >= maxLimit;
    return { canAdd: !limitReached, currentCount, maxLimit, limitReached };
  };

  return {
    isLoading,
    applicationCount,
    templateCount,
    emailsThisMonth,
    pdfsThisMonth,
    checkApplicationLimit,
    checkTemplateLimit,
    checkFeatureLimit,
    getFeatureLimit,
    hasFeature,
    refreshCounts: loadCounts,
    refreshApplicationCount: loadApplicationCount,
  };
};
