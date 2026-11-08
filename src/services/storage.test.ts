import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearHistory,
  db,
  deleteMap,
  exportBundle,
  importBundle,
  listHistory,
  listMaps,
  listSaved,
  putMap,
  pushHistory,
  removeSaved,
  saveSound,
  wipeAll,
} from '@/services/storage';
import type { Sound } from '@/types';

function makeSound(id: string): Sound {
  return {
    id,
    source: 'commons',
    title: `Sound ${id}`,
    description: '',
    audioUrl: 'https://example.test/a.mp3',
    pageUrl: 'https://example.test/page',
    mime: 'audio/mpeg',
    durationSec: 12,
    licence: { code: 'CC0', url: '', attributionRequired: false, shareAlike: false },
    author: 'tester',
    soundCategory: 'rain',
    place: { name: 'X', country: 'Y', lat: 1, lon: 2, precision: 'exact' },
    recordedAt: null,
    canAnalyse: true,
    attribution: 'x',
  };
}

describe('local storage', () => {
  beforeEach(async () => {
    await db.open();
    await wipeAll();
  });

  it('saves and lists sounds, newest first', async () => {
    await saveSound(makeSound('a'));
    await new Promise((resolve) => setTimeout(resolve, 2));
    await saveSound(makeSound('b'));
    const saved = await listSaved();
    expect(saved.map((row) => row.id)).toEqual(['b', 'a']);
  });

  it('removes a saved sound', async () => {
    await saveSound(makeSound('a'));
    await removeSaved('a');
    expect(await listSaved()).toEqual([]);
  });

  it('keeps only the most recent history entries', async () => {
    for (let index = 0; index < 70; index += 1) {
      await pushHistory(makeSound(`h${index}`));
    }
    const history = await listHistory();
    expect(history.length).toBeLessThanOrEqual(60);
  });

  it('clears history without touching saved sounds', async () => {
    await saveSound(makeSound('keep'));
    await pushHistory(makeSound('drop'));
    await clearHistory();
    expect(await listHistory()).toEqual([]);
    expect((await listSaved()).length).toBe(1);
  });

  it('creates and deletes maps', async () => {
    const now = new Date().toISOString();
    await putMap({
      id: 'map1',
      title: 'Route',
      description: '',
      coverSoundId: null,
      visibility: 'local',
      itemIds: ['a'],
      createdAt: now,
      updatedAt: now,
    });
    expect((await listMaps()).length).toBe(1);
    await deleteMap('map1');
    expect(await listMaps()).toEqual([]);
  });

  it('exports a bundle that can be re-imported', async () => {
    await saveSound(makeSound('a'));
    const bundle = await exportBundle();
    expect(bundle.format).toBe('sound-atlas');
    expect(bundle.saved.length).toBe(1);

    await wipeAll();
    const result = await importBundle(bundle);
    expect(result.added).toBe(1);
    expect((await listSaved()).length).toBe(1);
  });

  it('never overwrites an existing row on import', async () => {
    await saveSound(makeSound('a'));
    const bundle = await exportBundle();
    const result = await importBundle(bundle);
    expect(result.added).toBe(0);
    expect(result.skipped).toBeGreaterThan(0);
    expect((await listSaved()).length).toBe(1);
  });

  it('rejects a malformed import instead of silently accepting it', async () => {
    await expect(importBundle({ nope: true })).rejects.toThrow('invalid-bundle');
    await expect(importBundle(null)).rejects.toThrow('invalid-bundle');
  });
});
