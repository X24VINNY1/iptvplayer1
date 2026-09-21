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
 * Rewrites an M3U8 manifest content so all segment paths, keys, and nested playlists
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
  });

  return rewritten.join('\n');
}

/**
 * Resolves the optimal browser-compatible MIME type so HTML5 video decoders don't reject the stream.
 */
function determineMimeType(rawMime, targetUrl, finalUrl) {
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

/**
 * Universal Zero-Lag Streaming Proxy
 * - Inspects first chunk: if #EXTM3U text, buffers manifest and rewrites URLs
 * - If binary video (MPEG-TS, MP4, MKV), pipes IMMEDIATELY without waiting for EOF
 * - Eliminates infinite buffering on live TS streams
 * - Normalizes MIME types so browser decoder never triggers MEDIA_ERR_SRC_NOT_SUPPORTED
 * - Forwards 206 Partial Content & Range headers for seamless VOD seeking
 */
const handleProxyRequest = async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl || typeof targetUrl !== 'string') {
    return res.status(400).send('Missing "url" query parameter');
  }

  const outgoingHeaders = {
    'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18 (Linux; Android 10)',
    'Accept': '*/*',
    'Connection': 'keep-alive',
    'Icy-MetaData': '1'
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

    const finalUrl = upstreamResponse.request?.res?.responseUrl || targetUrl;
    const stream = upstreamResponse.data;
    const cleanUrl = (finalUrl || targetUrl).toLowerCase();
    const isVod = cleanUrl.includes('/movie/') || cleanUrl.includes('/series/') || 
                  cleanUrl.includes('.mp4') || cleanUrl.includes('.mkv') || cleanUrl.includes('.avi') || cleanUrl.includes('.webm');

    // 1. VOD Movies & Series: Immediate native pipe streaming with 206 Range & CORS support
    if (isVod) {
      res.status(upstreamResponse.status || 200);
      res.setHeader('Content-Type', determineMimeType(upstreamResponse.headers['content-type'], targetUrl, finalUrl));
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Access-Control-Allow-Origin', '*');

      const headersToForward = [
        'content-length',
        'content-range',
        'content-duration'
      ];
      for (const h of headersToForward) {
        if (upstreamResponse.headers[h]) {
          res.setHeader(h, upstreamResponse.headers[h]);
        }
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

    stream.once('data', (chunk) => {
      const snippet = chunk.toString('utf-8', 0, Math.min(chunk.length, 64)).trim();
      if (snippet.startsWith('#EXTM3U') || snippet.startsWith('#EXT')) {
        // True M3U8 text manifest
        isManifest = true;
        manifestBuffer += chunk.toString('utf-8');

        stream.on('data', (nextChunk) => {
          manifestBuffer += nextChunk.toString('utf-8');
        });
      } else {
        // Binary Live Stream (e.g. MPEG-TS) -> pipe immediately!
        isManifest = false;
        res.status(upstreamResponse.status || 200);
        res.setHeader('Content-Type', determineMimeType(upstreamResponse.headers['content-type'], targetUrl, finalUrl));
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Access-Control-Allow-Origin', '*');

        const headersToForward = ['content-length', 'content-range', 'content-duration'];
        for (const h of headersToForward) {
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
          res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.status(200).send(rewritten);
        } else {
          res.status(upstreamResponse.status || 200).end();
        }
      }
    });

    stream.on('error', (err) => {
      console.warn('[Proxy Stream Data Error]', err.message);
      if (!res.headersSent) {
        res.status(502).send('Error streaming media data');
      }
    });

    req.on('close', () => {
      if (stream && typeof stream.destroy === 'function') {
        stream.destroy();
      }
    });

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
