import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Radio,
  Settings,
  Tv,
  AlertCircle,
  Copy,
  Check,
  Code2,
  Maximize2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Match, StreamResolveResponse } from '../types/football';

interface JWPlayerProps {
  currentMatch: Match | null;
  resolvedStream: StreamResolveResponse | null;
  isLoadingStream: boolean;
  streamError: string | null;
  onRetryResolve: () => void;
  onSwitchToTestStream: () => void;
  onSelectChannel?: (url: string) => void;
  isTestStream?: boolean;
}

export type PlaybackMode = 'playlist_m3u8' | 'proxy_stream' | 'raw_m3u8';

export const JWPlayer: React.FC<JWPlayerProps> = ({
  currentMatch,
  resolvedStream,
  isLoadingStream,
  streamError,
  onRetryResolve,
  onSwitchToTestStream,
  onSelectChannel,
  isTestStream,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTheater, setIsTheater] = useState(false);
  const [qualityLevels, setQualityLevels] = useState<{ id: number; height: number; bitrate: number }[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 = Auto
  const [showSettings, setShowSettings] = useState(false);
  const [showCodeDetails, setShowCodeDetails] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('playlist_m3u8');
  const [hlsError, setHlsError] = useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimeoutRef = useRef<any>(null);

  // Compute final stream URL based on playback mode
  const getStreamSourceUrl = useCallback((): string => {
    if (isTestStream) {
      return '/api/test-demo.m3u8';
    }

    if (!resolvedStream?.rawM3u8Url && !resolvedStream?.streamUrl) {
      return '';
    }

    const rawUrl = resolvedStream.rawM3u8Url || '';
    const proxyStreamUrl = resolvedStream.streamUrl || '';

    switch (playbackMode) {
      case 'playlist_m3u8':
        // Generate the master playlist as specified in Prompt Step 5
        return `/api/playlist.m3u8?url=${encodeURIComponent(proxyStreamUrl || rawUrl)}`;
      case 'proxy_stream':
        // Direct proxy stream
        if (proxyStreamUrl.startsWith('/api/proxy/stream')) {
          return proxyStreamUrl;
        }
        return `/api/proxy/stream?url=${encodeURIComponent(rawUrl)}`;
      case 'raw_m3u8':
        return rawUrl;
      default:
        return `/api/playlist.m3u8?url=${encodeURIComponent(proxyStreamUrl || rawUrl)}`;
    }
  }, [isTestStream, resolvedStream, playbackMode]);

  const playPromiseRef = useRef<Promise<void> | null>(null);
  const networkRetryRef = useRef<number>(0);

  // Safe play helper to gracefully handle browser autoplay restrictions and interruption by new load requests
  const safePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    try {
      const promise = video.play();
      playPromiseRef.current = promise;
      if (promise !== undefined) {
        promise
          .then(() => {
            setIsPlaying(true);
          })
          .catch((err: any) => {
            // AbortError is normal when play() is superseded by another load request or pause
            if (err && err.name === 'AbortError') {
              return;
            }
            // NotAllowedError is normal when browser requires user interaction before audio playback
            if (err && err.name === 'NotAllowedError') {
              setIsPlaying(false);
              return;
            }
            setIsPlaying(false);
          });
      }
    } catch {
      setIsPlaying(false);
    }
  }, []);

  // Safe pause helper that awaits any in-flight play request before pausing
  const safePause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (playPromiseRef.current) {
      playPromiseRef.current
        .catch(() => {})
        .finally(() => {
          video.pause();
          setIsPlaying(false);
        });
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  // Load stream into Hls.js
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let isDisposed = false;
    setHlsError(null);
    networkRetryRef.current = 0;
    const sourceUrl = getStreamSourceUrl();

    // Clean up any existing HLS instance before attaching a new one
    if (hlsRef.current) {
      hlsRef.current.stopLoad();
      hlsRef.current.detachMedia();
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (!sourceUrl) {
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      });

      hlsRef.current = hls;

      hls.loadSource(sourceUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        if (isDisposed) return;
        const levels = data.levels.map((lvl, index) => ({
          id: index,
          height: lvl.height,
          bitrate: lvl.bitrate,
        }));
        setQualityLevels(levels);

        safePlay();
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        if (!isDisposed) {
          setCurrentQuality(data.level);
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (isDisposed) return;
        if (data.fatal) {
          console.warn('HLS fatal error encountered:', data.type, data.details);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (networkRetryRef.current < 2) {
                networkRetryRef.current += 1;
                setTimeout(() => {
                  if (!isDisposed && hlsRef.current) {
                    hlsRef.current.startLoad();
                  }
                }, 1500);
              } else {
                hls.stopLoad();
                const isUpcoming = currentMatch?.status === 'UPCOMING' || (currentMatch?.kickoffTime && currentMatch.kickoffTime !== 'จบการแข่งขัน' && !currentMatch.kickoffTime.includes("'"));
                setHlsError(
                  isUpcoming
                    ? `สัญญาณสดคู่นี้ยังไม่เริ่มออกอากาศ (มีกำหนดแข่งขันเวลา ${currentMatch?.kickoffTime || 'วันนี้'}) สัญญาณสดจะเปิดให้รับชมเมื่อใกล้ถึงเวลาเตะ`
                    : currentMatch?.status === 'FINISHED'
                    ? 'การแข่งขันคู่นี้จบลงแล้ว สัญญาณสดปิดการออกอากาศ'
                    : 'ช่องสัญญาณสดไม่ตอบสนอง หรือสัญญาณยังไม่เริ่มถ่ายทอดสด'
                );
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setHlsError('เกิดข้อผิดพลาดในการถอดรหัสวิดีโอ กำลังกู้คืน...');
              hls.recoverMediaError();
              break;
            default:
              setHlsError('ไม่สามารถเล่นสตรีมนี้ได้ในขณะนี้');
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Safari HLS
      video.src = sourceUrl;
      const onLoadedMetadata = () => {
        if (!isDisposed) safePlay();
      };
      video.addEventListener('loadedmetadata', onLoadedMetadata);

      return () => {
        isDisposed = true;
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        safePause();
      };
    }

    return () => {
      isDisposed = true;
      if (hlsRef.current) {
        hlsRef.current.stopLoad();
        hlsRef.current.detachMedia();
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      safePause();
    };
  }, [getStreamSourceUrl, safePlay, safePause]);

  // Volume & Mute handling
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      safePlay();
    } else {
      safePause();
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (newVol > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const handleQualityChange = (levelIndex: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
      setCurrentQuality(levelIndex);
      setShowSettings(false);
    }
  };

  const toggleFullscreen = async () => {
    if (!playerContainerRef.current) return;

    if (!document.fullscreenElement) {
      try {
        await playerContainerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } catch (err) {
        console.error(err);
      }
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const toggleTheater = () => {
    setIsTheater(!isTheater);
  };

  const handleSeekToLive = () => {
    const video = videoRef.current;
    if (!video) return;
    if (hlsRef.current) {
      video.currentTime = video.duration - 1;
    }
  };

  const handleMouseMove = () => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setControlsVisible(false);
      }
    }, 3000);
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const currentStreamUrl = getStreamSourceUrl();
  const generatedM3u8Sample = `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-STREAM-INF:BANDWIDTH=1212323,FRAME-RATE=25,RESOLUTION=1280x720,CODECS="avc1.64001f,mp4a.40.2"\n${window.location.origin}${resolvedStream?.streamUrl || '/api/proxy/stream?url=' + encodeURIComponent(resolvedStream?.rawM3u8Url || '')}`;

  return (
    <div className={`flex flex-col transition-all duration-300 ${isTheater ? 'w-full' : 'max-w-5xl mx-auto'}`}>
      {/* Player Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 border border-b-0 border-slate-800 rounded-t-xl px-4 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <Radio className="h-3 w-3 animate-pulse text-emerald-400" />
            <span>JW PLAYER HD</span>
          </div>
          <span className="text-sm font-semibold text-white truncate">
            {isTestStream
              ? 'สัญญาณทดสอบระบบ (Test Live Stream 1080p)'
              : currentMatch
              ? `${currentMatch.homeTeam.name} vs ${currentMatch.awayTeam.name}`
              : 'เลือกคู่บอลเพื่อรับชม'}
          </span>
          {currentMatch?.league && (
            <span className="hidden sm:inline text-xs text-slate-400 truncate">
              · {currentMatch.league.name}
            </span>
          )}
        </div>

        {/* Quality indicator / Mode pill */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setShowCodeDetails(!showCodeDetails)}
            className="flex items-center gap-1 text-slate-400 hover:text-emerald-400 px-2 py-1 rounded bg-slate-800/80 border border-slate-700 hover:border-emerald-500/40 transition-colors cursor-pointer"
            title="ดูคำสั่ง M3U8 และ Proxy URL"
          >
            <Code2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">M3U8 Source</span>
          </button>

          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono-num font-medium border border-slate-700">
            {currentQuality === -1 ? 'AUTO' : qualityLevels[currentQuality]?.height ? `${qualityLevels[currentQuality].height}p` : 'HD'}
          </span>
        </div>
      </div>

      {/* Main Video Box / JW Container */}
      <div
        ref={playerContainerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setControlsVisible(false)}
        className="group relative w-full aspect-video bg-black overflow-hidden border-x border-slate-800 shadow-2xl select-none"
      >
        <video
          ref={videoRef}
          playsInline
          className="w-full h-full object-contain cursor-pointer"
          onClick={togglePlay}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Top Watermark / Brand in Player (JW Style) */}
        <div className="absolute top-4 right-4 pointer-events-none flex items-center gap-1.5 opacity-60 group-hover:opacity-90 transition-opacity">
          <div className="h-5 w-5 rounded bg-emerald-500 flex items-center justify-center font-black text-[10px] text-slate-950">
            JW
          </div>
          <span className="text-[11px] font-bold tracking-wider text-slate-200">
            DOOBALL
          </span>
        </div>

        {/* Big Center Play Button when paused */}
        {!isPlaying && !isLoadingStream && !streamError && !hlsError && currentMatch && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
            <button
              onClick={togglePlay}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/90 text-slate-950 shadow-xl shadow-emerald-500/30 hover:scale-110 hover:bg-emerald-400 active:scale-95 transition-all cursor-pointer"
            >
              <Play className="h-8 w-8 ml-1 fill-current" />
            </button>
          </div>
        )}

        {/* Loading Spinner */}
        {isLoadingStream && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm text-center p-6">
            <div className="relative mb-4">
              <div className="h-12 w-12 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
              <Tv className="absolute inset-0 m-auto h-5 w-5 text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-white">กำลังดึงลิงก์สตรีมจากระบบ Proxy...</p>
            <p className="text-xs text-slate-400 mt-1">Resolving M3U8 Master Playlist</p>
          </div>
        )}

        {/* Stream Error / Offline Overlay */}
        {(streamError || hlsError) && !isLoadingStream && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-3">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h4 className="text-base font-semibold text-white">
              {streamError || hlsError}
            </h4>
            <p className="text-xs text-slate-400 max-w-md mt-1 mb-4 leading-relaxed">
              สัญญาณอาจยังไม่เริ่มปล่อยก่อนเวลาแข่งขัน หรือเซิร์ฟเวอร์ถ่ายทอดสดกำลังอัปเดตช่องสัญญาณ
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={onRetryResolve}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5 text-emerald-400" />
                <span>ลองดึงสัญญาณใหม่</span>
              </button>
              <button
                onClick={onSwitchToTestStream}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>เปิดดูช่องทดสอบระบบ HD</span>
              </button>
            </div>
          </div>
        )}

        {/* Empty state when no match is selected */}
        {!currentMatch && !isTestStream && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 p-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-4">
              <Tv className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">ยังไม่ได้เลือกคู่ถ่ายทอดสด</h3>
            <p className="text-xs text-slate-400 max-w-sm mb-4">
              เลื่อนลงเพื่อเลือกคู่แข่งขันจากตาราง หรือกดปุ่มด้านล่างเพื่อทดสอบเครื่องเล่น JW Player
            </p>
            <button
              onClick={onSwitchToTestStream}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>เปิดช่องทดสอบสตรีมมิ่ง HD</span>
            </button>
          </div>
        )}

        {/* JW Player Bottom Control Bar */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-4 pb-3 pt-8 transition-opacity duration-300 ${
            controlsVisible || !isPlaying ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Progress / Live indicator line */}
          <div className="relative w-full h-1 bg-white/20 rounded-full mb-3 overflow-hidden cursor-pointer" onClick={handleSeekToLive}>
            <div className="absolute top-0 right-0 h-full w-full bg-emerald-500 origin-right transition-all" />
          </div>

          <div className="flex items-center justify-between gap-3 text-white text-xs">
            {/* Left Controls: Play/Pause, Volume, Live Badge */}
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer text-white"
                title={isPlaying ? 'หยุดชั่วคราว (Space)' : 'เล่น (Space)'}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
              </button>

              {/* Volume Slider */}
              <div className="flex items-center gap-1.5 group/vol">
                <button
                  onClick={toggleMute}
                  className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer text-white"
                  title={isMuted ? 'เปิดเสียง (M)' : 'ปิดเสียง (M)'}
                >
                  {isMuted || volume === 0 ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 h-1 accent-emerald-400 bg-white/20 rounded-lg cursor-pointer transition-all"
                />
              </div>

              {/* Live Badge */}
              <button
                onClick={handleSeekToLive}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-400 font-bold hover:bg-rose-500/30 transition-colors cursor-pointer"
                title="คลิกเพื่อกลับสู่สัญญาณสดล่าสุด"
              >
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                <span>LIVE</span>
              </button>
            </div>

            {/* Right Controls: Quality, PiP, Theater, Fullscreen */}
            <div className="flex items-center gap-2">
              {/* Quality Settings Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                  title="ความละเอียดวิดีโอ"
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span className="font-mono-num">
                    {currentQuality === -1 ? 'Auto' : `${qualityLevels[currentQuality]?.height || 'HD'}p`}
                  </span>
                </button>

                {showSettings && (
                  <div className="absolute bottom-full right-0 mb-2 w-32 rounded-lg bg-slate-900 border border-slate-700 shadow-xl py-1 z-50">
                    <button
                      onClick={() => handleQualityChange(-1)}
                      className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-slate-800 transition-colors ${
                        currentQuality === -1 ? 'text-emerald-400 font-bold' : 'text-slate-300'
                      }`}
                    >
                      <span>Auto</span>
                      {currentQuality === -1 && <Check className="h-3 w-3" />}
                    </button>
                    {qualityLevels.map((lvl) => (
                      <button
                        key={lvl.id}
                        onClick={() => handleQualityChange(lvl.id)}
                        className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-slate-800 transition-colors ${
                          currentQuality === lvl.id ? 'text-emerald-400 font-bold' : 'text-slate-300'
                        }`}
                      >
                        <span className="font-mono-num">{lvl.height}p</span>
                        {currentQuality === lvl.id && <Check className="h-3 w-3" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Theater Mode Toggle */}
              <button
                onClick={toggleTheater}
                className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer text-white"
                title={isTheater ? 'ย่อขนาดปกติ' : 'โหมดโรงภาพยนตร์ (Theater)'}
              >
                <Maximize2 className="h-4 w-4" />
              </button>

              {/* Fullscreen Toggle */}
              <button
                onClick={toggleFullscreen}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer text-white"
                title={isFullscreen ? 'ออกจากเต็มจอ (F)' : 'เต็มจอ (F)'}
              >
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stream Selector & Multi-Link Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-t-0 border-slate-800 rounded-b-xl px-4 py-3">
        {/* Stream Modes */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
          <span className="px-2 text-slate-500 font-medium hidden sm:inline">โหมดส่งข้อมูล:</span>
          <button
            onClick={() => setPlaybackMode('playlist_m3u8')}
            className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
              playbackMode === 'playlist_m3u8'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="สร้างข้อมูลเป็น playlist.m3u8 ตามข้อ 5"
          >
            Master M3U8
          </button>
          <button
            onClick={() => setPlaybackMode('proxy_stream')}
            className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
              playbackMode === 'proxy_stream'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="เล่นผ่าน Proxy Stream URL"
          >
            Proxy Stream
          </button>
          <button
            onClick={() => setPlaybackMode('raw_m3u8')}
            className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
              playbackMode === 'raw_m3u8'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="เล่นโดยตรงจาก Raw M3U8"
          >
            Raw M3U8
          </button>
        </div>

        {/* Match Stream Links / Alternative Channels */}
        {currentMatch?.streamLinks && currentMatch.streamLinks.length > 0 && onSelectChannel && (
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-xs text-slate-400 mr-1 hidden sm:inline">ช่องสำรอง:</span>
            {currentMatch.streamLinks.map((link, idx) => (
              <button
                key={link.id || idx}
                onClick={() => onSelectChannel(link.url)}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                {link.label || `ลิงก์ ${idx + 1}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* M3U8 Code Inspector Drawer (when toggled) */}
      {showCodeDetails && (
        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs font-mono">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <Code2 className="h-4 w-4" />
              <span>โครงสร้างข้อมูลตาม Prompt ข้อ 4 และข้อ 5</span>
            </div>
            <button
              onClick={() => setShowCodeDetails(false)}
              className="text-slate-500 hover:text-slate-300"
            >
              ปิด
            </button>
          </div>

          <div className="space-y-3">
            {/* Raw M3u8 Url */}
            <div>
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-semibold text-slate-300">1. rawM3u8Url (m3u8 ต้นฉบับ):</span>
                <button
                  onClick={() => copyToClipboard(resolvedStream?.rawM3u8Url || '', 'raw')}
                  className="flex items-center gap-1 text-emerald-400 hover:underline cursor-pointer"
                >
                  {copiedField === 'raw' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedField === 'raw' ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                </button>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-300 break-all select-all font-mono text-[11px]">
                {resolvedStream?.rawM3u8Url || '(ยังไม่มีข้อมูล)'}
              </div>
            </div>

            {/* streamUrl */}
            <div>
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-semibold text-slate-300">2. streamUrl (Proxy):</span>
                <button
                  onClick={() => copyToClipboard(resolvedStream?.streamUrl || '', 'proxy')}
                  className="flex items-center gap-1 text-emerald-400 hover:underline cursor-pointer"
                >
                  {copiedField === 'proxy' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedField === 'proxy' ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                </button>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-300 break-all select-all font-mono text-[11px]">
                {resolvedStream?.streamUrl ? `${window.location.origin}${resolvedStream.streamUrl}` : '(ยังไม่มีข้อมูล)'}
              </div>
            </div>

            {/* Generated playlist.m3u8 */}
            <div>
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-semibold text-slate-300">3. สร้างข้อมูลเป็น playlist.m3u8 (ข้อ 5):</span>
                <button
                  onClick={() => copyToClipboard(generatedM3u8Sample, 'm3u8')}
                  className="flex items-center gap-1 text-emerald-400 hover:underline cursor-pointer"
                >
                  {copiedField === 'm3u8' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedField === 'm3u8' ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                </button>
              </div>
              <pre className="p-2.5 rounded bg-slate-900 border border-slate-800 text-emerald-300 overflow-x-auto whitespace-pre leading-relaxed text-[11px]">
                {generatedM3u8Sample}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
