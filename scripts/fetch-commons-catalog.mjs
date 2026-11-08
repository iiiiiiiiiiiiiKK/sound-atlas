#!/usr/bin/env node
/**
 * Builds the bundled Wikimedia Commons field-recording catalog.
 *
 * Every entry comes from the live Commons API (action=query&prop=imageinfo|videoinfo):
 *  - only audio files whose declared licence is in the allow-list below are kept,
 *  - coordinates come from the file's own EXIF GPS when Commons publishes it,
 *  - otherwise the record is placed at *city level* using the "Audio files of <City>"
 *    category it is filed under, and marked `precision: "city"` so the UI can say so,
 *  - files with no location evidence at all are kept with `precision: "unknown"` and
 *    are never drawn on the map.
 *
 * Usage: node scripts/fetch-commons-catalog.mjs
 * Output: public/data/commons-catalog.json
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'public/data/commons-catalog.json');

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'SoundAtlas/1.0 (https://github.com/iiiiiiiiiiiiiKK/sound-atlas; catalog build)';

/** Licences we are willing to embed. Everything else is dropped. */
const ALLOWED_LICENCES = [
  'cc0',
  'public domain',
  'pd',
  'cc by 1.0',
  'cc by 2.0',
  'cc by 2.5',
  'cc by 3.0',
  'cc by 4.0',
  'cc by-sa 1.0',
  'cc by-sa 2.0',
  'cc by-sa 2.5',
  'cc by-sa 3.0',
  'cc by-sa 4.0',
];

const LICENCE_URL = {
  cc0: 'https://creativecommons.org/publicdomain/zero/1.0/',
  'cc by 1.0': 'https://creativecommons.org/licenses/by/1.0/',
  'cc by 2.0': 'https://creativecommons.org/licenses/by/2.0/',
  'cc by 2.5': 'https://creativecommons.org/licenses/by/2.5/',
  'cc by 3.0': 'https://creativecommons.org/licenses/by/3.0/',
  'cc by 4.0': 'https://creativecommons.org/licenses/by/4.0/',
  'cc by-sa 1.0': 'https://creativecommons.org/licenses/by-sa/1.0/',
  'cc by-sa 2.0': 'https://creativecommons.org/licenses/by-sa/2.0/',
  'cc by-sa 2.5': 'https://creativecommons.org/licenses/by-sa/2.5/',
  'cc by-sa 3.0': 'https://creativecommons.org/licenses/by-sa/3.0/',
  'cc by-sa 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
};

