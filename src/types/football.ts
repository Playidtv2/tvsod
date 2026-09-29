export interface Team {
  name: string;
  score?: string | number | null;
  logo?: string;
}

export interface League {
  name: string;
  logo?: string;
  sportTypeId?: number | string;
}

export interface StreamChannel {
  id?: number | string;
  url: string;
  image?: string;
  title: string;
  backup?: string;
  status?: string;
  category?: string;
  tvstation_name?: string;
}

export interface StreamLink {
  id: string;
  label: string;
  url: string;
  quality?: string;
}

export interface SportType {
  id: string;
  name: string;
  icon?: string | null;
  liveEventCount: number;
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
  channels?: StreamChannel[];
  sportTypeId?: string | number;
}

export interface MatchesResponse {
  success: boolean;
  source?: string;
  count: number;
  matches: Match[];
  sportTypes?: SportType[];
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
  channels?: StreamChannel[];
}
