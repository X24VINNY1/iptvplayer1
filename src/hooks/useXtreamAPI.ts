import { useMemo } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { XtreamAPI } from '@/api/xtream';

export function useXtreamAPI(): XtreamAPI | null {
  const { isAuthenticated, connectionType, serverUrl, username, password } = useAuthStore();

  return useMemo(() => {
    if (!isAuthenticated || connectionType === 'm3u') {
      return null;
    }
    return new XtreamAPI(serverUrl, username, password);
  }, [isAuthenticated, connectionType, serverUrl, username, password]);
}
