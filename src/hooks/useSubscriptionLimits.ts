import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface LimitCheck {
  canAdd: boolean;
  currentCount: number;
  maxLimit: number;
  limitReached: boolean;
}

export const useSubscriptionLimits = () => {
  const { user, subscription } = useAuth();
  const [applicationCount, setApplicationCount] = useState<number>(0);
  const [templateCount, setTemplateCount] = useState<number>(0);
  const [emailsThisMonth, setEmailsThisMonth] = useState<number>(0);
  const [pdfsThisMonth, setPdfsThisMonth] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadCounts();
    }
  }, [user]);

  const loadCounts = async () => {
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
    const appsQuery = supabase.from('applications').select('id');
    const { data: apps } = await (
      user?.tenant_id
        ? appsQuery.eq('tenant_id', user.tenant_id)
        : appsQuery.eq('user_id', user?.sub)
    );
    return apps?.map((a: { id: string }) => a.id) ?? [];
  };

  // Period window: use subscription period if available, otherwise current calendar month
  const getPeriodWindow = (): { start: string; end: string } => {
    if (subscription?.period_start && subscription?.period_end) {
      return { start: subscription.period_start, end: subscription.period_end };
    }
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    return { start, end };
  };

  const loadApplicationCount = async () => {
    try {
      const query = supabase
        .from('applications')
        .select('*', { count: 'exact', head: true });

      const { count, error } = await (
        user?.tenant_id
          ? query.eq('tenant_id', user.tenant_id)
          : query.eq('user_id', user?.sub)
      );

      if (error) throw error;
      setApplicationCount(count ?? 0);
    } catch (error) {
      console.error('Error loading application count:', error);
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
    } catch (error) {
      console.error('Error loading template count:', error);
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
    } catch (error) {
      console.error('Error loading email count:', error);
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
    } catch (error) {
      console.error('Error loading PDF count:', error);
    }
  };

  const getFeatureLimit = (featureCode: string): number | null => {
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
    const maxLimit = getFeatureLimit('max_applications');
    if (maxLimit === null) {
      return { canAdd: true, currentCount: applicationCount, maxLimit: Infinity, limitReached: false };
    }
    const limitReached = applicationCount >= maxLimit;
    return { canAdd: !limitReached, currentCount: applicationCount, maxLimit, limitReached };
  };

  const checkTemplateLimit = (): LimitCheck => {
    const maxLimit = getFeatureLimit('templates');
    if (maxLimit === null) {
      return { canAdd: true, currentCount: templateCount, maxLimit: Infinity, limitReached: false };
    }
    const limitReached = templateCount >= maxLimit;
    return { canAdd: !limitReached, currentCount: templateCount, maxLimit, limitReached };
  };

  const checkFeatureLimit = (featureCode: string, currentCount: number): LimitCheck => {
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
