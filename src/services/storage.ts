/**
 * Local persistence (IndexedDB via Dexie).
 *
 * Nothing here ever leaves the browser: saved sounds, sound maps, journeys,
 * recordings and history are all device-local. Blobs for user recordings are stored
 * in their own table so listing metadata stays cheap.
 */
import Dexie, { type Table } from 'dexie';
import type {
  HistoryEntry,
  LocalClip,
  LocalJourney,
  LocalSoundMap,
  Sound,
  SoundSnapshot,
} from '@/types';

export interface ClipRow extends Omit<LocalClip, 'blob'> {
  blob: Blob;
}

export class SoundAtlasDatabase extends Dexie {
  saved!: Table<SoundSnapshot, string>;
  maps!: Table<LocalSoundMap, string>;
  journeys!: Table<LocalJourney, string>;
  clips!: Table<ClipRow, string>;
  history!: Table<HistoryEntry, string>;

  constructor() {
    super('sound-atlas');
    this.version(1).stores({
      saved: 'id, savedAt',
      maps: 'id, updatedAt',
      journeys: 'id, updatedAt',
      clips: 'id, createdAt',
      history: 'id, playedAt',
    });
  }
}

export const db = new SoundAtlasDatabase();

export async function isStorageAvailable(): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return false;
  try {
    await db.open();
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ saved */

export async function listSaved(): Promise<SoundSnapshot[]> {
  const rows = await db.saved.toArray();
  return rows.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function saveSound(sound: Sound): Promise<void> {
  await db.saved.put({ id: sound.id, sound, savedAt: new Date().toISOString() });
}

export async function removeSaved(id: string): Promise<void> {
  await db.saved.delete(id);
}

/* ------------------------------------------------------------------- maps */

export async function listMaps(): Promise<LocalSoundMap[]> {
  const rows = await db.maps.toArray();
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function putMap(map: LocalSoundMap): Promise<void> {
  await db.maps.put(map);
}

export async function deleteMap(id: string): Promise<void> {
  await db.maps.delete(id);
}

/* --------------------------------------------------------------- journeys */

export async function listJourneys(): Promise<LocalJourney[]> {
  const rows = await db.journeys.toArray();
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function putJourney(journey: LocalJourney): Promise<void> {
  await db.journeys.put(journey);
}

export async function deleteJourney(id: string): Promise<void> {
  await db.journeys.delete(id);
}

/* ------------------------------------------------------------------ clips */

export async function listClips(): Promise<ClipRow[]> {
  const rows = await db.clips.toArray();
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function putClip(clip: ClipRow): Promise<void> {
  await db.clips.put(clip);
}

export async function deleteClip(id: string): Promise<void> {
  await db.clips.delete(id);
}

/* ---------------------------------------------------------------- history */

const HISTORY_LIMIT = 60;

export async function listHistory(): Promise<HistoryEntry[]> {
  const rows = await db.history.toArray();
  return rows.sort((a, b) => b.playedAt.localeCompare(a.playedAt));
}

export async function pushHistory(sound: Sound): Promise<void> {
  await db.history.put({ id: sound.id, sound, playedAt: new Date().toISOString() });
  const rows = await listHistory();
  const stale = rows.slice(HISTORY_LIMIT);
  if (stale.length) await db.history.bulkDelete(stale.map((row) => row.id));
}

export async function clearHistory(): Promise<void> {
  await db.history.clear();
}

/* ------------------------------------------------------- export / import */

export interface ExportBundle {
  format: 'sound-atlas';
  version: 1;
  exportedAt: string;
  saved: SoundSnapshot[];
  maps: LocalSoundMap[];
  journeys: LocalJourney[];
  /** Blobs cannot be serialised into JSON, so recordings export as metadata only. */
  clips: Omit<ClipRow, 'blob'>[];
}

export async function exportBundle(): Promise<ExportBundle> {
  const [saved, maps, journeys, clips] = await Promise.all([
    listSaved(),
    listMaps(),
    listJourneys(),
    listClips(),
  ]);
  return {
    format: 'sound-atlas',
    version: 1,
    exportedAt: new Date().toISOString(),
    saved,
    maps,
    journeys,
    clips: clips.map(({ blob: _blob, ...meta }) => meta),
  };
}

export interface ImportResult {
  added: number;
  skipped: number;
}

function looksLikeBundle(value: unknown): value is ExportBundle {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ExportBundle>;
  return candidate.format === 'sound-atlas' && candidate.version === 1;
}

/**
 * Merge an exported bundle. Existing rows with the same id are kept (never
 * overwritten), and malformed rows are counted as skipped rather than trusted.
 */
export async function importBundle(raw: unknown): Promise<ImportResult> {
  if (!looksLikeBundle(raw)) throw new Error('invalid-bundle');
  let added = 0;
  let skipped = 0;

  const existingSaved = new Set((await db.saved.toArray()).map((row) => row.id));
  for (const row of raw.saved ?? []) {
    if (!row?.id || !row.sound || existingSaved.has(row.id)) {
      skipped += 1;
      continue;
    }
    await db.saved.put(row);
    existingSaved.add(row.id);
    added += 1;
  }

  const existingMaps = new Set((await db.maps.toArray()).map((row) => row.id));
  for (const row of raw.maps ?? []) {
    if (!row?.id || existingMaps.has(row.id)) {
      skipped += 1;
      continue;
    }
    await db.maps.put(row);
    added += 1;
  }

  const existingJourneys = new Set((await db.journeys.toArray()).map((row) => row.id));
  for (const row of raw.journeys ?? []) {
    if (!row?.id || existingJourneys.has(row.id)) {
      skipped += 1;
      continue;
    }
    await db.journeys.put(row);
    added += 1;
  }

  const existingClips = new Set((await db.clips.toArray()).map((row) => row.id));
  for (const row of raw.clips ?? []) {
    // Audio bytes are not part of a metadata export, so a clip without its blob is skipped.
    if (!row?.id || existingClips.has(row.id)) {
      skipped += 1;
      continue;
    }
    skipped += 1;
  }

  return { added, skipped };
}

/** Wipes every local table — used by the "delete all data" control. */
export async function wipeAll(): Promise<void> {
  await Promise.all([
    db.saved.clear(),
    db.maps.clear(),
    db.journeys.clear(),
    db.clips.clear(),
    db.history.clear(),
  ]);
}
