/**
 * Payload CMS API client for fetching data.
 * Includes a file-based cache so `astro build` can succeed even when the CMS is down.
 * On successful fetch, data is cached to .cache/payload/.
 * On fetch failure, cached data is returned as fallback.
 */

import fs from 'node:fs';
import path from 'node:path';

const PAYLOAD_API_URL = import.meta.env.PAYLOAD_API_URL || 'http://127.0.0.1:3000/api';
const CACHE_DIR = path.resolve(process.cwd(), '.cache', 'payload');

export interface PayloadResponse<T> {
  docs: T[];
  totalDocs: number;
  limit: number;
  totalPages: number;
  page: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
}

export interface Media {
  id: string;
  alt: string;
  url: string;
  filename: string;
  mimeType: string;
  filesize: number;
  width?: number;
  height?: number;
}

export interface Breed {
  id: string;
  name: string;
  slug: string;
  petType?: string;
  status?: string;
  featured?: boolean;
  image?: Media | string;
  shortDescription?: string;
  breedGroup?: string;
  breedRole?: string;
  size?: string;
  heightMin?: number;
  heightMax?: number;
  weightMin?: number;
  weightMax?: number;
  lifeExpectancyMin?: number;
  lifeExpectancyMax?: number;
  coatType?: string;
  coatLength?: string;
  colors?: { color: string }[];
  origin?: string;
  temperament?: { trait: string }[];
  strengths?: { point: string }[];
  weaknesses?: { point: string }[];
  traits?: {
    affectionLevel?: number;
    childFriendly?: number;
    petFriendly?: number;
    strangerFriendly?: number;
    trainability?: number;
    energyLevel?: number;
    groomingNeeds?: number;
    sheddingLevel?: number;
    barkingLevel?: number;
    intelligence?: number;
    playfulness?: number;
    watchdogAbility?: number;
    adaptability?: number;
    healthRobustness?: number;
  };
  breedHistory?: string;
  article?: string;
  author?: string;
  publishedDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Comparison {
  id: string;
  title: string;
  slug: string;
  summary?: string;
  content?: string;
  breeds?: (Breed | string)[];
  comparisonCriteria?: { criterion: string }[];
  verdict?: string;
  author?: string;
  featuredImage?: Media | string;
  publishedDate?: string;
  status?: string;
  createdAt: string;
  updatedAt: string;
}

function getCacheKey(endpoint: string, params?: Record<string, string>): string {
  const paramStr = params ? JSON.stringify(params, Object.keys(params).sort()) : '';
  // Create a safe filename from endpoint + params
  const raw = `${endpoint}__${paramStr}`;
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 200);
}

function readCache<T>(key: string): T | null {
  try {
    const filePath = path.join(CACHE_DIR, `${key}.json`);
    if (!fs.existsSync(filePath)) return null;
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const filePath = path.join(CACHE_DIR, `${key}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data));
  } catch (e) {
    console.warn('[payload] Failed to write cache:', e);
  }
}

async function fetchAPI<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${PAYLOAD_API_URL}/${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  }

  const cacheKey = getCacheKey(endpoint, params);

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      throw new Error(`Payload API error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json() as T;
    // Cache successful responses
    writeCache(cacheKey, data);
    return data;
  } catch (e) {
    // Try fallback to cache
    const cached = readCache<T>(cacheKey);
    if (cached) {
      console.warn(`[payload] API unavailable for ${endpoint}, using cached data`);
      return cached;
    }
    throw e;
  }
}

/** Pet type labels */
export const PET_TYPE_LABELS: Record<string, string> = {
  'dog': 'Dog',
  'cat': 'Cat',
  'bird': 'Bird',
  'fish': 'Fish',
  'small-animal': 'Small Animal',
  'reptile': 'Reptile',
  'universal': 'Universal',
};

/**
 * Get media URL from a media field.
 * Rewrites CMS API URLs to local /media/<filename> paths so images
 * are served as static assets and don't depend on the CMS being live.
 */
export function getMediaUrl(media: Media | string | undefined | null): string | null {
  if (!media) return null;
  if (typeof media === 'string') return null;
  const url = media.url;
  if (!url) return null;
  // Rewrite CMS API URLs to local static paths
  // Payload URLs look like: /api/media/file/<filename> or full http://host/api/media/file/<filename>
  const filename = media.filename || url.split('/').pop();
  if (filename) {
    return `/media/${filename}`;
  }
  return url;
}

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

/** Size labels */
export const SIZE_LABELS: Record<string, string> = {
  'small': 'Small',
  'medium': 'Medium',
  'large': 'Large',
  'giant': 'Giant',
};

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

/** Labels for the derived comparison criteria used by the comparison table */
export const CRITERION_LABELS: Record<string, string> = {
  'lowShedding': 'Low Shedding',
  'apartmentFriendly': 'Apartment Friendly',
  'watchdogAbility': 'Watchdog Ability',
  'energyLevel': 'Energy Level',
  'trainability': 'Trainability',
  'childFriendly': 'Child Friendly',
  'petFriendly': 'Pet Friendly',
  'easyGrooming': 'Easy Grooming',
  'barkingControl': 'Barking Control',
  'adaptability': 'Adaptability',
  'intelligence': 'Intelligence',
  'healthRobustness': 'Health Robustness',
};

/** Fetch all published breeds */
export async function getBreeds(limit = 300): Promise<Breed[]> {
  try {
    const data = await fetchAPI<PayloadResponse<Breed>>('breeds', {
      'where[status][equals]': 'published',
      limit: String(limit),
      depth: '1',
      sort: 'name',
    });
    return data.docs;
  } catch (e) {
    console.error('[payload] Failed to fetch breeds:', e);
    return [];
  }
}

/** Fetch a single breed by slug */
export async function getBreedBySlug(slug: string): Promise<Breed | null> {
  try {
    const data = await fetchAPI<PayloadResponse<Breed>>('breeds', {
      'where[slug][equals]': slug,
      depth: '1',
    });
    return data.docs[0] ?? null;
  } catch (e) {
    console.error('[payload] Failed to fetch breed by slug:', slug, e);
    return null;
  }
}

/** Fetch all published breed comparisons */
export async function getComparisons(limit = 100): Promise<Comparison[]> {
  try {
    const data = await fetchAPI<PayloadResponse<Comparison>>('comparisons', {
      'where[status][equals]': 'published',
      limit: String(limit),
      depth: '2',
      sort: '-publishedDate',
    });
    return data.docs;
  } catch (e) {
    console.error('[payload] Failed to fetch comparisons:', e);
    return [];
  }
}

/** Fetch a single breed comparison by slug */
export async function getComparisonBySlug(slug: string): Promise<Comparison | null> {
  try {
    const data = await fetchAPI<PayloadResponse<Comparison>>('comparisons', {
      'where[slug][equals]': slug,
      depth: '2',
    });
    return data.docs[0] ?? null;
  } catch (e) {
    console.error('[payload] Failed to fetch comparison by slug:', slug, e);
    return null;
  }
}
