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
 * Resolves the playback stream URL:
 * - On Web (browser): ALWAYS routes through the streaming proxy (/proxy?url=...) so the server
 *   fetches the media stream directly from the Xtream server and streams it to the website with full CORS and proper MIME types.
 * - On Native Android: Uses direct connection where cleartext traffic and native player engines are active.
 */
export const getStreamPlaybackUrl = (rawUrl: string, mode?: 'proxy' | 'direct'): string => {
  if (!rawUrl) return '';

  const cleanRawUrl = extractRawStreamUrl(rawUrl);

  // If running inside Native Android APK and not explicitly asking for proxy, direct is optimal
  if (Capacitor.isNativePlatform() && mode !== 'proxy') {
    return cleanRawUrl;
  }

  // Explicit direct override (if forced)
  if (mode === 'direct' && Capacitor.isNativePlatform()) {
    return cleanRawUrl;
  }

  // On ALL Web browsers (HTTP and HTTPS), route through the server proxy so the server
  // fetches the Xtream URL and sends the video stream directly to the website
  return `/proxy?url=${encodeURIComponent(cleanRawUrl)}`;
};

export const getProxiedStreamUrl = getStreamPlaybackUrl;
