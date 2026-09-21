import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Enable JSON parsing
app.use(express.json());

// Global CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Range');
  res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now(), proxy: true });
});

/**
 * Rewrites an M3U8 manifest content so all segment paths and nested playlists
 * route cleanly through the same-origin /proxy endpoint over HTTPS with full CORS.
 */
function rewriteM3U8(content, baseUrl, proxyEndpoint = '/proxy?url=') {
  const lines = content.split('\n');
  const rewritten = lines.map((line) => {
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
  });

  return rewritten.join('\n');
}

/**
 * Universal Zero-Lag Streaming Proxy
 * - Streams continuous live TS and binary video IMMEDIATELY via pipe without waiting for EOF
 * - Detects and rewrites M3U8 playlists on the fly
 * - Forwards 206 Partial Content and Range headers for smooth VOD seeking
 * - Tracks 302 redirects to find the exact streaming cluster
 */
const handleProxyRequest = async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl || typeof targetUrl !== 'string') {
    return res.status(400).send('Missing "url" query parameter');
  }

  const outgoingHeaders = {
    'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18 (Linux; Android 10)',
    'Accept': '*/*',
    'Connection': 'keep-alive'
  };

  if (req.headers.range) {
    outgoingHeaders['Range'] = req.headers.range;
  }

  try {
    const upstreamResponse = await axios({
      method: 'get',
      url: targetUrl,
      responseType: 'stream',
      headers: outgoingHeaders,
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: (status) => status < 400
    });

    const contentType = (upstreamResponse.headers['content-type'] || '').toLowerCase();
    const isExplicitM3u8 = targetUrl.toLowerCase().includes('.m3u8') || targetUrl.toLowerCase().includes('m3u8');
    const isM3u8ContentType = contentType.includes('mpegurl') || contentType.includes('application/x-mpegurl');

    if (isExplicitM3u8 || isM3u8ContentType) {
      // Manifest request: read text, rewrite URLs, and send
      let manifestText = '';
      upstreamResponse.data.setEncoding('utf-8');
      upstreamResponse.data.on('data', (chunk) => {
        manifestText += chunk;
      });

      upstreamResponse.data.on('end', () => {
        const finalUrl = upstreamResponse.request?.res?.responseUrl || targetUrl;
        const rewritten = rewriteM3U8(manifestText, finalUrl, '/proxy?url=');
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.status(200).send(rewritten);
      });

      upstreamResponse.data.on('error', (err) => {
        console.warn('[Proxy Manifest Error]', err.message);
        if (!res.headersSent) res.status(502).send('Error buffering manifest');
      });
    } else {
      // Continuous Live TS broadcast or MP4 video chunk: pipe immediately!
      res.status(upstreamResponse.status);

      const headersToForward = [
        'content-type',
        'content-length',
        'content-range',
        'accept-ranges',
        'content-duration'
      ];

      for (const header of headersToForward) {
        if (upstreamResponse.headers[header]) {
          res.setHeader(header, upstreamResponse.headers[header]);
        }
      }

      if (!upstreamResponse.headers['accept-ranges']) {
        res.setHeader('Accept-Ranges', 'bytes');
      }

      req.on('close', () => {
        if (upstreamResponse.data && typeof upstreamResponse.data.destroy === 'function') {
          upstreamResponse.data.destroy();
        }
      });

      return upstreamResponse.data.pipe(res);
    }
  } catch (error) {
    console.warn(`[Proxy Error] ${targetUrl}:`, error.message);
    if (!res.headersSent) {
      return res.status(502).json({
        error: 'Proxy Stream Error',
        message: error.message,
        targetUrl
      });
    }
  }
};

app.get('/proxy', handleProxyRequest);
app.get('/api/proxy', handleProxyRequest);

// Serve compiled static assets
app.use(express.static(path.join(__dirname, 'dist')));

// Serve the APK directly if it exists in the root (for Downloader on TV)
app.get('/download/app.apk', (req, res) => {
  const apkPath = path.join(__dirname, 'OnyxStream.apk');
  res.download(apkPath, 'OnyxStream.apk', (err) => {
    if (err) {
      res.status(404).send('APK not found on server. Build it using GitHub Actions or build-apk.ps1 first.');
    }
  });
});

// Single Page Application catch-all route (compatible with Express 5)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`OnyxStream server running on http://0.0.0.0:${PORT}`);
});
