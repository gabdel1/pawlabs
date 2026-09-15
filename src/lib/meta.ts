/**
 * Search-result copy: <title> and <meta name="description"> for breed profiles
 * and comparison articles.
 *
 * Why this exists: the old title pattern ("<Breed> — Breed Profile & Traits")
 * and the old description (the breed's one-line tagline) told a searcher
 * nothing they were scanning the result for. People typing a breed name want
 * temperament, size, lifespan, shedding, and whether it suits their household.
 * We already hold all of that as structured data, so the snippet is generated
 * from it rather than written by hand 201 times.
 *
 * Two hard constraints drive the odd-looking assembly below:
 *
 *   1. Titles must stay under 60 characters or Google truncates them, and breed
 *      names run from "Pug" (3) to "Nova Scotia Duck Tolling Retriever" (34).
 *   2. Descriptions must land in 140-160 characters for every breed, with the
 *      same name-length spread appearing *twice* in most phrasings.
 *
 * Neither can be met by one fixed template. Both functions therefore generate a
 * spread of candidate phrasings and pick the longest one that still fits, so a
 * short name gets the fullest version and a long name degrades gracefully
 * instead of being cut off mid-word by the search engine.
 */

import type { Breed, Comparison } from './payload';
import { BREED_GROUP_LABELS } from './traits';

/** Google truncates around 60; stay strictly under. */
const TITLE_MAX = 59;

/** Description window. Below 140 wastes space, above 160 gets cut. */
const DESC_MIN = 140;
const DESC_MAX = 160;

const BRAND = ' | PawLabs';

// ─── Titles ───────────────────────────────────────────────────────────

/**
 * Facet lists in descending order of usefulness. The first one that fits
 * within TITLE_MAX wins, so short names keep the full list.
 */
const TITLE_FACETS = [
  'Temperament, Size, Shedding & Care',
  'Temperament, Size & Shedding',
  'Temperament, Size & Care',
  'Temperament & Care',
  'Traits & Care',
];

/**
 * "Collie: Temperament, Size, Shedding & Care | PawLabs"
 *
 * Leads with the breed because that is the query, then the facets that match
 * what the searcher is actually after. The H1 stays the bare breed name — this
 * is the SERP headline, not the page headline.
 */
export function breedMetaTitle(breed: Breed): string {
  for (const facets of TITLE_FACETS) {
    const candidate = `${breed.name}: ${facets}${BRAND}`;
    if (candidate.length <= TITLE_MAX) return candidate;
  }
  // Nothing in the table fits. Only reachable if a breed name grows past ~34
  // characters, but a truncated title is worse than a plain one.
  return `${breed.name}${BRAND}`;
}

// ─── Trait rendering ──────────────────────────────────────────────────

/** Compact labels — the full TRAIT_LABELS strings are too long for a snippet. */
const TRAIT_SHORT: Record<string, string> = {
  affectionLevel: 'affection',
  childFriendly: 'kids',
  petFriendly: 'other pets',
  strangerFriendly: 'strangers',
  trainability: 'trainability',
  energyLevel: 'energy',
  groomingNeeds: 'grooming',
  sheddingLevel: 'shedding',
  barkingLevel: 'barking',
  intelligence: 'intelligence',
  playfulness: 'play',
  watchdogAbility: 'watchdog',
  adaptability: 'adaptability',
  healthRobustness: 'health',
};

/**
 * How much a trait pulls its weight in a search snippet. Shedding and
 * child-friendliness are what people actually type; playfulness is not. This
 * only breaks ties between equally distinctive scores — it never promotes an
 * average trait over a defining one.
 */
const TRAIT_PULL: Record<string, number> = {
  childFriendly: 1.6,
  sheddingLevel: 1.5,
  energyLevel: 1.35,
  trainability: 1.3,
  barkingLevel: 1.2,
  groomingNeeds: 1.2,
  petFriendly: 1.1,
  adaptability: 1.05,
  intelligence: 1.0,
  affectionLevel: 1.0,
  healthRobustness: 0.95,
  strangerFriendly: 0.9,
  watchdogAbility: 0.9,
  playfulness: 0.85,
};

