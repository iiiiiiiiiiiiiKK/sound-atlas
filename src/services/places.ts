/**
 * Place search for the map box.
 *
 * Photon (komoot) is used because it answers with permissive CORS headers and needs
 * no key. If it is unreachable we fall back to iNaturalist's place index, which covers
 * the same purpose with slightly coarser results.
 */
import { getJson } from '@/services/http';
import { searchPlaces as inatPlaces } from '@/services/sources/inaturalist';

export interface PlaceResult {
  id: string;
  name: string;
  detail: string;
  lat: number;
  lon: number;
  /** Suggested zoom when the user jumps here. */
  zoom: number;
  bbox?: [number, number, number, number];
}

interface PhotonFeature {
  properties?: {
    osm_id?: number;
    name?: string;
    city?: string;
    state?: string;
    country?: string;
    type?: string;
    osm_value?: string;
    extent?: [number, number, number, number];
  };
  geometry?: { coordinates?: [number, number] };
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  try {
    const url = `https://photon.komoot.io/api/?${new URLSearchParams({ q: trimmed, limit: '8', lang: 'en' })}`;
    const data = await getJson<{ features?: PhotonFeature[] }>(url, { signal, timeoutMs: 9000 });
    const results: PlaceResult[] = [];
    for (const feature of data.features || []) {
      const coords = feature.geometry?.coordinates;
      if (!coords) continue;
      const props = feature.properties || {};
      const name = props.name || props.city || props.country || trimmed;
      const detailParts = [props.state, props.country].filter(Boolean);
      const extent = props.extent;
      results.push({
        id: `photon-${props.osm_id ?? `${coords[0]}-${coords[1]}`}`,
        name,
        detail: detailParts.join(', '),
        lat: coords[1],
        lon: coords[0],
        zoom: extent ? 9 : 11,
        bbox: extent ? [extent[0], extent[1], extent[2], extent[3]] : undefined,
      });
    }
    if (results.length) return results;
  } catch {
    // fall through to the secondary provider
  }

  try {
    const fallback = await inatPlaces(trimmed, signal);
    return fallback.map((place) => ({
      id: `inat-place-${place.name}-${place.lat}`,
      name: place.name,
      detail: place.display,
      lat: place.lat,
      lon: place.lon,
      zoom: 10,
    }));
  } catch {
    return [];
  }
}
