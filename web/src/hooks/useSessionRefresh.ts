import { useEffect } from 'react';
import { restoreSession } from '@/lib/api';

export function useSessionRefresh() {
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void restoreSession();
      }
    };

    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
}