/**
 * Traits where a bare number misleads. "shedding (9)" reads as a good score;
 * "shedding (heavy)" reads as what it is. Bands are [1-2, 3-4, 5-6, 7-8, 9-10].
 */
const QUALITATIVE: Record<string, [string, string, string, string, string]> = {
  sheddingLevel: ['minimal', 'light', 'moderate', 'high', 'heavy'],
  groomingNeeds: ['minimal', 'low', 'moderate', 'high', 'intensive'],
};

/**
 * "a Beagle" / "an Afghan Hound".
 *
 * A letter test rather than a phonetic one, which is correct for all 201 breeds
 * currently profiled — none begins with a "yoo" vowel ("a Eurasier") or a silent
 * consonant ("an Hungarian"). Those are the two cases to revisit if the list
 * ever grows one.
 */
function article(name: string): string {
  return /^[AEIOU]/i.test(name) ? 'an' : 'a';
}

function bandOf(score: number, bands: [string, string, string, string, string]): string {
  if (score <= 2) return bands[0];
  if (score <= 4) return bands[1];
  if (score <= 6) return bands[2];
  if (score <= 8) return bands[3];
  return bands[4];
}

interface ScoredTrait {
  key: string;
  value: number;
  rendered: string;
}

/** Scored traits, most defining first. Distance from mid-scale is what defines. */
function definingTraits(breed: Breed): ScoredTrait[] {
  const traits = breed.traits ?? {};
  return Object.entries(traits)
    .filter(([key, v]) => typeof v === 'number' && !Number.isNaN(v) && TRAIT_SHORT[key])
    .map(([key, v]) => {
      const value = Math.max(1, Math.min(10, Math.round(v as number)));
      const words = QUALITATIVE[key];
      return {
        key,
        value,
        rendered: `${TRAIT_SHORT[key]} (${words ? bandOf(value, words) : value})`,
        weight: Math.abs(value - 5.5) * (TRAIT_PULL[key] ?? 1),
      };
    })
    .sort((a, b) => b.weight - a.weight)
    .map(({ key, value, rendered }) => ({ key, value, rendered }));
}

/** Count of scored traits, so "and N more" is never a lie. */
function scoredTraitCount(breed: Breed): number {
  const traits = breed.traits ?? {};
  return Object.entries(traits).filter(
    ([key, v]) => typeof v === 'number' && !Number.isNaN(v) && TRAIT_SHORT[key],
  ).length;
}

// ─── Breed descriptions ───────────────────────────────────────────────

interface Candidate {
  text: string;
  /** Lower is better. Ranks phrasings we would rather ship, before length. */
  rank: number;
}

/**
 * Pick the best candidate that lands inside the description window.
 *
 * Rank beats length. Sorting purely by length looks sensible and is wrong: the
 * phrasings that name the breed a second time ("Is a Collie right for your
 * home?") are longer than the impersonal ones, so on a long breed name they
 * overflow and the generic fallback wins every time. Repeating the breed name
 * is worth more than the handful of characters, so it is ranked ahead and only
 * the tie is broken by length.
 */
function pickBest(candidates: Candidate[]): string {
  const byPreference = (a: Candidate, b: Candidate) =>
    a.rank - b.rank || b.text.length - a.text.length;

  const inRange = candidates
    .filter((c) => c.text.length >= DESC_MIN && c.text.length <= DESC_MAX)
    .sort(byPreference);
  if (inRange.length) return inRange[0].text;

  // Nothing landed in the window. Prefer the longest that is still not
  // truncated over a short one that wastes the slot.
  const under = candidates.filter((c) => c.text.length <= DESC_MAX).sort(byPreference);
  if (under.length) return under[0].text;

  return candidates.reduce((best, c) => (c.text.length < best.text.length ? c : best)).text;
}

