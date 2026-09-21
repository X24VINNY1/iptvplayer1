import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
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

// In-memory store for TV Companion phone pairing sessions
const companionSessions = new Map();

// Clean up expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [pin, session] of companionSessions.entries()) {
    if (now > session.expiresAt) {
      companionSessions.delete(pin);
    }
  }
}, 60000);

// Get TV local network IP and port for easy phone connection
app.get('/api/companion/info', (req, res) => {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  res.json({
    ip: addresses[0] || 'localhost',
    allIps: addresses,
    port: PORT,
  });
});

// Generate a new 4-digit PIN for TV Companion
app.get('/api/companion/new', (req, res) => {
  // Generate a random 4-digit PIN
  let pin;
  do {
    pin = Math.floor(1000 + Math.random() * 9000).toString();
  } while (companionSessions.has(pin));

  companionSessions.set(pin, {
    createdAt: Date.now(),
    expiresAt: Date.now() + 15 * 60 * 1000, // 15 mins
    status: 'waiting',
    data: null,
  });

  res.json({ pin, expiresAt: Date.now() + 15 * 60 * 1000 });
});

// Phone submits Xtream or M3U credentials for the TV
app.post('/api/companion/submit', (req, res) => {
  const { pin, data } = req.body;
  if (!pin || !companionSessions.has(pin)) {
    return res.status(404).json({ error: 'Invalid or expired PIN' });
  }

  const session = companionSessions.get(pin);
  if (Date.now() > session.expiresAt) {
    companionSessions.delete(pin);
    return res.status(410).json({ error: 'PIN has expired. Generate a new one on TV.' });
  }

  session.status = 'ready';
  session.data = data;
  companionSessions.set(pin, session);

  res.json({ success: true, message: 'Credentials transferred to TV' });
});