/** Cities used both to discover categories and to place city-level records. */
const CITIES = [
  ['Berlin', 'Germany', 52.52, 13.405],
  ['Hamburg', 'Germany', 53.5511, 9.9937],
  ['Munich', 'Germany', 48.1351, 11.582],
  ['Cologne', 'Germany', 50.9375, 6.9603],
  ['Vienna', 'Austria', 48.2082, 16.3738],
  ['Zurich', 'Switzerland', 47.3769, 8.5417],
  ['Paris', 'France', 48.8566, 2.3522],
  ['Lyon', 'France', 45.764, 4.8357],
  ['London', 'United Kingdom', 51.5072, -0.1276],
  ['Edinburgh', 'United Kingdom', 55.9533, -3.1883],
  ['Dublin', 'Ireland', 53.3498, -6.2603],
  ['Amsterdam', 'Netherlands', 52.3676, 4.9041],
  ['Brussels', 'Belgium', 50.8503, 4.3517],
  ['Copenhagen', 'Denmark', 55.6761, 12.5683],
  ['Stockholm', 'Sweden', 59.3293, 18.0686],
  ['Oslo', 'Norway', 59.9139, 10.7522],
  ['Helsinki', 'Finland', 60.1699, 24.9384],
  ['Tallinn', 'Estonia', 59.437, 24.7536],
  ['Warsaw', 'Poland', 52.2297, 21.0122],
  ['Prague', 'Czech Republic', 50.0755, 14.4378],
  ['Budapest', 'Hungary', 47.4979, 19.0402],
  ['Lisbon', 'Portugal', 38.7223, -9.1393],
  ['Madrid', 'Spain', 40.4168, -3.7038],
  ['Barcelona', 'Spain', 41.3874, 2.1686],
  ['Rome', 'Italy', 41.9028, 12.4964],
  ['Milan', 'Italy', 45.4642, 9.19],
  ['Venice', 'Italy', 45.4408, 12.3155],
  ['Athens', 'Greece', 37.9838, 23.7275],
  ['Istanbul', 'Turkey', 41.0082, 28.9784],
  ['Moscow', 'Russia', 55.7558, 37.6173],
  ['New York City', 'United States', 40.7128, -74.006],
  ['Chicago', 'United States', 41.8781, -87.6298],
  ['San Francisco', 'United States', 37.7749, -122.4194],
  ['Los Angeles', 'United States', 34.0522, -118.2437],
  ['Seattle', 'United States', 47.6062, -122.3321],
  ['Toronto', 'Canada', 43.6532, -79.3832],
  ['Vancouver', 'Canada', 49.2827, -123.1207],
  ['Montreal', 'Canada', 45.5019, -73.5674],
  ['Mexico City', 'Mexico', 19.4326, -99.1332],
  ['Havana', 'Cuba', 23.1136, -82.3666],
  ['Sao Paulo', 'Brazil', -23.5505, -46.6333],
  ['Rio de Janeiro', 'Brazil', -22.9068, -43.1729],
  ['Buenos Aires', 'Argentina', -34.6037, -58.3816],
  ['Santiago', 'Chile', -33.4489, -70.6693],
  ['Lima', 'Peru', -12.0464, -77.0428],
  ['Bogota', 'Colombia', 4.711, -74.0721],
  ['Cape Town', 'South Africa', -33.9249, 18.4241],
  ['Nairobi', 'Kenya', -1.2921, 36.8219],
  ['Cairo', 'Egypt', 30.0444, 31.2357],
  ['Marrakesh', 'Morocco', 31.6295, -7.9811],
  ['Dubai', 'United Arab Emirates', 25.2048, 55.2708],
  ['Mumbai', 'India', 19.076, 72.8777],
  ['New Delhi', 'India', 28.6139, 77.209],
  ['Kolkata', 'India', 22.5726, 88.3639],
  ['Bangkok', 'Thailand', 13.7563, 100.5018],
  ['Singapore', 'Singapore', 1.3521, 103.8198],
  ['Kuala Lumpur', 'Malaysia', 3.139, 101.6869],
  ['Jakarta', 'Indonesia', -6.2088, 106.8456],
  ['Manila', 'Philippines', 14.5995, 120.9842],
  ['Hong Kong', 'Hong Kong', 22.3193, 114.1694],
  ['Taipei', 'Taiwan', 25.033, 121.5654],
  ['Seoul', 'South Korea', 37.5665, 126.978],
  ['Tokyo', 'Japan', 35.6762, 139.6503],
  ['Osaka', 'Japan', 34.6937, 135.5023],
  ['Kyoto', 'Japan', 35.0116, 135.7681],
  ['Beijing', 'China', 39.9042, 116.4074],
  ['Shanghai', 'China', 31.2304, 121.4737],
  ['Sydney', 'Australia', -33.8688, 151.2093],
  ['Melbourne', 'Australia', -37.8136, 144.9631],
  ['Auckland', 'New Zealand', -36.8485, 174.7633],
  ['Reykjavik', 'Iceland', 64.1466, -21.9426],
];

/** Thematic categories whose members are soundscapes rather than place files. */
const THEME_CATEGORIES = [
  'Category:Soundscape',
  'Category:Sounds of rain',
  'Category:Recordings of wind',
  'Category:Crowds',
  'Category:Field recordings',
  'Category:Sounds of noise',
  'Category:Thunderstorms',
  'Category:Waterfalls',
  'Category:Waves',
  'Category:Road traffic noise',
  'Category:Railway sounds',
  'Category:Church bells',
];

