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
const sportTypesCache: { entry: CacheEntry<any> | null } = { entry: null };

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const GRAPHQL_ENDPOINT = 'https://api4.xn--72czaud0ezbn4b8de.com/graphql';

// 1. Matches API Proxy: Merges dooballlaos matches with live GraphQL sportEvents & sportTypes
app.get('/api/matches', async (req: Request, res: Response) => {
  const now = Date.now();
  const cacheAge = matchesCache.entry ? now - matchesCache.entry.timestamp : Infinity;

  // Use cache if less than 20 seconds old
  if (matchesCache.entry && cacheAge < 20000 && !req.query.refresh) {
    return res.json({ ...matchesCache.entry.data, _cached: true, _age: Math.round(cacheAge / 1000) });
  }

  try {
    // Parallel fetch from both dooballlaos API and the GraphQL backend
    const [laosRes, gqlRes, typesRes] = await Promise.allSettled([
      fetch('https://dooballlaos.com/api/matches', {
        headers: { 'User-Agent': DEFAULT_USER_AGENT, 'Accept': 'application/json' },
      }).then(r => r.ok ? r.json() : null),
      fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': DEFAULT_USER_AGENT },
        body: JSON.stringify({
          query: `
            query GetLiveSportEvents {
              sportEvents {
                id
                name
                homeTeamName
                awayTeamName
                homeScore
                awayScore
                homeTeamLogoUrl
                awayTeamLogoUrl
                eventDateTime
                state
                channels
                sportLeague {
                  id
                  name
                  logoUrl
                  sportTypeId
                }
              }
            }
          `
        })
      }).then(r => r.ok ? r.json() : null),
      fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': DEFAULT_USER_AGENT },
        body: JSON.stringify({
          query: `
            query GetSportTypes {
              sportTypes {
                id
                name
                icon
                liveEventCount
              }
            }
          `
        })
      }).then(r => r.ok ? r.json() : null)
    ]);

    const laosData = laosRes.status === 'fulfilled' ? laosRes.value : null;
    const gqlData = gqlRes.status === 'fulfilled' ? gqlRes.value?.data?.sportEvents : null;
    const typesData = typesRes.status === 'fulfilled' ? typesRes.value?.data?.sportTypes : null;

    let combinedMatches: any[] = [];
    const seenNames = new Set<string>();

    // 1. Prioritize GraphQL live and upcoming sport events with real channels
    if (Array.isArray(gqlData)) {
      // Sort: LIVE first, then UPCOMING, then FINISHED
      const sortedGql = [...gqlData].sort((a, b) => {
        if (a.state === 'LIVE' && b.state !== 'LIVE') return -1;
        if (b.state === 'LIVE' && a.state !== 'LIVE') return 1;
        return new Date(b.eventDateTime).getTime() - new Date(a.eventDateTime).getTime();
      });

      sortedGql.forEach((item: any) => {
        const homeName = item.homeTeamName || item.name?.split(' vs ')[0] || 'ทีมเหย้า';
        const awayName = item.awayTeamName || item.name?.split(' vs ')[1] || 'ทีมเยือน';
        const key = `${homeName.toLowerCase().trim()}_${awayName.toLowerCase().trim()}`;
        seenNames.add(key);

        const eventDate = item.eventDateTime ? new Date(item.eventDateTime) : new Date();
        const dateStr = eventDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
        const timeStr = eventDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });

        let kickoffTime = timeStr;
        if (item.state === 'LIVE') {
          kickoffTime = 'กำลังแข่ง';
        } else if (item.state === 'FINISHED') {
          kickoffTime = 'จบการแข่งขัน';
        }

        const rawChannels = Array.isArray(item.channels) ? item.channels : [];
        const primaryChannel = rawChannels[0];

        combinedMatches.push({
          id: `gql_${item.id}`,
          slug: `${homeName}-vs-${awayName}`.replace(/\s+/g, '-'),
          date: dateStr,
          dateOrder: item.state === 'LIVE' ? 0 : item.state === 'UPCOMING' ? 1 : 2,
          homeTeam: {
            name: homeName,
            score: item.homeScore,
            logo: item.homeTeamLogoUrl || undefined,
          },
          awayTeam: {
            name: awayName,
            score: item.awayScore,
            logo: item.awayTeamLogoUrl || undefined,
          },
          league: {
            name: item.sportLeague?.name || 'ถ่ายทอดสด',
            logo: item.sportLeague?.logoUrl || undefined,
            sportTypeId: item.sportLeague?.sportTypeId || 1,
          },
          kickoffTime,
          status: item.state || 'UPCOMING',
          currentMinute: item.state === 'LIVE' ? 'LIVE' : undefined,
          link: primaryChannel?.url || '',
          channels: rawChannels.map((c: any) => ({
            id: c.id,
            url: c.url,
            image: c.image,
            title: c.title || c.tvstation_name || 'ช่องถ่ายทอดสด',
            backup: c.backup,
            status: c.status,
            category: c.category,
            tvstation_name: c.tvstation_name,
          })),
          sportTypeId: item.sportLeague?.sportTypeId || '1',
        });
      });
    }

    // 2. Also incorporate dooballlaos matches (if unique)
    if (laosData && Array.isArray(laosData.matches)) {
      laosData.matches.forEach((m: any) => {
        const homeName = m.homeTeam?.name || '';
        const awayName = m.awayTeam?.name || '';
        const key = `${homeName.toLowerCase().trim()}_${awayName.toLowerCase().trim()}`;
        if (!seenNames.has(key)) {
          seenNames.add(key);
          combinedMatches.push({
            ...m,
            sportTypeId: '1', // Football
          });
        }
      });
    }

    // Sport Types with fallback to default set
    const fallbackSportTypes = [
      { id: "1", name: "ฟุตบอล", icon: null, liveEventCount: 0 },
      { id: "35", name: "มวย", icon: null, liveEventCount: 0 },
      { id: "8", name: "แข่งรถ", icon: null, liveEventCount: 0 },
      { id: "32", name: "มอเตอร์ไซค์", icon: null, liveEventCount: 0 },
      { id: "2", name: "เทนนิส", icon: null, liveEventCount: 0 },
      { id: "3", name: "บาสเกตบอล", icon: null, liveEventCount: 0 },
      { id: "14", name: "วอลเลย์บอล", icon: null, liveEventCount: 0 },
      { id: "18", name: "แบดมินตัน", icon: null, liveEventCount: 0 },
      { id: "16", name: "สนุกเกอร์", icon: null, liveEventCount: 0 },
      { id: "37", name: "กอล์ฟ", icon: null, liveEventCount: 0 },
      { id: "4", name: "อื่นๆ", icon: null, liveEventCount: 0 }
    ];

    const sportTypes = Array.isArray(typesData) ? typesData : fallbackSportTypes;

    // Update liveEventCount for each sport type
    sportTypes.forEach((st: any) => {
      st.liveEventCount = combinedMatches.filter(
        (m: any) => String(m.sportTypeId) === String(st.id) && m.status === 'LIVE'
      ).length;
    });

    const resultData = {
      success: true,
      count: combinedMatches.length,
      matches: combinedMatches,
      sportTypes,
    };

    matchesCache.entry = { data: resultData, timestamp: now };
    return res.json(resultData);
  } catch (error: any) {
    console.warn('Matches fetch error, checking cache or fallback:', error?.message);
    if (matchesCache.entry) {
      return res.json({ ...matchesCache.entry.data, _stale: true });
    }
    return res.status(502).json({
      success: false,
      message: 'Unable to fetch matches',
      error: error?.message,
    });
  }
});

