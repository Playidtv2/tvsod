import React, { useState, useMemo } from 'react';
import { Search, Filter, Radio, Calendar, Trophy, X, Activity } from 'lucide-react';
import { Match, SportType } from '../types/football';
import { MatchCard } from './MatchCard';

interface MatchListProps {
  matches: Match[];
  sportTypes?: SportType[];
  selectedMatch: Match | null;
  onSelectMatch: (match: Match) => void;
  isLoading: boolean;
}

export const MatchList: React.FC<MatchListProps> = ({
  matches,
  sportTypes = [],
  selectedMatch,
  onSelectMatch,
  isLoading,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LIVE' | 'UPCOMING' | 'FINISHED'>('ALL');
  const [selectedSport, setSelectedSport] = useState<string>('ALL');
  const [selectedLeague, setSelectedLeague] = useState<string>('ALL');

  // Extract unique leagues
  const leagues = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    matches.forEach((m) => {
      const name = m.league?.name || 'อื่นๆ';
      const existing = map.get(name);
      if (existing) {
        existing.count++;
      } else {
        map.set(name, { name, count: 1 });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [matches]);

  // Filter matches
  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      // Sport Type filter
      if (selectedSport !== 'ALL') {
        if (String(m.sportTypeId) !== String(selectedSport)) {
          return false;
        }
      }

      // Status filter
      if (statusFilter === 'LIVE') {
        const isLive = m.status === 'LIVE' || (m.kickoffTime && m.kickoffTime.includes("'")) || m.kickoffTime === 'กำลังแข่ง';
        if (!isLive) return false;
      } else if (statusFilter === 'UPCOMING') {
        const isUpcoming = (m.status === 'UPCOMING' || m.status === 'NS') && m.kickoffTime !== 'จบการแข่งขัน' && m.kickoffTime !== 'กำลังแข่ง';
        if (!isUpcoming) return false;
      } else if (statusFilter === 'FINISHED') {
        const isFinished = m.status === 'FINISHED' || m.kickoffTime === 'จบการแข่งขัน' || m.status === 'FT';
        if (!isFinished) return false;
      }

      // League filter
      if (selectedLeague !== 'ALL') {
        if (m.league?.name !== selectedLeague) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const home = m.homeTeam?.name?.toLowerCase() || '';
        const away = m.awayTeam?.name?.toLowerCase() || '';
        const league = m.league?.name?.toLowerCase() || '';
        return home.includes(query) || away.includes(query) || league.includes(query);
      }

      return true;
    });
  }, [matches, selectedSport, statusFilter, selectedLeague, searchQuery]);

  const liveMatchesCount = useMemo(() => {
    return matches.filter(
      (m) => m.status === 'LIVE' || (m.kickoffTime && m.kickoffTime.includes("'")) || m.kickoffTime === 'กำลังแข่ง'
    ).length;
  }, [matches]);

  const upcomingMatchesCount = useMemo(() => {
    return matches.filter(
      (m) => (m.status === 'UPCOMING' || m.status === 'NS') && m.kickoffTime !== 'จบการแข่งขัน' && m.kickoffTime !== 'กำลังแข่ง'
    ).length;
  }, [matches]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" id="matches-section">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Trophy className="h-4 w-4" />
            <span>โปรแกรมถ่ายทอดสดกีฬาออนไลน์ & ดูบอลสด</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            ตารางถ่ายทอดสด & สัญญาณสตรีมมิ่ง HD
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            เลือกประเภทกีฬาและคู่ที่ต้องการรับชม พร้อมช่องสัญญาณสด SIAM & beIN Sports รองรับ M3U8 Master Playlist
          </p>
        </div>

        {/* Search bar */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาทีม, ลีก, ช่อง..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Sport Types Selector Tabs (boxing, racing, tennis, football, etc.) */}
      {sportTypes.length > 0 && (
        <div className="mb-6 overflow-x-auto pb-2 scrollbar-none">
          <div className="flex items-center gap-2 min-w-max">
            <button
              onClick={() => setSelectedSport('ALL')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                selectedSport === 'ALL'
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-sm shadow-emerald-500/10'
                  : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <Activity className="h-4 w-4" />
              <span>กีฬาทั้งหมด</span>
              <span className="font-mono-num text-[11px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                {matches.length}
              </span>
            </button>

            {sportTypes.map((st) => {
              const countForSport = matches.filter((m) => String(m.sportTypeId) === String(st.id)).length;
              const isSelected = selectedSport === st.id;
              return (
                <button
                  key={st.id}
                  onClick={() => setSelectedSport(st.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-sm shadow-emerald-500/10'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {st.icon ? (
                    <span
                      className="h-4 w-4 flex items-center justify-center shrink-0 text-current [&>svg]:h-4 [&>svg]:w-4"
                      dangerouslySetInnerHTML={{ __html: st.icon }}
                    />
                  ) : (
                    <Trophy className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span>{st.name}</span>
                  {countForSport > 0 && (
                    <span className="font-mono-num text-[11px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                      {countForSport}
                    </span>
                  )}
                  {st.liveEventCount > 0 && (
                    <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Bar: Status segmented control + League Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4 mb-6">
        {/* Status segmented controls */}
        <div className="flex items-center gap-1 p-1 bg-slate-900/90 rounded-lg border border-slate-800 text-xs font-medium">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ทั้งหมด ({matches.length})
          </button>
          <button
            onClick={() => setStatusFilter('LIVE')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              statusFilter === 'LIVE'
                ? 'bg-rose-500 text-white font-bold shadow-sm shadow-rose-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="h-3 w-3" />
            <span>กำลังแข่ง ({liveMatchesCount})</span>
          </button>
          <button
            onClick={() => setStatusFilter('UPCOMING')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              statusFilter === 'UPCOMING'
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="h-3 w-3" />
            <span>วันนี้/เร็วๆ นี้ ({upcomingMatchesCount})</span>
          </button>
          <button
            onClick={() => setStatusFilter('FINISHED')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              statusFilter === 'FINISHED'
                ? 'bg-slate-700 text-white font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ผลการแข่งขัน
          </button>
        </div>

        {/* League dropdown filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={selectedLeague}
            onChange={(e) => setSelectedLeague(e.target.value)}
            className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer max-w-[200px] truncate"
          >
            <option value="ALL">ทุกลีก / รายการ ({matches.length})</option>
            {leagues.map((lg) => (
              <option key={lg.name} value={lg.name}>
                {lg.name} ({lg.count})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 rounded-xl border border-slate-800 bg-slate-900/40 p-4 animate-pulse">
              <div className="h-4 bg-slate-800 rounded w-1/3 mb-4" />
              <div className="space-y-3">
                <div className="h-5 bg-slate-800 rounded w-3/4" />
                <div className="h-5 bg-slate-800 rounded w-2/3" />
              </div>
              <div className="h-6 bg-slate-800 rounded w-1/4 mt-6" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredMatches.length === 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-12 text-center max-w-md mx-auto my-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-slate-400 mx-auto mb-3">
            <Search className="h-6 w-6" />
          </div>
          <h4 className="text-base font-semibold text-white mb-1">ไม่พบคู่แข่งขันที่ค้นหา</h4>
          <p className="text-xs text-slate-400 mb-4">
            ลองปรับเปลี่ยนคำค้นหา หรือเปลี่ยนตัวกรองสถานะเป็น "ทุกลีก"
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('ALL');
              setSelectedLeague('ALL');
            }}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-xs font-semibold hover:bg-emerald-400 transition-colors cursor-pointer"
          >
            ล้างตัวกรองทั้งหมด
          </button>
        </div>
      )}

      {/* Matches Grid */}
      {!isLoading && filteredMatches.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMatches.map((match) => (
            <MatchCard
              key={match.id || match.slug}
              match={match}
              isSelected={selectedMatch?.id === match.id}
              onSelect={onSelectMatch}
            />
          ))}
        </div>
      )}
    </div>
  );
};
