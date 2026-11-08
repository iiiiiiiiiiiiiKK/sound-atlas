/**
 * iNaturalist adapter —wildlife sound observations.
 *
 * Only openly licensed, research-grade observations that carry coordinates and a
 * playable sound file are surfaced. iNaturalist audio is served from
 * static.inaturalist.org, which does not send CORS headers, so `canAnalyse` is false
 * and the UI falls back to a static waveform.
 */
import { getJson } from '@/services/http';
import type { Sound, SoundQueryResult } from '@/types';

const API = 'https://api.inaturalist.org/v1';

interface InatSound {
  id: number;
  license_code: string | null;
  attribution: string | null;
  file_url: string;
  file_content_type: string;
}

interface InatObservation {
  id: number;
  uuid: string;
  license_code?: string | null;
  quality_grade?: string;
  observed_on?: string | null;
  place_guess?: string | null;
  geojson?: { coordinates?: [number, number] } | null;
  location?: string | null;
  user?: { login?: string; name?: string } | null;
  taxon?: {
    id?: number;
    name?: string | null;
    preferred_common_name?: string | null;
    iconic_taxon_name?: string | null;
  } | null;
  sounds?: InatSound[];
}

interface InatResponse {
  total_results?: number;
  results?: InatObservation[];
}

const ALLOWED_SOUND_LICENCES = new Set(['cc0', 'cc-by', 'cc-by-sa']);
const LICENCE_URL: Record<string, string> = {
  cc0: 'https://creativecommons.org/publicdomain/zero/1.0/',
  'cc-by': 'https://creativecommons.org/licenses/by/4.0/',
  'cc-by-nc': 'https://creativecommons.org/licenses/by-nc/4.0/',
  'cc-by-sa': 'https://creativecommons.org/licenses/by-sa/4.0/',
};

function groupFor(iconic: string | undefined): Sound['soundCategory'] {
  switch (iconic) {
    case 'Aves':
      return 'animal';
    case 'Amphibia':
    case 'Insecta':
    case 'Mammalia':
    case 'Reptilia':
      return 'animal';
    default:
      return 'animal';
  }
}

function toSound(observation: InatObservation): Sound | null {
  const sound = observation.sounds?.[0];
  if (!sound?.file_url) return null;
  const licenceCode = (sound.license_code || observation.license_code || '').toLowerCase();
  if (licenceCode && !ALLOWED_SOUND_LICENCES.has(licenceCode)) return null;

  const coords = observation.geojson?.coordinates;
  const lat = coords?.[1];
  const lon = coords?.[0];
  const hasPoint = typeof lat === 'number' && typeof lon === 'number';
  const placeLabel = observation.place_guess ?? observation.taxon?.preferred_common_name ?? 'iNaturalist observation';
  const species = observation.taxon?.preferred_common_name || observation.taxon?.name || 'Wildlife';
  const observer = observation.user?.name || observation.user?.login || 'an iNaturalist observer';
  const licence = licenceCode || 'cc-by';

  return {
    id: `inat-${observation.id}`,
    source: 'inaturalist',
    title: `${species} —${placeLabel}`.slice(0, 140),
    description: observation.taxon?.name
      ? `Field recording of ${observation.taxon.name}${
          observation.observed_on ? `, observed on ${observation.observed_on}` : ''
        }.`
      : '',
    audioUrl: sound.file_url,
    pageUrl: `https://www.inaturalist.org/observations/${observation.id}`,
    mime: sound.file_content_type || 'audio/mpeg',
    durationSec: null,
    licence: {
      code: licence.toUpperCase(),
      url: LICENCE_URL[licence] || 'https://www.inaturalist.org/pages/terms',
      attributionRequired: licence !== 'cc0',
      shareAlike: licence.includes('sa'),
    },
    author: observer,
    soundCategory: groupFor(observation.taxon?.iconic_taxon_name ?? undefined),
    place: hasPoint
      ? { name: placeLabel, country: '', lat: lat as number, lon: lon as number, precision: 'exact' }
      : null,
    recordedAt: observation.observed_on ?? null,
    canAnalyse: false,
    attribution: sound.attribution || `© ${observer} · iNaturalist · ${licence.toUpperCase()}`,
  };
}

export interface InatQuery {
  bbox?: [number, number, number, number];
  taxonId?: number;
  limit?: number;
  random?: boolean;
  signal?: AbortSignal;
}

export async function search(observation: InatQuery = {}): Promise<SoundQueryResult> {
  const { bbox, taxonId, limit = 50, random = false, signal } = observation;
  const params = new URLSearchParams({
    sounds: 'true',
    licensed: 'true',
    quality_grade: 'research',
    per_page: String(Math.min(200, limit)),
    order_by: random ? 'random' : 'created_at',
    order: 'desc',
  });
  if (taxonId) params.set('taxon_id', String(taxonId));
  if (bbox) {
    const [west, south, east, north] = bbox;
    params.set('swlat', String(south));
    params.set('swlng', String(west));
    params.set('nelat', String(north));
    params.set('nelng', String(east));
  }

  try {
    const data = await getJson<InatResponse>(`${API}/observations?${params.toString()}`, {
      signal,
      timeoutMs: 15000,
    });
    const items = (data.results || [])
      .map(toSound)
      .filter((sound): sound is Sound => Boolean(sound));
    return { items, total: data.total_results ?? items.length, partial: false, errors: [] };
  } catch (error) {
    return {
      items: [],
      total: null,
      partial: true,
      errors: [error instanceof Error ? error.message : 'iNaturalist request failed'],
    };
  }
}

/** Fetch one observation directly, so a shared deep link still resolves. */
export async function byObservationId(observationId: string): Promise<Sound | null> {
  try {
    const data = await getJson<InatResponse>(`${API}/observations/${encodeURIComponent(observationId)}`, {
      timeoutMs: 12000,
    });
    const observation = data.results?.[0];
    return observation ? toSound(observation) : null;
  } catch {
    return null;
  }
}

/** Place autocomplete for the map search box. */export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<{ name: string; display: string; lat: number; lon: number }[]> {
  if (query.trim().length < 2) return [];
  const url = `${API}/places/autocomplete?${new URLSearchParams({ q: query.trim(), per_page: '8' })}`;
  const data = await getJson<{
    results?: { name: string; display_name?: string; location?: string; bounding_box?: string }[];
  }>(url, { signal, timeoutMs: 8000 });
  const places: { name: string; display: string; lat: number; lon: number }[] = [];
  for (const result of data.results || []) {
    const match = /^(-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)$/.exec(result.bounding_box || '');
    if (match) {
      const south = Number(match[1]);
      const north = Number(match[2]);
      const west = Number(match[3]);
      const east = Number(match[4]);
      places.push({
        name: result.name,
        display: result.display_name || result.name,
        lat: (south + north) / 2,
        lon: (west + east) / 2,
      });
      continue;
    }
    if (result.location) {
      const [lat, lon] = result.location.split(',').map(Number);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        places.push({ name: result.name, display: result.display_name || result.name, lat, lon });
      }
    }
  }
  return places;
}

