import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import type { UserSettings } from '@/types';

interface PreferencesContextValue {
  timezone: string | null;
  settings: UserSettings | null;
  refreshSettings: () => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextValue>({
  timezone: null,
  settings: null,
  refreshSettings: async () => {},
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UserSettings | null>(null);

  const refreshSettings = async () => {
    try {
      const data = await api<UserSettings>('/api/settings');
      setSettings(data);
    } catch {
      setSettings(null);
    }
  };

  useEffect(() => {
    refreshSettings().catch(() => {});
  }, []);

  return (
    <PreferencesContext.Provider
      value={{
        timezone: settings?.timezone ?? null,
        settings,
        refreshSettings,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}

/** Alias matching legacy project naming */
export function useUserPrefs() {
  const { refreshSettings, ...rest } = usePreferences();
  return { ...rest, refresh: refreshSettings };
}

import { formatRelativeTime as fmtRelative } from './formatters';

export function useFormatters() {
  const { timezone } = usePreferences();
  return {
    formatRelativeTime: (iso: string) => fmtRelative(iso, timezone),
  };
}
