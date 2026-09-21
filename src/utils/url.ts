import { Capacitor } from '@capacitor/core';

export const normalizeServerUrl = (url: string): string => {
  let normalized = url.trim();
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = 'http://' + normalized;
  }
  return normalized;
};

export const buildApiUrl = (
  serverUrl: string,
  username: string,
  password: string,
  action?: string,
  params?: Record<string, string>
): string => {
  const url = new URL(`${serverUrl}/player_api.php`);
  url.searchParams.append('username', username);
  url.searchParams.append('password', password);
  if (action) {
    url.searchParams.append('action', action);
  }
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }
  return url.toString();
};

export const buildStreamUrl = (
  serverUrl: string,
  username: string,
  password: string,
  type: 'live' | 'movie' | 'series',
  streamId: number,
  extension: string = 'm3u8'
): string => {
  return `${serverUrl}/${type}/${username}/${password}/${streamId}.${extension}`;
};

/**
 * Extracts the original target stream URL from any proxy wrapper.
 */
export const extractRawStreamUrl = (url: string): string => {
  if (!url) return '';
  if (url.includes('/proxy?url=')) {
    try {
      const idx = url.indexOf('/proxy?url=');
      const encoded = url.substring(idx + 11);
      return decodeURIComponent(encoded);
    } catch {
      return url;
    }
  }
  return url;
};

/**
 * Resolves the playback stream URL with auto-selection or explicit mode override.
 */
export const getStreamPlaybackUrl = (rawUrl: string, mode?: 'proxy' | 'direct'): string => {
  if (!rawUrl) return '';

  const cleanRawUrl = extractRawStreamUrl(rawUrl);

  if (mode === 'direct') {
    return cleanRawUrl;
  }

  if (mode === 'proxy') {
    return `/proxy?url=${encodeURIComponent(cleanRawUrl)}`;
  }

  // Inside Native Android APK, cleartext traffic is enabled so direct stream URL is optimal
  if (Capacitor.isNativePlatform()) {
    return cleanRawUrl;
  }

  // In Web browser environments on HTTPS, route through the streaming proxy to bypass Mixed Content & CORS
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && cleanRawUrl.startsWith('http://')) {
    return `/proxy?url=${encodeURIComponent(cleanRawUrl)}`;
  }

  return cleanRawUrl;
};
