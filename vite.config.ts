import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import axios from 'axios';

function rewriteM3U8(content: string, baseUrl: string, proxyEndpoint = '/proxy?url=') {
  const lines = content.split('\n');
  return lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    if (trimmed.startsWith('#EXT-X-MEDIA:') && trimmed.includes('URI="')) {
      return line.replace(/URI="([^"]+)"/, (_, uri) => {
        try {
          const resolved = new URL(uri, baseUrl).toString();
          return `URI="${proxyEndpoint}${encodeURIComponent(resolved)}"`;
        } catch {
          return `URI="${uri}"`;
        }
      });
    }

    if (trimmed.startsWith('#EXT-X-KEY:') && trimmed.includes('URI="')) {
      return line.replace(/URI="([^"]+)"/, (_, uri) => {
        try {
          const resolved = new URL(uri, baseUrl).toString();
          return `URI="${proxyEndpoint}${encodeURIComponent(resolved)}"`;
        } catch {
          return `URI="${uri}"`;
        }
      });
    }

    if (trimmed.startsWith('#')) {
      return line;
    }

    try {
      const resolved = new URL(trimmed, baseUrl).toString();
      return `${proxyEndpoint}${encodeURIComponent(resolved)}`;
    } catch {
      return line;
    }
  }).join('\n');
}

function determineMimeType(rawMime: string, targetUrl: string, finalUrl: string): string {
  const low = (rawMime || '').toLowerCase();
  if (low.includes('video/mp4') || low.includes('video/webm') || low.includes('video/ogg')) {
    return low;
  }
  if (low.includes('video/mp2t')) {
    return 'video/mp2t';
  }
  if (low.includes('mpegurl')) {
    return 'application/vnd.apple.mpegurl; charset=utf-8';
  }

  const cleanUrl = (finalUrl || targetUrl || '').toLowerCase();
  if (cleanUrl.includes('.ts')) return 'video/mp2t';
  if (cleanUrl.includes('.mp4')) return 'video/mp4';
  if (cleanUrl.includes('.mkv') || cleanUrl.includes('.avi') || cleanUrl.includes('.mov')) return 'video/mp4';
  if (cleanUrl.includes('.webm')) return 'video/webm';
  if (cleanUrl.includes('.m3u8')) return 'application/vnd.apple.mpegurl; charset=utf-8';
  return 'video/mp4';
}

// Development streaming proxy plugin
function streamProxyPlugin() {
  return {
    name: 'stream-proxy',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url.startsWith('/proxy')) {
          return next();
        }

        const parsedUrl = new URL(req.url, 'http://localhost');
        const targetUrl = parsedUrl.searchParams.get('url');

        if (!targetUrl) {
          res.statusCode = 400;
          return res.end('Missing "url" query parameter');
        }

        const outgoingHeaders: Record<string, string> = {
          'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18 (Linux; Android 10)',
          'Accept': '*/*',
          'Icy-MetaData': '1'
        };

        if (req.headers.range) {
          outgoingHeaders['Range'] = req.headers.range;
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          return res.end();
        }

        try {
          const upstreamResponse = await axios({
            method: 'get',
            url: targetUrl,
            responseType: 'stream',
            headers: outgoingHeaders,
            timeout: 15000,
            maxRedirects: 5,
            validateStatus: (status) => status < 400,
          });

          const finalUrl = (upstreamResponse.request as any)?.res?.responseUrl || targetUrl;
          const stream = upstreamResponse.data;
          const cleanUrl = (finalUrl || targetUrl).toLowerCase();
          const isVod = cleanUrl.includes('/movie/') || cleanUrl.includes('/series/') || 
                        cleanUrl.includes('.mp4') || cleanUrl.includes('.mkv') || cleanUrl.includes('.avi') || cleanUrl.includes('.webm');

          // 1. VOD Movies & Series: Immediate native pipe streaming with 206 Range & CORS support
          if (isVod) {
            res.statusCode = upstreamResponse.status || 200;
            res.setHeader('Content-Type', determineMimeType(upstreamResponse.headers['content-type'], targetUrl, finalUrl));
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Access-Control-Allow-Origin', '*');

            const headers = ['content-length', 'content-range', 'content-duration'];
            for (const h of headers) {
              if (upstreamResponse.headers[h]) res.setHeader(h, upstreamResponse.headers[h]);
            }

            req.on('close', () => {
              if (stream && typeof stream.destroy === 'function') {
                stream.destroy();
              }
            });

            return stream.pipe(res);
          }

          // 2. Playlists & Live Streams: inspect initial chunk
          let isManifest = false;
          let manifestBuffer = '';

          stream.once('data', (chunk: any) => {
            const snippet = chunk.toString('utf-8', 0, Math.min(chunk.length, 64)).trim();
            if (snippet.startsWith('#EXTM3U') || snippet.startsWith('#EXT')) {
              // True M3U8 text manifest
              isManifest = true;
              manifestBuffer += chunk.toString('utf-8');

              stream.on('data', (nextChunk: any) => {
                manifestBuffer += nextChunk.toString('utf-8');
              });
            } else {
              // Binary Live Stream (e.g. MPEG-TS) -> pipe immediately!
              isManifest = false;
              res.statusCode = upstreamResponse.status || 200;
              res.setHeader('Content-Type', determineMimeType(upstreamResponse.headers['content-type'], targetUrl, finalUrl));
              res.setHeader('Accept-Ranges', 'bytes');
              res.setHeader('Access-Control-Allow-Origin', '*');

              const headers = ['content-length', 'content-range', 'content-duration'];
              for (const h of headers) {
                if (upstreamResponse.headers[h]) res.setHeader(h, upstreamResponse.headers[h]);
              }

              res.write(chunk);
              stream.pipe(res);
            }
          });

          stream.on('end', () => {
            if (!res.headersSent) {
              if (isManifest) {
                const rewritten = rewriteM3U8(manifestBuffer, finalUrl, '/proxy?url=');
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                res.end(rewritten);
              } else {
                res.statusCode = upstreamResponse.status || 200;
                res.end();
              }
            }
          });

          stream.on('error', (err: any) => {
            if (!res.headersSent) {
              res.statusCode = 502;
              res.end('Error streaming media data');
            }
          });

          req.on('close', () => {
            if (stream && typeof stream.destroy === 'function') {
              stream.destroy();
            }
          });
        } catch (err: any) {
          console.warn('[Vite Proxy Warn]', err.message);
          if (!res.headersSent) {
            res.statusCode = 502;
            res.end(`Proxy Error: ${err.message}`);
          }
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), streamProxyPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
});
