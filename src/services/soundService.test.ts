import { beforeEach, describe, expect, it } from 'vitest';
import { searchSounds } from '@/services/soundService';
import { inBoundingBox, loadCatalog } from '@/services/sources/commons';
import type { Sound } from '@/types';

/** A sound fixture with only the fields the merge/filter logic reads. */
function makeSound(overrides: Partial<Sound> & { id: string }): Sound {
  return {
    source: 'commons',
    title: `sound ${overrides.id}`,
    description: '',
    audioUrl: 'https://example.test/a.mp3',
    pageUrl: 'https://example.test/page',
    mime: 'audio/mpeg',
    durationSec: 30,
    licence: { code: 'CC0', url: 'https://example.test/l', attributionRequired: false, shareAlike: false },
    author: 'tester',
    soundCategory: 'nature',
    place: { name: 'Test', country: 'Testland', lat: 10, lon: 20, precision: 'exact' },
    recordedAt: null,
    canAnalyse: true,
    attribution: 'test',
    ...overrides,
  };
}

describe('inBoundingBox', () => {
  const sounds = [
    makeSound({ id: 'a', place: { name: 'A', country: '', lat: 10, lon: 20, precision: 'exact' } }),
    makeSound({ id: 'b', place: { name: 'B', country: '', lat: -40, lon: 170, precision: 'exact' } }),
    makeSound({ id: 'c', place: null }),
  ];

  it('keeps only sounds inside the box', () => {
    const inside = inBoundingBox(sounds, [0, 0, 30, 30]);
    expect(inside.map((sound) => sound.id)).toEqual(['a']);
  });

  it('handles a box that crosses the antimeridian', () => {
    const inside = inBoundingBox(sounds, [160, -60, -170, 0]);
    expect(inside.map((sound) => sound.id)).toEqual(['b']);
  });

  it('drops sounds with no place', () => {
    expect(inBoundingBox(sounds, [-180, -90, 180, 90]).map((sound) => sound.id)).toEqual(['a', 'b']);
  });
});

describe('loadCatalog', () => {
  it('loads the bundled catalogue and keeps only located records', async () => {
    const { entries, meta } = await loadCatalog();
    expect(meta.count).toBe(entries.length);
    expect(entries.length).toBeGreaterThan(0);
    for (const sound of entries) {
      expect(sound.place).not.toBeNull();
      expect(sound.place!.lat).toBeGreaterThanOrEqual(-90);
      expect(sound.place!.lat).toBeLessThanOrEqual(90);
      expect(sound.place!.lon).toBeGreaterThanOrEqual(-180);
      expect(sound.place!.lon).toBeLessThanOrEqual(180);
    }
  });

  it('only contains licence codes the project is allowed to embed', async () => {
    const { entries } = await loadCatalog();
    const allowed = /^(cc0|public domain|cc by(-sa)? \d\.\d)$/i;
    for (const sound of entries) {
      expect(sound.licence.code).toMatch(allowed);
      expect(sound.audioUrl.startsWith('https://')).toBe(true);
      expect(sound.pageUrl.startsWith('https://commons.wikimedia.org/')).toBe(true);
    }
  });
});

describe('searchSounds', () => {
  beforeEach(async () => {
    await loadCatalog();
  });

  it('filters by category', async () => {
    const result = await searchSounds({ categories: ['rain'], sources: ['commons'], limit: 40 });
    for (const sound of result.items) {
      expect(sound.soundCategory).toBe('rain');
    }
  });

  it('filters by minimum duration', async () => {
    const result = await searchSounds({ minDuration: 30, sources: ['commons'], limit: 40 });
    for (const sound of result.items) {
      expect(sound.durationSec ?? 0).toBeGreaterThanOrEqual(30);
    }
  });

  it('filters to precise coordinates only', async () => {
    const result = await searchSounds({ onlyPrecise: true, sources: ['commons'], limit: 40 });
    for (const sound of result.items) {
      expect(sound.place?.precision).toBe('exact');
    }
  });

  it('never returns a sound without a place', async () => {
    const result = await searchSounds({ sources: ['commons'], limit: 200 });
    expect(result.items.length).toBeGreaterThan(0);
    for (const sound of result.items) {
      expect(sound.place).toBeTruthy();
    }
  });

  it('de-duplicates by id', async () => {
    const result = await searchSounds({ sources: ['commons'], limit: 200 });
    const ids = result.items.map((sound) => sound.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('respects the limit', async () => {
    const result = await searchSounds({ sources: ['commons'], limit: 5 });
    expect(result.items.length).toBeLessThanOrEqual(5);
  });

  it('reports a partial result instead of throwing when a provider is excluded', async () => {
    const result = await searchSounds({ sources: ['commons'], limit: 10 });
    expect(result.partial).toBe(false);
    expect(result.errors).toEqual([]);
  });
});
