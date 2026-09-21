import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import os from 'os';
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
  const companionSessions = new Map<string, any>();

  return {
    name: 'stream-proxy',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        // TV Companion Pairing Endpoints for Vite Dev
        if (req.url.startsWith('/api/companion/info')) {
          const interfaces = os.networkInterfaces();
          const addresses: string[] = [];
          for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name] || []) {
              if (iface.family === 'IPv4' && !iface.internal) {
                addresses.push(iface.address);
              }
            }
          }
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ ip: addresses[0] || 'localhost', allIps: addresses, port: 3000 }));
        }

        if (req.url.startsWith('/api/companion/new')) {
          let pin = Math.floor(1000 + Math.random() * 9000).toString();
          companionSessions.set(pin, {
            createdAt: Date.now(),
            expiresAt: Date.now() + 15 * 60 * 1000,
            status: 'waiting',
            data: null,
          });
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ pin, expiresAt: Date.now() + 15 * 60 * 1000 }));
        }

        if (req.url.startsWith('/api/companion/submit') && req.method === 'POST') {
          let body = '';
          req.on('data', (c: any) => { body += c; });
          req.on('end', () => {
            try {
              const { pin, data } = JSON.parse(body);
              if (!pin || !companionSessions.has(pin)) {
                res.statusCode = 404;
                return res.end(JSON.stringify({ error: 'Invalid PIN' }));
              }
              const session = companionSessions.get(pin);
              session.status = 'ready';
              session.data = data;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true }));
            } catch (err: any) {
              res.statusCode = 400;
              return res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        if (req.url.startsWith('/api/companion/poll')) {
          const parsed = new URL(req.url, 'http://localhost');
          const pin = parsed.searchParams.get('pin');
          if (!pin || !companionSessions.has(pin)) {
            res.statusCode = 404;
            return res.end(JSON.stringify({ error: 'Invalid PIN' }));
          }
          const session = companionSessions.get(pin);
          if (session.status === 'ready') {
            const data = session.data;
            companionSessions.delete(pin);
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ status: 'completed', data }));
          }
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ status: 'waiting' }));
        }

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
          'User-Agent': 'IPTVSmartersPlayer',
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
          let upstreamResponse: any;
          const uas = [
            'IPTVSmartersPlayer',
            'VLC/3.0.18 LibVLC/3.0.18 (Linux; Android 10)',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
          ];
          for (const ua of uas) {
            try {
              outgoingHeaders['User-Agent'] = ua;
              upstreamResponse = await axios({
                method: 'get',
                url: targetUrl,
                responseType: 'stream',
                headers: outgoingHeaders,
                timeout: 15000,
                maxRedirects: 5,
                validateStatus: (status) => status < 400,
              });
              break;
            } catch (err: any) {
              if (ua === uas[uas.length - 1]) throw err;
            }
          }

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

          // 2. Playlists & Live Streams
          let isManifest = false;
          let manifestBuffer = '';
          let manifestTimer: any = null;

          const flushManifest = () => {
            if (manifestTimer) clearTimeout(manifestTimer);
            if (!res.headersSent) {
              const rewritten = rewriteM3U8(manifestBuffer, finalUrl, '/proxy?url=');
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
              res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(rewritten);
            }
          };

          stream.once('data', (chunk: any) => {
            const isText = chunk.length > 0 && chunk[0] === 0x23;
            const snippet = isText ? chunk.toString('utf-8', 0, Math.min(chunk.length, 64)).trim() : '';

            if (isText && (snippet.startsWith('#EXTM3U') || snippet.startsWith('#EXT'))) {
              isManifest = true;
              manifestBuffer += chunk.toString('utf-8');
              manifestTimer = setTimeout(flushManifest, 120);

              stream.on('data', (nextChunk: any) => {
                manifestBuffer += nextChunk.toString('utf-8');
                if (manifestBuffer.includes('#EXT-X-ENDLIST') || manifestBuffer.split('\n').length > 5) {
                  flushManifest();
                }
              });
            } else {
              isManifest = false;
              res.statusCode = upstreamResponse.status || 200;
              res.setHeader('Content-Type', 'video/mp2t');
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
            if (isManifest) {
              flushManifest();
            } else if (!res.headersSent) {
              res.statusCode = upstreamResponse.status || 200;
              res.end();
            }
          });

          stream.on('error', (err: any) => {
            if (!res.headersSent) {
              res.statusCode = 502;
              res.end('Error streaming media data');
            }
          });

          req.on('close', () => {
            if (manifestTimer) clearTimeout(manifestTimer);
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
  base: './',
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
