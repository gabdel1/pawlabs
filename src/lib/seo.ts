/**
 * JSON-LD structured data generators for SEO.
 * Follows schema.org specifications for Product, Review, and WebSite.
 */

import type { Product, Review, Media } from './payload';
import { getMediaUrl, CATEGORY_LABELS, VERDICT_LABELS } from './payload';

const SITE_URL = 'https://pawlabs.org';
const SITE_NAME = 'PawLabs';

/** Generate JSON-LD for a Product page */
export function productJsonLd(product: Product): string {
  const imageUrl = getMediaUrl(product.image as Media);
  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    url: `${SITE_URL}/products/${product.slug}`,
    description: product.shortDescription || `${product.name} - pet product review`,
  };

  if (imageUrl) {
    schema.image = imageUrl.startsWith('http') ? imageUrl : `${SITE_URL}${imageUrl}`;
  }

  if (product.category) {
    schema.category = CATEGORY_LABELS[product.category] ?? product.category;
  }

  if (product.rating != null) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: product.rating,
      bestRating: 5,
      worstRating: 0,
      ratingCount: 1,
    };
  }

  if (product.price != null) {
    schema.offers = {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: product.affiliateUrl || `${SITE_URL}/products/${product.slug}`,
    };
  }

  if (product.pros?.length) {
    schema.positiveNotes = {
      '@type': 'ItemList',
      itemListElement: product.pros.map((pro, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: pro.point,
      })),
    };
  }

  if (product.cons?.length) {
    schema.negativeNotes = {
      '@type': 'ItemList',
      itemListElement: product.cons.map((con, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: con.point,
      })),
    };
  }

  return JSON.stringify(schema);
}

/** Generate JSON-LD for a Review */
export function reviewJsonLd(review: Review, product: Product): string {
  const imageUrl = getMediaUrl(review.featuredImage as Media);
  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Review',
    name: review.title,
    reviewBody: review.summary || '',
    datePublished: review.publishedDate || review.createdAt,
    itemReviewed: {
      '@type': 'Product',
      name: product.name,
      url: `${SITE_URL}/products/${product.slug}`,
    },
  };

  if (imageUrl) {
    schema.image = imageUrl.startsWith('http') ? imageUrl : `${SITE_URL}${imageUrl}`;
  }

  if (review.author) {
    schema.author = {
      '@type': 'Person',
      name: review.author,
    };
  }

  if (review.overallRating != null) {
    schema.reviewRating = {
      '@type': 'Rating',
      ratingValue: review.overallRating,
      bestRating: 5,
      worstRating: 0,
    };
  }

  return JSON.stringify(schema);
}

/** Generate JSON-LD for a comparison page */
export function comparisonJsonLd(product1: Product, product2: Product): string {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${product1.name} vs ${product2.name} - Comparison`,
    description: `Head-to-head comparison of ${product1.name} and ${product2.name}. Compare price, rating, features, pros and cons.`,
    url: `${SITE_URL}/compare/${product1.slug}-vs-${product2.slug}`,
    mainEntity: [
      { '@type': 'Product', name: product1.name, url: `${SITE_URL}/products/${product1.slug}` },
      { '@type': 'Product', name: product2.name, url: `${SITE_URL}/products/${product2.slug}` },
    ],
  };
  return JSON.stringify(schema);
}

/** Generate JSON-LD for the website (used on homepage) */
export function websiteJsonLd(): string {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    description: 'Expert pet product reviews and recommendations. Compare smart gadgets, toys, health products, and more for your pets.',
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
  return JSON.stringify(schema);
}

/** Generate OpenGraph meta tag data */
export interface OGData {
  title: string;
  description: string;
  url: string;
  image?: string | null;
  type?: 'website' | 'article' | 'product';
}

export function buildOGData(data: Partial<OGData> & { title: string }): OGData {
  return {
    title: data.title,
    description: data.description || 'Expert pet product reviews and recommendations at PawLabs.',
    url: data.url || SITE_URL,
    image: data.image || null,
    type: data.type || 'website',
  };
}

export { SITE_URL, SITE_NAME };
