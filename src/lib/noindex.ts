/**
 * Comparison slugs held back from search, computed by scripts/compute-noindex.ts
 * during prebuild.
 *
 * Read from the generated file rather than recomputed, so the page meta, the
 * sitemap and the /compare index can never disagree about which pages are
 * indexed — a page that says noindex while the sitemap submits it is a
 * contradiction Google reports as an error.
 */

import fs from 'node:fs';
import path from 'node:path';

let cached: Set<string> | null = null;

/** Slugs of comparisons that should not be indexed or listed. */
export function noindexedComparisons(): Set<string> {
  if (cached) return cached;
  const file = path.resolve(process.cwd(), 'data/noindex-comparisons.json');
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8')) as { slugs?: string[] };
    cached = new Set(data.slugs ?? []);
  } catch {
    // Absent on a fresh checkout before the first prebuild. Indexing everything
    // is the safe default: it is the behaviour we had before this existed.
    cached = new Set();
  }
  return cached;
}

export function isNoindexed(slug: string): boolean {
  return noindexedComparisons().has(slug);
}
