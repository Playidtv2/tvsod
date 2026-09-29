import React from 'react';
import { Play, Radio, Calendar, CheckCircle2 } from 'lucide-react';
import { Match } from '../types/football';

interface MatchCardProps {
  match: Match;
  isSelected: boolean;
  onSelect: (match: Match) => void;
}

export const MatchCard: React.FC<MatchCardProps> = ({ match, isSelected, onSelect }) => {
  const isLive = match.status === 'LIVE' || (match.kickoffTime && match.kickoffTime.includes("'"));
  const isFinished = match.status === 'FINISHED' || match.kickoffTime === 'จบการแข่งขัน';

  return (
    <div
      onClick={() => onSelect(match)}
      className={`group relative flex flex-col justify-between rounded-xl border p-4 transition-all duration-200 cursor-pointer ${
        isSelected
          ? 'border-emerald-500 bg-slate-900/90 ring-1 ring-emerald-500/50 shadow-lg shadow-emerald-500/10'
          : 'border-slate-800/80 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/70'
      }`}
    >
      {/* Top Header: League & Status */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/60 pb-2.5 mb-3 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          {match.league.logo ? (
            <img
              src={match.league.logo}
              alt={match.league.name}
              referrerPolicy="no-referrer"
              className="h-4 w-4 object-contain rounded-full bg-slate-800 shrink-0"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : null}
          <span className="font-medium text-slate-300 truncate max-w-[140px] sm:max-w-[180px]">
            {match.league.name}
          </span>
        </div>

        {/* Status indicator (Zero-pill text styling) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isLive ? (
            <span className="flex items-center gap-1 text-rose-400 font-bold font-mono-num text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
              <span>สด {match.currentMinute ? `(${match.currentMinute})` : ''}</span>
            </span>
          ) : isFinished ? (
            <span className="flex items-center gap-1 text-slate-400 text-[11px]">
              <CheckCircle2 className="h-3 w-3 text-slate-500" />
              <span>จบการแข่งขัน</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-400 font-mono-num font-semibold text-[11px]">
              <Calendar className="h-3 w-3 text-emerald-500/70" />
              <span>{match.kickoffTime}</span>
            </span>
          )}
        </div>
      </div>

      {/* Teams & Scores */}
      <div className="space-y-2.5 py-1">
        {/* Home Team */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {match.homeTeam.logo ? (
              <img
                src={match.homeTeam.logo}
                alt={match.homeTeam.name}
                referrerPolicy="no-referrer"
                className="h-6 w-6 object-contain rounded bg-slate-800 shrink-0 p-0.5"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="h-6 w-6 rounded bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400 shrink-0">
                {match.homeTeam.name.slice(0, 1)}
              </div>
            )}
            <span className={`text-sm truncate font-medium ${isSelected ? 'text-white font-semibold' : 'text-slate-200'}`}>
              {match.homeTeam.name}
            </span>
          </div>

          <span className="font-mono-num text-sm font-bold text-white px-2 py-0.5 rounded bg-slate-800/80 min-w-6 text-center">
            {match.homeTeam.score !== undefined && match.homeTeam.score !== null ? match.homeTeam.score : '-'}
          </span>
        </div>

        {/* Away Team */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {match.awayTeam.logo ? (
              <img
                src={match.awayTeam.logo}
                alt={match.awayTeam.name}
                referrerPolicy="no-referrer"
                className="h-6 w-6 object-contain rounded bg-slate-800 shrink-0 p-0.5"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="h-6 w-6 rounded bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400 shrink-0">
                {match.awayTeam.name.slice(0, 1)}
              </div>
            )}
            <span className={`text-sm truncate font-medium ${isSelected ? 'text-white font-semibold' : 'text-slate-200'}`}>
              {match.awayTeam.name}
            </span>
          </div>

          <span className="font-mono-num text-sm font-bold text-white px-2 py-0.5 rounded bg-slate-800/80 min-w-6 text-center">
            {match.awayTeam.score !== undefined && match.awayTeam.score !== null ? match.awayTeam.score : '-'}
          </span>
        </div>
      </div>

      {/* Footer Info & Action */}
      <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <span>{match.date || 'วันนี้'}</span>
          {match.channels && match.channels.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400 font-mono-num border border-slate-700">
              {match.channels.length} ช่อง
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(match);
          }}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            isSelected
              ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/30'
              : 'bg-slate-800 text-slate-200 group-hover:bg-emerald-500 group-hover:text-slate-950'
          }`}
        >
          {isLive ? <Radio className="h-3 w-3 animate-pulse" /> : <Play className="h-3 w-3 fill-current" />}
          <span>{isLive ? 'ดูสดเลย' : isFinished ? 'ดูย้อนหลัง' : 'รับชม'}</span>
        </button>
      </div>
    </div>
  );
};
