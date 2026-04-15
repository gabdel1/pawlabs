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

export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: any;
  shortDescription?: string;
  price?: number;
  affiliateUrl?: string;
  image?: Media | string;
  gallery?: { image: Media | string }[];
  category?: string;
  subcategory?: string;
  petType?: string;
  animalTypes?: string[];
  featured?: boolean;
  rating?: number;
  pros?: { point: string }[];
  cons?: { point: string }[];
  reviewBody?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  title: string;
  slug: string;
  product: Product | string;
  content?: any;
  summary?: string;
  overallRating?: number;
  ratingBreakdown?: {
    quality?: number;
    valueForMoney?: number;
    easeOfUse?: number;
    durability?: number;
  };
  verdict?: string;
  affiliateUrl?: string;
  featuredImage?: Media | string;
  author?: string;
  publishedDate?: string;
  status?: string;
  createdAt: string;
  updatedAt: string;
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

export interface Guide {
  id: string;
  title: string;
  slug: string;
  guideType?: string;
  summary?: string;
  content?: string;
  products?: (Product | string)[];
  category?: string;
  petType?: string;
  author?: string;
  featuredImage?: Media | string;
  publishedDate?: string;
  status?: string;
  createdAt: string;
  updatedAt: string;
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

/** Fetch all products from CMS */
export async function getProducts(limit = 100): Promise<Product[]> {
  try {
    const data = await fetchAPI<PayloadResponse<Product>>('products', {
      limit: String(limit),
      depth: '1',
    });
    return data.docs;
  } catch (e) {
    console.error('[payload] Failed to fetch products:', e);
    return [];
  }
}

/** Fetch a single product by slug */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  try {
    const data = await fetchAPI<PayloadResponse<Product>>('products', {
      'where[slug][equals]': slug,
      depth: '1',
    });
    return data.docs[0] ?? null;
  } catch (e) {
    console.error('[payload] Failed to fetch product by slug:', slug, e);
    return null;
  }
}

/** Fetch a single product by ID */
export async function getProductById(id: string): Promise<Product | null> {
  try {
    const data = await fetchAPI<Product>(`products/${id}`, { depth: '1' });
    return data;
  } catch (e) {
    console.error('[payload] Failed to fetch product by ID:', id, e);
    return null;
  }
}

/** Fetch reviews for a specific product */
export async function getReviewsForProduct(productId: string): Promise<Review[]> {
  try {
    const data = await fetchAPI<PayloadResponse<Review>>('reviews', {
      'where[product][equals]': productId,
      'where[status][equals]': 'published',
      depth: '1',
    });
    return data.docs;
  } catch {
    return [];
  }
}

/** Fetch all published reviews */
export async function getReviews(limit = 100): Promise<Review[]> {
  try {
    const data = await fetchAPI<PayloadResponse<Review>>('reviews', {
      'where[status][equals]': 'published',
      limit: String(limit),
      depth: '1',
    });
    return data.docs;
  } catch {
    return [];
  }
}

/** Category labels */
export const CATEGORY_LABELS: Record<string, string> = {
  'wellness': 'Wellness',
  'security': 'Security',
  'smart-gadgets': 'Smart Gadgets',
  'food-treats': 'Food & Treats',
  'grooming': 'Grooming',
  'beds-furniture': 'Beds & Furniture',
  'leashes-collars': 'Leashes & Collars',
  'travel': 'Travel',
  'toys': 'Toys',
  'health-wellness': 'Health & Wellness',
  'other': 'Other',
};

/** Subcategory labels */
export const SUBCATEGORY_LABELS: Record<string, Record<string, string>> = {
  'wellness': {
    'litter': 'Litter',
    'supplements': 'Supplements',
    'dental': 'Dental Care',
    'flea-tick': 'Flea & Tick',
  },
  'security': {
    'collars': 'Collars & Trackers',
    'cameras': 'Cameras',
    'gates': 'Gates & Barriers',
    'containment': 'Containment',
  },
  'smart-gadgets': {
    'feeders': 'Smart Feeders',
    'water': 'Water Fountains',
    'doors': 'Smart Doors',
    'toys': 'Interactive Toys',
  },
  'food-treats': {
    'dry-food': 'Dry Food',
    'wet-food': 'Wet Food',
    'treats': 'Treats',
    'supplements': 'Supplements',
  },
  'grooming': {
    'brushes': 'Brushes & Combs',
    'shampoo': 'Shampoos',
    'clippers': 'Clippers & Trimmers',
    'dryers': 'Dryers',
  },
};

/** Get subcategory label */
export function getSubcategoryLabel(category: string, subcategory: string): string | null {
  return SUBCATEGORY_LABELS[category]?.[subcategory] ?? null;
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

/** Verdict labels */
export const VERDICT_LABELS: Record<string, string> = {
  'highly-recommended': 'Highly Recommended',
  'recommended': 'Recommended',
  'average': 'Average',
  'not-recommended': 'Not Recommended',
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

/** Guide type labels */
export const GUIDE_TYPE_LABELS: Record<string, string> = {
  'ultimate-guide': 'Ultimate Guide',
  'essentials': 'Essentials Roundup',
  'roundup': 'Product Roundup',
  'comparison': 'Comparison Guide',
};

/** Fetch all published guides */
export async function getGuides(limit = 100): Promise<Guide[]> {
  try {
    const data = await fetchAPI<PayloadResponse<Guide>>('guides', {
      'where[status][equals]': 'published',
      limit: String(limit),
      depth: '2',
      sort: '-publishedDate',
    });
    return data.docs;
  } catch (e) {
    console.error('[payload] Failed to fetch guides:', e);
    return [];
  }
}

/** Fetch a single guide by slug */
export async function getGuideBySlug(slug: string): Promise<Guide | null> {
  try {
    const data = await fetchAPI<PayloadResponse<Guide>>('guides', {
      'where[slug][equals]': slug,
      depth: '2',
    });
    return data.docs[0] ?? null;
  } catch (e) {
    console.error('[payload] Failed to fetch guide by slug:', slug, e);
    return null;
  }
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

/** Fetch all published breeds */
export async function getBreeds(limit = 200): Promise<Breed[]> {
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