/**
 * "Collie temperament, herding group, 50-75 lb, 12-14 yr lifespan. Scored 1-10
 *  on trainability (9), shedding (heavy), kids (8) and 11 more traits. Is a
 *  Collie right for your home?"
 *
 * Facts first because that is what gets scanned, the defining trait scores
 * second, and a question last that mirrors the one the searcher is really
 * asking. No adjectives — every number here is on the page.
 */
export function breedMetaDescription(breed: Breed): string {
  const name = breed.name;
  const traits = definingTraits(breed);
  const total = scoredTraitCount(breed);

  const group = breed.breedGroup
    ? (BREED_GROUP_LABELS[breed.breedGroup] ?? breed.breedGroup).toLowerCase()
    : null;

  const weight =
    breed.weightMin && breed.weightMax ? `${breed.weightMin}-${breed.weightMax} lb` : null;
  const life =
    breed.lifeExpectancyMin && breed.lifeExpectancyMax
      ? `${breed.lifeExpectancyMin}-${breed.lifeExpectancyMax} yr`
      : null;

  // Openers, longest first.
  const openers = [`${name} temperament, `, `${name}: `];

  // Fact clauses, longest first. Group is dropped before the hard numbers are.
  const factSets: string[] = [];
  for (const withGroup of group ? [true, false] : [false]) {
    for (const longLife of [true, false]) {
      const parts = [
        withGroup && group ? `${group} group` : null,
        weight,
        life ? (longLife ? `${life} lifespan` : life) : null,
      ].filter(Boolean);
      if (parts.length) factSets.push(`${parts.join(', ')}. `);
    }
  }
  if (!factSets.length) factSets.push('');

  // Trait clauses, longest first.
  const traitSets: string[] = [];
  for (const k of [3, 2]) {
    const picked = traits.slice(0, k);
    if (picked.length < k) continue;
    const rest = total - picked.length;
    const list = picked.map((t) => t.rendered).join(', ');
    traitSets.push(`Scored 1-10 on ${list}${rest > 0 ? ` and ${rest} more traits` : ''}. `);
    traitSets.push(`Rated on ${list}${rest > 0 ? ` and ${rest} more` : ''}. `);
  }
  if (!traitSets.length) traitSets.push('');

  // Closers, longest first. The long-name cases need the impersonal ones.
  const an = article(name);
  const closers: Candidate[] = [
    { text: `Is ${an} ${name} right for your home?`, rank: 0 },
    { text: `Is ${an} ${name} the right fit for your household?`, rank: 0 },
    { text: `Is the ${name} right for you?`, rank: 1 },
    { text: `Is this breed right for your home?`, rank: 2 },
    { text: `Is this the right breed for you?`, rank: 2 },
  ];

  const candidates: Candidate[] = [];
  for (const o of openers) {
    for (const f of factSets) {
      for (const t of traitSets) {
        for (const c of closers) {
          candidates.push({ text: `${o}${f}${t}${c.text}`, rank: c.rank });
        }
      }
    }
  }

  return pickBest(candidates);
}

// ─── Comparison descriptions ──────────────────────────────────────────

/** Trait keys as they appear in comparisonCriteria, mapped to snippet words. */
const CRITERION_SHORT: Record<string, string> = {
  lowShedding: 'shedding',
  easyGrooming: 'grooming',
  apartmentFriendly: 'apartment life',
  watchdogAbility: 'watchdog instinct',
  energyLevel: 'energy',
  trainability: 'trainability',
  childFriendly: 'kids',
  petFriendly: 'other pets',
  barkingControl: 'barking',
  adaptability: 'adaptability',
  intelligence: 'intelligence',
  healthRobustness: 'health',
  affectionLevel: 'affection',
  strangerFriendly: 'strangers',
  sheddingLevel: 'shedding',
  groomingNeeds: 'grooming',
  playfulness: 'play drive',
};