// TV polls for companion completion
app.get('/api/companion/poll', (req, res) => {
  const pin = req.query.pin;
  if (!pin || !companionSessions.has(pin)) {
    return res.status(404).json({ error: 'Invalid or expired session' });
  }

  const session = companionSessions.get(pin);
  if (session.status === 'ready') {
    const payload = session.data;
    companionSessions.delete(pin); // One-time consumption
    return res.json({ status: 'completed', data: payload });
  }

  res.json({ status: 'waiting' });
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
/**
 * Resolves the optimal browser-compatible MIME type so HTML5 video decoders don't reject the stream.
 */
function determineMimeType(rawMime, targetUrl, finalUrl, isBinary = false) {
  if (isBinary) {
    return 'video/mp2t';
  }
  const low = (rawMime || '').toLowerCase();
  if (low.includes('video/mp4')) return 'video/mp4';
  if (low.includes('video/mp2t')) return 'video/mp2t';
  if (low.includes('video/webm')) return 'video/webm';
  if (low.includes('mpegurl')) return 'application/vnd.apple.mpegurl; charset=utf-8';

  const cleanUrl = (finalUrl || targetUrl || '').toLowerCase();
  if (cleanUrl.includes('.ts')) return 'video/mp2t';
  if (cleanUrl.includes('.mp4')) return 'video/mp4';
  if (cleanUrl.includes('.mkv') || cleanUrl.includes('.avi')) return 'video/mp4';
  if (cleanUrl.includes('.m3u8')) return 'application/vnd.apple.mpegurl; charset=utf-8';
  return 'video/mp4';
}

const USER_AGENTS = [
  'IPTVSmartersPlayer',
  'VLC/3.0.18 LibVLC/3.0.18 (Linux; Android 10)',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'okhttp/4.9.0'
];

async function fetchUpstreamStream(targetUrl, rangeHeader, userAgentIndex = 0) {
  const ua = USER_AGENTS[userAgentIndex] || USER_AGENTS[0];
  const headers = {
    'User-Agent': ua,
    'Accept': '*/*',
    'Connection': 'keep-alive',
    'Icy-MetaData': '1',
  };
  if (rangeHeader) {
    headers['Range'] = rangeHeader;
  }

  try {
    const res = await axios({
      method: 'get',
      url: targetUrl,
      responseType: 'stream',
      headers,
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: (status) => status < 400,
    });
    return res;
  } catch (err) {
    if (userAgentIndex < USER_AGENTS.length - 1 && (err.response?.status === 403 || err.response?.status === 401 || err.code === 'ECONNRESET')) {
      console.log(`[Proxy Retry] UA "${ua}" failed (${err.message}), retrying with next User-Agent...`);
      return fetchUpstreamStream(targetUrl, rangeHeader, userAgentIndex + 1);
    }
    throw err;
  }
}

/**
 * Universal Zero-Lag Streaming Proxy
 * - Multi-tier User-Agent fallback (Smarters, VLC, Chrome, OkHttp)
 * - Raw binary live stream pipe (video/mp2t) for mpegts.js
 * - Fast manifest flusher for Hls.js
 * - Native 206 Partial Content range forwarding for VOD seek
 */
const handleProxyRequest = async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl || typeof targetUrl !== 'string') {
    return res.status(400).send('Missing "url" query parameter');
  }

  try {
    const upstreamResponse = await fetchUpstreamStream(targetUrl, req.headers.range, 0);

    const finalUrl = upstreamResponse.request?.res?.responseUrl || targetUrl;
    const stream = upstreamResponse.data;
    const cleanUrl = (finalUrl || targetUrl).toLowerCase();
    const isVod = cleanUrl.includes('/movie/') || cleanUrl.includes('/series/') || 
                  cleanUrl.includes('.mp4') || cleanUrl.includes('.mkv') || cleanUrl.includes('.avi') || cleanUrl.includes('.webm');

    // 1. VOD Movies & Series: Immediate native pipe streaming with 206 Range & CORS support
    if (isVod) {
      res.status(upstreamResponse.status || 200);
      res.setHeader('Content-Type', determineMimeType(upstreamResponse.headers['content-type'], targetUrl, finalUrl, false));
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

    // 2. Playlists & Live Streams
    let isManifest = false;
    let manifestBuffer = '';
    let manifestTimer = null;

    const flushManifest = () => {
      if (manifestTimer) clearTimeout(manifestTimer);
      if (!res.headersSent) {
        const rewritten = rewriteM3U8(manifestBuffer, finalUrl, '/proxy?url=');
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).send(rewritten);
      }
    };

    stream.once('data', (chunk) => {
      // An M3U8 playlist starts with '#' (ASCII 0x23)
      const isText = chunk.length > 0 && chunk[0] === 0x23;
      const snippet = isText ? chunk.toString('utf-8', 0, Math.min(chunk.length, 64)).trim() : '';

      if (isText && (snippet.startsWith('#EXTM3U') || snippet.startsWith('#EXT'))) {
        isManifest = true;
        manifestBuffer += chunk.toString('utf-8');

        // Flush manifest as soon as segments are buffered or after 120ms debounce
        manifestTimer = setTimeout(flushManifest, 120);

        stream.on('data', (nextChunk) => {
          manifestBuffer += nextChunk.toString('utf-8');
          if (manifestBuffer.includes('#EXT-X-ENDLIST') || manifestBuffer.split('\n').length > 5) {
            flushManifest();
          }
        });
      } else {
        // Binary Live MPEG-TS Stream: pipe immediately with video/mp2t!
        isManifest = false;
        res.status(upstreamResponse.status || 200);
        res.setHeader('Content-Type', 'video/mp2t');
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
      if (isManifest) {
        flushManifest();
      } else if (!res.headersSent) {
        res.status(upstreamResponse.status || 200).end();
      }
    });

    stream.on('error', (err) => {
      console.warn('[Proxy Stream Data Error]', err.message);
      if (!res.headersSent) {
        res.status(502).send('Error streaming media data');
      }
    });

    req.on('close', () => {
      if (manifestTimer) clearTimeout(manifestTimer);
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
