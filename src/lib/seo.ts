/**
 * JSON-LD structured data generators for SEO.
 * Follows schema.org specifications for WebSite, Organization,
 * CollectionPage, BreadcrumbList, and Article.
 */

import type { Breed, Comparison, Media } from './payload';
import { getMediaUrl } from './payload';
import { CONTACT_EMAIL, EDITORIAL_TEAM } from './site';

const SITE_URL = 'https://pawlabs.org';
const SITE_NAME = 'PawLabs';
const SITE_DESCRIPTION = 'A dog breed encyclopedia — detailed profiles, temperament and care ratings, and head-to-head breed comparisons for every breed.';

/**
 * The organisation, referenced as publisher everywhere.
 * Kept in one place so the contact point and about page stay consistent.
 */
function organizationNode() {
  return {
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/favicon.png`,
    },
    email: CONTACT_EMAIL,
  };
}

/**
 * The editorial team, referenced as author on every article.
 * An Organization rather than a Person — the byline is a team, and claiming an
 * individual we cannot evidence would be worse than useless for E-E-A-T.
 */
function authorNode() {
  return {
    '@type': 'Organization',
    '@id': `${SITE_URL}/#editorial-team`,
    name: EDITORIAL_TEAM.name,
    url: EDITORIAL_TEAM.url,
    description: EDITORIAL_TEAM.bio,
    parentOrganization: { '@id': `${SITE_URL}/#organization` },
  };
}

/** Generate JSON-LD for the Organization (shows as Knowledge Panel in Google) */
export function organizationJsonLd(): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    ...organizationNode(),
    description: SITE_DESCRIPTION,
    foundingDate: '2026',
    sameAs: [],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: CONTACT_EMAIL,
        url: `${SITE_URL}/contact`,
        availableLanguage: ['en'],
      },
      {
        '@type': 'ContactPoint',
        contactType: 'editorial corrections',
        email: CONTACT_EMAIL,
        url: `${SITE_URL}/contact#corrections`,
      },
    ],
    publishingPrinciples: `${SITE_URL}/about#editorial-standards`,
    correctionsPolicy: `${SITE_URL}/about#corrections`,
  });
}

/** Generate JSON-LD for the About page */
export function aboutPageJsonLd(breedCount: number): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: `About ${SITE_NAME}`,
    url: `${SITE_URL}/about`,
    description: `Who writes PawLabs, how ${breedCount} breed profiles are researched, and the editorial standards behind them.`,
    publisher: organizationNode(),
    mainEntity: authorNode(),
  });
}

/** Generate JSON-LD for the Contact page */
export function contactPageJsonLd(): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: `Contact ${SITE_NAME}`,
    url: `${SITE_URL}/contact`,
    description: 'Corrections, general questions, privacy and data requests, press and partnership enquiries.',
    publisher: organizationNode(),
  });
}

/** Generate JSON-LD for a standing policy page */
export function policyPageJsonLd(name: string, path: string, description: string): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name,
    url: `${SITE_URL}${path}`,
    description,
    publisher: organizationNode(),
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
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

/** Generate JSON-LD for a single breed profile (Article + author/publisher) */
export function breedJsonLd(breed: Breed): string {
  const imageUrl = getMediaUrl(breed.image as Media);
  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${breed.name} Breed Profile`,
    description:
      breed.shortDescription ||
      `Complete ${breed.name} breed profile with traits, ratings, and expert analysis.`,
    url: `${SITE_URL}/breeds/${breed.slug}`,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/breeds/${breed.slug}`,
    },
    datePublished: breed.publishedDate || breed.createdAt,
    dateModified: breed.updatedAt,
    author: authorNode(),
    publisher: organizationNode(),
    about: {
      '@type': 'Thing',
      name: breed.name,
    },
  };

  if (imageUrl) {
    schema.image = imageUrl.startsWith('http') ? imageUrl : `${SITE_URL}${imageUrl}`;
  }

  return JSON.stringify(schema);
}

/**
 * Generate FAQPage JSON-LD from the same array the page renders visibly.
 *
 * Note on expectations: Google restricted FAQ *rich results* in August 2023 to
 * well-known authoritative government and health sites, so this will not draw
 * an expanded snippet for us. It is still worth emitting — it makes the page's
 * question/answer structure explicit for other consumers, including AI answer
 * surfaces — but the real win is the visible FAQ section itself.
 */
export function breedFaqJsonLd(faqs: { question: string; answer: string }[], breedSlug: string): string | null {
  if (faqs.length === 0) return null;
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${SITE_URL}/breeds/${breedSlug}#faq`,
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  });
}

/**
 * Generate FAQPage JSON-LD for a comparison article.
 *
 * Answers are verbatim extracts from the article, and the page renders the same
 * Q&A visibly — FAQ markup whose answers are not on the page is a Google
 * violation. Serialisation goes through JSON.stringify so quotes, apostrophes
 * and unicode in the extracted prose are escaped by the serialiser rather than
 * by hand.
 */
export function comparisonFaqJsonLd(
  faqs: { question: string; answer: string }[],
  slug: string,
): string | null {
  if (faqs.length === 0) return null;
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${SITE_URL}/compare/${slug}#faq`,
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
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
    author: authorNode(),
    publisher: organizationNode(),
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

/** Generate JSON-LD for the Breed Match quiz page */
export function quizJsonLd(questionCount: number, breedCount: number): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'PawLabs Breed Match Quiz',
    url: `${SITE_URL}/quiz`,
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript',
    description: `A ${questionCount}-question quiz that reads your home, household and weekly routine against ${breedCount} breed profiles and recommends the breeds that genuinely fit.`,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
  });
}

/**
 * JSON-LD for the photo breed identifier: the tool itself as a WebApplication,
 * with its FAQ as a FAQPage node in the same graph. The FAQ array is the one
 * the page renders, so the markup cannot drift from the visible answers.
 */
export function breedIdentifierJsonLd(
  breedCount: number,
  faqs: { question: string; answer: string }[],
): string {
  const url = `${SITE_URL}/what-breed-is-my-dog`;
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        '@id': `${url}#app`,
        name: 'What Breed Is My Dog? Photo Breed Identifier',
        url,
        applicationCategory: 'LifestyleApplication',
        operatingSystem: 'Any',
        browserRequirements: 'Requires JavaScript',
        description: `Upload a photo of a dog and see which of ${breedCount} breeds it most resembles, with lookalike breeds and links to each breed profile. Photos are not stored.`,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        publisher: organizationNode(),
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer },
        })),
      },
    ],
  });
}

/** Generate JSON-LD for a breadcrumb trail */
export function breadcrumbJsonLd(items: { name: string; url: string }[]): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`,
    })),
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
