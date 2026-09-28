import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { JWPlayer } from './components/JWPlayer';
import { MatchList } from './components/MatchList';
import { StreamDetailsModal } from './components/StreamDetailsModal';
import { Match, MatchesResponse, StreamResolveResponse } from './types/football';
import {
  Tv,
  Radio,
  Sparkles,
  Terminal,
  ShieldCheck,
  Zap,
  Play,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';

import heroStadiumImg from './assets/images/hero_stadium_lights_1790567031636.jpg';

export default function App() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState<boolean>(true);
  const [matchesError, setMatchesError] = useState<string | null>(null);

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [resolvedStream, setResolvedStream] = useState<StreamResolveResponse | null>(null);
  const [isLoadingStream, setIsLoadingStream] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  const [isTestStream, setIsTestStream] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false);

  // Fetch matches from API: /api/matches
  const fetchMatches = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoadingMatches(true);
    setMatchesError(null);

    try {
      const res = await fetch(`/api/matches${isManualRefresh ? '?refresh=1' : ''}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ไม่สามารถดึงข้อมูลตารางแข่งขันได้`);
      }
      const data: MatchesResponse = await res.json();
      if (data && Array.isArray(data.matches)) {
        setMatches(data.matches);

        // Auto-select first match if none currently selected
        if (!selectedMatch && !isTestStream && data.matches.length > 0) {
          // Prefer LIVE match, otherwise first upcoming
          const live = data.matches.find(
            (m) => m.status === 'LIVE' || (m.kickoffTime && m.kickoffTime.includes("'"))
          );
          const first = live || data.matches[0];
          selectMatch(first, false);
        }
      } else {
        throw new Error('รูปแบบข้อมูลรายการสดไม่ถูกต้อง');
      }
    } catch (err: any) {
      console.error('Fetch matches error:', err);
      setMatchesError(err?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsLoadingMatches(false);
      setIsRefreshing(false);
    }
  }, [selectedMatch, isTestStream]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  // Resolve stream when a match is selected
  const resolveMatchStream = async (targetMatch: Match, customUrl?: string) => {
    setIsLoadingStream(true);
    setStreamError(null);
    setIsTestStream(false);

    const fixtureUrl = customUrl || targetMatch.link || (targetMatch.streamLinks && targetMatch.streamLinks[0]?.url);

    if (!fixtureUrl) {
      setStreamError('ไม่พบลิงก์ถ่ายทอดสดสำหรับคู่นี้');
      setIsLoadingStream(false);
      return;
    }

    try {
      const res = await fetch(`/api/stream/resolve?url=${encodeURIComponent(fixtureUrl)}`);
      const data: StreamResolveResponse = await res.json();

      if (data && data.success) {
        setResolvedStream(data);
      } else {
        setStreamError(data?.message || 'ไม่พบช่องสัญญาณที่พร้อมใช้งานสำหรับคู่นี้');
      }
    } catch (err: any) {
      console.error('Resolve stream error:', err);
      setStreamError('ไม่สามารถดึงข้อมูลสตรีมจากเซิร์ฟเวอร์ได้');
    } finally {
      setIsLoadingStream(false);
    }
  };

  const selectMatch = (match: Match, shouldScroll = true) => {
    if (selectedMatch?.id === match.id && resolvedStream && !isTestStream) {
      if (shouldScroll) {
        const playerEl = document.getElementById('player-section');
        if (playerEl) {
          playerEl.scrollIntoView({ behavior: 'smooth' });
        }
      }
      return;
    }

    setSelectedMatch(match);
    resolveMatchStream(match);

    if (shouldScroll) {
      const playerEl = document.getElementById('player-section');
      if (playerEl) {
        playerEl.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleSelectChannel = (channelUrl: string) => {
    if (selectedMatch) {
      resolveMatchStream(selectedMatch, channelUrl);
    }
  };

  const handleSwitchToTestStream = () => {
    setIsTestStream(true);
    setStreamError(null);
    setIsLoadingStream(false);
    const playerEl = document.getElementById('player-section');
    if (playerEl) {
      playerEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleLoadCustomUrl = async (url: string) => {
    setIsLoadingStream(true);
    setStreamError(null);
    setIsTestStream(false);

    if (url.includes('.m3u8')) {
      // Direct m3u8
      setResolvedStream({
        success: true,
        rawM3u8Url: url,
        streamUrl: `/api/proxy/stream?url=${encodeURIComponent(url)}`,
      });
      setIsLoadingStream(false);
    } else {
      // Resolve fixture URL
      try {
        const res = await fetch(`/api/stream/resolve?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        if (data && data.success) {
          setResolvedStream(data);
        } else {
          setStreamError(data.message || 'ไม่สามารถ resolve ลิงก์ที่ระบุได้');
        }
      } catch (err: any) {
        setStreamError('เกิดข้อผิดพลาดในการโหลด URL');
      } finally {
        setIsLoadingStream(false);
      }
    }

    const playerEl = document.getElementById('player-section');
    if (playerEl) {
      playerEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const liveCount = matches.filter(
    (m) => m.status === 'LIVE' || (m.kickoffTime && m.kickoffTime.includes("'"))
  ).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <Navbar
        onRefresh={() => fetchMatches(true)}
        isRefreshing={isRefreshing}
        onOpenInspector={() => setIsInspectorOpen(true)}
        onSelectTestStream={handleSwitchToTestStream}
        liveCount={liveCount}
      />

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-800/80 bg-slate-950 py-10 sm:py-14">
        {/* Background Image with Contrast Scrim */}
        <div className="absolute inset-0 z-0 opacity-25">
          <img
            src={heroStadiumImg}
            alt="Football Stadium Floodlights"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover object-center filter saturate-150"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />
          <div className="absolute inset-0 bg-radial-at-c from-transparent via-slate-950/60 to-slate-950" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/50 px-3.5 py-1 text-xs font-semibold text-emerald-400 mb-4 backdrop-blur-sm">
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            <span>PROXY STREAMING LIVE HD</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white max-w-3xl mx-auto leading-tight text-balance">
            เว็บดูบอลออนไลน์ ถ่ายทอดสดฟุตบอลทุกลีก
          </h1>

          <p className="mt-3 text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            เชื่อมต่อ API รายการสด ดึงลิงก์ Proxy HLS สตรีมมิ่งความคมชัดสูง 1080p พร้อมเครื่องเล่น JW Player
            รองรับการสร้าง Playlist M3U8 เล่นได้ทันทีทุกอุปกรณ์
          </p>

          {/* Quiet Metadata (Zero-pill text separators) */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400 font-medium">
            <span>ถ่ายทอดสดพรีเมียร์ลีก</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>ยูฟ่า แชมเปียนส์ลีก</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>ไทยลีก</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="text-emerald-400 font-semibold">รองรับ M3U8 Master Playlist</span>
          </div>

          {/* Quick CTAs */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#player-section"
              className="flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 active:scale-95 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>รับชมสัญญาณสด (JW Player)</span>
            </a>
            <button
              onClick={() => setIsInspectorOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:border-emerald-500/50 hover:bg-slate-800 transition-all cursor-pointer"
            >
              <Terminal className="h-4 w-4 text-emerald-400" />
              <span>เปิดดูโครงสร้าง Proxy API</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Player Section */}
      <section className="relative z-10 py-8 px-4 sm:px-6 lg:px-8 border-b border-slate-800/80 bg-slate-950/60" id="player-section">
        <div className="mx-auto max-w-7xl">
          {/* Section Subhead */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Tv className="h-5 w-5 text-emerald-400" />
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                เครื่องเล่นสัญญาณสด (JW Player Engine)
              </h2>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={handleSwitchToTestStream}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 hover:border-emerald-500/40 text-slate-300 transition-colors cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                <span>ทดสอบสตรีม 1080p</span>
              </button>
              <button
                onClick={() => setIsInspectorOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 hover:border-emerald-500/40 text-slate-300 transition-colors cursor-pointer"
              >
                <Terminal className="h-3.5 w-3.5 text-emerald-400" />
                <span>ดูโค้ด M3U8</span>
              </button>
            </div>
          </div>

          {/* JW Player Component */}
          <JWPlayer
            currentMatch={selectedMatch}
            resolvedStream={resolvedStream}
            isLoadingStream={isLoadingStream}
            streamError={streamError}
            onRetryResolve={() => selectedMatch && resolveMatchStream(selectedMatch)}
            onSwitchToTestStream={handleSwitchToTestStream}
            onSelectChannel={handleSelectChannel}
            isTestStream={isTestStream}
          />

          {/* Selected Match Card Info below player */}
          {selectedMatch && (
            <div className="mt-4 max-w-5xl mx-auto rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {selectedMatch.homeTeam.logo && (
                      <img
                        src={selectedMatch.homeTeam.logo}
                        alt={selectedMatch.homeTeam.name}
                        referrerPolicy="no-referrer"
                        className="h-7 w-7 object-contain bg-slate-800 rounded p-0.5"
                      />
                    )}
                    <span className="font-bold text-white text-sm sm:text-base">
                      {selectedMatch.homeTeam.name}
                    </span>
                    <span className="font-mono-num font-bold text-emerald-400 text-base px-2 py-0.5 bg-slate-800 rounded">
                      {selectedMatch.homeTeam.score ?? '-'}
                    </span>
                  </div>

                  <span className="text-slate-500 font-bold">VS</span>

                  <div className="flex items-center gap-2">
                    <span className="font-mono-num font-bold text-emerald-400 text-base px-2 py-0.5 bg-slate-800 rounded">
                      {selectedMatch.awayTeam.score ?? '-'}
                    </span>
                    <span className="font-bold text-white text-sm sm:text-base">
                      {selectedMatch.awayTeam.name}
                    </span>
                    {selectedMatch.awayTeam.logo && (
                      <img
                        src={selectedMatch.awayTeam.logo}
                        alt={selectedMatch.awayTeam.name}
                        referrerPolicy="no-referrer"
                        className="h-7 w-7 object-contain bg-slate-800 rounded p-0.5"
                      />
                    )}
                  </div>
                </div>

                {/* Match Metadata */}
                <div className="flex items-center gap-3 text-slate-400">
                  <span className="font-medium text-slate-300">{selectedMatch.league.name}</span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="font-mono-num">{selectedMatch.kickoffTime}</span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span>{selectedMatch.date}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Matches List Section */}
      <MatchList
        matches={matches}
        selectedMatch={selectedMatch}
        onSelectMatch={selectMatch}
        isLoading={isLoadingMatches}
      />

      {/* Feature Highlights Grid */}
      <section className="py-12 border-t border-slate-800/80 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 mb-3 border border-emerald-500/20">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5">Proxy API สตรีมมิ่งความเร็วสูง</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                ระบบจัดการดึง Stream Resolve และ Proxy ผ่านเซิร์ฟเวอร์หลังบ้าน ลดปัญหาบล็อก IP และ CORS ในเบราว์เซอร์
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 mb-3 border border-emerald-500/20">
                <Tv className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5">เครื่องเล่น JW Player & HLS</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                ควบคุมการรับชมได้เต็มรูปแบบ รองรับปรับระดับความละเอียดอัตโนมัติ (Auto / 1080p / 720p), โหมดโรงภาพยนตร์, และจอเต็ม
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 mb-3 border border-emerald-500/20">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5">สร้าง Master M3U8 Playlist ทันที</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                ระบบแปลงสตรีมเป็น #EXTM3U ตามมาตรฐาน พร้อมโครงสร้าง BANDWIDTH และ CODECS เพื่อความเข้ากันได้สูงสุด
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950 py-8 px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm text-slate-300">
              DOOBALL<span className="text-emerald-400">.LIVE</span>
            </span>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <span>ระบบดูบอลสดออนไลน์และตัวเล่น JW Player M3U8</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <button
              onClick={() => setIsInspectorOpen(true)}
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Proxy API Specs
            </button>
            <button
              onClick={handleSwitchToTestStream}
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Test Stream
            </button>
            <button
              onClick={() => fetchMatches(true)}
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              รีเฟรชตาราง
            </button>
          </div>
        </div>
      </footer>

      {/* Stream Details & API Inspector Modal */}
      <StreamDetailsModal
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        currentMatch={selectedMatch}
        resolvedStream={resolvedStream}
        onLoadCustomUrl={handleLoadCustomUrl}
      />
    </div>
  );
}
