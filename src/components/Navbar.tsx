import React from 'react';
import { Tv, Radio, PlayCircle, RefreshCw, Terminal } from 'lucide-react';

interface NavbarProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenInspector: () => void;
  onSelectTestStream: () => void;
  liveCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  onRefresh,
  isRefreshing,
  onOpenInspector,
  onSelectTestStream,
  liveCount,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single Brand element */}
        <a href="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-white hover:text-emerald-400 transition-colors">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Tv className="h-5 w-5" />
          </div>
          <span className="font-extrabold text-xl tracking-tight">
            DOOBALL<span className="text-emerald-400">.LIVE</span>
          </span>
        </a>

        {/* Zone 2: Navigation Links (single-line, clean text) */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <a href="#player-section" className="hover:text-white transition-colors flex items-center gap-1.5">
            <PlayCircle className="h-4 w-4 text-emerald-400" />
            <span>จอถ่ายทอดสด</span>
          </a>
          <a href="#matches-section" className="hover:text-white transition-colors flex items-center gap-1.5">
            <Radio className="h-4 w-4 text-rose-400" />
            <span>ตารางแข่งขัน</span>
            {liveCount > 0 && (
              <span className="ml-1 text-xs font-bold text-rose-400 font-mono-num animate-pulse">
                ({liveCount} สด)
              </span>
            )}
          </a>
          <button
            onClick={onSelectTestStream}
            className="hover:text-emerald-400 transition-colors text-left flex items-center gap-1.5 cursor-pointer text-slate-400"
          >
            <span>ช่องทดสอบสัญญาณ HD</span>
          </button>
        </nav>

        {/* Zone 3: 1-2 Primary Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenInspector}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-emerald-500/50 hover:bg-slate-800 hover:text-white transition-all whitespace-nowrap cursor-pointer"
            title="ดูการทำงานของ Proxy API และ M3U8"
          >
            <Terminal className="h-3.5 w-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Proxy API Debugger</span>
            <span className="sm:hidden">API</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer shadow-sm shadow-emerald-500/20"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>รีเฟรชสด</span>
          </button>
        </div>
      </div>
    </header>
  );
};