// Sport Types endpoint
app.get('/api/sport-types', async (req: Request, res: Response) => {
  const now = Date.now();
  if (sportTypesCache.entry && now - sportTypesCache.entry.timestamp < 60000) {
    return res.json(sportTypesCache.entry.data);
  }

  try {
    const gqlRes = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': DEFAULT_USER_AGENT },
      body: JSON.stringify({
        query: `
          query GetSportTypes {
            sportTypes {
              id
              name
              icon
              liveEventCount
            }
          }
        `
      })
    });
    if (gqlRes.ok) {
      const data = await gqlRes.json();
      if (data.data?.sportTypes) {
        sportTypesCache.entry = { data: data.data.sportTypes, timestamp: now };
        return res.json(data.data.sportTypes);
      }
    }
  } catch {
    // ignore
  }

  return res.json([]);
});

// Helper to perform safe fetch with timeout and headers
async function fetchStreamWithTimeout(url: string, timeoutMs = 8000, customReferer?: string): Promise<globalThis.Response | null> {
  const referersToTry = [
    customReferer,
    'https://www.do-ball.com/',
    'https://www.dooball-doonang.com/',
    'https://dooball99.top/',
    'https://www3.xn--72czaud0ezbn4b8de.com/',
  ].filter(Boolean) as string[];

  for (const ref of referersToTry) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, {
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          'Referer': ref,
          'Origin': ref.endsWith('/') ? ref.slice(0, -1) : ref,
          'Accept': '*/*',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        return res;
      }
    } catch {
      // try next
    }
  }
  return null;
}

