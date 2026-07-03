import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { loadOwnedApplicationsWithKeys, ApplicationSummary } from '../lib/applicationQueries';
import { querySelect } from '../lib/queryApi';

export function useApplicationPicker() {
  const { user, isSystemAdmin } = useAuth();
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [selectedApp, setSelectedApp] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      if (!user?.sub) {
        setApplications([]);
        setSelectedApp('');
        return;
      }

      const { data: prefs, error: prefsError } = await querySelect<{ default_application_id: string | null }>({
        table: 'user_preferences',
        operation: 'select',
        select: 'default_application_id',
        filters: [{ column: 'user_id', op: 'eq', value: user.sub }],
        limit: 1,
      });

      if (prefsError) {
        throw prefsError;
      }

      const rows = await loadOwnedApplicationsWithKeys(user.sub, user.tenant_id, isSystemAdmin);
      setApplications(rows);

      const defaultApplicationId = prefs?.[0]?.default_application_id || null;
      if (defaultApplicationId) {
        setSelectedApp(defaultApplicationId);
      } else if (rows.length > 0) {
        setSelectedApp(rows[0].id);
      } else {
        setSelectedApp('');
      }
    } finally {
      setLoading(false);
    }
  }, [user?.sub, user?.tenant_id, isSystemAdmin]);

  useEffect(() => {
    if (!user) {
      setApplications([]);
      setSelectedApp('');
      setLoading(false);
      return;
    }

    setLoading(true);
    void reload();
  }, [user, reload]);

  const selectedApplication = applications.find((app) => app.id === selectedApp) || null;

  return {
    applications,
    selectedApp,
    setSelectedApp,
    selectedApplication,
    loading,
    reload,
  };
}
