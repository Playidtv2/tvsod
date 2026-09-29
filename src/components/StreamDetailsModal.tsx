import React, { useState } from 'react';
import { X, Copy, Check, Terminal, Play, ArrowRight, Layers, FileCode, CheckCircle2 } from 'lucide-react';
import { Match, StreamResolveResponse } from '../types/football';

interface StreamDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMatch: Match | null;
  resolvedStream: StreamResolveResponse | null;
  onLoadCustomUrl: (url: string) => void;
}

export const StreamDetailsModal: React.FC<StreamDetailsModalProps> = ({
  isOpen,
  onClose,
  currentMatch,
  resolvedStream,
  onLoadCustomUrl,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [customInputUrl, setCustomInputUrl] = useState('');

  if (!isOpen) return null;

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const fixtureUrl = currentMatch?.link || 'https://dooball99.top/fixtures/19783652';
  const resolveEndpointUrl = `/api/stream/resolve?url=${encodeURIComponent(fixtureUrl)}`;
  const matchesEndpointUrl = `/api/matches`;

  const rawM3u8Url = resolvedStream?.rawM3u8Url || 'https://k7ktdny7ll.kaibannpongmungtai.top/do-ball.com/siam-2/playlist.m3u8?wmsAuthSign=...';

  const streamUrl = `https://dooballlaos.com/api/proxy/stream?url=${rawM3u8Url}`;

  const masterPlaylistText = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=1212323,FRAME-RATE=25,RESOLUTION=1280x720,CODECS="avc1.64001f,mp4a.40.2"
https://dooballlaos.com/api/proxy/stream?url=${rawM3u8Url}`;

  const localMasterPlaylistEndpoint = `/api/playlist.m3u8?url=${encodeURIComponent(rawM3u8Url)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Proxy API & M3U8 Master Playlist Inspector</h3>
              <p className="text-xs text-slate-400">ตรวจสอบโครงสร้างการดึง Proxy API ทั้ง 5 ขั้นตอนตามคำสั่ง</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-900 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step-by-Step Breakdown */}
        <div className="space-y-5 text-xs">
          {/* Step 1: Matches API */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/20 text-emerald-400 font-bold text-[11px]">
                  1
                </span>
                <span className="font-semibold text-slate-200">โครงสร้างรายการสด (Matches API):</span>
              </div>
              <button
                onClick={() => copy(matchesEndpointUrl, 's1')}
                className="flex items-center gap-1 text-slate-400 hover:text-emerald-400 cursor-pointer"
              >
                {copiedKey === 's1' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                <span>{copiedKey === 's1' ? 'คัดลอกแล้ว' : 'คัดลอก Endpoint'}</span>
              </button>
            </div>
            <p className="text-slate-400 mb-2">
              ดึงข้อมูลจาก <code className="text-emerald-400 font-mono">https://dooballlaos.com/api/matches</code> ผ่าน Proxy Backend
            </p>
            <div className="flex items-center gap-2">
              <a
                href="/api/matches"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-[11px] transition-colors"
              >
                <span>GET /api/matches (เปิดดู JSON ดิบ)</span>
                <ArrowRight className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Step 2: Stream Resolve */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/20 text-emerald-400 font-bold text-[11px]">
                  2
                </span>
                <span className="font-semibold text-slate-200">ดึงข้อมูลที่สำคัญ (Stream Resolve):</span>
              </div>
              <button
                onClick={() => copy(resolveEndpointUrl, 's2')}
                className="flex items-center gap-1 text-slate-400 hover:text-emerald-400 cursor-pointer"
              >
                {copiedKey === 's2' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                <span>{copiedKey === 's2' ? 'คัดลอกแล้ว' : 'คัดลอก Endpoint'}</span>
              </button>
            </div>
            <p className="text-slate-400 mb-2">
              เรียก: <code className="text-emerald-400 font-mono">https://dooballlaos.com/api/stream/resolve?url={fixtureUrl}</code>
            </p>
            <div className="p-2.5 rounded bg-slate-950 font-mono text-[11px] text-slate-300 break-all select-all">
              GET {resolveEndpointUrl}
            </div>
          </div>

          {/* Step 3 & 4: Data Payload Preview */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/20 text-emerald-400 font-bold text-[11px]">
                  3-4
                </span>
                <span className="font-semibold text-slate-200">ผลลัพธ์ข้อมูล rawM3u8Url และ streamUrl:</span>
              </div>
              <button
                onClick={() => copy(JSON.stringify(resolvedStream || {}, null, 2), 's3')}
                className="flex items-center gap-1 text-slate-400 hover:text-emerald-400 cursor-pointer"
              >
                {copiedKey === 's3' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                <span>{copiedKey === 's3' ? 'คัดลอกแล้ว' : 'คัดลอก JSON'}</span>
              </button>
            </div>
            <pre className="p-3 rounded bg-slate-950 font-mono text-[11px] text-emerald-300 overflow-x-auto whitespace-pre leading-relaxed max-h-44">
              {JSON.stringify(
                resolvedStream || {
                  success: true,
                  source: "cache",
                  rawM3u8Url: "https://k7ktdny7ll.kaibannpongmungtai.top/do-ball.com/siam-2/playlist.m3u8?wmsAuthSign=c2VydmVyX3RpbWU9OS8yOC8yMDI2IDM6MjM6NDggQU0maGFzaF92YWx1ZT1pWHpmVGY5N2p5YzdKUUpoclN1STN3PT0mdmFsaWRtaW51dGVzPTM2MCZpZD0x",
                  streamUrl: "/api/proxy/stream?url=https%3A%2F%2Fk7ktdny7ll.kaibannpongmungtai.top%2Fdo-ball.com%2Fsiam-2%2Fplaylist.m3u8%3FwmsAuthSign%3Dc2VydmVyX3RpbWU9OS8yOC8yMDI2IDM6MjM6NDggQU0maGFzaF92YWx1ZT1pWHpmVGY5N2p5YzdKUUpoclN1STN3PT0mdmFsaWRtaW51dGVzPTM2MCZpZD0x"
                },
                null,
                2
              )}
            </pre>
          </div>

          {/* Step 5: Master Playlist */}
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500 text-slate-950 font-bold text-[11px]">
                  5
                </span>
                <span className="font-semibold text-emerald-300">สร้างข้อมูลเป็น playlist.m3u8 พร้อมเล่นด้วย JW Player:</span>
              </div>
              <button
                onClick={() => copy(masterPlaylistText, 's5')}
                className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
              >
                {copiedKey === 's5' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                <span>{copiedKey === 's5' ? 'คัดลอกแล้ว' : 'คัดลอก M3U8'}</span>
              </button>
            </div>
            <pre className="p-3 rounded bg-slate-950 font-mono text-[11px] text-emerald-300 overflow-x-auto whitespace-pre leading-relaxed mb-3">
              {masterPlaylistText}
            </pre>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={localMasterPlaylistEndpoint}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors"
              >
                <FileCode className="h-3.5 w-3.5" />
                <span>ดาวน์โหลด / เปิด URL playlist.m3u8</span>
              </a>
            </div>
          </div>

          {/* Test Custom Fixture / Stream URL */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h4 className="font-semibold text-slate-200 mb-2">ทดสอบ Resolve ลิงก์อื่นตามต้องการ:</h4>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="วางลิงก์ เช่น https://dooball99.top/fixtures/19783652 หรือ .m3u8"
                value={customInputUrl}
                onChange={(e) => setCustomInputUrl(e.target.value)}
                className="flex-1 rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-white placeholder-slate-500 font-mono text-xs focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={() => {
                  if (customInputUrl.trim()) {
                    onLoadCustomUrl(customInputUrl.trim());
                    onClose();
                  }
                }}
                disabled={!customInputUrl.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>เล่นเลย</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
