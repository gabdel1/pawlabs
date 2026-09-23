/**
 * How much search interest each breed actually has.
 *
 * The comparison generator could write 20,100 head-to-heads from 201 breeds.
 * Almost none of them are searched for: nobody types "Sealyham Terrier vs Glen
 * of Imaal Terrier". Pages like that do not earn traffic, and a few dozen of
 * them sitting next to each other read as a content mill however well each one
 * is written. This module is what stops us writing them, and what marks the
 * ones already written as not worth indexing.
 *
 * The data lives in data/search-demand.json so that the generator (which runs
 * inside the CMS) and the site build read exactly the same numbers. Scores are
 * relative interest on a 0-100 scale, not impressions.
 *
 * The file currently ships a seed list: the breeds that appear in this site's
 * own Search Console queries, the breeds that reliably draw high search volume
 * anywhere, and the ones Google Images already sends us traffic for. Replace it
 * with real data whenever there is some — export Search Console queries to CSV
 * and run cms/src/scripts/import-search-demand.ts.
 */

import fs from 'node:fs';
import path from 'node:path';

interface DemandFile {
  version: number;
  updated: string;
  source: string;
  /** Score for any breed not listed. */
  default: number;
  breeds: Record<string, number>;
}

/** Runs from the repo root during an Astro build, and from cms/ in the CMS. */
const CANDIDATE_PATHS = [
  path.resolve(process.cwd(), 'data/search-demand.json'),
  path.resolve(process.cwd(), '../data/search-demand.json'),
];

let cached: DemandFile | null = null;

function load(): DemandFile {
  if (cached) return cached;
  for (const file of CANDIDATE_PATHS) {
    try {
      if (fs.existsSync(file)) {
        cached = JSON.parse(fs.readFileSync(file, 'utf-8')) as DemandFile;
        return cached;
      }
    } catch (e) {
      console.warn(`[search-demand] could not read ${file}:`, e);
    }
  }
  // Missing data must not silently prune the whole site, so fall back to a
  // value above every threshold: everything is kept and nothing is gated.
  console.warn('[search-demand] data/search-demand.json not found — treating all breeds as in demand');
  cached = { version: 0, updated: '', source: 'missing', default: 100, breeds: {} };
  return cached;
}

/** 0-100 relative search interest for one breed. */
export function demandFor(slug: string): number {
  const data = load();
  return data.breeds[slug] ?? data.default;
}

/**
 * Demand for an article about several breeds.
 *
 * Weighted towards the strongest breed rather than the average: "Golden
 * Retriever vs Barbet" is worth writing because people search Golden
 * Retriever, and the Barbet gets discovered through it. Two obscure breeds
 * together have nothing to ride on.
 */
export function demandForSet(slugs: string[]): number {
  if (!slugs.length) return 0;
  const scores = slugs.map(demandFor);
  const max = Math.max(...scores);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.round(max * 0.6 + mean * 0.4);
}

/**
 * Below this, a head-to-head is not worth writing or indexing.
 *
 * Set so a pairing needs more than one mid-tier breed carrying obscure
 * partners. Two default-score breeds land at 8; a mid-tier breed against two
 * obscure ones reaches 35; two mid-tier breeds make 45; anything involving a
 * breed people search heavily is 69+.
 */
export const MIN_PAIRING_DEMAND = 40;

/**
 * Roundups are judged differently: "best dogs for allergies" is a real query
 * whatever breeds end up on the list, so the lifestyle angle carries the page
 * and the breeds only need to not be uniformly obscure.
 */
export const MIN_ROUNDUP_DEMAND = 15;

export type ArticleShape = 'pairing' | 'roundup';

/**
 * Pairings name their breeds in the title and are cross-shopping articles;
 * roundups rank four or more breeds against a lifestyle question.
 */
export function shapeOf(breedCount: number, title: string): ArticleShape {
  if (breedCount >= 4) return 'roundup';
  return /\bvs\.?\b/i.test(title) || breedCount <= 3 ? 'pairing' : 'roundup';
}

export interface DemandVerdict {
  score: number;
  shape: ArticleShape;
  threshold: number;
  /** True when the article is below the bar for its shape. */
  lowDemand: boolean;
}

export function assessDemand(slugs: string[], title: string): DemandVerdict {
  const shape = shapeOf(slugs.length, title);
  const threshold = shape === 'pairing' ? MIN_PAIRING_DEMAND : MIN_ROUNDUP_DEMAND;
  const score = demandForSet(slugs);
  return { score, shape, threshold, lowDemand: score < threshold };
}

/** Provenance, for build logs and the admin. */
export function demandSource(): { source: string; updated: string; scored: number } {
  const data = load();
  return { source: data.source, updated: data.updated, scored: Object.keys(data.breeds).length };
}
