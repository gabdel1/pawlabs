/**
 * Comparison articles taken out of circulation.
 *
 * These are the combinatorial and obscure pages flagged in review: six
 * near-identical "X vs Y vs Airedale Terrier" articles, three more built the
 * same way around the American Eskimo Dog, and a tail of pairings between
 * breeds almost nobody searches for. Individually each one reads fine. Sampled
 * together they read as generated-for-search, which is exactly what Google's
 * scaled-content policy is aimed at — and what an ads reviewer sees.
 *
 * They are not deleted. The documents stay published in the CMS, but the site
 * stops building a page for them and nginx sends each URL to the ranking that
 * covers the same breeds, so nothing 404s and no inbound link dies.
 *
 * The list is curated by hand in data/retired-comparisons.json, because which
 * pages look mass-produced is an editorial judgement. The automated demand
 * floor in search-demand.ts is what stops new ones being written.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface RetiredComparison {
  slug: string;
  title: string;
  /** Path to send visitors to, e.g. /compare/terrier-breeds-ranked-for-family-life */
  redirectTo: string | null;
  why: string;
}

let cached: RetiredComparison[] | null = null;

function load(): RetiredComparison[] {
  if (cached) return cached;
  try {
    const file = path.resolve(process.cwd(), 'data/retired-comparisons.json');
    cached = (JSON.parse(fs.readFileSync(file, 'utf-8')).retired ?? []) as RetiredComparison[];
  } catch {
    cached = [];
  }
  return cached;
}

export function retiredComparisons(): RetiredComparison[] {
  return load();
}

let slugSet: Set<string> | null = null;

/** True when this comparison should not be built, listed or linked. */
export function isRetired(slug: string): boolean {
  if (!slugSet) slugSet = new Set(load().map((r) => r.slug));
  return slugSet.has(slug);
}

/** Drop retired entries from any list of comparisons. */
export function withoutRetired<T extends { slug: string }>(items: T[]): T[] {
  return items.filter((item) => !isRetired(item.slug));
}
