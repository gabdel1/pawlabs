/**
 * Payload CMS API client for fetching data.
 * Falls back to static seed data when CMS is not running.
 */

import { seedProducts, CATEGORY_LABELS_EXTENDED, SUBCATEGORY_LABELS } from '../data/products';
import type { SeedProduct } from '../data/products';

const PAYLOAD_API_URL = import.meta.env.PAYLOAD_API_URL || 'http://127.0.0.1:3000/api';

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

async function fetchAPI<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${PAYLOAD_API_URL}/${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Payload API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/** Fetch all products — falls back to seed data */
export async function getProducts(limit = 100): Promise<Product[]> {
  try {
    const data = await fetchAPI<PayloadResponse<Product>>('products', {
      limit: String(limit),
      depth: '1',
    });
    if (data.docs.length > 0) return data.docs;
  } catch {
    // CMS not running — use seed data
  }
  return seedProducts as Product[];
}

/** Fetch a single product by slug */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  try {
    const data = await fetchAPI<PayloadResponse<Product>>('products', {
      'where[slug][equals]': slug,
      depth: '1',
    });
    if (data.docs[0]) return data.docs[0];
  } catch {
    // fallback
  }
  return (seedProducts.find(p => p.slug === slug) as Product) ?? null;
}

/** Fetch a single product by ID */
export async function getProductById(id: string): Promise<Product | null> {
  try {
    const data = await fetchAPI<Product>(`products/${id}`, { depth: '1' });
    return data;
  } catch {
    return (seedProducts.find(p => p.id === id) as Product) ?? null;
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
  ...CATEGORY_LABELS_EXTENDED,
  // Legacy flat keys
  'smart-gadgets': 'Smart Gadgets',
  'toys': 'Toys',
  'food-treats': 'Food & Treats',
  'health-wellness': 'Health & Wellness',
  'grooming': 'Grooming',
  'beds-furniture': 'Beds & Furniture',
  'leashes-collars': 'Leashes & Collars',
  'travel': 'Travel',
  'other': 'Other',
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

/** Get media URL from a media field */
export function getMediaUrl(media: Media | string | undefined | null): string | null {
  if (!media) return null;
  if (typeof media === 'string') return null;
  return media.url ?? null;
}

/** Re-export for convenience */
export { SUBCATEGORY_LABELS, CATEGORY_LABELS_EXTENDED };
export type { SeedProduct };
