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
