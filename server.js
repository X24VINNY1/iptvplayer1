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

// CORS headers for all requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Generic Proxy endpoint to bypass Browser Mixed Content (HTTPS -> HTTP) and CORS
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl || typeof targetUrl !== 'string') {
    return res.status(400).send('Missing "url" query parameter');
  }

  try {
    const response = await axios({
      method: 'get',
      url: targetUrl,
      responseType: 'stream',
      headers: {
        'User-Agent': 'IPTVSmarters/1.0.0 (Linux; Android 10)'
      },
      timeout: 15000
    });

    // Forward status & content-type
    res.status(response.status);
    if (response.headers['content-type']) {
      res.setHeader('Content-Type', response.headers['content-type']);
    }

    response.data.pipe(res);
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(502).send(`Proxy Error: ${error.message}`);
  }
});

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