// 2. Stream Resolve API Proxy: https://dooballlaos.com/api/stream/resolve?url=...
app.get('/api/stream/resolve', async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).json({ success: false, message: 'Parameter "url" is required' });
  }

  // If the targetUrl is already a direct m3u8 stream from channels
  if (targetUrl.includes('.m3u8')) {
    return res.json({
      success: true,
      source: 'direct_channel',
      rawM3u8Url: targetUrl,
      streamUrl: `/api/proxy/stream?url=${encodeURIComponent(targetUrl)}`,
      allCandidates: [targetUrl],
    });
  }

  const now = Date.now();
  const cached = resolveCache.get(targetUrl);
  if (cached && now - cached.timestamp < 120000 && !req.query.refresh) {
    return res.json({ ...cached.data, _cached: true });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

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
    console.warn('Resolve stream notice:', error?.message);
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
    finalStreamUrl = '/api/test-demo.m3u8';
  }

  // Format the target stream link
  let proxyTarget: string;
  const useUpstreamHost = req.query.upstream === '1' || req.query.upstream === 'true';

  if (direct) {
    proxyTarget = finalStreamUrl;
  } else if (useUpstreamHost) {
    proxyTarget = `https://dooballlaos.com/api/proxy/stream?url=${encodeURIComponent(finalStreamUrl)}`;
  } else if (finalStreamUrl.startsWith('/api/proxy/stream')) {
    proxyTarget = `/api/proxy/stream${finalStreamUrl.slice('/api/proxy/stream'.length)}`;
  } else if (finalStreamUrl.includes('dooballlaos.com/api/proxy/stream?url=')) {
    const extracted = finalStreamUrl.split('dooballlaos.com/api/proxy/stream?url=')[1];
    proxyTarget = `/api/proxy/stream?url=${extracted}`;
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
  let targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).send('Missing url parameter');
  }

  // Unwrap any nested proxy wrappers
  while (targetUrl.includes('/api/proxy/stream?url=')) {
    const idx = targetUrl.indexOf('/api/proxy/stream?url=') + '/api/proxy/stream?url='.length;
    const substr = targetUrl.slice(idx);
    try {
      targetUrl = decodeURIComponent(substr);
    } catch {
      targetUrl = substr;
    }
  }

  let finalUrl = targetUrl;
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    finalUrl = `https://dooballlaos.com${targetUrl.startsWith('/') ? '' : '/'}${targetUrl}`;
  }

  // Attempt 1: Fetch via dooballlaos proxy endpoint
  const dooballProxyUrl = `https://dooballlaos.com/api/proxy/stream?url=${encodeURIComponent(finalUrl)}`;
  let upstreamRes = await fetchStreamWithTimeout(dooballProxyUrl, 7000);
  let resolvedSourceUrl = finalUrl;

  // Attempt 2: If dooball proxy failed or returned 404/5xx, try direct connection to source with streaming headers
  if (!upstreamRes || !upstreamRes.ok) {
    if (finalUrl.startsWith('http://') || finalUrl.startsWith('https://')) {
      const directRes = await fetchStreamWithTimeout(finalUrl, 7000);
      if (directRes && directRes.ok) {
        upstreamRes = directRes;
        resolvedSourceUrl = finalUrl;
      }
    }
  }

  if (!upstreamRes || !upstreamRes.ok) {
    console.warn(`[Proxy stream] Stream is offline or not broadcasting yet: ${finalUrl.slice(0, 80)}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'text/plain');
    return res.status(503).send('Stream is currently offline or not yet broadcasting');
  }

  return handleStreamResponse(upstreamRes, resolvedSourceUrl, req, res);
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
