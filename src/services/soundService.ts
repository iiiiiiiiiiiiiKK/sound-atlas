/**
 * The one place the app asks for sounds.
 *
 * Providers are independent: a failure in one never empties the other. Results are
 * de-duplicated by id, filtered by the active query, and sorted so that recordings
 * with precise coordinates come first.
 */
import * as commons from '@/services/sources/commons';
import * as inat from '@/services/sources/inaturalist';
import type { Sound, SoundQuery, SoundQueryResult } from '@/types';

export interface MergedQuery extends SoundQuery {
  sources?: ('commons' | 'inaturalist')[];
  minDuration?: number;
  onlyPrecise?: boolean;
  signal?: AbortSignal;
  /**
   * Called once with the bundled results as soon as they are ready, before the live
   * provider answers. Lets the map paint immediately instead of waiting on the network.
   */
  onPartial?: (result: SoundQueryResult) => void;
}

function matches(sound: Sound, query: MergedQuery): boolean {
  if (query.categories?.length && !query.categories.includes(sound.soundCategory)) return false;
  if (query.minDuration && (sound.durationSec ?? 0) < query.minDuration) return false;
  if (query.onlyPrecise && sound.place?.precision !== 'exact') return false;
  if (query.placeName) {
    const needle = query.placeName.toLowerCase();
    const haystack = `${sound.title} ${sound.description} ${sound.place?.name ?? ''} ${sound.place?.country ?? ''}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

/** De-duplicate, filter, sort and page a set of collected sounds. */
function finalise(
  collected: Sound[],
  query: MergedQuery,
  limit: number,
  total: number | null,
): SoundQueryResult {
  const seen = new Set<string>();
  const unique: Sound[] = [];
  for (const sound of collected) {
    if (seen.has(sound.id)) continue;
    if (!sound.place) continue;
    seen.add(sound.id);
    unique.push(sound);
  }

  const sorted = unique.filter((sound) => matches(sound, query)).sort((a, b) => {
    const precisionRank = (sound: Sound) => (sound.place?.precision === 'exact' ? 0 : 1);
    const delta = precisionRank(a) - precisionRank(b);
    if (delta !== 0) return delta;
    return (a.title || '').localeCompare(b.title || '');
  });

  return {
    items: sorted.slice(0, limit),
    total: total == null ? null : Math.max(sorted.length, Math.min(total, Math.max(sorted.length, limit))),
    partial: false,
    errors: [],
  };
}

export async function searchSounds(query: MergedQuery = {}): Promise<SoundQueryResult> {
  const sources = query.sources ?? ['commons', 'inaturalist'];
  const wants = new Set(sources);
  const limit = query.limit ?? 120;
  const errors: string[] = [];
  let partial = false;
  let total: number | null = 0;
  const collected: Sound[] = [];

  // ---- curated Commons catalogue (always available, bundled with the build)
  if (wants.has('commons')) {
    try {
      const { entries } = await commons.loadCatalog();
      const scoped = query.bbox ? commons.inBoundingBox(entries, query.bbox) : entries;
      collected.push(...scoped);
      total = (total ?? 0) + scoped.length;

      // Paint these immediately: they are local data, and the live provider can be slow.
      if (query.onPartial) {
        const provisional = finalise(collected, query, limit, total);
        if (provisional.items.length) query.onPartial(provisional);
      }
    } catch (error) {
      partial = true;
      total = null;
      errors.push(`Wikimedia Commons catalogue: ${error instanceof Error ? error.message : 'unavailable'}`);
    }
  }

  // ---- live iNaturalist observations for the same window
  if (wants.has('inaturalist')) {
    const result = await inat.search({
      bbox: query.bbox,
      taxonId: query.taxonId,
      // iNaturalist returns a large JSON document per row, so keep the page small.
      limit: Math.min(40, Math.max(20, limit)),
      random: Boolean(query.seed),
      signal: query.signal,
    });
    if (result.partial) {
      partial = true;
      errors.push(...result.errors);
      if (total != null && result.total == null) total = null;
    } else {
      collected.push(...result.items);
      if (total != null) total += result.total ?? result.items.length;
    }
  }

  const provisional = finalise(collected, query, limit, total);
  return {
    items: provisional.items,
    total: provisional.total,
    partial,
    errors,
  };
}

/** One particular sound by id, from whichever provider owns it. */
export async function getSoundById(id: string): Promise<Sound | null> {
  if (id.startsWith('inat-')) {
    const observationId = id.replace('inat-', '');
    const direct = await inat.byObservationId(observationId);
    if (direct) return direct;
  }
  const { entries } = await commons.loadCatalog();
  return entries.find((sound) => sound.id === id) ?? null;
}

export { commons, inat };

