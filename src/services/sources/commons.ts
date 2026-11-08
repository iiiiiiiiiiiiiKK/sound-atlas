/**
 * Wikimedia Commons adapter.
 *
 * Two lanes:
 *  1. `loadCatalog()` — the curated catalog built by scripts/fetch-commons-catalog.mjs.
 *     Every record was filtered at build time to openly licensed field recordings that
 *     carry real place evidence.
 *  2. `searchByPlace()` — a live `list=search` + `imageinfo` lookup so a user can find
 *     recordings in places the curated catalog does not cover. Results pass the same
 *     licence gate before they are shown.
 */
import { getJson, getLocalJson } from '@/services/http';
import type { Sound, SoundCategory, SoundQueryResult } from '@/types';

const API = 'https://commons.wikimedia.org/w/api.php';

interface CatalogueRecord {
  id: string;
  source: 'commons';
  title: string;
  description: string;
  audioUrl: string;
  pageUrl: string;
  mime: string;
  bytes: number;
  durationSec: number | null;
  licence: { code: string; url: string; attributionRequired: boolean; shareAlike: boolean };
  author: string;
  credit: string;
  categories: string[];
  keywords: string;
  soundCategory: SoundCategory;
  place: { name: string; country: string; lat: number; lon: number; precision: 'exact' | 'city' } | null;
  recordedAt: string | null;
}

interface Catalogue {
  generatedAt: string;
  count: number;
  entries: CatalogueRecord[];
}

export interface CommonsCatalogueMeta {
  generatedAt: string;
  count: number;
}

let cache: { entries: Sound[]; meta: CommonsCatalogueMeta } | null = null;

function toSound(record: CatalogueRecord): Sound {
  const attribution = record.licence.attributionRequired
    ? `“${record.title}” by ${record.author} — ${record.licence.code.toUpperCase()} · Wikimedia Commons`
    : `“${record.title}” — ${record.licence.code} · Wikimedia Commons`;
  return {
    id: record.id,
    source: 'commons',
    title: record.title,
    description: record.description,
    audioUrl: record.audioUrl,
    pageUrl: record.pageUrl,
    mime: record.mime,
    durationSec: record.durationSec,
    licence: record.licence,
    author: record.author,
    credit: record.credit,
    soundCategory: record.soundCategory,
    place: record.place,
    recordedAt: record.recordedAt,
    canAnalyse: true,
    attribution,
  };
}

export async function loadCatalog(): Promise<{ entries: Sound[]; meta: CommonsCatalogueMeta }> {
  if (cache) return cache;
  const payload = await getLocalJson<Catalogue>('data/commons-catalog.json');
  const entries = (payload.entries || []).map(toSound).filter((sound) => sound.place);
  cache = { entries, meta: { generatedAt: payload.generatedAt, count: entries.length } };
  return cache;
}

export async function catalogueMeta(): Promise<CommonsCatalogueMeta> {
  return (await loadCatalog()).meta;
}

/** All catalogue sounds whose place falls inside the bounding box. */
export function inBoundingBox(sounds: Sound[], bbox: [number, number, number, number]): Sound[] {
  const [west, south, east, north] = bbox;
  const crossesAntimeridian = west > east;
  return sounds.filter((sound) => {
    if (!sound.place) return false;
    const { lat, lon } = sound.place;
    if (lat < south || lat > north) return false;
    return crossesAntimeridian ? lon >= west || lon <= east : lon >= west && lon <= east;
  });
}

const ALLOWED = /^(cc0|public domain|cc by(-sa)? \d\.\d)$/i;

function licenceCode(raw: string): string {
  const text = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  if (text.includes('cc0') || text.includes('public domain') || text === 'pd') return text.includes('cc0') ? 'cc0' : 'public domain';
  const match = text.match(/cc[\s-]*(by(?:[\s-]*sa)?)[\s-]*(\d(?:\.\d)?)/);
  return match ? `cc ${match[1].replace(/\s+/g, '-')} ${match[2]}` : text;
}

function stripHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function classify(text: string): SoundCategory {
  const t = ` ${text.toLowerCase()} `;
  const table: [SoundCategory, string[]][] = [
    ['rain', [' rain', 'rainfall', 'drizzle']],
    ['weather', ['wind', 'storm', 'thunder', 'hail', 'snow']],
    ['water', ['water', 'river', 'stream', 'waterfall', 'wave', 'sea', 'ocean', 'beach']],
    ['traffic', ['traffic', 'car', 'road', 'street', 'motor', 'highway', 'horn']],
    ['transport', ['train', 'railway', 'station', 'metro', 'subway', 'airport', 'plane', 'tram']],
    ['animal', ['bird', 'insect', 'cricket', 'cicada', 'frog', 'animal', 'gull', 'owl']],
    ['human', ['crowd', 'people', 'voice', 'market', 'festival', 'children', 'footsteps']],
    ['architecture', ['church', 'bell', 'cathedral', 'temple', 'hall', 'museum', 'indoor', 'room']],
    ['city', ['city', 'urban', 'downtown', 'town', 'plaza', 'shop']],
  ];
  for (const [category, words] of table) {
    if (words.some((word) => t.includes(word))) return category;
  }
  return 'nature';
}

interface SearchPage {
  pageid: number;
  title: string;
  imageinfo?: {
    url: string;
    descriptionurl: string;
    mime: string;
    size: number;
    extmetadata?: Record<string, { value: unknown }>;
  }[];
  videoinfo?: { duration?: number; derivatives?: { src: string; type?: string }[] }[];
}

/** Live search against Commons for a free-text place query. */
export async function searchByPlace(place: string, signal?: AbortSignal): Promise<SoundQueryResult> {
  const errors: string[] = [];
  try {
    const searchUrl = `${API}?${new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      list: 'search',
      srsearch: `filetype:audio sound ${place}`,
      srnamespace: '6',
      srlimit: '20',
    })}`;
    const search = await getJson<{ query?: { search?: { title: string }[] } }>(searchUrl, {
      signal,
      timeoutMs: 12000,
    });
    const titles = (search.query?.search || []).map((item) => item.title);
    if (!titles.length) return { items: [], total: 0, partial: false, errors };

    const infoUrl = `${API}?${new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      prop: 'imageinfo|videoinfo',
      iiprop: 'url|mime|size|extmetadata',
      viprop: 'derivatives|duration',
      titles: titles.slice(0, 20).join('|'),
    })}`;
    const info = await getJson<{ query?: { pages?: Record<string, SearchPage> } }>(infoUrl, {
      signal,
      timeoutMs: 12000,
    });

    const items: Sound[] = [];
    for (const page of Object.values(info.query?.pages || {})) {
      const file = page.imageinfo?.[0];
      if (!file || !file.mime.startsWith('audio')) continue;
      const meta = file.extmetadata || {};
      const licence = licenceCode(stripHtml(meta.LicenseShortName?.value ?? meta.UsageTerms?.value));
      if (!ALLOWED.test(licence)) continue;
      const author = stripHtml(meta.Artist?.value).slice(0, 120) || 'Unknown author';
      const derivative = (page.videoinfo?.[0]?.derivatives || []).find(
        (entry) => entry.type === 'audio/mpeg' || /\.mp3$/i.test(entry.src || ''),
      );
      const title = page.title.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ');
      const description = stripHtml(meta.ImageDescription?.value).slice(0, 300);
      items.push({
        id: `commons-live-${page.pageid}`,
        source: 'commons',
        title,
        description,
        audioUrl: derivative?.src || file.url.split('?')[0],
        pageUrl: file.descriptionurl,
        mime: file.mime,
        durationSec: page.videoinfo?.[0]?.duration ? Math.round(Number(page.videoinfo[0].duration)) : null,
        licence: {
          code: licence,
          url: 'https://commons.wikimedia.org/wiki/Commons:Licensing',
          attributionRequired: !/cc0|public domain/i.test(licence),
          shareAlike: /sa/i.test(licence),
        },
        author,
        soundCategory: classify(`${title} ${description}`),
        place: null,
        recordedAt: null,
        canAnalyse: true,
        attribution: `“${title}” by ${author} — ${licence.toUpperCase()} · Wikimedia Commons`,
      });
    }
    return { items, total: items.length, partial: false, errors };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'commons search failed');
    return { items: [], total: null, partial: true, errors };
  }
}
