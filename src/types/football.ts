export interface Team {
  name: string;
  score?: string | number | null;
  logo?: string;
}

export interface League {
  name: string;
  logo?: string;
}

export interface StreamLink {
  id: string;
  label: string;
  url: string;
  quality?: string;
}

export interface Match {
  id: string;
  slug: string;
  date: string;
  dateOrder?: number;
  homeTeam: Team;
  awayTeam: Team;
  league: League;
  kickoffTime: string;
  status: 'LIVE' | 'UPCOMING' | 'FINISHED' | string;
  currentMinute?: string;
  link: string;
  streamLinks?: StreamLink[];
}

export interface MatchesResponse {
  success: boolean;
  source?: string;
  count: number;
  matches: Match[];
  _cached?: boolean;
  _stale?: boolean;
}

export interface StreamResolveResponse {
  success: boolean;
  source?: string;
  rawM3u8Url?: string;
  streamUrl?: string;
  allCandidates?: string[];
  message?: string;
  _cached?: boolean;
}
