/**
 * Breed display labels.
 *
 * Kept separate from payload.ts because that module reaches for node:fs to
 * manage its build-time cache — importing it from browser code, or from a
 * plain `tsx` script, drags Node globals and import.meta.env in with it. This
 * file is safe on both sides. payload.ts re-exports everything here, so
 * existing imports keep working.
 */

/** Trait labels for breed ratings */
export const TRAIT_LABELS: Record<string, string> = {
  'affectionLevel': 'Affection Level',
  'childFriendly': 'Child Friendly',
  'petFriendly': 'Pet Friendly',
  'strangerFriendly': 'Stranger Friendly',
  'trainability': 'Trainability',
  'energyLevel': 'Energy Level',
  'groomingNeeds': 'Grooming Needs',
  'sheddingLevel': 'Shedding Level',
  'barkingLevel': 'Barking Level',
  'intelligence': 'Intelligence',
  'playfulness': 'Playfulness',
  'watchdogAbility': 'Watchdog Ability',
  'adaptability': 'Adaptability',
  'healthRobustness': 'Health Robustness',
};

/** Breed group labels */
export const BREED_GROUP_LABELS: Record<string, string> = {
  'sporting': 'Sporting',
  'working': 'Working',
  'herding': 'Herding',
  'toy': 'Toy',
  'terrier': 'Terrier',
  'hound': 'Hound',
  'non-sporting': 'Non-Sporting',
  'foundation-stock': 'Foundation Stock',
  'natural': 'Natural',
  'hybrid': 'Hybrid',
  'mutation': 'Mutation',
  'crossbreed': 'Crossbreed',
};
