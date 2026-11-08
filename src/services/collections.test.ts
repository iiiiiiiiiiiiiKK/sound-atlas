import { describe, expect, it } from 'vitest';
import { COLLECTIONS, collectionById, resolveCollection } from '@/services/collections';
import { loadCatalog } from '@/services/sources/commons';

describe('collections', () => {
  it('defines a stable set of collections', () => {
    expect(COLLECTIONS.length).toBeGreaterThanOrEqual(4);
    const ids = COLLECTIONS.map((collection) => collection.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resolves collections from real catalogue data', async () => {
    await loadCatalog();
    const rain = collectionById('rain');
    expect(rain).not.toBeNull();
    const resolved = await resolveCollection(rain!, 20);
    // Every returned sound must exist and match the query's categories.
    for (const sound of resolved.sounds) {
      expect(sound.place).toBeTruthy();
      expect(['rain', 'weather']).toContain(sound.soundCategory);
    }
  });

  it('returns an empty result (not a fake one) for an unknown collection', () => {
    expect(collectionById('does-not-exist')).toBeNull();
  });
});
