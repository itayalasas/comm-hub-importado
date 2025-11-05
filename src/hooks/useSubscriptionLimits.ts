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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadApplicationCount();
    }
  }, [user]);

  const loadApplicationCount = async () => {
    try {
      setIsLoading(true);
      const { count, error } = await supabase
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.sub);

      if (error) throw error;

      setApplicationCount(count || 0);
    } catch (error) {
      console.error('Error loading application count:', error);
    } finally {
      setIsLoading(false);
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

  const checkApplicationLimit = (): LimitCheck => {
    const maxLimit = getFeatureLimit('max_applications');

    if (maxLimit === null) {
      return {
        canAdd: true,
        currentCount: applicationCount,
        maxLimit: Infinity,
        limitReached: false,
      };
    }

    const limitReached = applicationCount >= maxLimit;

    return {
      canAdd: !limitReached,
      currentCount: applicationCount,
      maxLimit,
      limitReached,
    };
  };

  const checkFeatureLimit = (featureCode: string, currentCount: number): LimitCheck => {
    const maxLimit = getFeatureLimit(featureCode);

    if (maxLimit === null) {
      return {
        canAdd: true,
        currentCount,
        maxLimit: Infinity,
        limitReached: false,
      };
    }

    const limitReached = currentCount >= maxLimit;

    return {
      canAdd: !limitReached,
      currentCount,
      maxLimit,
      limitReached,
    };
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

  return {
    isLoading,
    applicationCount,
    checkApplicationLimit,
    checkFeatureLimit,
    getFeatureLimit,
    hasFeature,
    refreshCounts: loadApplicationCount,
  };
};
