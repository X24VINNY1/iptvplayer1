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
 * Uses the final redirected URL (responseUrl) to ensure relative URLs resolve correctly.
 */
function rewriteM3U8(content, baseUrl, proxyEndpoint = '/proxy?url=') {
  const lines = content.split('\n');
  const rewritten = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    // Handle URI inside EXT-X tags (e.g. #EXT-X-MEDIA:TYPE=AUDIO,...,URI="audio.m3u8")
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

    // Pass comments and tags through as-is
    if (trimmed.startsWith('#')) {
      return line;
    }

    // Segment line or nested playlist URL
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
 * High-Performance IPTV Streaming Proxy
 * - Resolves IPTV server 302 redirects to find the real streaming edge
 * - Rewrites M3U8 playlists so all TS/AAC/MP4 segments stream through HTTPS
 * - Supports HTTP 206 Partial Content (Byte Range requests) for seeking and buffering MP4 VOD
 * - Emulates VLC/IPTVSmarters User-Agent so IPTV providers don't block web playback
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

  const isLikelyM3u8 = targetUrl.toLowerCase().includes('.m3u8') || targetUrl.includes('/live/');

  try {
    if (isLikelyM3u8) {
      // Manifest request: fetch text and rewrite internal segment URLs
      const response = await axios({
        method: 'get',
        url: targetUrl,
        responseType: 'text',
        headers: outgoingHeaders,
        timeout: 10000,
        maxRedirects: 5,
        validateStatus: (status) => status < 400
      });

      // If the response is actually an M3U8 playlist
      const dataStr = typeof response.data === 'string' ? response.data : '';
      if (dataStr.includes('#EXTM3U') || targetUrl.toLowerCase().includes('.m3u8')) {
        // Resolve relative segment URLs against final redirected URL if available
        const finalUrl = response.request?.res?.responseUrl || targetUrl;
        const rewrittenManifest = rewriteM3U8(dataStr, finalUrl, '/proxy?url=');
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.status(200).send(rewrittenManifest);
      }
    }

    // Binary media stream / video chunks (TS, MP4, MKV)
    const response = await axios({
      method: 'get',
      url: targetUrl,
      responseType: 'stream',
      headers: outgoingHeaders,
      timeout: 20000,
      maxRedirects: 5,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      validateStatus: (status) => status < 400
    });

    res.status(response.status);

    const headersToForward = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'content-duration'
    ];

    for (const header of headersToForward) {
      if (response.headers[header]) {
        res.setHeader(header, response.headers[header]);
      }
    }

    if (!response.headers['accept-ranges']) {
      res.setHeader('Accept-Ranges', 'bytes');
    }

    req.on('close', () => {
      if (response.data && typeof response.data.destroy === 'function') {
        response.data.destroy();
      }
    });

    return response.data.pipe(res);
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
