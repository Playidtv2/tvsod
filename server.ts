import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

// CORS & JSON middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
  res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// In-memory cache
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const matchesCache: { entry: CacheEntry<any> | null } = { entry: null };
const resolveCache = new Map<string, CacheEntry<any>>();

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// 1. Matches API Proxy: https://dooballlaos.com/api/matches
app.get('/api/matches', async (req: Request, res: Response) => {
  const now = Date.now();
  const cacheAge = matchesCache.entry ? now - matchesCache.entry.timestamp : Infinity;

  // Use cache if less than 30 seconds old
  if (matchesCache.entry && cacheAge < 30000 && !req.query.refresh) {
    return res.json({ ...matchesCache.entry.data, _cached: true, _age: Math.round(cacheAge / 1000) });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const upstreamRes = await fetch('https://dooballlaos.com/api/matches', {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!upstreamRes.ok) {
      throw new Error(`Upstream returned status ${upstreamRes.status}`);
    }

    const data = await upstreamRes.json();
    matchesCache.entry = { data, timestamp: now };
    return res.json(data);
  } catch (error: any) {
    console.warn('Matches fetch error, checking cache or fallback:', error?.message);
    if (matchesCache.entry) {
      return res.json({ ...matchesCache.entry.data, _stale: true });
    }
    return res.status(502).json({
      success: false,
      message: 'Unable to fetch matches from dooballlaos upstream',
      error: error?.message,
    });
  }
});

// 2. Stream Resolve API Proxy: https://dooballlaos.com/api/stream/resolve?url=...
app.get('/api/stream/resolve', async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).json({ success: false, message: 'Parameter "url" is required' });
  }

  const now = Date.now();
  const cached = resolveCache.get(targetUrl);
  if (cached && now - cached.timestamp < 120000 && !req.query.refresh) {
    return res.json({ ...cached.data, _cached: true });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const apiUrl = `https://dooballlaos.com/api/stream/resolve?url=${encodeURIComponent(targetUrl)}`;
    const upstreamRes = await fetch(apiUrl, {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text().catch(() => '');
      throw new Error(`Upstream returned ${upstreamRes.status}: ${errText.slice(0, 100)}`);
    }

    const data = await upstreamRes.json();
    resolveCache.set(targetUrl, { data, timestamp: now });
    return res.json(data);
  } catch (error: any) {
    console.error('Resolve error:', error?.message);
    if (cached) {
      return res.json({ ...cached.data, _stale: true });
    }
    return res.status(502).json({
      success: false,
      message: 'Failed to resolve stream link',
      error: error?.message,
    });
  }
});

