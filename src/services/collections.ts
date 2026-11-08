/**
 * Themed collections.
 *
 * Each collection is a live query against the providers — never a hand-written list of
 * ids, so a collection can never claim sounds that do not exist. If a query returns
 * fewer sounds than hoped, the UI shows the real number.
 */
import { searchSounds } from '@/services/soundService';
import type { Collection, Sound, SoundCategory, SoundQuery } from '@/types';

export const COLLECTIONS: Collection[] = [
  {
    id: 'rain',
    titleKey: 'collection.rain.title',
    descriptionKey: 'collection.rain.body',
    query: { categories: ['rain', 'weather'] },
  },
  {
    id: 'forest',
    titleKey: 'collection.forest.title',
    descriptionKey: 'collection.forest.body',
    query: { categories: ['nature', 'animal'] },
  },
  {
    id: 'water',
    titleKey: 'collection.water.title',
    descriptionKey: 'collection.water.body',
    query: { categories: ['water'] },
  },
  {
    id: 'cities',
    titleKey: 'collection.cities.title',
    descriptionKey: 'collection.cities.body',
    query: { categories: ['city', 'human'] },
  },
  {
    id: 'traffic',
    titleKey: 'collection.traffic.title',
    descriptionKey: 'collection.traffic.body',
    query: { categories: ['traffic', 'transport'] },
  },
  {
    id: 'quiet',
    titleKey: 'collection.quiet.title',
    descriptionKey: 'collection.quiet.body',
    query: { categories: ['nature', 'architecture'] },
  },
];

export function collectionById(id: string): Collection | null {
  return COLLECTIONS.find((collection) => collection.id === id) ?? null;
}

export interface ResolvedCollection {
  collection: Collection;
  sounds: Sound[];
  partial: boolean;
  errors: string[];
}

export async function resolveCollection(collection: Collection, limit = 24): Promise<ResolvedCollection> {
  const query: SoundQuery = { ...collection.query, limit };
  const result = await searchSounds({ ...query, limit });
  return { collection, sounds: result.items, partial: result.partial, errors: result.errors };
}

export async function resolveAllCollections(limit = 12): Promise<ResolvedCollection[]> {
  return Promise.all(COLLECTIONS.map((collection) => resolveCollection(collection, limit)));
}

/** Categories used by the filter rail, in display order. */
export const FILTER_CATEGORIES: SoundCategory[] = [
  'nature',
  'rain',
  'weather',
  'water',
  'animal',
  'human',
  'traffic',
  'transport',
  'architecture',
  'city',
];