/**
 * Traits that actually separate the breeds being compared, widest spread first.
 *
 * A comparison's stored criteria are the same five on nearly every article, so
 * they describe the template rather than the matchup. The spread across the
 * real trait scores is what decides which breed someone should pick.
 */
function decidingTraits(breeds: Breed[]): string[] {
  if (breeds.length < 2) return [];
  const spreads: { key: string; spread: number }[] = [];

  for (const key of Object.keys(TRAIT_SHORT)) {
    const values = breeds
      .map((b) => (b.traits as Record<string, number> | undefined)?.[key])
      .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
    if (values.length < 2) continue;
    const spread = Math.max(...values) - Math.min(...values);
    if (spread > 0) {
      spreads.push({ key, spread: spread * (TRAIT_PULL[key] ?? 1) });
    }
  }

  return spreads
    .sort((a, b) => b.spread - a.spread)
    .map((s) => TRAIT_SHORT[s.key])
    .slice(0, 4);
}

/** "A, B and C" / "A and B" — Oxford-comma-free, as the rest of the site reads. */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Roundup articles number their per-breed sections ("1. Golden Retriever"), and
 * that ranking — not the stored relation order, which is alphabetical — is what
 * a reader wants named in the snippet.
 *
 * Reads the article body; never modifies it.
 */
export function rankedBreedNames(comparison: Comparison, breeds: Breed[]): string[] {
  const html = comparison.content ?? '';
  const ranked: { position: number; name: string }[] = [];

  for (const match of html.matchAll(/<h3[^>]*>\s*(\d+)\s*[.)]\s*([^<]+?)\s*<\/h3>/gi)) {
    const position = Number(match[1]);
    const heading = match[2].trim();
    // Only trust a heading that names a breed the article is actually about.
    const breed = breeds.find((b) => b.name.toLowerCase() === heading.toLowerCase());
    if (breed && !ranked.some((r) => r.name === breed.name)) {
      ranked.push({ position, name: breed.name });
    }
  }

  ranked.sort((a, b) => a.position - b.position);
  return ranked.map((r) => r.name);
}

/**
 * Names the breeds and the traits that decide between them, rather than the
 * stored summary — which on most articles is a near-identical abstract.
 *
 * Titles stay as the article H1, so this is the only half that changes.
 */
export function comparisonMetaDescription(comparison: Comparison, breeds: Breed[]): string {
  const ranked = rankedBreedNames(comparison, breeds);
  const order = ranked.length ? ranked : breeds.map((b) => b.name);
  const traits = decidingTraits(breeds);
  const isRoundup = ranked.length >= 4 || breeds.length >= 4;

  const candidates: Candidate[] = [];

  // How many breeds to name, longest first. A head-to-head names both; a
  // roundup names the top few and says how many others there are.
  const nameCounts = isRoundup ? [3, 2] : [breeds.length];

  for (const count of nameCounts) {
    const named = order.slice(0, count);
    if (!named.length) continue;
    const rest = order.length - named.length;

    // "A, B, C and 5 more" — comma-joined, because the trailing "and N more"
    // is already supplying the conjunction. joinNames would produce a second
    // one ("A, B and C and 5 more").
    const subjects = isRoundup
      ? [
          `${named.join(', ')} and ${rest} more, ranked. `,
          `${named.join(', ')} and ${rest} more. `,
        ]
      : [`${joinNames(named)} compared. `, `${joinNames(named)}. `];

    for (const traitCount of [4, 3, 2]) {
      const picked = traits.slice(0, traitCount);
      if (picked.length < Math.min(traitCount, traits.length)) continue;
      if (!picked.length) continue;

      const traitClauses = [
        `Where they differ most: ${joinNames(picked)}. `,
        `They split on ${joinNames(picked)}. `,
      ];

      const closers = [
        'Side-by-side trait scores and an honest verdict.',
        'Side-by-side trait scores, with the verdict.',
        'Trait scores side by side, plus the verdict.',
        'With side-by-side trait scores.',
        'Trait scores compared.',
      ];

      for (const s of subjects) {
        for (const t of traitClauses) {
          for (const c of closers) candidates.push({ text: `${s}${t}${c}`, rank: 0 });
        }
      }
    }
  }

  if (!candidates.length) {
    return (comparison.summary ?? `Comparing ${joinNames(breeds.map((b) => b.name))}.`).slice(0, DESC_MAX);
  }

  return pickBest(candidates);
}

