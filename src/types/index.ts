/** Shared domain types. Everything the UI renders is described here. */

export type Lang = 'en' | 'zh';
export type Theme = 'dark' | 'light';

/** The vocabulary used to colour and filter nodes on the map. */
export type SoundCategory =
  | 'nature'
  | 'weather'
  | 'rain'
  | 'water'
  | 'animal'
  | 'human'
  | 'traffic'
  | 'transport'
  | 'architecture'
  | 'city';

export const SOUND_CATEGORIES: SoundCategory[] = [
  'nature',
  'weather',
  'rain',
  'water',
  'animal',
  'human',
  'traffic',
  'transport',
  'architecture',
  'city',
];

export const CATEGORY_COLOR: Record<SoundCategory, string> = {
  nature: '#4fd1b5',
  weather: '#7aa2f7',
  rain: '#5eead4',
  water: '#38bdf8',
  animal: '#a3e635',
  human: '#f9a8d4',
  traffic: '#f97362',
  transport: '#fbbf24',
  architecture: '#c4b5fd',
  city: '#94a3b8',
};

export const CATEGORY_GLYPH: Record<SoundCategory, string> = {
  nature: 'leaf',
  weather: 'wind',
  rain: 'cloud-rain',
  water: 'waves',
  animal: 'bird',
  human: 'users',
  traffic: 'car',
  transport: 'train',
  architecture: 'landmark',
  city: 'building',
};

export type SourceId = 'commons' | 'inaturalist' | 'local';

export interface Place {
  name: string;
  country: string;
  lat: number;
  lon: number;
  /** `exact` = the file carries its own coordinates, `city` = placed at its city. */
  precision: 'exact' | 'city' | 'user';
}

export interface Licence {
  code: string;
  url: string;
  attributionRequired: boolean;
  shareAlike: boolean;
}

export interface Sound {
  id: string;
  source: SourceId;
  title: string;
  description: string;
  audioUrl: string;
  pageUrl: string;
  mime: string;
  durationSec: number | null;
  licence: Licence;
  author: string;
  authorUrl?: string;
  credit?: string;
  soundCategory: SoundCategory;
  place: Place | null;
  recordedAt: string | null;
  /** True when the host sends CORS headers, so a real spectrum can be computed. */
  canAnalyse: boolean;
  /** Pre-formatted attribution line required by the source licence. */
  attribution: string;
}

/** A user-owned sound map (a personal themed route of sounds). */
export interface LocalSoundMap {
  id: string;
  title: string;
  description: string;
  coverSoundId: string | null;
  visibility: 'private' | 'local';
  itemIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** A user-owned journey: an ordered listening route through real places. */
export interface LocalJourney {
  id: string;
  title: string;
  description: string;
  itemIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** A user-uploaded or locally recorded clip. */
export interface LocalClip {
  id: string;
  title: string;
  description: string;
  placeName: string;
  country: string;
  lat: number | null;
  lon: number | null;
  sharePreciseLocation: boolean;
  soundCategory: SoundCategory;
  recordedAt: string | null;
  createdAt: string;
  durationSec: number | null;
  mime: string;
  blob: Blob;
  publicConsent: boolean;
  rightsConfirmed: boolean;
}

/** Snapshot of a remote sound, stored so library pages render without refetching. */
export interface SoundSnapshot {
  id: string;
  sound: Sound;
  savedAt: string;
}

export interface HistoryEntry {
  id: string;
  sound: Sound;
  playedAt: string;
}

export interface Collection {
  id: string;
  titleKey: string;
  descriptionKey: string;
  /** Resolver that returns the real sounds behind this collection. */
  query: SoundQuery;
}

export interface SoundQuery {
  bbox?: [number, number, number, number];
  categories?: SoundCategory[];
  taxonId?: number;
  placeName?: string;
  limit?: number;
  seed?: number;
}

export interface SoundQueryResult {
  items: Sound[];
  /** Total matches reported by the providers when known. */
  total: number | null;
  /** True when some provider failed or was truncated. */
  partial: boolean;
  errors: string[];
}

export interface GeoPoint {
  lat: number;
  lon: number;
}
