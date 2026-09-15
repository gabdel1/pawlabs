/**
 * "Similar Breeds" — the five breed-to-breed links on every profile page.
 *
 * These were previously `allBreeds.slice(0, 5)` against a name-sorted list,
 * which meant every one of the 201 profiles linked to the same five breeds:
 * Affenpinscher, Afghan Hound, Airedale Terrier, Akita, Alaskan Malamute. As
 * navigation that is useless, and as internal linking it is worse than useless
 * — it concentrated the entire site's breed-to-breed link equity on five
 * alphabetical accidents.
 *
 * Similarity here means what a reader means by it: same sort of dog, same sort
 * of size, behaves about the same day to day. Trait distance does most of the
 * work; group and size act as correctors, because a Border Collie and a Papillon
 * can score alike across fourteen traits and still be nothing alike to live with.
 */

import type { Breed } from './payload';

/** Size bands, ordered, so "one band apart" is measurable. */
const SIZE_ORDER: Record<string, number> = {
  small: 0,
  medium: 1,
  large: 2,
  giant: 3,
};

/**
 * Traits that describe how a dog behaves, weighted by how much a difference in
 * them changes daily life. Energy and grooming are what make two breeds feel
 * different to own; watchdog ability barely registers.
 */
const TRAIT_WEIGHTS: Record<string, number> = {
  energyLevel: 1.4,
  groomingNeeds: 1.2,
  sheddingLevel: 1.2,
  trainability: 1.1,
  barkingLevel: 1.0,
  childFriendly: 1.0,
  petFriendly: 0.9,
  affectionLevel: 0.9,
  adaptability: 0.9,
  playfulness: 0.8,
  intelligence: 0.8,
  strangerFriendly: 0.7,
  watchdogAbility: 0.6,
  healthRobustness: 0.5,
};

/** Penalty weights for the categorical correctors. */
const DIFFERENT_GROUP_PENALTY = 2.2;
const SIZE_BAND_PENALTY = 1.3;

function traitDistance(a: Breed, b: Breed): number | null {
  const ta = (a.traits ?? {}) as Record<string, number | undefined>;
  const tb = (b.traits ?? {}) as Record<string, number | undefined>;

  let total = 0;
  let weight = 0;

  for (const [key, w] of Object.entries(TRAIT_WEIGHTS)) {
    const va = ta[key];
    const vb = tb[key];
    if (typeof va !== 'number' || typeof vb !== 'number') continue;
    total += Math.abs(va - vb) * w;
    weight += w;
  }

  // Too little overlap to claim anything about similarity.
  if (weight < 4) return null;
  return total / weight;
}

/** Lower is more similar. */
function dissimilarity(breed: Breed, other: Breed): number | null {
  const distance = traitDistance(breed, other);
  if (distance === null) return null;

  let score = distance;

  if (breed.breedGroup && other.breedGroup && breed.breedGroup !== other.breedGroup) {
    score += DIFFERENT_GROUP_PENALTY;
  }

  const a = breed.size ? SIZE_ORDER[breed.size] : undefined;
  const b = other.size ? SIZE_ORDER[other.size] : undefined;
  if (a !== undefined && b !== undefined) {
    score += Math.abs(a - b) * SIZE_BAND_PENALTY;
  }

  return score;
}

/**
 * The breeds most like this one, closest first.
 *
 * `pool` should already be the full breed list; this filters out the subject
 * and anything of a different species itself, so callers cannot forget to.
 */
export function findSimilarBreeds(breed: Breed, pool: Breed[], count = 5): Breed[] {
  return pool
    .filter((other) => other.slug !== breed.slug && other.petType === breed.petType)
    .map((other) => ({ breed: other, score: dissimilarity(breed, other) }))
    .filter((entry): entry is { breed: Breed; score: number } => entry.score !== null)
    .sort((a, b) => a.score - b.score || a.breed.name.localeCompare(b.breed.name))
    .slice(0, count)
    .map((entry) => entry.breed);
}
