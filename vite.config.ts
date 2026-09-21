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

          const contentType = (upstreamResponse.headers['content-type'] || '').toLowerCase();
          const isExplicitM3u8 = targetUrl.toLowerCase().includes('.m3u8') || targetUrl.toLowerCase().includes('m3u8');
          const isM3u8ContentType = contentType.includes('mpegurl') || contentType.includes('application/x-mpegurl');

          if (isExplicitM3u8 || isM3u8ContentType) {
            let manifestText = '';
            upstreamResponse.data.setEncoding('utf-8');
            upstreamResponse.data.on('data', (chunk: any) => {
              manifestText += chunk;
            });
            upstreamResponse.data.on('end', () => {
              const finalUrl = (upstreamResponse.request as any)?.res?.responseUrl || targetUrl;
              const rewritten = rewriteM3U8(manifestText, finalUrl, '/proxy?url=');
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
              res.end(rewritten);
            });
            upstreamResponse.data.on('error', (err: any) => {
              if (!res.headersSent) {
                res.statusCode = 502;
                res.end('Error buffering manifest');
              }
            });
          } else {
            res.statusCode = upstreamResponse.status;
            const headers = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
            for (const h of headers) {
              if (upstreamResponse.headers[h]) res.setHeader(h, upstreamResponse.headers[h]);
            }
            if (!upstreamResponse.headers['accept-ranges']) res.setHeader('Accept-Ranges', 'bytes');

            req.on('close', () => {
              if (upstreamResponse.data && typeof upstreamResponse.data.destroy === 'function') {
                upstreamResponse.data.destroy();
              }
            });

            return upstreamResponse.data.pipe(res);
          }
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
