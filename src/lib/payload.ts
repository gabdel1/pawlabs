/**
 * Payload CMS API client for fetching data.
 * Only fetches from the CMS database — no placeholder/fallback data.
 */

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

/** Get media URL from a media field */
export function getMediaUrl(media: Media | string | undefined | null): string | null {
  if (!media) return null;
  if (typeof media === 'string') return null;
  return media.url ?? null;
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