// ─── Per-article overrides ────────────────────────────────────────────

/**
 * Hand-written SERP copy for articles worth tuning individually.
 *
 * Only the <title> and the description are overridden — the H1 keeps the
 * article's own title, and the body is untouched. That separation is the whole
 * point: a headline that reads well on the page ("Best Dog Breeds for Families
 * with Toddlers") and one that earns a click in a result list ("… (6 Ranked)")
 * are not always the same string.
 */
const COMPARISON_SEO_OVERRIDES: Record<string, { title?: string; description?: string }> = {
  'best-dog-breeds-for-families-with-toddlers': {
    title: 'Best Dog Breeds for Families with Toddlers (6 Ranked) | PawLabs',
    description:
      'Golden Retriever, Labrador and Collie rank top three on kid tolerance, ' +
      'low startle response and reliable recall. Six breeds ranked, with the drawbacks.',
  },
};

/** The <title> for a comparison. Falls back to the article H1 plus the brand. */
export function comparisonMetaTitle(comparison: Comparison): string {
  return COMPARISON_SEO_OVERRIDES[comparison.slug]?.title ?? `${comparison.title}${BRAND}`;
}

/** The description for a comparison, hand-written where one has been supplied. */
export function comparisonDescription(comparison: Comparison, breeds: Breed[]): string {
  return (
    COMPARISON_SEO_OVERRIDES[comparison.slug]?.description ??
    comparisonMetaDescription(comparison, breeds)
  );
}

// ─── Internal linking ─────────────────────────────────────────────────

/** Roundups about living with children, most specific topic first. */
const FAMILY_TOPIC_RANK: { pattern: RegExp; specificity: number }[] = [
  { pattern: /\btoddler/i, specificity: 3 },
  { pattern: /\b(child|children|kid|kids)\b/i, specificity: 2 },
  { pattern: /\bfamil/i, specificity: 1 },
];

export interface FamilyRoundupLink {
  slug: string;
  title: string;
  /** 1-based rank within the article, when it is a ranked roundup. */
  position: number | null;
  total: number;
}

/**
 * The best "good with children" roundup to link a breed profile to.
 *
 * Chosen by how specifically the article is about children — an article about
 * toddlers beats a general family-life ranking — then by how well the breed
 * places in it. Returns null when the breed appears in no such article, which
 * is the common case and must not produce a link.
 */
export function familyRoundupFor(
  breed: Breed,
  featuredIn: Comparison[],
): FamilyRoundupLink | null {
  const candidates = featuredIn
    .map((comparison) => {
      const topic = FAMILY_TOPIC_RANK.find((t) => t.pattern.test(comparison.title));
      if (!topic) return null;

      const linked = (comparison.breeds || []).filter((b) => typeof b !== 'string') as Breed[];
      const ranked = rankedBreedNames(comparison, linked);
      const index = ranked.indexOf(breed.name);

      return {
        slug: comparison.slug,
        title: comparison.title,
        position: index >= 0 ? index + 1 : null,
        total: ranked.length || linked.length,
        specificity: topic.specificity,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  if (!candidates.length) return null;

  candidates.sort(
    (a, b) =>
      b.specificity - a.specificity ||
      (a.position ?? 99) - (b.position ?? 99) ||
      a.slug.localeCompare(b.slug),
  );

  const { slug, title, position, total } = candidates[0];
  return { slug, title, position, total };
}