// 3. Generate playlist.m3u8 (as requested in item 5)
// Master playlist that references the streamUrl via proxy
app.get('/api/playlist.m3u8', async (req: Request, res: Response) => {
  const rawUrl = req.query.url as string;
  const streamUrlParam = req.query.streamUrl as string;
  const direct = req.query.direct === '1';

  let finalStreamUrl = streamUrlParam || rawUrl;

  // If a fixture link was provided instead of direct stream, try to resolve it
  if (finalStreamUrl && (finalStreamUrl.includes('/fixtures/') || finalStreamUrl.includes('dooball99.top'))) {
    try {
      const resolveRes = await fetch(`http://127.0.0.1:${PORT}/api/stream/resolve?url=${encodeURIComponent(finalStreamUrl)}`);
      if (resolveRes.ok) {
        const resolved = await resolveRes.json();
        if (resolved.streamUrl) {
          finalStreamUrl = `https://dooballlaos.com${resolved.streamUrl}`;
        } else if (resolved.rawM3u8Url) {
          finalStreamUrl = resolved.rawM3u8Url;
        }
      }
    } catch {
      // ignore
    }
  }

  if (!finalStreamUrl) {
    // Provide a sample stream if none provided
    finalStreamUrl = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
  }

  // Format the target stream link
  let proxyTarget: string;
  if (direct) {
    proxyTarget = finalStreamUrl;
  } else if (finalStreamUrl.startsWith('/api/proxy/stream')) {
    proxyTarget = `/api/proxy/stream${finalStreamUrl.slice('/api/proxy/stream'.length)}`;
  } else if (finalStreamUrl.includes('dooballlaos.com/api/proxy/stream')) {
    proxyTarget = finalStreamUrl;
  } else {
    proxyTarget = `/api/proxy/stream?url=${encodeURIComponent(finalStreamUrl)}`;
  }

  const playlistContent = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=1212323,FRAME-RATE=25,RESOLUTION=1280x720,CODECS="avc1.64001f,mp4a.40.2"
${proxyTarget}
`;

  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
  res.setHeader('Content-Disposition', 'inline; filename="playlist.m3u8"');
  return res.send(playlistContent);
});

// 4. Stream Proxy endpoint: /api/proxy/stream?url=...
app.get('/api/proxy/stream', async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).send('Missing url parameter');
  }

  // We can either fetch via dooballlaos proxy or directly with headers
  let fetchUrl = targetUrl;
  if (!targetUrl.startsWith('http')) {
    fetchUrl = `https://dooballlaos.com${targetUrl}`;
  }

  try {
    const upstreamRes = await fetch(fetchUrl, {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        'Referer': 'https://dooball99.top/',
        'Origin': 'https://dooball99.top',
        'Accept': '*/*',
      },
    });

    if (!upstreamRes.ok) {
      // If dooballlaos proxy returned 404, check if targetUrl was encoded inside
      if (fetchUrl.includes('/api/proxy/stream?url=')) {
        const nestedUrl = decodeURIComponent(fetchUrl.split('/api/proxy/stream?url=')[1]);
        if (nestedUrl.startsWith('http')) {
          const directRes = await fetch(nestedUrl, {
            headers: {
              'User-Agent': DEFAULT_USER_AGENT,
              'Referer': 'https://dooball99.top/',
              'Origin': 'https://dooball99.top',
            },
          });
          if (directRes.ok) {
            return handleStreamResponse(directRes, nestedUrl, req, res);
          }
        }
      }
      return res.status(upstreamRes.status).send(`Upstream returned ${upstreamRes.status}`);
    }

    return handleStreamResponse(upstreamRes, fetchUrl, req, res);
  } catch (err: any) {
    console.error('Proxy stream fetch error:', err?.message);
    return res.status(502).send(`Proxy fetch failed: ${err?.message}`);
  }
});

async function handleStreamResponse(upstreamRes: globalThis.Response, sourceUrl: string, req: Request, res: Response) {
  const contentType = upstreamRes.headers.get('content-type') || '';
  const isM3u8 = contentType.includes('mpegurl') || sourceUrl.includes('.m3u8') || contentType.includes('application/x-mpegURL');

  // Copy relevant response headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (contentType) res.setHeader('Content-Type', contentType);

  if (isM3u8) {
    // Read and rewrite playlist relative URLs to pass through our proxy
    const text = await upstreamRes.text();
    const baseUrl = sourceUrl.substring(0, sourceUrl.lastIndexOf('/') + 1);

    const rewritten = text
      .split('\n')
      .map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
          return line;
        }
        // It's a URI line (either segment .ts or sub-playlist .m3u8)
        let resolvedUri = trimmed;
        if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
          try {
            resolvedUri = new URL(trimmed, baseUrl).toString();
          } catch {
            resolvedUri = baseUrl + trimmed;
          }
        }
        return `/api/proxy/stream?url=${encodeURIComponent(resolvedUri)}`;
      })
      .join('\n');

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    return res.send(rewritten);
  }

  // Binary stream (e.g. .ts segment)
  const arrayBuffer = await upstreamRes.arrayBuffer();
  return res.send(Buffer.from(arrayBuffer));
}

// 5. Test Live HLS Demo stream
app.get('/api/test-demo.m3u8', (req: Request, res: Response) => {
  const testMaster = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=2149280,CODECS="mp4a.40.2,avc1.64001f",RESOLUTION=1280x720,FRAME-RATE=25.000
https://test-streams.mux.dev/x36xhzz/url_0/1920_1080/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1464400,CODECS="mp4a.40.2,avc1.64001f",RESOLUTION=848x480,FRAME-RATE=25.000
https://test-streams.mux.dev/x36xhzz/url_2/index.m3u8
`;
  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
  res.send(testMaster);
});

// Setup Vite for development or static serving for production
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DooBall Live server listening on port ${PORT}`);
  });
}

startServer();
