import { useEffect } from 'react';

/** After OAuth reconnect, reopen the settings modal if the user was mid-flow. */
export function useReopenSettingsModal(onOpen: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if (sessionStorage.getItem('reopenSettings') === '1') {
      sessionStorage.removeItem('reopenSettings');
      onOpen();
    }
  }, [enabled, onOpen]);
}
