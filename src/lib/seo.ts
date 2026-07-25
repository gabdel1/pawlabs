/**
 * JSON-LD structured data generators for SEO.
 * Follows schema.org specifications for WebSite, Organization,
 * CollectionPage, BreadcrumbList, and Article.
 */

import type { Breed, Comparison, Media } from './payload';
import { getMediaUrl } from './payload';

const SITE_URL = 'https://pawlabs.org';
const SITE_NAME = 'PawLabs';
const SITE_DESCRIPTION = 'A dog breed encyclopedia — detailed profiles, temperament and care ratings, and head-to-head breed comparisons for every breed.';

/** Generate JSON-LD for the Organization (shows as Knowledge Panel in Google) */
export function organizationJsonLd(): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.png`,
    description: SITE_DESCRIPTION,
    foundingDate: '2026',
    sameAs: [],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      url: `${SITE_URL}`,
    },
  });
}

/** Generate JSON-LD for the website (used on homepage) */
export function websiteJsonLd(): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/favicon.png`,
      },
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/breeds?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  });
}

/** Generate JSON-LD for the breed index (CollectionPage) */
export function breedsListJsonLd(breeds: Breed[]): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Dog Breed Encyclopedia - PawLabs',
    description: 'Browse every dog breed profile — temperament, size, grooming, energy and trainability ratings.',
    url: `${SITE_URL}/breeds`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: breeds.length,
      itemListElement: breeds.map((b, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE_URL}/breeds/${b.slug}`,
        name: b.name,
      })),
    },
  });
}

/** Generate JSON-LD for a breed comparison article */
export function comparisonJsonLd(comparison: Comparison, breeds: Breed[]): string {
  const imageUrl = getMediaUrl(comparison.featuredImage as Media);
  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: comparison.title,
    description: comparison.summary || `Head-to-head comparison of ${breeds.map(b => b.name).join(' and ')}.`,
    url: `${SITE_URL}/compare/${comparison.slug}`,
    datePublished: comparison.publishedDate || comparison.createdAt,
    dateModified: comparison.updatedAt,
    author: {
      '@type': 'Organization',
      name: comparison.author || SITE_NAME,
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/favicon.png`,
      },
    },
    about: breeds.map(b => ({
      '@type': 'Thing',
      name: b.name,
      url: `${SITE_URL}/breeds/${b.slug}`,
    })),
  };

  if (imageUrl) {
    schema.image = imageUrl.startsWith('http') ? imageUrl : `${SITE_URL}${imageUrl}`;
  }

  return JSON.stringify(schema);
}

/** Generate JSON-LD for the comparison index (CollectionPage) */
export function comparisonsListJsonLd(comparisons: Comparison[]): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Dog Breed Comparisons - PawLabs',
    description: 'Head-to-head dog breed comparisons to help you find the breed that fits your life.',
    url: `${SITE_URL}/compare`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: comparisons.length,
      itemListElement: comparisons.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE_URL}/compare/${c.slug}`,
        name: c.title,
      })),
    },
  });
}

// ─── Helpers ──────────────────────────────────────────

/** Generate OpenGraph meta tag data */
export interface OGData {
  title: string;
  description: string;
  url: string;
  image?: string | null;
  type?: 'website' | 'article';
}

export function buildOGData(data: Partial<OGData> & { title: string }): OGData {
  return {
    title: data.title,
    description: data.description || SITE_DESCRIPTION,
    url: data.url || SITE_URL,
    image: data.image || null,
    type: data.type || 'website',
  };
}

export { SITE_URL, SITE_NAME, SITE_DESCRIPTION };
