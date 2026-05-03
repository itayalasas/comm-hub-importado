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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadCounts();
    }
  }, [user]);

  const loadCounts = async () => {
    try {
      setIsLoading(true);
      await Promise.all([loadApplicationCount(), loadTemplateCount()]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadApplicationCount = async () => {
    try {
      // Tenant members share the same applications — count by tenant when available
      const query = supabase
        .from('applications')
        .select('*', { count: 'exact', head: true });

      const { count, error } = await (
        user?.tenant_id
          ? query.eq('tenant_id', user.tenant_id)
          : query.eq('user_id', user?.sub)
      );

      if (error) throw error;
      setApplicationCount(count || 0);
    } catch (error) {
      console.error('Error loading application count:', error);
    }
  };

  const loadTemplateCount = async () => {
    try {
      // Count templates across all applications of the tenant/user
      const appsQuery = supabase
        .from('applications')
        .select('id');

      const { data: apps } = await (
        user?.tenant_id
          ? appsQuery.eq('tenant_id', user.tenant_id)
          : appsQuery.eq('user_id', user?.sub)
      );

      if (!apps || apps.length === 0) {
        setTemplateCount(0);
        return;
      }

      const appIds = apps.map((a: { id: string }) => a.id);

      const { count, error } = await supabase
        .from('communication_templates')
        .select('*', { count: 'exact', head: true })
        .in('application_id', appIds);

      if (error) throw error;
      setTemplateCount(count || 0);
    } catch (error) {
      console.error('Error loading template count:', error);
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
    checkApplicationLimit,
    checkTemplateLimit,
    checkFeatureLimit,
    getFeatureLimit,
    hasFeature,
    refreshCounts: loadCounts,
    // Kept for backwards compatibility
    refreshApplicationCount: loadApplicationCount,
  };
};