/** Words that mark a file as speech, news, music or narration 閳?never a field recording. */
const REJECT_WORDS = [
  'spoken wikipedia',
  'pronunciation',
  'pronounciation',
  'anthem',
  'waltz',
  'symphony',
  'sonata',
  'overture',
  'concerto',
  'prelude',
  'requiem',
  'opera ',
  'dharani',
  'chant',
  'sermon',
  'interview',
  'speech',
  'audiobook',
  'podcast',
  'music',
  'song',
  'piano',
  'guitar',
  'violin',
  'orchestra',
  'choir',
  'voice of america',
  'pd voa',
  'voa ',
  'radio',
  'broadcast',
  'news',
    'journalist',
  'correspondent',
  'narration',
  'lecture',
  'talking',
  'debate',
  'press conference',
  'license review needed',
  'white noise',
  'pink noise',
  'brown noise',
  'grey noise',
  'gray noise',
  'blue noise',
  'violet noise',
  'perlin noise',
  'gaussian',
  'synthetic sounds',
  'noise (physics)',
  'white-noise',
  'weighted noise',
  'audio files of 18',
  'audio files of 19',
  ];

/** The recording must actually claim to be environmental sound. */
const POSITIVE_WORDS = [
  'sound',
  'soundscape',
  'field record',
  'ambience',
  'ambient',
  'noise',
  'atmosphere',
  'recording of',
  'nature recording',
  'recorded at',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let lastCall = 0;
/** Commons rate-limits aggressively: serialise every request. */
async function api(params, attempt = 0) {
  const wait = Math.max(0, 900 - (Date.now() - lastCall));
  if (wait) await sleep(wait);
  lastCall = Date.now();
  const url = `${API}?${new URLSearchParams({ action: 'query', format: 'json', ...params })}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!text.trim().startsWith('{')) throw new Error(text.slice(0, 120));
    return JSON.parse(text);
  } catch (err) {
    if (attempt < 4) {
      await sleep(1500 * (attempt + 1));
      return api(params, attempt + 1);
    }
    throw err;
  }
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normaliseLicence(raw) {
  return stripHtml(raw).toLowerCase().replace(/\s+/g, ' ').trim();
}

function pickLicence(ext) {
  const candidates = [ext?.LicenseShortName?.value, ext?.UsageTerms?.value, ext?.License?.value]
    .map(normaliseLicence)
    .filter(Boolean);
  for (const candidate of candidates) {
    const compact = candidate.replace(/^cc[\s-]*/, 'cc ').replace(/creative commons\s*/i, 'cc ');
    if (ALLOWED_LICENCES.includes(compact)) return compact;
    if (compact.startsWith('public domain') || compact === 'pd' || compact === 'pd-self') return 'public domain';
    if (compact.startsWith('cc0')) return 'cc0';
    const match = compact.match(/cc[\s-]*(by(?:[\s-]*sa)?)[\s-]*(\d(?:\.\d)?)/);
    if (match) {
      const key = `cc ${match[1].replace(/\s+/g, '-')} ${match[2]}`;
      if (ALLOWED_LICENCES.includes(key)) return key;
    }
  }
  return null;
}

function parseDuration(value) {
  const text = stripHtml(value);
  if (!text) return null;
  if (/^\d+(\.\d+)?$/.test(text)) {
    const seconds = Number(text) / (Number(text) > 30000 ? 1000 : 1);
    return seconds > 0 && seconds < 3600 ? Math.round(seconds) : null;
  }
  const parts = text.split(':').map((part) => Number(part));
  if (parts.length === 2 && parts.every((n) => Number.isFinite(n))) return Math.round(parts[0] * 60 + parts[1]);
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) return Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2]);
  return null;
}

function parseCoord(value) {
  if (value == null || value === '') return null;
  const num = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(num) && Math.abs(num) <= 180 ? num : null;
}

/** Deterministic classification from title/description/category vocabulary. */
function classify(text) {
  const t = ` ${text.toLowerCase()} `;
  const rules = [
    ['rain', [' rain', 'rainfall', 'drizzle', 'downpour', 'shower']],
    ['weather', [' wind', 'storm', 'thunder', 'hail', 'snow', 'sleet', 'weather']],
    ['water', ['water', 'river', 'stream', 'waterfall', 'wave', 'sea ', 'ocean', 'beach', 'harbour', 'harbor', 'fountain', 'lake']],
    ['traffic', ['traffic', 'car ', 'cars ', 'road', 'street noise', 'motorway', 'highway', 'intersection', 'horn', 'bus ', 'tram', 'engine']],
    ['transport', ['train', 'railway', 'rail ', 'station', 'metro', 'subway', 'airport', 'plane', 'aircraft', 'platform', 'tram']],
    ['animal', ['bird', 'crow', 'gull', 'insect', 'cricket', 'cicada', 'frog', 'dog', 'cat ', 'animal', 'birdsong', 'bee', 'seagull', 'owl']],
    ['human', ['crowd', 'people', 'voices', 'market', 'festival', 'children', 'speech', 'chat', 'footsteps', 'restaurant', 'cafe', 'square']],
    ['architecture', ['church', 'bell', 'cathedral', 'temple', 'hall', 'museum', 'tunnel', 'underpass', 'indoor', 'room', 'stairwell', 'station hall']],
    ['city', ['city', 'urban', 'downtown', 'centre', 'center', 'town', 'plaza', 'alexa', 'mall', 'shop']],
  ];
  for (const [category, words] of rules) {
    if (words.some((word) => t.includes(word))) return category;
  }
  return 'nature';
}

function cityFor(categoryName) {
  const match = /^Audio files of (.+)$/i.exec(categoryName);
  if (!match) return null;
  const name = match[1].trim();
  return CITIES.find(([city]) => city.toLowerCase() === name.toLowerCase()) || null;
}

/**
 * Place a recording by the place categories it is filed under.
 * Only a category that names a known city is trusted; anything else stays unknown.
 */
function cityFromCategories(categories) {
  for (const category of categories) {
    const found = cityFor(category);
    if (found) return found;
  }
  return null;
}

async function listCategory(category) {
  const members = [];
  let cont = {};
  do {
    const data = await api({
      list: 'categorymembers',
      cmtitle: category,
      cmtype: 'file',
      cmlimit: '500',
      ...cont,
    });
    for (const member of data?.query?.categorymembers || []) members.push(member.title);
    cont = data?.continue ? { cmcontinue: data.continue.cmcontinue } : {};
  } while (cont.cmcontinue && members.length < 500);
  return members;
}

async function fileFacts(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 25) {
    const chunk = titles.slice(i, i + 25);
    const data = await api({
      prop: 'imageinfo|videoinfo',
      iiprop: 'url|mime|size|extmetadata',
      viprop: 'url|mime|derivatives|size|duration',
      titles: chunk.join('|'),
    });
    for (const page of Object.values(data?.query?.pages || {})) {
      const info = page.imageinfo?.[0];
      const video = page.videoinfo?.[0];
      if (!info) continue;
      out.set(page.title, { info, video });
    }
  }
  return out;
}

/** Stable, collision-free id from the Commons file title. */
function makeId(fileTitle) {
  const slug = fileTitle
    .replace(/^File:/, '')
    .replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  let hash = 0x811c9dc5;
  for (const char of fileTitle) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `commons-${slug || 'file'}-${hash.toString(16).padStart(8, '0')}`;
}

function extract(entry, facts) {
  const { info, video } = facts;
  const mime = String(info.mime || '');
  if (!mime.startsWith('audio') && mime !== 'application/ogg') return null;
  if (!(info.size > 4000)) return null;
  // Keep files that can start streaming quickly; longer material stays in Commons.
  if (info.size > 24 * 1024 * 1024) return null;

  const ext = info.extmetadata || {};
  const licence = pickLicence(ext);
  if (!licence) return null;

  const title = entry.fileTitle.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim();
  const description = stripHtml(ext.ImageDescription?.value).slice(0, 400);
  const categories = stripHtml(ext.Categories?.value)
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
  const haystack = `${title} ${description} ${categories.join(' ')} ${entry.category}`.toLowerCase();

  // Speech, music, news and narration never belong on the map.
  if (REJECT_WORDS.some((word) => haystack.includes(word))) return null;
  // A field recording must present itself as one.
  if (!POSITIVE_WORDS.some((word) => haystack.includes(word))) return null;

  const duration =
    Number(video?.duration) > 0
      ? Math.round(Number(video.duration))
      : parseDuration(ext.length?.value ?? ext.Duration?.value);
  if (duration != null && (duration < 4 || duration > 1800)) return null;

  const derivative = (video?.derivatives || []).find((item) => item.type === 'audio/mpeg' || /\.mp3$/i.test(item.src || ''));
  const audioUrl = derivative?.src || info.url.split('?')[0];

  const lat = parseCoord(ext.GPSLatitude?.value);
  const lon = parseCoord(ext.GPSLongitude?.value);
  const exact = lat != null && lon != null && Math.abs(lat) <= 90;

  const city = entry.city || cityFromCategories(categories);

  const precision = exact ? 'exact' : city ? 'city' : 'unknown';
  let place = null;
  if (exact) {
    place = { name: city?.[0] || description.slice(0, 60) || title, country: city?.[1] || '', lat, lon, precision };
  } else if (city) {
    place = { name: city[0], country: city[1], lat: city[2], lon: city[3], precision };
  }

  const author = stripHtml(ext.Artist?.value).slice(0, 120) || 'Unknown author';

  return {
    id: makeId(entry.fileTitle),
    source: 'commons',
    title: title.slice(0, 140),
    description,
    audioUrl,
    pageUrl: info.descriptionurl,
    mime,
    bytes: info.size,
    durationSec: duration,
    licence: {
      code: licence,
      url: LICENCE_URL[licence] || 'https://commons.wikimedia.org/wiki/Commons:Licensing',
      attributionRequired: licence !== 'cc0' && licence !== 'public domain',
      shareAlike: licence.includes('sa'),
    },
    author,
    credit: stripHtml(ext.Credit?.value).slice(0, 200),
    categories: categories.slice(0, 8),
    keywords: haystack,
    soundCategory: classify(haystack),
    place,
    recordedAt: null,
    licenseVerified: true,
  };
}

async function main() {
  const queue = [];
  for (const [city] of CITIES) queue.push({ category: `Category:Audio files of ${city}`, city: CITIES.find((c) => c[0] === city) });
  for (const category of THEME_CATEGORIES) queue.push({ category, city: null });

  const seen = new Set();
  const entries = [];
  for (const [index, job] of queue.entries()) {
    let titles = [];
    try {
      titles = await listCategory(job.category);
    } catch (err) {
      console.warn(`! ${job.category}: ${err.message}`);
      continue;
    }
    const wanted = titles.filter((title) => !seen.has(title));
    if (!wanted.length) continue;
    wanted.forEach((title) => seen.add(title));

    let facts;
    try {
      facts = await fileFacts(wanted);
    } catch (err) {
      console.warn(`! files of ${job.category}: ${err.message}`);
      continue;
    }
    for (const fileTitle of wanted) {
      const found = facts.get(fileTitle);
      if (!found) continue;
      const entry = extract({ fileTitle, category: job.category, city: job.city }, found);
      // A record with no place evidence can never be drawn on the map, so it is dropped.
      if (entry && entry.place) entries.push(entry);
    }
    process.stdout.write(`\r[${index + 1}/${queue.length}] ${job.category} 閳?${entries.length} kept   `);
  }
  process.stdout.write('\n');

  entries.sort((a, b) => a.id.localeCompare(b.id));
  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'Wikimedia Commons (action=query API)',
    licensePolicy:
      'Only CC0, Public Domain, CC BY and CC BY-SA recordings are included. Each record keeps its author, licence and original file page.',
    count: entries.length,
    entries,
  };
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload, null, 1) + '\n', 'utf8');

  const byCategory = {};
  const byPrecision = {};
  for (const entry of entries) {
    byCategory[entry.soundCategory] = (byCategory[entry.soundCategory] || 0) + 1;
    const precision = entry.place?.precision || 'unknown';
    byPrecision[precision] = (byPrecision[precision] || 0) + 1;
  }
  console.log(`wrote ${entries.length} records 閳?${OUT}`);
  console.log('by sound category:', byCategory);
  console.log('by location precision:', byPrecision);
}

await main();




